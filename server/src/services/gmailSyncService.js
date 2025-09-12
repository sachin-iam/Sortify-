import { google } from 'googleapis'
import pLimit from 'p-limit'
import Email from '../models/Email.js'
import { classifyEmail } from './classificationService.js'
import axios from 'axios'

const GMAIL_SYNC_MAX_CONCURRENCY = parseInt(process.env.GMAIL_SYNC_MAX_CONCURRENCY) || 5
const GMAIL_SYNC_BATCH_SIZE = 100
const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'

// Create concurrency limiter
const limit = pLimit(GMAIL_SYNC_MAX_CONCURRENCY)

/**
 * Get OAuth2 client for user
 * @param {Object} user - User object with Gmail tokens
 * @returns {Object} OAuth2 client
 */
export const getOAuthForUser = (user) => {
  // Expect tokens saved on the user (adjust field names to your schema)
  const { gmailAccessToken, gmailRefreshToken } = user
  if (!gmailAccessToken && !gmailRefreshToken) {
    throw new Error('Gmail not connected for this user')
  }
  
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  
  oauth2.setCredentials({
    access_token: gmailAccessToken,
    refresh_token: gmailRefreshToken,
    expiry_date: user.gmailTokenExpiry?.getTime()
  })
  
  return oauth2
}

/**
 * Download attachment from Gmail
 * @param {Object} oauth2 - OAuth2 client
 * @param {string} messageId - Gmail message ID
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<Buffer>} Attachment data
 */
export const downloadAttachment = async (oauth2, messageId, attachmentId) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId
    })

    return Buffer.from(response.data.data, 'base64')
  } catch (error) {
    console.error('Error downloading attachment:', error)
    throw error
  }
}

/**
 * List all message IDs from Gmail with pagination
 * @param {Object} oauth2 - OAuth2 client
 * @param {string} query - Gmail search query
 * @param {Array} labelIds - Label IDs to search in
 * @returns {Promise<Array>} Array of message IDs
 */
export const listAllMessageIds = async (oauth2, query = '', labelIds = ['INBOX']) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })
    const allMessageIds = []
    let nextPageToken = null

    console.log('📧 Starting to list all message IDs...')

    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: GMAIL_SYNC_BATCH_SIZE,
        q: query,
        labelIds,
        pageToken: nextPageToken
      })

      const messages = response.data.messages || []
      allMessageIds.push(...messages.map(msg => msg.id))
      
      console.log(`📧 Fetched ${messages.length} message IDs (Total: ${allMessageIds.length})`)
      
      nextPageToken = response.data.nextPageToken
    } while (nextPageToken)

    console.log(`✅ Total message IDs found: ${allMessageIds.length}`)
    return allMessageIds

  } catch (error) {
    console.error('❌ Error listing message IDs:', error)
    throw error
  }
}

/**
 * Fetch full message details from Gmail
 * @param {Object} oauth2 - OAuth2 client
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<Object>} Full message object
 */
export const fetchMessage = async (oauth2, messageId) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    })

    return response.data
  } catch (error) {
    console.error(`❌ Error fetching message ${messageId}:`, error)
    throw error
  }
}

/**
 * Parse email headers and body from Gmail message
 * @param {Object} message - Gmail message object
 * @returns {Object} Parsed email data
 */
