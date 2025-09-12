import { google } from 'googleapis'
import User from '../models/User.js'
import Email from '../models/Email.js'
import { getOAuthForUser, fetchMessage, parseEmailMessage, upsertEmail, classifyAndSave } from './gmailSyncService.js'
import axios from 'axios'

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'

/**
 * Start Gmail watch for realtime updates
 * @param {Object} user - User object
 * @returns {Promise<Object>} Watch result
 */
export const startWatch = async (user) => {
  try {
    const oauth2 = getOAuthForUser(user)
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })

    // Start watch
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: process.env.GOOGLE_PUBSUB_TOPIC || 'projects/your-project/topics/gmail-notifications',
        labelIds: ['INBOX'],
        labelFilterBehavior: 'include'
      }
    })

    // Update user with watch info
    user.gmailWatchExpiration = new Date(parseInt(watchResponse.data.expiration))
    user.gmailHistoryId = watchResponse.data.historyId
    user.gmailWatchActive = true
    await user.save()

    console.log('✅ Gmail watch started for user:', user.email)
    return {
      success: true,
      expiration: user.gmailWatchExpiration,
      historyId: user.gmailHistoryId
    }
  } catch (error) {
    console.error('❌ Error starting Gmail watch:', error)
    throw error
  }
}

/**
 * Stop Gmail watch
 * @param {Object} user - User object
 * @returns {Promise<Object>} Stop result
 */
export const stopWatch = async (user) => {
  try {
    const oauth2 = getOAuthForUser(user)
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })

    // Stop watch
    await gmail.users.stop({
      userId: 'me'
    })

    // Clear watch info from user
    user.gmailWatchExpiration = null
    user.gmailHistoryId = null
    user.gmailWatchActive = false
    await user.save()

    console.log('✅ Gmail watch stopped for user:', user.email)
    return { success: true }
  } catch (error) {
    console.error('❌ Error stopping Gmail watch:', error)
    throw error
  }
}

/**
 * Process Gmail history delta for new emails
 * @param {Object} oauth2 - OAuth2 client
 * @param {Object} user - User object
 * @param {string} startHistoryId - Starting history ID
 * @returns {Promise<Object>} Process result
 */
export const processHistoryDelta = async (oauth2, user, startHistoryId) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })
    let nextPageToken = null
    let processedCount = 0

    do {
      const response = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        pageToken: nextPageToken
      })

      const history = response.data.history || []
      
      for (const historyRecord of history) {
        if (historyRecord.messagesAdded) {
          for (const messageAdded of historyRecord.messagesAdded) {
            try {
              // Fetch full message
              const message = await fetchMessage(oauth2, messageAdded.message.id)
              const emailData = parseEmailMessage(message)
              
              // Upsert email
              const emailDoc = await upsertEmail(user, emailData)
              
              // Classify email
              await classifyAndSave(emailDoc)
              
              processedCount++
              
              // Broadcast SSE event for new email
              await broadcastSSEEvent({
                type: 'new_email',
                emailId: emailDoc._id,
                userId: user._id.toString()
              })
              
            } catch (error) {
              console.error('❌ Error processing new email:', error)
            }
          }
        }
      }

      nextPageToken = response.data.nextPageToken
    } while (nextPageToken)

    // Update user's last processed history ID
    user.gmailLastHistoryId = startHistoryId
    await user.save()

    return { success: true, processedCount }
  } catch (error) {
    console.error('❌ Error processing history delta:', error)
    throw error
  }
}

/**
 * Maybe renew Gmail watch before expiration
 * @param {Object} user - User object
 * @returns {Promise<Object>} Renewal result
 */
export const maybeRenewWatch = async (user) => {
  try {
    if (!user.gmailWatchActive || !user.gmailWatchExpiration) {
      return { success: false, message: 'No active watch to renew' }
    }

    const now = new Date()
    const expiration = new Date(user.gmailWatchExpiration)
    const timeUntilExpiration = expiration.getTime() - now.getTime()

    // Renew if less than 5 minutes until expiration
    if (timeUntilExpiration < 5 * 60 * 1000) {
      console.log('🔄 Renewing Gmail watch for user:', user.email)
      return await startWatch(user)
    }

    return { success: true, message: 'Watch still valid' }
  } catch (error) {
    console.error('❌ Error renewing Gmail watch:', error)
    throw error
  }
}

/**
 * Fallback polling when Pub/Sub is not configured
 * @param {Object} user - User object
 * @returns {Promise<Object>} Polling result
 */
export const fallbackPolling = async (user) => {
  try {
    const oauth2 = getOAuthForUser(user)
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })

    // Get current history ID
    const profile = await gmail.users.getProfile({ userId: 'me' })
    const currentHistoryId = profile.data.historyId

    if (user.gmailLastHistoryId && user.gmailLastHistoryId !== currentHistoryId) {
      // Process delta
      return await processHistoryDelta(oauth2, user, user.gmailLastHistoryId)
    }

    return { success: true, message: 'No new changes' }
  } catch (error) {
    console.error('❌ Error in fallback polling:', error)
    throw error
  }
}

/**
 * Broadcast SSE event to connected clients
 * @param {Object} event - Event data
 */
const broadcastSSEEvent = async (event) => {
  try {
    // This would typically send to connected SSE clients
    // For now, we'll just log it
    console.log('📡 Broadcasting SSE event:', event)
    
    // In a real implementation, you'd send this to connected clients
    // via Server-Sent Events or WebSocket
  } catch (error) {
    console.error('❌ Error broadcasting SSE event:', error)
  }
}

/**
 * Check if user has active Gmail watch
 * @param {Object} user - User object
 * @returns {boolean} Watch status
 */
export const isWatchActive = (user) => {
  return user.gmailWatchActive && user.gmailWatchExpiration && new Date(user.gmailWatchExpiration) > new Date()
}
