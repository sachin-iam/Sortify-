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

/**
 * Extract professor title from sender name
 * @param {string} from - Email sender
 * @returns {Object|null} - {title, name} or null
 */
export const extractProfessorTitle = (from) => {
  if (!from) return null
  
  const professorPatterns = [
    /\(([^)]*(?:Assistant Professor|Associate Professor|Professor|Faculty|Dr\.).*?)\)/i,
    /(Assistant Professor|Associate Professor|Professor|Dr\.)\s+/i,
    /\b(Dr\.)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
  ]
  
  for (const pattern of professorPatterns) {
    const match = from.match(pattern)
    if (match) {
      return {
        title: match[1].trim(),
        name: extractSenderName(from),
        fullMatch: match[0].trim()
      }
    }
  }
  
  return null
}

/**
 * Match multi-word phrases in text
 * @param {string} text - Text to search
 * @param {Array<string>} phrases - Phrases to find
 * @returns {Object} - {count, matchedPhrases, score}
 */
export const matchPhrases = (text, phrases) => {
  if (!text || !phrases || phrases.length === 0) {
    return { count: 0, matchedPhrases: [], score: 0 }
  }
  
  const lowerText = text.toLowerCase()
  const matchedPhrases = []
  let totalScore = 0
  
  phrases.forEach(phrase => {
    const lowerPhrase = phrase.toLowerCase()
    
    // Escape special regex characters
    const escapedPhrase = lowerPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedPhrase, 'gi')
    const matches = lowerText.match(regex)
    
    if (matches && matches.length > 0) {
      matchedPhrases.push(phrase)
      
      // Higher score for phrase matches (they're more specific)
      const phraseScore = matches.length * 2.5
      totalScore += phraseScore
    }
  })
  
  return {
    count: matchedPhrases.length,
    matchedPhrases,
    score: totalScore
  }
}

/**
 * Check if sender email exactly matches a pattern
 * @param {string} from - Email sender
 * @param {string} emailPattern - Email address pattern
 * @returns {boolean} - True if matches
 */
export const matchesExactEmail = (from, emailPattern) => {
  if (!from || !emailPattern) return false
  
  // Extract email from "Name <email@domain.com>" format
  const emailMatch = from.match(/<(.+?)>/)
  const email = emailMatch ? emailMatch[1].trim().toLowerCase() : from.trim().toLowerCase()
  
  return email === emailPattern.toLowerCase()
}

/**
 * Check for specific sender patterns (HOD, E-Zone, NPTEL, etc.)
 * @param {string} from - Email sender
 * @param {string} categoryName - Category name to check
 * @returns {Object|null} - Match result or null
 */
export const matchSpecificSender = (from, categoryName) => {
  if (!from || !categoryName) return null
  
  const lowerFrom = from.toLowerCase()
  const senderName = extractSenderName(from) || ''
  const domain = extractSenderDomain(from) || ''
  
  // HOD-specific patterns
  if (categoryName === 'HOD') {
    if (lowerFrom.includes('hod.cse@sharda.ac.in') || 
        lowerFrom.includes('hod cse') || 
        senderName.toLowerCase().includes('hod')) {
      return { matched: true, confidence: 0.95, pattern: 'HOD sender' }
    }
  }
  
  // E-Zone-specific patterns
  if (categoryName === 'E-Zone') {
    if (lowerFrom.includes('ezone@shardauniversity.com') || 
        lowerFrom.includes('e-zone online portal') ||
        domain.includes('ezone')) {
      return { matched: true, confidence: 0.98, pattern: 'E-Zone sender' }
    }
  }
  
  // NPTEL-specific patterns
  if (categoryName === 'NPTEL') {
    if (domain.includes('nptel.iitm.ac.in') || 
        domain.includes('nptel.ac.in') ||
        lowerFrom.includes('onlinecourses@nptel')) {
      return { matched: true, confidence: 0.95, pattern: 'NPTEL sender' }
    }
  }
  
  // Professor-specific patterns
  if (categoryName === 'Professor') {
    const profTitle = extractProfessorTitle(from)
    if (profTitle) {
      return { matched: true, confidence: 0.90, pattern: 'Professor title', title: profTitle }
    }
  }
  
  // Promotions-specific patterns
  if (categoryName === 'Promotions') {
    if (lowerFrom.includes("'promotions' via") || 
        lowerFrom.includes('promotions via ug student group')) {
      return { matched: true, confidence: 0.92, pattern: 'Promotions sender' }
    }
  }
  
  // Whats happening-specific patterns
  if (categoryName === 'Whats happening') {
    if (lowerFrom.includes("'what's happening' via") || 
        lowerFrom.includes("what's happening via") ||
        lowerFrom.includes('whatshappening@')) {
      return { matched: true, confidence: 0.92, pattern: 'Whats happening sender' }
    }
  }
  
  return null
}

