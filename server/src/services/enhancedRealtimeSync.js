// Enhanced real-time Gmail sync with push notifications
import { google } from 'googleapis'
import Email from '../models/Email.js'
import { classifyEmail } from './classificationService.js'
import { upsertEmail, parseEmailMessage, fetchMessage } from './gmailSyncService.js'
import { sendEmailSyncUpdate, sendSyncStatusUpdate } from './websocketService.js'

// Store active sync processes and watch channels
const activeSyncs = new Map()
const watchChannels = new Map()

/**
 * Start enhanced real-time sync with Gmail push notifications
 * @param {Object} user - User object
 * @returns {Promise<boolean>} Success status
 */
export const startEnhancedRealtimeSync = async (user) => {
  try {
    console.log(`🔄 Starting enhanced real-time sync for user: ${user.email}`)

    // Initialize Gmail client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      access_token: user.gmailAccessToken,
      refresh_token: user.gmailRefreshToken
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Set up Gmail push notifications
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: process.env.GOOGLE_PUBSUB_TOPIC || 'projects/sortify-app/topics/gmail-notifications',
        labelIds: ['INBOX'],
        labelFilterBehavior: 'include'
      }
    })

    console.log(`📡 Gmail watch channel created: ${watchResponse.data.historyId}`)

    // Store watch channel info
    watchChannels.set(user._id.toString(), {
      historyId: watchResponse.data.historyId,
      expiration: watchResponse.data.expiration
    })

    // Set up periodic sync (backup method) with 20-second delay
    const syncInterval = setInterval(async () => {
      try {
        console.log(`🔄 Starting periodic sync for user: ${user.email}`)
        await syncNewEmails(gmail, user)
        console.log(`✅ Periodic sync completed for user: ${user.email}`)
      } catch (error) {
        console.error('❌ Periodic sync error:', error)
        // Send error notification via WebSocket
        sendSyncStatusUpdate(user._id.toString(), {
          status: 'error',
          message: 'Sync failed: ' + error.message,
          timestamp: new Date()
        })
      }
    }, 20 * 1000) // Every 20 seconds for better efficiency

    // Store the interval for cleanup
    activeSyncs.set(user._id.toString(), {
      interval: syncInterval,
      lastSync: new Date(),
      gmail,
      oauth2Client
    })

    // Initial sync with delay to prevent immediate load
    setTimeout(async () => {
      try {
        console.log(`🔄 Starting initial sync for user: ${user.email}`)
        await syncNewEmails(gmail, user)
        console.log(`✅ Initial sync completed for user: ${user.email}`)
      } catch (error) {
        console.error('❌ Initial sync error:', error)
      }
    }, 5000) // 5-second delay for initial sync

    console.log(`✅ Enhanced real-time sync started for user: ${user.email}`)
    return true

  } catch (error) {
    console.error('Failed to start enhanced real-time sync:', error)
    return false
  }
}

/**
 * Stop enhanced real-time sync
 * @param {string} userId - User ID
 */
export const stopEnhancedRealtimeSync = (userId) => {
  const sync = activeSyncs.get(userId.toString())
  if (sync) {
    clearInterval(sync.interval)
    activeSyncs.delete(userId.toString())
    console.log(`🛑 Enhanced real-time sync stopped for user: ${userId}`)
  }

  // Clean up watch channel
  const watchChannel = watchChannels.get(userId.toString())
  if (watchChannel) {
    watchChannels.delete(userId.toString())
    console.log(`📡 Watch channel cleaned up for user: ${userId}`)
  }
}

/**
 * Sync new emails using Gmail history API
 * @param {Object} gmail - Gmail client
 * @param {Object} user - User object
 */
