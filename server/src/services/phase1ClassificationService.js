// Phase 1: Fast rule-based email classification using sender patterns and keywords
import Category from '../models/Category.js'
import { CLASSIFICATION_CONFIG } from '../config/classification.js'
import {
  extractSenderDomain,
  extractSenderName,
  matchesDomainPattern,
  matchesNamePattern,
  countKeywordMatches,
  calculateConfidence,
  matchPhrases,
  matchSpecificSender,
  extractProfessorTitle
} from '../utils/senderPatternMatcher.js'

// Cache for user categories to reduce database queries
const categoryCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get categories for user from cache or database
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - User categories
 */
const getCategoriesForUser = async (userId) => {
  const cacheKey = `categories_${userId}`
  const cached = categoryCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  
  const categories = await Category.find({ 
    userId, 
    isActive: true 
  }).select('name keywords patterns classificationStrategy priority').lean()
  
  categoryCache.set(cacheKey, {
    data: categories,
    timestamp: Date.now()
  })
  
  return categories
}

/**
 * Clear category cache for a user
 * @param {string} userId - User ID
 */
export const clearCategoryCache = (userId) => {
  if (userId) {
    categoryCache.delete(`categories_${userId}`)
  } else {
    categoryCache.clear()
  }
}

/**
 * Match email against category sender domain patterns
 * @param {string} from - Email sender
 * @param {Object} category - Category with patterns
 * @returns {Object|null} - Match result or null
 */
const matchSenderDomain = (from, category) => {
  if (!category.patterns || !category.patterns.senderDomains) {
    return null
  }
  
  const domain = extractSenderDomain(from)
  if (!domain) return null
  
  for (const pattern of category.patterns.senderDomains) {
    if (matchesDomainPattern(domain, pattern)) {
      return {
        category: category.name,
        confidence: CLASSIFICATION_CONFIG.phase1.senderDomainConfidence,
        method: 'sender-domain',
        matchedPattern: pattern,
        matchedValue: domain
      }
    }
  }
  
  return null
}

/**
 * Match email against category sender name patterns
 * @param {string} from - Email sender
 * @param {Object} category - Category with patterns
 * @returns {Object|null} - Match result or null
 */
const matchSenderName = (from, category) => {
  if (!category.patterns || !category.patterns.senderNames) {
    return null
  }
  
  const name = extractSenderName(from)
  if (!name) return null
  
  for (const pattern of category.patterns.senderNames) {
    if (matchesNamePattern(name, pattern)) {
      return {
        category: category.name,
        confidence: CLASSIFICATION_CONFIG.phase1.senderNameConfidence,
        method: 'sender-name',
        matchedPattern: pattern,
        matchedValue: name
      }
    }
  }
  
  return null
}

/**
 * Match email against category keywords and phrases
 * @param {string} subject - Email subject
 * @param {string} snippet - Email snippet/preview
 * @param {Object} category - Category with keywords
 * @returns {Object|null} - Match result or null
 */
const matchKeywords = (subject, snippet, category) => {
  if (!category.keywords || category.keywords.length === 0) {
    return null
  }
  
  // Combine subject and snippet for keyword matching
  const text = `${subject} ${snippet}`
  const keywordMatches = countKeywordMatches(text, category.keywords)
  
  // Also check for phrase matches if classificationStrategy exists
  let phraseMatches = { count: 0, matchedPhrases: [], score: 0 }
  if (category.classificationStrategy?.bodyAnalysis?.phrases) {
    phraseMatches = matchPhrases(text, category.classificationStrategy.bodyAnalysis.phrases)
  }
  
  const totalMatches = keywordMatches.count + phraseMatches.count
  const totalScore = keywordMatches.score + phraseMatches.score
  
  if (totalMatches > 0) {
    const combinedMatches = {
      count: totalMatches,
      score: totalScore
    }
    
    const confidence = calculateConfidence(
      combinedMatches,
      CLASSIFICATION_CONFIG.phase1.keywordConfidence
    )
    
    return {
      category: category.name,
      confidence,
      method: phraseMatches.count > 0 ? 'keyword+phrase' : 'keyword',
      matchedKeywords: keywordMatches.matchedKeywords,
      matchedPhrases: phraseMatches.matchedPhrases,
      keywordScore: totalScore
    }
  }
  
  return null
}

/**
 * Check category for any match (domain, name, keyword, phrase, or specific sender)
 * @param {Object} email - Email data
 * @param {Object} category - Category to check
 * @returns {Object|null} - Best match or null
 */