export const parseEmailMessage = (message) => {
  const headers = message.payload?.headers || []
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value

  // Extract body content (HTML and text)
  let html = ''
  let text = ''
  let body = ''
  const attachments = []

  const extractContent = (part) => {
    if (part.mimeType === 'text/html' && part.body?.data) {
      html = Buffer.from(part.body.data, 'base64').toString('utf-8')
    } else if (part.mimeType === 'text/plain' && part.body?.data) {
      text = Buffer.from(part.body.data, 'base64').toString('utf-8')
      body = text // Keep for backward compatibility
    } else if (part.mimeType.startsWith('multipart/')) {
      // Handle multipart messages
      if (part.parts) {
        for (const subPart of part.parts) {
          extractContent(subPart)
        }
      }
    } else if (part.body?.attachmentId) {
      // Handle attachments
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename || `attachment_${part.body.attachmentId}`,
        mimeType: part.mimeType,
        size: part.body.size || 0
      })
    }
  }

  if (message.payload?.body?.data) {
    // Simple message
    if (message.payload.mimeType === 'text/html') {
      html = Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
    } else if (message.payload.mimeType === 'text/plain') {
      text = Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
      body = text
    }
  } else if (message.payload?.parts) {
    // Multipart message
    for (const part of message.payload.parts) {
      extractContent(part)
    }
  }

  return {
    gmailId: message.id,
    messageId: message.id,
    threadId: message.threadId,
    subject: getHeader('Subject') || 'No Subject',
    from: getHeader('From') || 'Unknown Sender',
    to: getHeader('To') || '',
    date: new Date(parseInt(message.internalDate)),
    snippet: message.snippet || '',
    html,
    text,
    body, // Keep for backward compatibility
    attachments,
    isRead: !message.labelIds?.includes('UNREAD'),
    labels: message.labelIds || [],
    provider: 'gmail'
  }
}

/**
 * Upsert email into MongoDB
 * @param {Object} user - User object
 * @param {Object} emailData - Email data to save
 * @returns {Promise<Object>} Saved email document
 */
export const upsertEmail = async (user, emailData) => {
  try {
    const emailDoc = {
      userId: user._id,
      ...emailData
    }

    const savedEmail = await Email.findOneAndUpdate(
      { gmailId: emailData.gmailId, userId: user._id },
      emailDoc,
      { upsert: true, new: true }
    )

    return savedEmail
  } catch (error) {
    console.error('❌ Error upserting email:', error)
    throw error
  }
}

/**
 * Classify email using ML service and save classification
 * @param {Object} emailDoc - Email document
 * @returns {Promise<Object>} Updated email with classification
 */
export const classifyAndSave = async (emailDoc) => {
  try {
    // Try ML service first, fallback to local classification
    let classification
    try {
      const response = await axios.post(`${MODEL_SERVICE_URL}/categorize`, {
        subject: emailDoc.subject,
        snippet: emailDoc.snippet,
        body: emailDoc.body || emailDoc.text
      })
      classification = response.data
    } catch (mlError) {
      console.log('ML service unavailable, using local classification')
      classification = classifyEmail(emailDoc.subject, emailDoc.snippet, emailDoc.body || emailDoc.text)
    }
    
    // Update email with classification
    const updatedEmail = await Email.findByIdAndUpdate(
      emailDoc._id,
      {
        category: classification.label,
        classification: {
          label: classification.label,
          confidence: classification.confidence,
          modelVersion: '1.0.0',
          classifiedAt: new Date()
        }
      },
      { new: true }
    )

    return updatedEmail
  } catch (error) {
    console.error('❌ Error classifying email:', error)
    // Return original email if classification fails
    return emailDoc
  }
}

/**
 * Full Gmail inbox sync
 * @param {Object} user - User object
 * @returns {Promise<Object>} Sync results
 */
