import Email from '../models/Email.js'

/**
 * Cleanup old full content from emails (time-based cleanup)
 * @param {number} daysOld - Number of days old to consider for cleanup (default: 7)
 * @returns {Promise<Object>} Cleanup results
 */
export const cleanupOldFullContent = async (daysOld = 7) => {
  try {
    console.log(`🧹 Starting cleanup of full content older than ${daysOld} days...`)

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

    // Find emails with full content loaded before cutoff date
    const emailsToCleanup = await Email.find({
      isFullContentLoaded: true,
      fullContentLoadedAt: { $lt: cutoffDate }
    }).select('_id subject userId')

    if (emailsToCleanup.length === 0) {
      console.log('✅ No emails found for cleanup')
      return {
        success: true,
        cleanedCount: 0,
        message: 'No emails found for cleanup'
      }
    }

    console.log(`📧 Found ${emailsToCleanup.length} emails to cleanup`)

    // Cleanup full content from emails
    const result = await Email.updateMany(
      {
        isFullContentLoaded: true,
        fullContentLoadedAt: { $lt: cutoffDate }
      },
      {
        $unset: {
          html: 1,
          text: 1,
          body: 1,
          attachments: 1
        },
        $set: {
          isFullContentLoaded: false,
          fullContentLoadedAt: null
        }
      }
    )

    console.log(`✅ Cleanup completed: ${result.modifiedCount} emails cleaned`)

    return {
      success: true,
      cleanedCount: result.modifiedCount,
      totalFound: emailsToCleanup.length,
      cutoffDate: cutoffDate.toISOString(),
      message: `Successfully cleaned ${result.modifiedCount} emails`
    }

  } catch (error) {
    console.error('❌ Cleanup error:', error)
    return {
      success: false,
      error: error.message,
      cleanedCount: 0
    }
  }
}

/**
 * Cleanup full content on user logout (optional immediate cleanup)
 * @param {string} userId - User ID to cleanup emails for
 * @returns {Promise<Object>} Cleanup results
 */
export const cleanupOnLogout = async (userId) => {
  try {
    console.log(`🧹 Starting logout cleanup for user: ${userId}`)

    // Find emails with full content for this user
    const userEmails = await Email.find({
      userId,
      isFullContentLoaded: true
    }).select('_id subject')

    if (userEmails.length === 0) {
      console.log('✅ No full content emails found for user')
      return {
        success: true,
        cleanedCount: 0,
        message: 'No full content emails found for user'
      }
    }

    console.log(`📧 Found ${userEmails.length} emails with full content for user`)

    // Cleanup full content from user's emails
    const result = await Email.updateMany(
      {
        userId,
        isFullContentLoaded: true
      },
      {
        $unset: {
          html: 1,
          text: 1,
          body: 1,
          attachments: 1
        },
        $set: {
          isFullContentLoaded: false,
          fullContentLoadedAt: null
        }
      }
    )

    console.log(`✅ Logout cleanup completed: ${result.modifiedCount} emails cleaned for user ${userId}`)

    return {
      success: true,
      cleanedCount: result.modifiedCount,
      userId,
      message: `Successfully cleaned ${result.modifiedCount} emails for user`
    }

  } catch (error) {
    console.error('❌ Logout cleanup error:', error)
    return {
      success: false,
      error: error.message,
      cleanedCount: 0
    }
  }
}

/**
 * Get cleanup statistics
 * @returns {Promise<Object>} Cleanup statistics
 */
export const getCleanupStats = async () => {
  try {
    const stats = await Email.aggregate([
      {
        $group: {
          _id: null,
          totalEmails: { $sum: 1 },
          emailsWithFullContent: {
            $sum: { $cond: ['$isFullContentLoaded', 1, 0] }
          },
          emailsWithoutFullContent: {
            $sum: { $cond: ['$isFullContentLoaded', 0, 1] }
          }
        }
      }
    ])

    const result = stats[0] || {
      totalEmails: 0,
      emailsWithFullContent: 0,
      emailsWithoutFullContent: 0
    }

    // Get oldest full content date
    const oldestFullContent = await Email.findOne({
      isFullContentLoaded: true
    })
      .sort({ fullContentLoadedAt: 1 })
      .select('fullContentLoadedAt')

    // Get newest full content date
    const newestFullContent = await Email.findOne({
      isFullContentLoaded: true
    })
      .sort({ fullContentLoadedAt: -1 })
      .select('fullContentLoadedAt')

    return {
      success: true,
      stats: {
        ...result,
        oldestFullContentDate: oldestFullContent?.fullContentLoadedAt,
        newestFullContentDate: newestFullContent?.fullContentLoadedAt,
        fullContentPercentage: result.totalEmails > 0 
          ? Math.round((result.emailsWithFullContent / result.totalEmails) * 100) 
          : 0
      }
    }

  } catch (error) {
    console.error('❌ Get cleanup stats error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Schedule automatic cleanup (run daily)
 * @param {number} daysOld - Number of days old to consider for cleanup
 * @param {number} intervalHours - Interval in hours between cleanup runs (default: 24)
 */
export const scheduleCleanup = (daysOld = 7, intervalHours = 24) => {
  const intervalMs = intervalHours * 60 * 60 * 1000

  console.log(`⏰ Scheduling cleanup every ${intervalHours} hours for content older than ${daysOld} days`)

  // Run cleanup immediately
  cleanupOldFullContent(daysOld)

  // Schedule recurring cleanup
  const intervalId = setInterval(async () => {
    try {
      console.log(`🕐 Running scheduled cleanup...`)
      const result = await cleanupOldFullContent(daysOld)
      
      if (result.success) {
        console.log(`✅ Scheduled cleanup completed: ${result.cleanedCount} emails cleaned`)
      } else {
        console.error(`❌ Scheduled cleanup failed: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ Scheduled cleanup error:', error)
    }
  }, intervalMs)

  // Return interval ID for cleanup if needed
  return intervalId
}

/**
 * Manual cleanup trigger (for testing or manual runs)
 * @param {Object} options - Cleanup options
 * @returns {Promise<Object>} Cleanup results
 */
export const runManualCleanup = async (options = {}) => {
  const { daysOld = 7, userId = null } = options

  try {
    console.log(`🔧 Running manual cleanup with options:`, options)

    if (userId) {
      // Cleanup specific user
      return await cleanupOnLogout(userId)
    } else {
      // Cleanup all users
      return await cleanupOldFullContent(daysOld)
    }

  } catch (error) {
    console.error('❌ Manual cleanup error:', error)
    return {
      success: false,
      error: error.message,
      cleanedCount: 0
    }
  }
}
