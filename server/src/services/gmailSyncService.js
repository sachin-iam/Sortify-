import { google } from 'googleapis'
import pLimit from 'p-limit'
import Email from '../models/Email.js'
import { classifyEmail } from './enhancedClassificationService.js'
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
 * Extract URLs from HTML content
 * @param {string} html - HTML content
 * @returns {Array} Array of URLs found
 */
const extractUrlsFromHtml = (html) => {
  if (!html) return []
  
  const urlRegex = /href\s*=\s*['"](https?:\/\/[^'"]+)['"]/gi
  const urls = []
  let match
  
  while ((match = urlRegex.exec(html)) !== null) {
    urls.push(match[1])
  }
  
  return urls
}

/**
 * Extract URLs from plain text
 * @param {string} text - Plain text content
 * @returns {Array} Array of URLs found
 */
const extractUrlsFromText = (text) => {
  if (!text) return []
  
  const urlRegex = /https?:\/\/[^\s<>\"{}|\\^`\[\]]+/gi
  return text.match(urlRegex) || []
}

/**
 * Parse sender domain from email address
 * @param {string} fromHeader - From header value
 * @returns {string} Domain name
 */
const parseSenderDomain = (fromHeader) => {
  if (!fromHeader) return 'unknown'
  
  // Extract email address using regex
  const emailRegex = /<([^>]+)>|^([^\s<>]+@[^\s<>]+)/
  const match = fromHeader.match(emailRegex)
  
  if (match) {
    const email = match[1] || match[2]
    if (email && email.includes('@')) {
      return email.split('@')[1].toLowerCase()
    }
  }
  
  return 'unknown'
}

/**
 * Parse email headers and body from Gmail message
 * @param {Object} message - Gmail message object
 * @returns {Object} Parsed email data with enhanced metadata
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
      // Handle attachments with enhanced metadata
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

  // Extract comprehensive header information
  const enhancedHeaders = {}
  headers.forEach(header => {
    enhancedHeaders[header.name.toLowerCase()] = header.value
  })

  // Extract thread metadata
  const inReplyTo = getHeader('In-Reply-To')
  const references = getHeader('References')
  const replyTo = getHeader('Reply-To')
  
  // Parse sender domain
  const fromHeader = getHeader('From') || 'Unknown Sender'
  const senderDomain = parseSenderDomain(fromHeader)
  
  // Parse recipient information
  const toHeader = getHeader('To') || ''
  const ccHeader = getHeader('Cc') || ''
  const bccHeader = getHeader('Bcc') || ''
  
  // Count recipients
  const recipientCount = [
    ...toHeader.split(','),
    ...ccHeader.split(','),
    ...bccHeader.split(',')
  ].filter(email => email.trim().includes('@')).length

  // Extract URLs from content
  const htmlUrls = extractUrlsFromHtml(html)
  const textUrls = extractUrlsFromText(text + ' ' + body)
  const allUrls = [...new Set([...htmlUrls, ...textUrls])]

  // Parse authentication headers
  const authHeaders = {
    spf: getHeader('Received-SPF') || getHeader('Authentication-Results'),
    dkim: getHeader('DKIM-Signature') || getHeader('Authentication-Results'),
    dmarc: getHeader('ARC-Authentication-Results') || getHeader('Authentication-Results')
  }

  // Extract priority/importance headers
  const priorityHeaders = {
    priority: getHeader('X-Priority') || getHeader('Priority'),
    importance: getHeader('X-MSMail-Priority') || getHeader('Importance'),
    mimeVersion: getHeader('MIME-Version')
  }

  return {
    gmailId: message.id,
    messageId: message.id,
    threadId: message.threadId,
    subject: getHeader('Subject') || 'No Subject',
    from: fromHeader,
    to: toHeader,
    cc: ccHeader,
    bcc: bccHeader,
    date: new Date(parseInt(message.internalDate)),
    snippet: message.snippet || '',
    html,
    text,
    body, // Keep for backward compatibility
    attachments,
    isRead: !message.labelIds?.includes('UNREAD'),
    labels: message.labelIds || [],
    provider: 'gmail',
    
    // Enhanced metadata for feature extraction
    enhancedMetadata: {
      senderDomain,
      recipientCount,
      threadMetadata: {
        inReplyTo,
        references,
        isReply: !!inReplyTo,
        isForward: false // Could be enhanced to detect forwards
      },
      headers: {
        replyTo,
        returnPath: getHeader('Return-Path'),
        messageId: getHeader('Message-ID'),
        userAgent: getHeader('User-Agent') || getHeader('X-Mailer'),
        ...authHeaders,
        ...priorityHeaders
      },
      urls: allUrls,
      urlCount: allUrls.length,
      hasExternalLinks: allUrls.some(url => {
        try {
          const urlObj = new URL(url)
          return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
        } catch {
          return false
        }
      })
    }
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

    // Try to find existing email by gmailId first, then by messageId
    let query = { userId: user._id }
    if (emailData.gmailId) {
      query.gmailId = emailData.gmailId
    } else if (emailData.messageId) {
      query.messageId = emailData.messageId
    }

    const savedEmail = await Email.findOneAndUpdate(
      query,
      emailDoc,
      { upsert: true, new: true, runValidators: false }
    )

    return savedEmail
  } catch (error) {
    // If it's a duplicate key error, try to find the existing email
    if (error.code === 11000) {
      console.log('🔄 Duplicate key error, attempting to find existing email...')
      try {
        // Try to find by gmailId
        let existingEmail = null
        if (emailData.gmailId) {
          existingEmail = await Email.findOne({ gmailId: emailData.gmailId, userId: user._id })
        }
        // If not found by gmailId, try by messageId
        if (!existingEmail && emailData.messageId) {
          existingEmail = await Email.findOne({ messageId: emailData.messageId, userId: user._id })
        }
        
        if (existingEmail) {
          // Update the existing email with new data
          Object.assign(existingEmail, emailData)
          await existingEmail.save()
          console.log('✅ Updated existing email:', emailData.gmailId || emailData.messageId)
          return existingEmail
        }
      } catch (updateError) {
        console.error('❌ Error updating existing email:', updateError)
      }
    }
    
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
    // Use enhanced classification with full email data
    let classification
    try {
      // Prepare comprehensive email data for enhanced classification
      const emailData = {
        subject: emailDoc.subject,
        body: emailDoc.body || emailDoc.text,
        html: emailDoc.html,
        from: emailDoc.from,
        to: emailDoc.to,
        cc: emailDoc.cc,
        bcc: emailDoc.bcc,
        date: emailDoc.date,
        attachments: emailDoc.attachments || [],
        enhancedMetadata: emailDoc.enhancedMetadata || {}
      }
      
      classification = await classifyEmail(
        emailDoc.subject, 
        emailDoc.snippet, 
        emailDoc.body || emailDoc.text, 
        emailDoc.userId.toString(),
        emailData
      )
    } catch (localError) {
      console.log('Enhanced classification failed, using fallback:', localError.message)
      classification = {
        label: 'Other',
        confidence: 0.5,
        scores: {},
        model: 'fallback'
      }
    }
    
    // Prepare update data with enhanced features
    const updateData = {
      category: classification.label,
      classification: {
        label: classification.label,
        confidence: classification.confidence,
        modelVersion: '2.0.0-ensemble',
        classifiedAt: new Date(),
        model: classification.model || 'enhanced',
        reason: 'Enhanced ensemble classification',
        ensembleScores: classification.ensembleScores || {},
        featureContributions: classification.featureContributions || {}
      }
    }
    
    // Add extracted features and enhanced metadata if available
    if (classification.extractedFeatures) {
      updateData.extractedFeatures = classification.extractedFeatures
    }
    
    if (classification.enhancedMetadata) {
      updateData.enhancedMetadata = classification.enhancedMetadata
    }
    
    // Update email with enhanced classification
    const updatedEmail = await Email.findByIdAndUpdate(
      emailDoc._id,
      updateData,
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

    // Find the most recent email we already have
    const latestEmail = await Email.findOne({ 
      userId: user._id,
      provider: 'gmail'
    })
      .sort({ date: -1 })
      .select('date')
      .lean()

    // Build query to fetch only new emails (after the latest one we have)
    let query = 'in:inbox'
    if (latestEmail && latestEmail.date) {
      // Convert date to Unix timestamp (seconds) for Gmail API
      const afterTimestamp = Math.floor(latestEmail.date.getTime() / 1000)
      query = `in:inbox after:${afterTimestamp}`
      console.log(`📅 Fetching emails newer than: ${latestEmail.date.toISOString()}`)
      console.log(`📧 Gmail query: ${query}`)
    } else {
      console.log(`📧 No existing emails found, fetching all inbox emails`)
    }

    // Get message IDs using the query
    const messageIds = await listAllMessageIds(oauth2Client, query)
    
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
        message: 'No new emails found in inbox'
      }
    }

    console.log(`📧 Processing ${messageIds.length} emails with concurrency limit: ${GMAIL_SYNC_MAX_CONCURRENCY}`)

    // Process emails with concurrency control
    const processEmail = async (messageId) => {
      try {
        // Check if email already exists BEFORE fetching (to avoid unnecessary API calls)
        const existingEmail = await Email.findOne({ 
          gmailId: messageId,
          userId: user._id 
        }).select('_id').lean()
        
        if (existingEmail) {
          // Email already exists, skip processing
          return {
            success: true,
            emailId: messageId,
            skipped: true,
            reason: 'already_exists'
          }
        }
        
        // Fetch full message
        const message = await fetchMessage(oauth2Client, messageId)
        
        // Parse email data
        const emailData = parseEmailMessage(message)
        
        // Add full body and mark for classification
        emailData.fullBody = emailData.text || emailData.html || emailData.snippet || ''
        emailData.needsClassification = true
        emailData.isFullContentLoaded = true
        emailData.fullContentLoadedAt = new Date()
        
        // Upsert email
        const savedEmail = await upsertEmail(user, emailData)
        
        // Import and trigger classification pipeline
        const { classifyAndCache } = await import('./emailClassificationPipeline.js')
        
        // Classify immediately and cache (this also removes full body)
        const classificationResult = await classifyAndCache(savedEmail, user._id)
        const classifiedEmail = classificationResult.success 
          ? { ...savedEmail, category: classificationResult.classification.label }
          : savedEmail
        
        return {
          success: true,
          emailId: messageId,
          subject: emailData.subject,
          category: classifiedEmail.category,
          isNew: true
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
    const successful = results.filter(r => r.success && !r.skipped)
    const skipped = results.filter(r => r.success && r.skipped)
    const failed = results.filter(r => !r.success)
    const newEmails = results.filter(r => r.success && r.isNew)
    const classified = newEmails.filter(r => r.category && r.category !== 'Other')
    
    // Get category breakdown (only for new emails)
    const categoryBreakdown = {}
    newEmails.forEach(result => {
      const category = result.category || 'Other'
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1
    })

    console.log(`✅ Full sync completed:`)
    console.log(`   Total fetched from Gmail: ${messageIds.length}`)
    console.log(`   New emails synced: ${newEmails.length}`)
    console.log(`   Already existed (skipped): ${skipped.length}`)
    console.log(`   Failed: ${failed.length}`)
    console.log(`   Classified: ${classified.length}`)
    console.log(`   Categories:`, categoryBreakdown)

    return {
      success: true,
      total: messageIds.length,
      synced: newEmails.length,
      classified: classified.length,
      skipped: skipped.length,
      categoryBreakdown,
      message: newEmails.length > 0 
        ? `Successfully synced ${newEmails.length} new emails from Gmail inbox` 
        : 'No new emails found'
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

/**
 * Sync email thumbnails (metadata only) for faster initial loading
 * @param {Object} user - User object
 * @param {Object} options - Sync options
 * @returns {Promise<Object>} Sync results
 */
export const syncEmailThumbnails = async (user, options = {}) => {
  try {
    console.log(`🚀 Starting thumbnail sync for user: ${user.email}`)

    if (!user.gmailConnected || !user.gmailAccessToken) {
      throw new Error('Gmail account not connected')
    }

    const { maxResults = 1000, batchSize = 200 } = options

    // Initialize Gmail client
    const oauth2Client = getOAuthForUser(user)
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Get all message IDs (metadata only - much faster)
    const messageIds = await listAllMessageIds(oauth2Client, 'in:inbox')
    
    console.log(`📧 Found ${messageIds.length} emails for thumbnail sync`)

    if (messageIds.length === 0) {
      return {
        success: true,
        total: 0,
        synced: 0,
        classified: 0,
        skipped: 0,
        message: 'No emails found in inbox'
      }
    }

    // Limit to maxResults for initial sync
    const limitedMessageIds = messageIds.slice(0, maxResults)
    console.log(`📧 Processing ${limitedMessageIds.length} emails for thumbnail sync`)

    let syncedCount = 0
    let classifiedCount = 0
    let skippedCount = 0

    // Process emails in batches
    for (let i = 0; i < limitedMessageIds.length; i += batchSize) {
      const batch = limitedMessageIds.slice(i, i + batchSize)
      console.log(`📧 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(limitedMessageIds.length / batchSize)}`)

      const batchPromises = batch.map(messageId => limit(async () => {
        try {
          // Check if email already exists
          const existingEmail = await Email.findOne({ 
            gmailId: messageId,
            userId: user._id 
          })

          if (existingEmail) {
            // Update thumbnail data if needed
            if (!existingEmail.isFullContentLoaded) {
              // Get basic message metadata (faster than full message)
              const message = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'metadata',
                metadataHeaders: ['From', 'To', 'Subject', 'Date']
              })

              const headers = message.data.payload?.headers || []
              const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value

              // Update basic fields
              existingEmail.subject = getHeader('Subject') || 'No Subject'
              existingEmail.from = getHeader('From') || 'Unknown Sender'
              existingEmail.to = getHeader('To') || user.email
              existingEmail.date = new Date(parseInt(message.data.internalDate))
              existingEmail.snippet = message.data.snippet || ''
              existingEmail.isRead = !message.data.labelIds?.includes('UNREAD')
              existingEmail.labels = message.data.labelIds || []

              await existingEmail.save()
            }
            skippedCount++
            return { success: true, skipped: true, emailId: messageId }
          }

          // Get basic message metadata (much faster than full message)
          const message = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date']
          })

          const headers = message.data.payload?.headers || []
          const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value

          // Extract basic email data
          const subject = getHeader('Subject') || 'No Subject'
          const snippet = message.data.snippet || ''
          
          // Classify the email automatically
          const classification = await classifyEmail(subject, snippet, '')

          const emailData = {
            userId: user._id,
            gmailId: messageId,
            messageId: messageId,
            threadId: message.data.threadId || null,
            subject,
            from: getHeader('From') || 'Unknown Sender',
            to: getHeader('To') || user.email,
            date: new Date(parseInt(message.data.internalDate)),
            snippet,
            isRead: !message.data.labelIds?.includes('UNREAD'),
            labels: message.data.labelIds || [],
            category: classification.label,
            classification: {
              label: classification.label,
              confidence: classification.confidence
            },
            isFullContentLoaded: false,
            fullContentLoadedAt: null,
            lastAccessedAt: null
          }

          // Save thumbnail email
          await Email.findOneAndUpdate(
            { messageId: messageId, userId: user._id },
            emailData,
            { upsert: true, new: true }
          )

          syncedCount++
          classifiedCount++
          console.log(`✅ Thumbnail sync: ${subject} -> ${classification.label}`)

          return { 
            success: true, 
            emailId: messageId, 
            subject: subject,
            category: classification.label 
          }

        } catch (error) {
          console.error(`❌ Error syncing thumbnail ${messageId}:`, error.message)
          return { 
            success: false, 
            emailId: messageId, 
            error: error.message 
          }
        }
      }))

      const batchResults = await Promise.all(batchPromises)
      const batchSuccessful = batchResults.filter(r => r.success && !r.skipped).length
      const batchSkipped = batchResults.filter(r => r.skipped).length

      console.log(`📊 Batch completed: ${batchSuccessful} synced, ${batchSkipped} skipped`)
    }

    // Get category breakdown
    const categoryBreakdown = {}
    const recentEmails = await Email.find({ userId: user._id })
      .sort({ date: -1 })
      .limit(100)
      .select('category')

    recentEmails.forEach(email => {
      const category = email.category || 'Other'
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1
    })

    console.log(`✅ Thumbnail sync completed:`)
    console.log(`   Total: ${limitedMessageIds.length}`)
    console.log(`   Synced: ${syncedCount}`)
    console.log(`   Skipped: ${skippedCount}`)
    console.log(`   Classified: ${classifiedCount}`)
    console.log(`   Categories:`, categoryBreakdown)

    return {
      success: true,
      total: limitedMessageIds.length,
      synced: syncedCount,
      classified: classifiedCount,
      skipped: skippedCount,
      categoryBreakdown,
      message: `Successfully synced ${syncedCount} email thumbnails`,
      remaining: messageIds.length - limitedMessageIds.length
    }

  } catch (error) {
    console.error('❌ Thumbnail sync error:', error)
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
 * Full Gmail inbox sync - fetches ALL emails (not just incremental)
 * @param {Object} user - User object
 * @param {Object} options - Options { onProgress, classifyDuringSync }
 * @returns {Promise<Object>} Sync results
 */
export const fullHistoricalSync = async (user, options = {}) => {
  const { onProgress, classifyDuringSync = true } = options

  try {
    console.log(`🚀 Starting FULL Gmail sync for user: ${user.email}`)

    if (!user.gmailConnected || !user.gmailAccessToken) {
      throw new Error('Gmail account not connected')
    }

    // Initialize Gmail client
    const oauth2Client = getOAuthForUser(user)
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Check if model service is available for classification
    let modelAvailable = false
    try {
      const modelCheck = await axios.get(`${MODEL_SERVICE_URL}/status`, { timeout: 3000 })
      modelAvailable = modelCheck.data.status === 'ready' && classifyDuringSync
      console.log(`📊 Model service ${modelAvailable ? 'available' : 'unavailable'} for classification`)
    } catch (error) {
      console.log('⚠️  Model service not available, will skip classification during sync')
    }

    let totalFetched = 0
    let pageToken = null
    const stats = { 
      synced: 0, 
      classified: 0, 
      skipped: 0,
      errors: [] 
    }

    // Fetch ALL emails from inbox (no date filter)
    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 500,  // Larger batch size
        q: 'in:inbox',    // No date filter - get ALL
        pageToken
      })

      const messages = response.data.messages || []
      console.log(`📦 Fetched batch: ${messages.length} emails (Page token: ${pageToken ? 'yes' : 'first'})`)

      if (messages.length === 0) {
        break
      }

      // Process batch with concurrency control
      const batchResults = await Promise.all(
        messages.map(msg => limit(async () => {
          try {
            // Check if email already exists
            const existingEmail = await Email.findOne({ 
              gmailId: msg.id,
              userId: user._id 
            }).select('_id').lean()

            if (existingEmail) {
              stats.skipped++
              return { success: true, skipped: true }
            }

            // Fetch full message
            const fullMessage = await fetchMessage(oauth2Client, msg.id)

            // Parse email data
            const emailData = parseEmailMessage(fullMessage)

            // Upsert email
            const savedEmail = await upsertEmail(user, emailData)

            // Classify if model is available
            if (modelAvailable) {
              try {
                const classifyResponse = await axios.post(
                  `${MODEL_SERVICE_URL}/predict`,
                  {
                    subject: savedEmail.subject || '',
                    body: savedEmail.snippet || '',
                    user_id: user._id.toString()
                  },
                  { timeout: 10000 }
                )

                if (classifyResponse.data) {
                  await Email.updateOne(
                    { _id: savedEmail._id },
                    {
                      $set: {
                        category: classifyResponse.data.label,
                        'classification.label': classifyResponse.data.label,
                        'classification.confidence': classifyResponse.data.confidence,
                        'classification.model': 'distilbert-trained',
                        'classification.classifiedAt': new Date()
                      }
                    }
                  )
                  stats.classified++
                }
              } catch (classifyError) {
                console.error(`Classification failed for ${savedEmail._id}:`, classifyError.message)
              }
            }

            stats.synced++
            return { success: true, new: true }

          } catch (error) {
            stats.errors.push({ id: msg.id, error: error.message })
            console.error(`Failed to process ${msg.id}:`, error.message)
            return { success: false, error: error.message }
          }
        }))
      )

      totalFetched += messages.length
      pageToken = response.data.nextPageToken

      // Progress callback
      if (onProgress) {
        onProgress({
          totalFetched,
          synced: stats.synced,
          classified: stats.classified,
          skipped: stats.skipped,
          hasMore: !!pageToken
        })
      }

      console.log(`✅ Progress: Fetched ${totalFetched}, Synced ${stats.synced}, Classified ${stats.classified}, Skipped ${stats.skipped}`)

      // Rate limiting - small delay between batches
      if (pageToken) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

    } while (pageToken)

    console.log(`\n✅ Full sync complete!`)
    console.log(`   Total fetched: ${totalFetched}`)
    console.log(`   New emails synced: ${stats.synced}`)
    console.log(`   Classified: ${stats.classified}`)
    console.log(`   Skipped (existing): ${stats.skipped}`)
    console.log(`   Errors: ${stats.errors.length}`)

    return {
      success: true,
      totalFetched,
      synced: stats.synced,
      classified: stats.classified,
      skipped: stats.skipped,
      errors: stats.errors.length,
      errorDetails: stats.errors.slice(0, 10) // First 10 errors
    }

  } catch (error) {
    console.error('❌ Full sync error:', error)
    throw error
  }
}
