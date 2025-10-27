// Real-time email sync service
import { google } from 'googleapis'
import Email from '../models/Email.js'
import { classifyEmail } from './classificationService.js'

// Store active sync processes
const activeSyncs = new Map()

export const startRealtimeSync = async (user) => {
  try {
    console.log(`🔄 Starting real-time sync for user: ${user.email}`)

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

    // Get the latest email timestamp
    const latestEmail = await Email.findOne({ userId: user._id })
      .sort({ date: -1 })
      .select('date')

    const lastSyncTime = latestEmail?.date || new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

    // Sync new emails every 5 minutes
    const syncInterval = setInterval(async () => {
      try {
        await syncNewEmails(gmail, user, lastSyncTime)
      } catch (error) {
        console.error('Real-time sync error:', error)
      }
    }, 5 * 60 * 1000) // 5 minutes

    // Store the interval for cleanup
    activeSyncs.set(user._id.toString(), {
      interval: syncInterval,
      lastSync: new Date()
    })

    // Initial sync
    await syncNewEmails(gmail, user, lastSyncTime)

    console.log(`✅ Real-time sync started for user: ${user.email}`)
    return true

  } catch (error) {
    console.error('Failed to start real-time sync:', error)
    return false
  }
}

export const stopRealtimeSync = (userId) => {
  const sync = activeSyncs.get(userId.toString())
  if (sync) {
    clearInterval(sync.interval)
    activeSyncs.delete(userId.toString())
    console.log(`🛑 Real-time sync stopped for user: ${userId}`)
  }
}

const syncNewEmails = async (gmail, user, lastSyncTime) => {
  try {
    // Get emails newer than last sync time
    const query = `in:inbox after:${Math.floor(lastSyncTime.getTime() / 1000)}`
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100,
      q: query
    })

    const messages = response.data.messages || []
    console.log(`📧 Found ${messages.length} new emails for ${user.email}`)

    let syncedCount = 0

    for (const message of messages) {
      try {
        if (!message.id) continue

        // Check if email already exists
        const existingEmail = await Email.findOne({ 
          messageId: message.id,
          userId: user._id 
        })

        if (existingEmail) continue

        // Get full message details
        const messageData = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        })

        const headers = messageData.data.payload.headers
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value

        // Classify the email automatically
        const subject = getHeader('Subject') || 'No Subject'
        const snippet = messageData.data.snippet || ''
        const body = messageData.data.payload.body?.data || ''
        
        const classification = await classifyEmail(subject, snippet, body, user._id.toString())

        const emailData = {
          userId: user._id,
          gmailId: message.id,
          messageId: message.id,
          threadId: messageData.data.threadId || null,
          subject,
          from: getHeader('From') || 'Unknown Sender',
          to: getHeader('To') || user.email,
          date: new Date(parseInt(messageData.data.internalDate)),
          snippet,
          body,
          isRead: !messageData.data.labelIds?.includes('UNREAD'),
          labels: messageData.data.labelIds || [],
          category: classification.label,
          classification: {
            label: classification.label,
            confidence: classification.confidence
          }
        }

        // Save email
        await Email.findOneAndUpdate(
          { messageId: message.id, userId: user._id },
          emailData,
          { upsert: true, new: true }
        )

        syncedCount++
        console.log(`✅ Real-time sync: ${subject} -> ${classification.label}`)

      } catch (error) {
        console.error(`❌ Error syncing email ${message.id}:`, error.message)
        continue
      }
    }

    if (syncedCount > 0) {
      console.log(`🎉 Real-time sync completed: ${syncedCount} new emails for ${user.email}`)
    }

    return syncedCount

  } catch (error) {
    console.error('Real-time sync error:', error)
    return 0
  }
}

export const getActiveSyncs = () => {
  return Array.from(activeSyncs.keys())
}

export const isSyncActive = (userId) => {
  return activeSyncs.has(userId.toString())
}