const syncNewEmails = async (gmail, user) => {
  try {
    // Rate limiting: Check if sync is already in progress
    const syncKey = `sync_${user._id}`
    if (global.syncInProgress && global.syncInProgress[syncKey]) {
      console.log(`⏳ Sync already in progress for user: ${user.email}, skipping...`)
      return
    }

    // Mark sync as in progress
    if (!global.syncInProgress) global.syncInProgress = {}
    global.syncInProgress[syncKey] = true

    // Get the latest email timestamp
    const latestEmail = await Email.findOne({ userId: user._id })
      .sort({ date: -1 })
      .select('date gmailId')

    const lastSyncTime = latestEmail?.date || new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    // Use Gmail history API for more efficient syncing
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: latestEmail?.gmailId ? '1' : undefined, // Start from beginning if no emails
      historyTypes: ['messageAdded'],
      labelId: 'INBOX'
    })

    const history = historyResponse.data.history || []
    let syncedCount = 0

    console.log(`📧 Found ${history.length} history entries for ${user.email}`)

    // Limit processing to prevent overload
    const maxEmailsPerSync = 10
    let processedCount = 0

    for (const historyItem of history) {
      if (!historyItem.messagesAdded || processedCount >= maxEmailsPerSync) break

      for (const messageAdded of historyItem.messagesAdded) {
        if (processedCount >= maxEmailsPerSync) break
        
        try {
          const messageId = messageAdded.message?.id
          if (!messageId) continue

          // Check if email already exists
          const existingEmail = await Email.findOne({ 
            gmailId: messageId,
            userId: user._id 
          })

          if (existingEmail) continue

          // Get full message details
          const message = await fetchMessage(gmail, messageId)
          const emailData = parseEmailMessage(message)
          
          // Classify the email using ML
          const classification = await classifyEmail(
            emailData.subject, 
            emailData.snippet, 
            emailData.body || emailData.text
          )

          // Add classification to email data
          const classifiedEmailData = {
            ...emailData,
            category: classification.label,
            classification: {
              label: classification.label,
              confidence: classification.confidence,
              modelVersion: '2.0.0',
              classifiedAt: new Date()
            }
          }

          // Save email
          await upsertEmail(user, classifiedEmailData)

          // Send WebSocket update
          sendEmailSyncUpdate(user._id.toString(), classifiedEmailData)

          syncedCount++
          console.log(`✅ Real-time sync: "${emailData.subject}" -> ${classification.label} (${(classification.confidence * 100).toFixed(1)}%)`)

        } catch (error) {
          console.error(`❌ Error syncing email ${messageAdded.message?.id}:`, error.message)
          continue
        }
      }
    }

    if (syncedCount > 0) {
      console.log(`🎉 Enhanced real-time sync completed: ${syncedCount} new emails for ${user.email}`)
    }

    return syncedCount

  } catch (error) {
    console.error('Enhanced real-time sync error:', error)
    return 0
  } finally {
    // Clear sync in progress flag
    if (global.syncInProgress) {
      delete global.syncInProgress[syncKey]
    }
  }
}

/**
 * Handle Gmail push notification
 * @param {Object} notification - Push notification data
 */
export const handleGmailPushNotification = async (notification) => {
  try {
    console.log('📨 Received Gmail push notification:', notification)

    // Extract user ID from notification (you'll need to implement this based on your setup)
    const userId = notification.userId || notification.user_id
    
    if (!userId) {
      console.error('No user ID in push notification')
      return
    }

    const sync = activeSyncs.get(userId.toString())
    if (!sync) {
      console.log(`No active sync for user ${userId}`)
      return
    }

    // Trigger immediate sync
    await syncNewEmails(sync.gmail, { _id: userId })

  } catch (error) {
    console.error('Error handling Gmail push notification:', error)
  }
}

/**
 * Get active sync status
 * @param {string} userId - User ID
 * @returns {Object} Sync status
 */
export const getSyncStatus = (userId) => {
  const sync = activeSyncs.get(userId.toString())
  const watchChannel = watchChannels.get(userId.toString())
  
  return {
    isActive: !!sync,
    lastSync: sync?.lastSync,
    watchChannel: watchChannel ? {
      historyId: watchChannel.historyId,
      expiration: watchChannel.expiration
    } : null
  }
}

/**
 * Get all active syncs
 * @returns {Array} Array of active user IDs
 */
export const getActiveSyncs = () => {
  return Array.from(activeSyncs.keys())
}

/**
 * Force sync for a specific user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of emails synced
 */
export const forceSync = async (userId) => {
  const sync = activeSyncs.get(userId.toString())
  if (!sync) {
    throw new Error('No active sync for user')
  }

  return await syncNewEmails(sync.gmail, { _id: userId })
}

/**
 * Check and refresh OAuth tokens if needed
 * @param {Object} user - User object
 * @returns {Promise<boolean>} Success status
 */
export const refreshUserTokens = async (user) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      access_token: user.gmailAccessToken,
      refresh_token: user.gmailRefreshToken
    })

    // This will automatically refresh the token if needed
    await oauth2Client.getAccessToken()

    console.log(`✅ Tokens refreshed for user: ${user.email}`)
    return true

  } catch (error) {
    console.error('Failed to refresh tokens:', error)
    return false
  }
}

/**
 * Update user activity for smart syncing
 * @param {string} userId - User ID
 */
export const updateUserActivity = (userId) => {
  try {
    // Update last activity timestamp for the user
    // This can be used for smart syncing based on user activity
    const sync = activeSyncs.get(userId.toString())
    if (sync) {
      sync.lastActivity = new Date()
    }
    
    console.log(`📊 Updated activity for user: ${userId}`)
  } catch (error) {
    console.error('Error updating user activity:', error)
  }
}
