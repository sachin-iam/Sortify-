// Utility functions for matching sender patterns

/**
 * Extract email domain from sender string
 * @param {string} from - Email sender (e.g., "Name <email@domain.com>" or "email@domain.com")
 * @returns {string|null} - Domain or null if not found
 */
export const extractSenderDomain = (from) => {
  if (!from) return null
  
  // Extract email from "Name <email@domain.com>" format
  const emailMatch = from.match(/<(.+?)>/)
  const email = emailMatch ? emailMatch[1] : from
  
  // Extract domain from email
  const domainMatch = email.match(/@(.+)$/)
  return domainMatch ? domainMatch[1].trim() : null
}

/**
 * Extract sender name from sender string
 * @param {string} from - Email sender
 * @returns {string|null} - Sender name or null
 */
export const extractSenderName = (from) => {
  if (!from) return null
  
  // Extract name from "Name <email@domain.com>" format
  const nameMatch = from.match(/^([^<]+)</)
  if (nameMatch) {
    return nameMatch[1].trim()
  }
  
  // If no angle brackets, return everything before @ symbol
  const beforeAt = from.split('@')[0]
  return beforeAt.trim()
}

/**
 * Check if sender domain matches pattern
 * @param {string} domain - Sender domain
 * @param {string} pattern - Domain pattern (can include wildcards)
 * @returns {boolean} - True if matches
 */
export const matchesDomainPattern = (domain, pattern) => {
  if (!domain || !pattern) return false
  
  // Exact match
  if (domain.toLowerCase() === pattern.toLowerCase()) {
    return true
  }
  
  // Wildcard pattern (e.g., "*.sharda.ac.in")
  if (pattern.includes('*')) {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
    const regex = new RegExp(`^${regexPattern}$`, 'i')
    return regex.test(domain)
  }
  
  return false
}

/**
 * Check if sender name matches pattern
 * @param {string} name - Sender name
 * @param {string} pattern - Name pattern (can be regex-like)
 * @returns {boolean} - True if matches
 */
export const matchesNamePattern = (name, pattern) => {
  if (!name || !pattern) return false
  
  // Case-insensitive contains check
  return name.toLowerCase().includes(pattern.toLowerCase())
}

/**
 * Count keyword matches in text
 * @param {string} text - Text to search
 * @param {Array<string>} keywords - Keywords to find
 * @returns {Object} - {count, matchedKeywords, score}
 */
export const countKeywordMatches = (text, keywords) => {
  if (!text || !keywords || keywords.length === 0) {
    return { count: 0, matchedKeywords: [], score: 0 }
  }
  
  const lowerText = text.toLowerCase()
  const matchedKeywords = []
  let totalScore = 0
  
  keywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase()
    
    // Word boundary regex for better matching
    const regex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const matches = lowerText.match(regex)
    
    if (matches && matches.length > 0) {
      matchedKeywords.push(keyword)
      
      // Score based on number of matches and keyword length
      const keywordScore = matches.length * (keyword.length > 5 ? 1.5 : 1)
      totalScore += keywordScore
    }
  })
  
  return {
    count: matchedKeywords.length,
    matchedKeywords,
    score: totalScore
  }
}

/**
 * Calculate confidence based on matches
 * @param {Object} matches - Match results
 * @param {number} baseConfidence - Base confidence level
 * @returns {number} - Confidence score (0-1)
 */
export const calculateConfidence = (matches, baseConfidence) => {
  let confidence = baseConfidence
  
  // Boost confidence based on number of keyword matches
  if (matches.score > 0) {
    const boost = Math.min(matches.score * 0.02, 0.15) // Max 15% boost
    confidence = Math.min(confidence + boost, 0.95)
  }
  
  return Math.round(confidence * 100) / 100 // Round to 2 decimals
}

