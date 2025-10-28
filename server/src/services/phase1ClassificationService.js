// Phase 1: Fast rule-based email classification using sender patterns and keywords
import Category from '../models/Category.js'
import { CLASSIFICATION_CONFIG } from '../config/classification.js'
import {
  extractSenderDomain,
  extractSenderName,
  matchesDomainPattern,
  matchesNamePattern,
  countKeywordMatches,
  calculateConfidence
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
 * Match email against category keywords
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
  const matches = countKeywordMatches(text, category.keywords)
  
  if (matches.count > 0) {
    const confidence = calculateConfidence(
      matches,
      CLASSIFICATION_CONFIG.phase1.keywordConfidence
    )
    
    return {
      category: category.name,
      confidence,
      method: 'keyword',
      matchedKeywords: matches.matchedKeywords,
      keywordScore: matches.score
    }
  }
  
  return null
}

/**
 * Check category for any match (domain, name, or keyword)
 * @param {Object} email - Email data
 * @param {Object} category - Category to check
 * @returns {Object|null} - Best match or null
 */
const checkCategoryMatch = (email, category) => {
  const { subject = '', from = '', snippet = '' } = email
  const matches = []
  
  // Check sender domain
  const domainMatch = matchSenderDomain(from, category)
  if (domainMatch) {
    matches.push(domainMatch)
  }
  
  // Check sender name
  const nameMatch = matchSenderName(from, category)
  if (nameMatch) {
    matches.push(nameMatch)
  }
  
  // Check keywords
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