const checkCategoryMatch = (email, category) => {
  const { subject = '', from = '', snippet = '' } = email
  const matches = []
  
  // Priority 1: Check for specific sender patterns (HOD, E-Zone, NPTEL, Professor, etc.)
  const specificSenderMatch = matchSpecificSender(from, category.name)
  if (specificSenderMatch && specificSenderMatch.matched) {
    matches.push({
      category: category.name,
      confidence: specificSenderMatch.confidence,
      method: 'specific-sender',
      matchedPattern: specificSenderMatch.pattern,
      matchedValue: from,
      professorTitle: specificSenderMatch.title
    })
  }
  
  // Priority 2: Check sender domain
  const domainMatch = matchSenderDomain(from, category)
  if (domainMatch) {
    matches.push(domainMatch)
  }
  
  // Priority 3: Check sender name
  const nameMatch = matchSenderName(from, category)
  if (nameMatch) {
    matches.push(nameMatch)
  }
  
  // Priority 4: Check keywords and phrases
  const keywordMatch = matchKeywords(subject, snippet, category)
  if (keywordMatch) {
    matches.push(keywordMatch)
  }
  
  // Return best match (highest confidence)
  if (matches.length > 0) {
    return matches.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )
  }
  
  return null
}

/**
 * Phase 1: Fast rule-based email classification with priority-based matching
 * @param {Object} email - Email data {subject, from, snippet, body}
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Classification result
 */
export const classifyEmailPhase1 = async (email, userId) => {
  const { subject = '', from = '', snippet = '', body = '' } = email
  
  try {
    // Get user categories
    const categories = await getCategoriesForUser(userId)
    
    if (categories.length === 0) {
      console.log('⚠️ Phase 1: No categories found for user, using default')
      return {
        label: CLASSIFICATION_CONFIG.phase1.fallbackCategory,
        confidence: CLASSIFICATION_CONFIG.phase1.defaultConfidence,
        method: 'phase1-default',
        phase: 1,
        matchedPatterns: []
      }
    }
    
    // Separate categories by priority
    const highPriorityCategories = categories.filter(cat => cat.priority === 'high')
    const normalPriorityCategories = categories.filter(cat => !cat.priority || cat.priority === 'normal')
    const lowPriorityCategories = categories.filter(cat => cat.priority === 'low')
    
    // Priority Level 1: Check high-priority categories (Promotions, Placement, NPTEL, etc.)
    for (const category of highPriorityCategories) {
      const match = checkCategoryMatch(email, category)
      if (match && match.confidence >= 0.75) {
        console.log(`✅ Phase 1 [HIGH]: Match - "${subject}" → ${match.category} (${match.confidence}) via ${match.method}`)
        return {
          label: match.category,
          confidence: match.confidence,
          method: `phase1-${match.method}`,
          phase: 1,
          matchedPattern: match.matchedPattern,
          matchedValue: match.matchedValue,
          matchedKeywords: match.matchedKeywords,
          keywordScore: match.keywordScore,
          priorityLevel: 'high'
        }
      }
    }
    
    // Priority Level 2: Check normal-priority categories
    for (const category of normalPriorityCategories) {
      const match = checkCategoryMatch(email, category)
      if (match) {
        console.log(`✅ Phase 1 [NORMAL]: Match - "${subject}" → ${match.category} (${match.confidence}) via ${match.method}`)
        return {
          label: match.category,
          confidence: match.confidence,
          method: `phase1-${match.method}`,
          phase: 1,
          matchedPattern: match.matchedPattern,
          matchedValue: match.matchedValue,
          matchedKeywords: match.matchedKeywords,
          keywordScore: match.keywordScore,
          priorityLevel: 'normal'
        }
      }
    }
    
    // Priority Level 3: Check low-priority categories (HOD)
    for (const category of lowPriorityCategories) {
      const match = checkCategoryMatch(email, category)
      if (match) {
        console.log(`✅ Phase 1 [LOW]: Match - "${subject}" → ${match.category} (${match.confidence}) via ${match.method}`)
        return {
          label: match.category,
          confidence: match.confidence,
          method: `phase1-${match.method}`,
          phase: 1,
          matchedPattern: match.matchedPattern,
          matchedValue: match.matchedValue,
          matchedKeywords: match.matchedKeywords,
          keywordScore: match.keywordScore,
          priorityLevel: 'low'
        }
      }
    }
    
    // No matches found - use fallback
    console.log(`⚠️ Phase 1: No matches - "${subject}" → ${CLASSIFICATION_CONFIG.phase1.fallbackCategory} (${CLASSIFICATION_CONFIG.phase1.defaultConfidence})`)
    return {
      label: CLASSIFICATION_CONFIG.phase1.fallbackCategory,
      confidence: CLASSIFICATION_CONFIG.phase1.defaultConfidence,
      method: 'phase1-default',
      phase: 1,
      matchedPatterns: []
    }
    
  } catch (error) {
    console.error('❌ Phase 1 classification error:', error)
    // Return fallback on error
    return {
      label: CLASSIFICATION_CONFIG.phase1.fallbackCategory,
      confidence: CLASSIFICATION_CONFIG.phase1.defaultConfidence,
      method: 'phase1-error',
      phase: 1,
      error: error.message
    }
  }
}

export default classifyEmailPhase1


