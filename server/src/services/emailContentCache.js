/**
 * Email Content Cache Service
 * 
 * Caches full email content in memory per user session.
 * - When email is opened, full content is loaded and cached
 * - Cache persists until user logs out
 * - Only metadata is kept for unopened emails
 */

class EmailContentCache {
  constructor() {
    // Map of userId -> Map of emailId -> full email content
    this.cache = new Map()
    
    // Track cache stats
    this.stats = {
      hits: 0,
      misses: 0,
      totalCached: 0
    }
  }

  /**
   * Get cached email content for a user
   * @param {string} userId - User ID
   * @param {string} emailId - Email ID
   * @returns {object|null} Cached email content or null
   */
  get(userId, emailId) {
    const userCache = this.cache.get(userId.toString())
    if (!userCache) {
      this.stats.misses++
      return null
    }

    const cachedEmail = userCache.get(emailId.toString())
    if (cachedEmail) {
      this.stats.hits++
      console.log(`📦 Cache HIT for user ${userId}, email ${emailId}`)
      // Return a clean copy to avoid mutations
      return { ...cachedEmail }
    }

    this.stats.misses++
    return null
  }

  /**
   * Cache email content for a user
   * @param {string} userId - User ID
   * @param {string} emailId - Email ID
   * @param {object} emailContent - Full email content to cache
   */
  set(userId, emailId, emailContent) {
    const userIdStr = userId.toString()
    const emailIdStr = emailId.toString()

    // Initialize user cache if doesn't exist
    if (!this.cache.has(userIdStr)) {
      this.cache.set(userIdStr, new Map())
      console.log(`📦 Created cache for user ${userId}`)
    }

    const userCache = this.cache.get(userIdStr)
    const wasNew = !userCache.has(emailIdStr)
    
    // Store clean email content without cache metadata to avoid frontend issues
    userCache.set(emailIdStr, emailContent)

    if (wasNew) {
      this.stats.totalCached++
    }

    console.log(`📦 Cached email ${emailId} for user ${userId} (total cached: ${userCache.size})`)
  }

  /**
   * Clear cache for a specific user (e.g., on logout)
   * @param {string} userId - User ID
   */
  clearUser(userId) {
    const userIdStr = userId.toString()
    const userCache = this.cache.get(userIdStr)
    
    if (userCache) {
      const count = userCache.size
      this.cache.delete(userIdStr)
      console.log(`🗑️ Cleared cache for user ${userId} (${count} emails removed)`)
      return count
    }
    
    return 0
  }

  /**
   * Clear all cache (use with caution)
   */
  clearAll() {
    const totalUsers = this.cache.size
    this.cache.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      totalCached: 0
    }
    console.log(`🗑️ Cleared all cache (${totalUsers} users)`)
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getStats() {
    const totalUsers = this.cache.size
    let totalEmails = 0
    
    for (const userCache of this.cache.values()) {
      totalEmails += userCache.size
    }

    return {
      ...this.stats,
      totalUsers,
      totalEmails,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
        : '0%'
    }
  }

  /**
   * Get user cache statistics
   * @param {string} userId - User ID
   * @returns {object} User cache statistics
   */
  getUserStats(userId) {
    const userCache = this.cache.get(userId.toString())
    
    if (!userCache) {
      return {
        userId,
        cachedEmails: 0,
        totalSize: 0
      }
    }

    return {
      userId,
      cachedEmails: userCache.size,
      emails: Array.from(userCache.keys())
    }
  }

  /**
   * Check if email is cached for user
   * @param {string} userId - User ID
   * @param {string} emailId - Email ID
   * @returns {boolean} True if cached
   */
  has(userId, emailId) {
    const userCache = this.cache.get(userId.toString())
    if (!userCache) return false
    return userCache.has(emailId.toString())
  }

  /**
   * Remove specific email from user cache
   * @param {string} userId - User ID
   * @param {string} emailId - Email ID
   */
  remove(userId, emailId) {
    const userCache = this.cache.get(userId.toString())
    if (userCache) {
      const deleted = userCache.delete(emailId.toString())
      if (deleted) {
        console.log(`🗑️ Removed email ${emailId} from cache for user ${userId}`)
      }
      return deleted
    }
    return false
  }
}

// Create singleton instance
const emailContentCache = new EmailContentCache()

// Log cache stats every 5 minutes (optional)
setInterval(() => {
  const stats = emailContentCache.getStats()
  if (stats.totalEmails > 0) {
    console.log('📊 Email Content Cache Stats:', stats)
  }
}, 5 * 60 * 1000)

export default emailContentCache