export const fullSync = async (user) => {
  try {
    console.log(`🚀 Starting full Gmail sync for user: ${user.email}`)

    if (!user.gmailConnected || !user.gmailAccessToken) {
      throw new Error('Gmail account not connected')
    }

    // Initialize Gmail client
    const oauth2Client = getOAuthForUser(user)

    // Get all message IDs
    const messageIds = await listAllMessageIds(oauth2Client, 'in:inbox')
    
    console.log('🔍 Debug - messageIds type:', typeof messageIds)
    console.log('🔍 Debug - messageIds is array:', Array.isArray(messageIds))
    console.log('🔍 Debug - messageIds length:', messageIds?.length)
    console.log('🔍 Debug - first few messageIds:', messageIds?.slice(0, 3))
    
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return {
        success: true,
        total: 0,
        synced: 0,
        classified: 0,
        skipped: 0,
        message: 'No emails found in inbox'
      }
    }

    console.log(`📧 Processing ${messageIds.length} emails with concurrency limit: ${GMAIL_SYNC_MAX_CONCURRENCY}`)

    // Process emails with concurrency control
    const processEmail = async (messageId) => {
      try {
        // Fetch full message
        const message = await fetchMessage(oauth2Client, messageId)
        
        // Parse email data
        const emailData = parseEmailMessage(message)
        
        // Upsert email
        const savedEmail = await upsertEmail(user, emailData)
        
        // Classify email
        const classifiedEmail = await classifyAndSave(savedEmail)
        
        return {
          success: true,
          emailId: messageId,
          subject: emailData.subject,
          category: classifiedEmail.category
        }
      } catch (error) {
        console.error(`❌ Error processing email ${messageId}:`, error.message)
        return {
          success: false,
          emailId: messageId,
          error: error.message
        }
      }
    }

    // Process all emails with concurrency limit
    const results = await Promise.all(messageIds.map(messageId => limit(() => processEmail(messageId))))
    
    // Calculate statistics
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    const classified = successful.filter(r => r.category && r.category !== 'Other')
    
    // Get category breakdown
    const categoryBreakdown = {}
    successful.forEach(result => {
      const category = result.category || 'Other'
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1
    })

    console.log(`✅ Full sync completed:`)
    console.log(`   Total: ${messageIds.length}`)
    console.log(`   Synced: ${successful.length}`)
    console.log(`   Failed: ${failed.length}`)
    console.log(`   Classified: ${classified.length}`)
    console.log(`   Categories:`, categoryBreakdown)

    return {
      success: true,
      total: messageIds.length,
      synced: successful.length,
      classified: classified.length,
      skipped: failed.length,
      categoryBreakdown,
      message: `Successfully synced ${successful.length} emails from Gmail inbox`
    }

  } catch (error) {
    console.error('❌ Full sync error:', error)
    return {
      success: false,
      error: error.message,
      total: 0,
      synced: 0,
      classified: 0,
      skipped: 0
    }
  }
}

/**
 * Sync specific Gmail labels
 * @param {Object} user - User object
 * @param {Array} labelIds - Array of label IDs to sync
 * @returns {Promise<Object>} Sync results
 */
export const syncLabels = async (user, labelIds = ['INBOX', 'SENT', 'DRAFT']) => {
  try {
    console.log(`🏷️ Starting label sync for user: ${user.email}`)
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      access_token: user.gmailAccessToken,
      refresh_token: user.gmailRefreshToken
    })

    let totalSynced = 0
    const results = {}

    for (const labelId of labelIds) {
      console.log(`📧 Syncing label: ${labelId}`)
      
      const messageIds = await listAllMessageIds(oauth2Client, '', [labelId])
      
      if (messageIds.length === 0) {
        results[labelId] = { synced: 0, total: 0 }
        continue
      }

      // Process emails for this label
      const processEmail = limit(async (messageId) => {
        try {
          const message = await fetchMessage(oauth2Client, messageId)
          const emailData = parseEmailMessage(message)
          const savedEmail = await upsertEmail(user, emailData)
          const classifiedEmail = await classifyAndSave(savedEmail)
          
          return { success: true, category: classifiedEmail.category }
        } catch (error) {
          return { success: false, error: error.message }
        }
      })

      const labelResults = await Promise.all(messageIds.map(processEmail))
      const synced = labelResults.filter(r => r.success).length
      
      results[labelId] = { synced, total: messageIds.length }
      totalSynced += synced
    }

    return {
      success: true,
      totalSynced,
      results,
      message: `Successfully synced ${totalSynced} emails from ${labelIds.length} labels`
    }

  } catch (error) {
    console.error('❌ Label sync error:', error)
    return {
      success: false,
      error: error.message,
      totalSynced: 0,
      results: {}
    }
  }
}
