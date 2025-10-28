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
  }).select('name keywords patterns classificationStrategy').lean()
  
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
 * Phase 1: Fast rule-based email classification
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
    
    // Priority 1: Sender domain matching (highest confidence)
    for (const category of categories) {
      const domainMatch = matchSenderDomain(from, category)
      if (domainMatch) {
        console.log(`✅ Phase 1: Sender domain match - "${subject}" → ${domainMatch.category} (${domainMatch.confidence})`)
        return {
          label: domainMatch.category,
          confidence: domainMatch.confidence,
          method: 'phase1-sender-domain',
          phase: 1,
          matchedPattern: domainMatch.matchedPattern,
          matchedValue: domainMatch.matchedValue
        }
      }
    }
    
    // Priority 2: Sender name matching
    for (const category of categories) {
      const nameMatch = matchSenderName(from, category)
      if (nameMatch) {
        console.log(`✅ Phase 1: Sender name match - "${subject}" → ${nameMatch.category} (${nameMatch.confidence})`)
        return {
          label: nameMatch.category,
          confidence: nameMatch.confidence,
          method: 'phase1-sender-name',
          phase: 1,
          matchedPattern: nameMatch.matchedPattern,
          matchedValue: nameMatch.matchedValue
        }
      }
    }
    
    // Priority 3: Keyword matching (lower confidence)
    const keywordMatches = []
    for (const category of categories) {
      const keywordMatch = matchKeywords(subject, snippet, category)
      if (keywordMatch) {
        keywordMatches.push(keywordMatch)
      }
    }
    
    // Use best keyword match
    if (keywordMatches.length > 0) {
      const bestMatch = keywordMatches.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      )
      
      console.log(`✅ Phase 1: Keyword match - "${subject}" → ${bestMatch.category} (${bestMatch.confidence})`)
      return {
        label: bestMatch.category,
        confidence: bestMatch.confidence,
        method: 'phase1-keyword',
        phase: 1,
        matchedKeywords: bestMatch.matchedKeywords,
        keywordScore: bestMatch.keywordScore
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

