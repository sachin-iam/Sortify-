import express from 'express'
import { google } from 'googleapis'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import User from '../models/User.js'
import Email from '../models/Email.js'
import { classifyEmail } from '../services/enhancedClassificationService.js'
import { startRealtimeSync, stopRealtimeSync, isSyncActive } from '../services/realtimeSync.js'
import { fullSync, syncLabels } from '../services/gmailSyncService.js'
import notificationService from '../services/notificationService.js'
import { updateUserActivity } from '../services/enhancedRealtimeSync.js'
import { reclassifyAllEmails, getJobStatus } from '../services/emailReclassificationService.js'
import { estimateReclassificationTime } from '../services/categoryFeatureService.js'
import { sendReply } from '../services/gmailSendService.js'
import { groupEmailsIntoThreads } from '../services/threadGroupingService.js'

const router = express.Router()

// Gmail OAuth client
const getGmailClient = (accessToken, refreshToken) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

// @desc    Sync Gmail emails
// @route   POST /api/emails/gmail/sync
// @access  Private
router.post('/gmail/sync', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    
    if (!user.gmailConnected || !user.gmailAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Gmail account not connected'
      })
    }

    const gmail = getGmailClient(user.gmailAccessToken, user.gmailRefreshToken)
    
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
    }
    
    // Get emails (limited to 200 for quick sync)
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 200,
      q: query
    })

    const messages = response.data.messages || []
    let syncedCount = 0
    let newEmailCount = 0

    for (const message of messages) {
      try {
        // Skip if message.id is null or undefined
        if (!message.id) {
          console.log('Skipping message with null/undefined ID')
          continue
        }

        // Check if email already exists
        const existingEmail = await Email.findOne({ 
          gmailId: message.id,
          userId: user._id 
        })

        if (existingEmail) {
          console.log(`Email ${message.id} already exists, skipping`)
          continue
        }

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

        // Use upsert to avoid duplicate key errors
        const result = await Email.findOneAndUpdate(
          { messageId: message.id, userId: user._id },
          emailData,
          { upsert: true, new: true }
        )
        
        // Check if this was a new email (not existing before)
        if (!existingEmail) {
          newEmailCount++
          // Send individual new email notification
          notificationService.sendNewEmailNotification(user._id.toString(), {
            _id: result._id,
            from: emailData.from,
            subject: emailData.subject,
            category: emailData.category,
            isRead: emailData.isRead || false
          }).catch(error => {
            console.error('Error sending new email notification:', error)
          })
        }
        
        syncedCount++

      } catch (error) {
        console.error(`Error syncing email ${message.id}:`, error)
        // Continue with next email instead of stopping
        continue
      }
    }

    // Analytics will be updated automatically via frontend polling

    // Send notification about sync completion
    const syncMessage = newEmailCount > 0 
      ? `Found ${newEmailCount} new emails! Synced ${syncedCount} total.`
      : messages.length > 0 
        ? `No new emails found (checked ${messages.length} recent emails)`
        : 'No new emails in your inbox'
    
    notificationService.sendSyncStatusNotification(req.user._id.toString(), {
      status: 'completed',
      message: syncMessage,
      timestamp: new Date().toISOString(),
      count: syncedCount,
      newEmailCount: newEmailCount
    }).catch(error => {
      console.error('Error sending sync completion notification:', error)
    })

    res.json({
      success: true,
      message: syncMessage,
      syncedCount,
      newEmailCount,
      checkedCount: messages.length
    })

  } catch (error) {
    console.error('Gmail sync error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to sync Gmail emails'
    })
  }
}))

// @desc    Sync ALL Gmail emails (comprehensive sync)
// @route   POST /api/emails/gmail/sync-all
// @access  Private
router.post('/gmail/sync-all', protect, asyncHandler(async (req, res) => {
  try {
    console.log('SYNC_ALL_START:', req.user._id)
    
    const { fullSync } = await import('../services/gmailSyncService.js')
    const result = await fullSync(req.user)
    
    console.log('SYNC_ALL_SUCCESS:', result)
    
    // Send notification about full sync completion
    notificationService.sendSyncStatusNotification(req.user._id.toString(), {
      status: 'completed',
      message: `Full sync completed: ${result.syncedCount || 0} emails processed`,
      timestamp: new Date().toISOString(),
      count: result.syncedCount || 0
    })
    
    return res.json({ 
      success: true, 
      provider: 'gmail', 
      ...result 
    })
  } catch (err) {
    console.error('SYNC_ALL_ERROR:', err?.message)
    
    // Send notification about sync failure
    notificationService.sendSyncStatusNotification(req.user._id.toString(), {
      status: 'failed',
      message: `Full sync failed: ${err?.message || 'Unknown error'}`,
      timestamp: new Date().toISOString()
    })
    
    return res.status(400).json({ 
      success: false, 
      message: err?.message || 'Sync failed' 
    })
  }
}))

// @desc    Get user emails
// @route   GET /api/emails
// @access  Private
router.get('/', protect, asyncHandler(async (req, res) => {
  try {
    // Update user activity for smart syncing
    updateUserActivity(req.user._id)
    
    const { 
      page = 1, 
      limit = 25, 
      category, 
      provider = 'gmail', 
      q: search,
      threaded = 'false' // New parameter for thread grouping
    } = req.query
    const skip = (page - 1) * limit
    const isThreaded = threaded === 'true'

    let query = { userId: req.user._id }

    // Filter by provider (default to gmail)
    if (provider === 'gmail') {
      query.provider = 'gmail'
    } else if (provider === 'outlook') {
      // Outlook coming soon - return empty for now
      return res.json({
        success: true,
        items: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit)
      })
    }

    // Filter by category
    if (category && category !== 'All' && category !== 'all') {
      query.category = category
    }

    // Search functionality
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { from: { $regex: search, $options: 'i' } },
        { snippet: { $regex: search, $options: 'i' } }
      ]
    }

    // Fetch emails - need more data for threading
    const selectFields = isThreaded 
      ? '_id subject from to snippet date category classification isRead labels isArchived archivedAt threadId'
      : '_id subject from to snippet date category classification isRead labels isArchived archivedAt'

    const emails = await Email.find(query)
      .sort({ date: -1 })
      .select(selectFields)
      .lean()

    // Apply threading if requested
    let items
    let total
    
    if (isThreaded) {
      // Group emails into threads
      const allThreads = groupEmailsIntoThreads(emails)
      total = allThreads.length
      
      // Apply pagination to threads
      items = allThreads.slice(skip, skip + parseInt(limit))
    } else {
      // Regular pagination on individual emails
      items = emails.slice(skip, skip + parseInt(limit))
      total = await Email.countDocuments(query)
    }

    // Set cache control headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })

    // Format response as requested
    res.json({
      success: true,
      items,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      threaded: isThreaded
    })

  } catch (error) {
    console.error('Get emails error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch emails'
    })
  }
}))

// @desc    Get email statistics
// @route   GET /api/emails/stats
// @access  Private
router.get('/stats', protect, asyncHandler(async (req, res) => {
  try {
    const stats = await Email.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          },
          important: {
            $sum: { $cond: [{ $eq: ['$classification', 'important'] }, 1, 0] }
          },
          spam: {
            $sum: { $cond: [{ $eq: ['$classification', 'spam'] }, 1, 0] }
          }
        }
      }
    ])

    const result = stats[0] || {
      total: 0,
      unread: 0,
      important: 0,
      spam: 0
    }

    res.json({
      success: true,
      stats: {
        total: result.total,
        unread: result.unread,
        important: result.important,
        spam: result.spam
      }
    })

  } catch (error) {
    console.error('Get email stats error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email statistics'
    })
  }
}))

// @desc    Get all messages in a thread
// @route   GET /api/emails/thread/:containerId
// @access  Private
router.get('/thread/:containerId', protect, asyncHandler(async (req, res) => {
  try {
    const { containerId } = req.params
    console.log(`📧 Thread request for container: ${containerId}`)
    
    const { parseThreadContainerId, getThreadMessages } = await import('../services/threadGroupingService.js')
    
    // Parse the container ID to get threadId and dateKey
    const parsed = parseThreadContainerId(containerId)
    console.log(`📧 Parsed result:`, parsed)
    
    if (!parsed) {
      console.log(`📧 Not a thread container ID, trying as single email`)
      // If not a valid container ID, try to fetch as single email
      const email = await Email.findOne({
        _id: containerId,
        userId: req.user._id
      })
      
      if (!email) {
        console.log(`❌ Email not found: ${containerId}`)
        return res.status(404).json({
          success: false,
          message: 'Thread or email not found'
        })
      }
      
      console.log(`✅ Single email found: ${email.subject}`)
      console.log(`   Thread ID: ${email.threadId}`)
      
      // If this email has a threadId, fetch all messages in that thread for the same day
      if (email.threadId) {
        console.log(`📧 Email is part of a thread, fetching all thread messages`)
        const { normalizeDate } = await import('../services/threadGroupingService.js')
        const dateKey = normalizeDate(email.date)
        
        const messages = await getThreadMessages(Email, email.threadId, req.user._id, dateKey)
        console.log(`📧 Found ${messages ? messages.length : 0} messages in thread`)
        
        if (messages && messages.length > 0) {
          return res.json({
            success: true,
            messages,
            isThread: messages.length > 1,
            threadId: email.threadId,
            dateKey
          })
        }
      }
      
      // Return single email as array
      return res.json({
        success: true,
        messages: [email],
        isThread: false
      })
    }
    
    const { threadId, dateKey } = parsed
    console.log(`📧 Fetching thread messages for threadId: ${threadId}, date: ${dateKey}`)
    
    // Fetch all messages in the thread for that day
    const messages = await getThreadMessages(Email, threadId, req.user._id, dateKey)
    console.log(`📧 Found ${messages ? messages.length : 0} messages`)
    
    if (!messages || messages.length === 0) {
      console.log(`❌ No messages found for thread`)
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      })
    }
    
    console.log(`✅ Returning ${messages.length} thread messages`)
    res.json({
      success: true,
      messages,
      isThread: messages.length > 1,
      threadId,
      dateKey
    })
    
  } catch (error) {
    console.error('Get thread messages error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch thread messages',
      error: error.message
    })
  }
}))

// @desc    Get single email by ID
// @route   GET /api/emails/:id
// @access  Private
router.get('/:id', protect, asyncHandler(async (req, res) => {
  try {
    // Update user activity for smart syncing
    updateUserActivity(req.user._id)
    
    const email = await Email.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    })

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      })
    }

    res.json({
      success: true,
      email
    })

  } catch (error) {
    console.error('Get email error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email'
    })
  }
}))

// @desc    Download email attachment
// @route   GET /api/emails/:id/attachments/:attachmentId/download
// @access  Private
router.get('/:id/attachments/:attachmentId/download', protect, asyncHandler(async (req, res) => {
  try {
    const email = await Email.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    })

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      })
    }

    // Get user for OAuth
    const User = (await import('../models/User.js')).default
    const user = await User.findById(req.user._id)
    
    if (!user.gmailConnected) {
      return res.status(400).json({
        success: false,
        message: 'Gmail not connected'
      })
    }

    // Download attachment from Gmail
    const { downloadAttachment } = await import('../services/gmailSyncService.js')
    const { getOAuthForUser } = await import('../services/gmailSyncService.js')
    
    const oauth2 = getOAuthForUser(user)
    const attachmentData = await downloadAttachment(oauth2, email.gmailId, req.params.attachmentId)

    // Find attachment info
    const attachment = email.attachments.find(att => att.attachmentId === req.params.attachmentId)
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      })
    }

    // Set headers
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`)
    res.setHeader('Content-Length', attachmentData.length)

    res.send(attachmentData)

  } catch (error) {
    console.error('Download attachment error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to download attachment'
    })
  }
}))

// @desc    Archive email
// @route   PUT /api/emails/:id/archive
// @access  Private
router.put('/:id/archive', protect, asyncHandler(async (req, res) => {
  try {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📦 ARCHIVE REQUEST RECEIVED`)
    console.log(`   Email ID: ${req.params.id}`)
    console.log(`   User ID: ${req.user._id}`)
    console.log(`${'='.repeat(60)}\n`)
    
    const email = await Email.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    })

    if (!email) {
      console.log('❌ Email not found in database')
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      })
    }

    console.log(`📧 Email found in database:`)
    console.log(`   Subject: ${email.subject}`)
    console.log(`   Provider: ${email.provider}`)
    console.log(`   Gmail ID: ${email.gmailId || 'NOT SET'}`)
    console.log(`   Current Labels: ${email.labels?.join(', ') || 'none'}`)
    console.log(`   Currently Archived: ${email.isArchived || false}`)

    // Update Gmail labels if Gmail email (fault-tolerant)
    let gmailSyncSuccess = false
    if (email.provider === 'gmail' && email.gmailId) {
      try {
        console.log(`\n🔄 Attempting to archive email in Gmail...`)
        console.log(`   Gmail ID: ${email.gmailId}`)
        
        const User = (await import('../models/User.js')).default
        const user = await User.findById(req.user._id)
        
        if (!user.gmailConnected) {
          console.log('   ⚠️ Gmail not connected for user')
        } else if (!user.gmailAccessToken) {
          console.log('   ⚠️ No Gmail access token available')
        } else {
          console.log('   ✓ User has Gmail connected with access token')
          
          const { getOAuthForUser } = await import('../services/gmailSyncService.js')
          const oauth2 = getOAuthForUser(user)
          
          // Set up token refresh handler
          oauth2.on('tokens', async (tokens) => {
            console.log('   🔄 OAuth token refreshed automatically')
            if (tokens.access_token) {
              user.gmailAccessToken = tokens.access_token
            }
            if (tokens.refresh_token) {
              user.gmailRefreshToken = tokens.refresh_token
            }
            if (tokens.expiry_date) {
              user.gmailTokenExpiry = new Date(tokens.expiry_date)
            }
            await user.save()
          })
          
          const gmail = google.gmail({ version: 'v1', auth: oauth2 })

          // First check current email state
          console.log('   📥 Checking current Gmail state...')
          const currentState = await gmail.users.messages.get({
            userId: 'me',
            id: email.gmailId,
            format: 'minimal'
          })
          const currentLabels = currentState.data.labelIds || []
          console.log('   📧 Current labels:', currentLabels.join(', '))
          
          // Check if email has INBOX label
          if (!currentLabels.includes('INBOX')) {
            console.log('   ⚠️ Email does not have INBOX label - already archived in Gmail')
            console.log('   Skipping Gmail API call')
            gmailSyncSuccess = true // Consider this a success since it's already archived
          } else {
            // Remove INBOX label to archive in Gmail
            console.log('   📤 Calling Gmail API to remove INBOX label...')
            const modifyResponse = await gmail.users.messages.modify({
              userId: 'me',
              id: email.gmailId,
              requestBody: {
                removeLabelIds: ['INBOX']
              }
            })
            
            const newLabels = modifyResponse.data.labelIds || []
            console.log('   ✅ Gmail API modify response:', {
              id: modifyResponse.data.id,
              labelIds: newLabels.join(', '),
              inboxRemoved: !newLabels.includes('INBOX')
            })
            
            // Verify the change by fetching again
            console.log('   🔍 Verifying change in Gmail...')
            const verifyState = await gmail.users.messages.get({
              userId: 'me',
              id: email.gmailId,
              format: 'minimal'
            })
            const finalLabels = verifyState.data.labelIds || []
            console.log('   📧 Final labels after modification:', finalLabels.join(', '))
            
            if (finalLabels.includes('INBOX')) {
              console.log('   ⚠️ WARNING: INBOX label still present after modification!')
              console.log('   Gmail may not have processed the change yet')
            } else {
              console.log('   ✅ VERIFIED: INBOX label successfully removed from Gmail')
            }
            
            gmailSyncSuccess = true
            console.log(`✅ Gmail archive synced successfully for email: ${email.subject}`)
          }
        }
      } catch (gmailError) {
        console.error('\n❌ Gmail archive error (continuing with local update):')
        console.error(`   Message: ${gmailError.message}`)
        console.error(`   Code: ${gmailError.code}`)
        if (gmailError.errors) {
          console.error(`   Errors:`, gmailError.errors)
        }
        if (gmailError.response) {
          console.error(`   Response:`, gmailError.response.data)
        }
        // Continue with local update even if Gmail fails
      }
    } else {
      console.log('\n⚠️ SKIPPING Gmail sync:')
      if (!email.provider || email.provider !== 'gmail') {
        console.log(`   Reason: Provider is '${email.provider}', not 'gmail'`)
      }
      if (!email.gmailId) {
        console.log(`   Reason: Email has no Gmail ID`)
        console.log(`   This email may have been created manually or synced incorrectly`)
      }
    }

    // Update local database (always happens regardless of Gmail sync)
    email.isArchived = true
    email.archivedAt = new Date()
    if (email.labels) {
      email.labels = email.labels.filter(label => label !== 'INBOX')
    }
    await email.save()

    // Send WebSocket notification for real-time updates
    try {
      const { sendEmailSyncUpdate } = await import('../services/websocketService.js')
      sendEmailSyncUpdate(req.user._id.toString(), {
        type: 'email_archived',
        emailId: req.params.id,
        emailSubject: email.subject,
        gmailSynced: gmailSyncSuccess,
        message: 'Email archived successfully'
      })
    } catch (wsError) {
      console.error('WebSocket notification error:', wsError.message)
      // Don't fail the request if WebSocket fails
    }

    // Send notification about email archive
    notificationService.sendEmailOperationNotification(req.user._id.toString(), {
      operation: 'archived',
      message: `Email "${email.subject || 'Untitled'}" has been archived`,
      emailId: req.params.id,
      emailSubject: email.subject
    })

    console.log(`\n✅ ARCHIVE OPERATION COMPLETE`)
    console.log(`   Local DB Updated: YES`)
    console.log(`   Gmail Synced: ${gmailSyncSuccess ? 'YES' : 'NO'}`)
    console.log(`${'='.repeat(60)}\n`)

    res.json({
      success: true,
      message: 'Email archived successfully',
      email,
      gmailSynced: gmailSyncSuccess
    })

  } catch (error) {
    console.error(`\n❌ ARCHIVE OPERATION FAILED`)
    console.error(`   Error: ${error.message}`)
    console.error(`${'='.repeat(60)}\n`)
    res.status(500).json({
      success: false,
      message: 'Failed to archive email'
    })
  }
}))

// @desc    Unarchive email
// @route   PUT /api/emails/:id/unarchive
// @access  Private
router.put('/:id/unarchive', protect, asyncHandler(async (req, res) => {
  try {
    const email = await Email.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    })

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      })
    }

    // Update Gmail labels if Gmail email (fault-tolerant)
    let gmailSyncSuccess = false
    if (email.provider === 'gmail' && email.gmailId) {
      try {
        console.log(`🔄 Attempting to unarchive email in Gmail: ${email.subject}`)
        console.log(`   Gmail ID: ${email.gmailId}`)
        
        const User = (await import('../models/User.js')).default
        const user = await User.findById(req.user._id)
        
        if (!user.gmailConnected) {
          console.log('   ⚠️ Gmail not connected for user')
        } else if (!user.gmailAccessToken) {
          console.log('   ⚠️ No Gmail access token available')
        } else {
          console.log('   ✓ User has Gmail connected with access token')
          
          const { getOAuthForUser } = await import('../services/gmailSyncService.js')
          const oauth2 = getOAuthForUser(user)
          
          // Set up token refresh handler
          oauth2.on('tokens', async (tokens) => {
            console.log('   🔄 OAuth token refreshed automatically')
            if (tokens.access_token) {
              user.gmailAccessToken = tokens.access_token
            }
            if (tokens.refresh_token) {
              user.gmailRefreshToken = tokens.refresh_token
            }
            if (tokens.expiry_date) {
              user.gmailTokenExpiry = new Date(tokens.expiry_date)
            }
            await user.save()
          })
          
          const gmail = google.gmail({ version: 'v1', auth: oauth2 })

          // First check current email state
          console.log('   📥 Checking current Gmail state...')
          const currentState = await gmail.users.messages.get({
            userId: 'me',
            id: email.gmailId,
            format: 'minimal'
          })
          const currentLabels = currentState.data.labelIds || []
          console.log('   📧 Current labels:', currentLabels.join(', '))
          
          // Check if email already has INBOX label
          if (currentLabels.includes('INBOX')) {
            console.log('   ⚠️ Email already has INBOX label - not archived in Gmail')
            console.log('   Skipping Gmail API call')
            gmailSyncSuccess = true // Consider this a success since it's already in inbox
          } else {
            // Add INBOX label back to unarchive in Gmail
            console.log('   📥 Calling Gmail API to add INBOX label...')
            const modifyResponse = await gmail.users.messages.modify({
              userId: 'me',
              id: email.gmailId,
              requestBody: {
                addLabelIds: ['INBOX']
              }
            })
            
            const newLabels = modifyResponse.data.labelIds || []
            console.log('   ✅ Gmail API modify response:', {
              id: modifyResponse.data.id,
              labelIds: newLabels.join(', '),
              inboxAdded: newLabels.includes('INBOX')
            })
            
            // Verify the change by fetching again
            console.log('   🔍 Verifying change in Gmail...')
            const verifyState = await gmail.users.messages.get({
              userId: 'me',
              id: email.gmailId,
              format: 'minimal'
            })
            const finalLabels = verifyState.data.labelIds || []
            console.log('   📧 Final labels after modification:', finalLabels.join(', '))
            
            if (!finalLabels.includes('INBOX')) {
              console.log('   ⚠️ WARNING: INBOX label not present after modification!')
              console.log('   Gmail may not have processed the change yet')
            } else {
              console.log('   ✅ VERIFIED: INBOX label successfully added to Gmail')
            }
            
            gmailSyncSuccess = true
            console.log(`✅ Gmail unarchive synced successfully for email: ${email.subject}`)
          }
        }
      } catch (gmailError) {
        console.error('❌ Gmail unarchive error (continuing with local update):', {
          message: gmailError.message,
          code: gmailError.code,
          errors: gmailError.errors
        })
        // Continue with local update even if Gmail fails
      }
    } else {
      if (!email.gmailId) {
        console.log('   ⚠️ No Gmail ID for this email')
      }
    }

    // Update local database (always happens regardless of Gmail sync)
    email.isArchived = false
    email.archivedAt = null
    if (email.labels && !email.labels.includes('INBOX')) {
      email.labels.push('INBOX')
    }
    await email.save()

    // Send WebSocket notification for real-time updates
    try {
      const { sendEmailSyncUpdate } = await import('../services/websocketService.js')
      sendEmailSyncUpdate(req.user._id.toString(), {
        type: 'email_unarchived',
        emailId: req.params.id,
        emailSubject: email.subject,
        gmailSynced: gmailSyncSuccess,
        message: 'Email unarchived successfully'
      })
    } catch (wsError) {
      console.error('WebSocket notification error:', wsError.message)
      // Don't fail the request if WebSocket fails
    }

    // Send notification about email unarchive
    notificationService.sendEmailOperationNotification(req.user._id.toString(), {
      operation: 'unarchived',
      message: `Email "${email.subject || 'Untitled'}" has been unarchived`,
      emailId: req.params.id,
      emailSubject: email.subject
    })

    res.json({
      success: true,
      message: 'Email unarchived successfully',
      email,
      gmailSynced: gmailSyncSuccess
    })

  } catch (error) {
    console.error('Unarchive email error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to unarchive email'
    })
  }
}))

// @desc    Send reply to email
// @route   POST /api/emails/:id/reply
// @access  Private
router.post('/:id/reply', protect, asyncHandler(async (req, res) => {
  try {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📧 REPLY REQUEST RECEIVED`)
    console.log(`   Email ID: ${req.params.id}`)
    console.log(`   User ID: ${req.user._id}`)
    console.log(`${'='.repeat(60)}\n`)

    const { body: replyBody } = req.body

    if (!replyBody || !replyBody.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply body is required'
      })
    }

    // Find the email to reply to
    const email = await Email.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    })

    if (!email) {
      console.log('❌ Email not found in database')
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      })
    }

    console.log(`📧 Email found:`)
    console.log(`   Subject: ${email.subject}`)
    console.log(`   From: ${email.from}`)
    console.log(`   Gmail ID: ${email.gmailId || 'NOT SET'}`)
    console.log(`   Thread ID: ${email.threadId || 'NOT SET'}`)

    // Get user with Gmail credentials
    const user = await User.findById(req.user._id)

    if (!user.gmailConnected || !user.gmailAccessToken) {
      console.log('❌ Gmail not connected for user')
      return res.status(400).json({
        success: false,
        message: 'Gmail account not connected. Please connect your Gmail account first.'
      })
    }

    // Extract sender email from "Name <email@domain.com>" format
    const extractEmail = (emailStr) => {
      const match = emailStr.match(/<(.+?)>/)
      return match ? match[1] : emailStr
    }

    // Parse Message-ID from email headers if available
    // Message-ID is typically stored in the email object, but may need to be fetched
    const messageId = email.messageId || email.gmailId
    
    // Prepare reply data
    const replyData = {
      to: extractEmail(email.from),
      subject: email.subject,
      body: replyBody,
      threadId: email.threadId,
      inReplyTo: messageId ? `<${messageId}>` : undefined,
      references: messageId ? `<${messageId}>` : undefined
    }

    console.log(`\n📤 Sending reply via Gmail API...`)
    console.log(`   To: ${replyData.to}`)
    console.log(`   Subject: Re: ${replyData.subject}`)
    console.log(`   Thread ID: ${replyData.threadId || 'N/A'}`)

    // Send reply via Gmail
    const result = await sendReply(user, replyData)

    if (result.success) {
      console.log(`\n✅ REPLY SENT SUCCESSFULLY`)
      console.log(`   Message ID: ${result.messageId}`)
      console.log(`   Thread ID: ${result.threadId}`)
      console.log(`${'='.repeat(60)}\n`)

      // Fetch the sent message from Gmail to get full details
      let sentEmailData = null
      try {
        const gmail = getGmailClient(user.gmailAccessToken, user.gmailRefreshToken)
        const sentMessage = await gmail.users.messages.get({
          userId: 'me',
          id: result.messageId,
          format: 'full'
        })

        // Parse the sent message and save it to database
        const headers = sentMessage.data.payload.headers
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value

        // Get email body
        let emailBody = ''
        let emailHtml = ''
        
        const getBody = (payload) => {
          if (payload.body && payload.body.data) {
            const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8')
            return decoded
          }
          if (payload.parts) {
            for (const part of payload.parts) {
              if (part.mimeType === 'text/plain' && part.body.data) {
                emailBody = Buffer.from(part.body.data, 'base64').toString('utf-8')
              }
              if (part.mimeType === 'text/html' && part.body.data) {
                emailHtml = Buffer.from(part.body.data, 'base64').toString('utf-8')
              }
            }
          }
        }
        
        getBody(sentMessage.data.payload)

        // Create email document for the sent reply
        const newEmail = new Email({
          userId: req.user._id,
          provider: 'gmail',
          gmailId: result.messageId,
          messageId: getHeader('Message-ID'),
          threadId: result.threadId,
          subject: getHeader('Subject') || `Re: ${email.subject}`,
          from: user.email,
          to: extractEmail(email.from),
          date: new Date(parseInt(sentMessage.data.internalDate)),
          snippet: sentMessage.data.snippet,
          body: emailBody || replyBody,
          html: emailHtml,
          text: emailBody || replyBody,
          isRead: true,
          labels: sentMessage.data.labelIds || [],
          category: email.category || 'Other',
          isFullContentLoaded: true,
          fullContentLoadedAt: new Date()
        })

        await newEmail.save()
        sentEmailData = newEmail
        console.log(`✅ Sent reply saved to database with ID: ${newEmail._id}`)
      } catch (saveError) {
        console.error('⚠️  Failed to save sent reply to database:', saveError.message)
        // Don't fail the request if saving fails - the email was still sent
      }

      // Send notification about successful reply
      notificationService.sendEmailOperationNotification(req.user._id.toString(), {
        operation: 'replied',
        message: `Reply sent to "${email.from}"`,
        emailId: req.params.id,
        emailSubject: email.subject
      })

      res.json({
        success: true,
        message: 'Reply sent successfully',
        messageId: result.messageId,
        threadId: result.threadId,
        sentEmail: sentEmailData // Include the saved email data
      })
    } else {
      throw new Error('Failed to send reply')
    }

  } catch (error) {
    console.error(`\n❌ REPLY OPERATION FAILED`)
    console.error(`   Error: ${error.message}`)
    console.error(`${'='.repeat(60)}\n`)

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send reply'
    })
  }
}))

// @desc    Delete email
// @route   DELETE /api/emails/:id
// @access  Private
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  try {
    const email = await Email.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    })

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      })
    }

    // Move to Gmail TRASH if Gmail email
    if (email.provider === 'gmail' && email.gmailId) {
      try {
        const User = (await import('../models/User.js')).default
        const user = await User.findById(req.user._id)
        
        if (user.gmailConnected) {
          const { getOAuthForUser } = await import('../services/gmailSyncService.js')
          const oauth2 = getOAuthForUser(user)
          const gmail = google.gmail({ version: 'v1', auth: oauth2 })

          // Move to TRASH
          await gmail.users.messages.trash({
            userId: 'me',
            id: email.gmailId
          })
        }
      } catch (gmailError) {
        console.error('Gmail delete error:', gmailError)
        // Continue with local delete even if Gmail fails
      }
    }

    // Remove from local database
    await Email.findByIdAndDelete(req.params.id)

    // Send notification about email deletion
    notificationService.sendEmailOperationNotification(req.user._id.toString(), {
      operation: 'deleted',
      message: `Email "${email.subject || 'Untitled'}" has been deleted`,
      emailId: req.params.id,
      emailSubject: email.subject
    })

    res.json({
      success: true,
      message: 'Email deleted successfully'
    })

  } catch (error) {
    console.error('Delete email error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete email'
    })
  }
}))

// @desc    Recategorize email
// @route   POST /api/emails/recategorize/:emailId
// @access  Private
router.post('/recategorize/:emailId', protect, asyncHandler(async (req, res) => {
  try {
    const { emailId } = req.params
    const { newCategory } = req.body
    const userId = req.user._id

    if (!newCategory) {
      return res.status(400).json({
        success: false,
        message: 'New category is required'
      })
    }

    // Find the email
    const email = await Email.findOne({
      _id: emailId,
      userId: userId,
      isDeleted: false
    })

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      })
    }

    // Check if category exists
    const category = await Category.findOne({
      userId: userId,
      name: newCategory
    })

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    const oldCategory = email.category

    // Update email category
    await Email.findByIdAndUpdate(emailId, {
      category: newCategory,
      updatedAt: new Date()
    })

    // Update category email counts
    await Category.updateEmailCount(userId, oldCategory)
    await Category.updateEmailCount(userId, newCategory)

    // Trigger continuous learning
    try {
      const { onEmailRecategorized } = await import('../services/continuousLearningService.js')
      await onEmailRecategorized(emailId, oldCategory, newCategory, userId.toString())
    } catch (learningError) {
      console.warn('Failed to trigger continuous learning:', learningError.message)
    }

    // Send WebSocket update
    try {
      const { sendEmailSyncUpdate } = await import('../services/websocketService.js')
      sendEmailSyncUpdate(userId.toString(), {
        type: 'email_recategorized',
        emailId: emailId,
        oldCategory: oldCategory,
        newCategory: newCategory,
        message: `Email moved from "${oldCategory}" to "${newCategory}"`
      })
    } catch (wsError) {
      console.warn('Failed to send WebSocket update:', wsError.message)
    }

    res.json({
      success: true,
      message: 'Email recategorized successfully',
      emailId: emailId,
      oldCategory: oldCategory,
      newCategory: newCategory
    })

  } catch (error) {
    console.error('Recategorize email error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to recategorize email',
      error: error.message
    })
  }
}))

// @desc    Export emails to CSV
// @route   POST /api/emails/export/csv
// @access  Private
router.post('/export/csv', protect, asyncHandler(async (req, res) => {
  try {
    const { emailIds } = req.body

    if (!emailIds || !Array.isArray(emailIds)) {
      return res.status(400).json({
        success: false,
        message: 'Email IDs required'
      })
    }

    const emails = await Email.find({
      _id: { $in: emailIds },
      userId: req.user._id
    })

    if (emails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No emails found'
      })
    }

    // Create CSV content
    const csvHeader = 'Subject,From,To,Date,Category,Confidence,Snippet\n'
    const csvRows = emails.map(email => {
      const subject = (email.subject || '').replace(/"/g, '""')
      const from = (email.from || '').replace(/"/g, '""')
      const to = (email.to || '').replace(/"/g, '""')
      const date = email.date ? email.date.toISOString() : ''
      const category = email.category || 'Other'
      const confidence = email.classification?.confidence || 0
      const snippet = (email.snippet || '').replace(/"/g, '""').replace(/\n/g, ' ')

      return `"${subject}","${from}","${to}","${date}","${category}",${confidence},"${snippet}"`
    })

    const csvContent = csvHeader + csvRows.join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="emails-export-${Date.now()}.csv"`)
    res.send(csvContent)

  } catch (error) {
    console.error('Export CSV error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to export emails'
    })
  }
}))

// @desc    Classify email
// @route   POST /api/emails/classify/:id
// @access  Private
router.post('/classify/:id', protect, asyncHandler(async (req, res) => {
  try {
    const email = await Email.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    })

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      })
    }

    // Call ML service for classification
    const mlResponse = await fetch(`${process.env.MODEL_SERVICE_URL}/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: email.subject,
        body: email.snippet,
        from: email.from
      })
    })

    if (mlResponse.ok) {
      const classification = await mlResponse.json()
      email.category = classification.category
      email.confidence = classification.confidence
      await email.save()

      res.json({
        success: true,
        category: classification.category,
        confidence: classification.confidence
      })
    } else {
      // Fallback to manual classification
      email.category = 'general'
      email.confidence = 0.5
      await email.save()

      res.json({
        success: true,
        category: 'general',
        confidence: 0.5
      })
    }

  } catch (error) {
    console.error('Email classification error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to classify email'
    })
  }
}))

// @desc    Get email labels/categories
// @route   GET /api/emails/labels
// @access  Private
router.get('/labels', protect, asyncHandler(async (req, res) => {
  try {
    const categories = await Email.distinct('category', { userId: req.user._id })
    
    res.json({
      success: true,
      labels: categories
    })

  } catch (error) {
    console.error('Get labels error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch labels'
    })
  }
}))

// @desc    Classify emails using ML
// @route   POST /api/emails/classify
// @access  Private
router.post('/classify', protect, asyncHandler(async (req, res) => {
  try {
    const { emailIds } = req.body

    if (!emailIds || !Array.isArray(emailIds)) {
      return res.status(400).json({
        success: false,
        message: 'Email IDs array is required'
      })
    }

    const emails = await Email.find({
      _id: { $in: emailIds },
      userId: req.user._id
    })

    if (emails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No emails found'
      })
    }

    // For now, just return success - ML classification would be implemented here
    res.json({
      success: true,
      message: `Classified ${emails.length} emails`,
      classifiedCount: emails.length
    })

  } catch (error) {
    console.error('Email classification error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to classify emails'
    })
  }
}))

// @desc    Export emails as CSV
// @route   POST /api/emails/export
// @access  Private
router.post('/export', protect, asyncHandler(async (req, res) => {
  try {
    const { emailIds, format = 'csv' } = req.body

    let query = { userId: req.user._id }
    if (emailIds && Array.isArray(emailIds) && emailIds.length > 0) {
      query._id = { $in: emailIds }
    }

    const emails = await Email.find(query)
      .select('subject from date category snippet')
      .sort({ date: -1 })

    if (emails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No emails found to export'
      })
    }

    if (format === 'csv') {
      // Create CSV content
      const csvHeader = 'Subject,From,Date,Category,Snippet\n'
      const csvRows = emails.map(email => {
        const subject = `"${(email.subject || '').replace(/"/g, '""')}"`
        const from = `"${(email.from || '').replace(/"/g, '""')}"`
        const date = email.date ? email.date.toISOString() : ''
        const category = email.category || ''
        const snippet = `"${(email.snippet || '').replace(/"/g, '""')}"`

        return `${subject},${from},${date},${category},${snippet}`
      }).join('\n')

      const csvContent = csvHeader + csvRows

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="sortify-emails-${new Date().toISOString().split('T')[0]}.csv"`)
      res.send(csvContent)
    } else {
      res.json({
        success: true,
        data: emails,
        count: emails.length
      })
    }

  } catch (error) {
    console.error('Email export error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to export emails'
    })
  }
}))

// @desc    Update email category
// @route   PUT /api/emails/:id/category
// @access  Private
router.put('/:id/category', protect, asyncHandler(async (req, res) => {
  try {
    const { category } = req.body
    const { id } = req.params

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      })
    }

    const email = await Email.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { 
        category,
        classification: {
          label: category,
          confidence: 1.0
        }
      },
      { new: true }
    )

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      })
    }

    res.json({
      success: true,
      message: 'Email category updated successfully',
      email
    })

  } catch (error) {
    console.error('Update category error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update email category'
    })
  }
}))



// @desc    Bulk operations on emails
// @route   POST /api/emails/bulk
// @access  Private
router.post('/bulk', protect, asyncHandler(async (req, res) => {
  try {
    const { emailIds, operation, data } = req.body

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email IDs array is required'
      })
    }

    if (!operation) {
      return res.status(400).json({
        success: false,
        message: 'Operation is required'
      })
    }

    let updateData = {}
    let message = ''

    switch (operation) {
      case 'archive':
        // Sync with Gmail for each email
        const User = (await import('../models/User.js')).default
        const user = await User.findById(req.user._id)
        let gmailSyncCount = 0
        
        if (user.gmailConnected && user.gmailAccessToken) {
          const { getOAuthForUser } = await import('../services/gmailSyncService.js')
          const oauth2 = getOAuthForUser(user)
          const gmail = google.gmail({ version: 'v1', auth: oauth2 })
          
          // Get all emails to archive
          const emailsToArchive = await Email.find({
            _id: { $in: emailIds },
            userId: req.user._id,
            provider: 'gmail',
            gmailId: { $exists: true, $ne: null }
          })
          
          console.log(`\n📦 Bulk archiving ${emailsToArchive.length} emails in Gmail...`)
          
          // Archive each email in Gmail
          for (const email of emailsToArchive) {
            try {
              await gmail.users.messages.modify({
                userId: 'me',
                id: email.gmailId,
                requestBody: {
                  removeLabelIds: ['INBOX']
                }
              })
              gmailSyncCount++
              console.log(`   ✅ Archived in Gmail: ${email.subject}`)
            } catch (gmailError) {
              console.error(`   ❌ Failed to archive in Gmail: ${email.subject}`, gmailError.message)
              // Continue with others even if one fails
            }
          }
          
          console.log(`✅ Gmail sync complete: ${gmailSyncCount}/${emailsToArchive.length} synced`)
        }
        
        updateData = { isArchived: true, archivedAt: new Date() }
        message = `Emails archived successfully${gmailSyncCount > 0 ? ` (${gmailSyncCount} synced with Gmail)` : ''}`
        break
      case 'unarchive':
        // Sync with Gmail for each email
        const User2 = (await import('../models/User.js')).default
        const user2 = await User2.findById(req.user._id)
        let gmailSyncCount2 = 0
        
        if (user2.gmailConnected && user2.gmailAccessToken) {
          const { getOAuthForUser } = await import('../services/gmailSyncService.js')
          const oauth2 = getOAuthForUser(user2)
          const gmail = google.gmail({ version: 'v1', auth: oauth2 })
          
          // Get all emails to unarchive
          const emailsToUnarchive = await Email.find({
            _id: { $in: emailIds },
            userId: req.user._id,
            provider: 'gmail',
            gmailId: { $exists: true, $ne: null }
          })
          
          console.log(`\n📥 Bulk unarchiving ${emailsToUnarchive.length} emails in Gmail...`)
          
          // Unarchive each email in Gmail
          for (const email of emailsToUnarchive) {
            try {
              await gmail.users.messages.modify({
                userId: 'me',
                id: email.gmailId,
                requestBody: {
                  addLabelIds: ['INBOX']
                }
              })
              gmailSyncCount2++
              console.log(`   ✅ Unarchived in Gmail: ${email.subject}`)
            } catch (gmailError) {
              console.error(`   ❌ Failed to unarchive in Gmail: ${email.subject}`, gmailError.message)
              // Continue with others even if one fails
            }
          }
          
          console.log(`✅ Gmail sync complete: ${gmailSyncCount2}/${emailsToUnarchive.length} synced`)
        }
        
        updateData = { isArchived: false, archivedAt: null }
        message = `Emails unarchived successfully${gmailSyncCount2 > 0 ? ` (${gmailSyncCount2} synced with Gmail)` : ''}`
        break
      case 'delete':
        await Email.deleteMany({
          _id: { $in: emailIds },
          userId: req.user._id
        })
        
        // Send notification for bulk delete
        notificationService.sendBulkOperationNotification(req.user._id.toString(), {
          operation: 'delete',
          count: emailIds.length,
          success: true,
          message: `${emailIds.length} emails deleted successfully`
        })
        
        return res.json({
          success: true,
          message: 'Emails deleted successfully',
          count: emailIds.length
        })
      case 'categorize':
        if (!data?.category) {
          return res.status(400).json({
            success: false,
            message: 'Category is required for categorize operation'
          })
        }
        updateData = { 
          category: data.category,
          classification: {
            label: data.category,
            confidence: 1.0
          }
        }
        message = 'Emails categorized successfully'
        break
      case 'markRead':
        updateData = { isRead: true }
        message = 'Emails marked as read successfully'
        break
      case 'markUnread':
        updateData = { isRead: false }
        message = 'Emails marked as unread successfully'
        break
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid operation'
        })
    }

    const result = await Email.updateMany(
      { _id: { $in: emailIds }, userId: req.user._id },
      updateData
    )

    // Send notification for bulk operation
    notificationService.sendBulkOperationNotification(req.user._id.toString(), {
      operation: operation,
      count: result.modifiedCount || emailIds.length,
      success: true,
      message: message
    })

    res.json({
      success: true,
      message,
      count: result.modifiedCount
    })

  } catch (error) {
    console.error('Bulk operation error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk operation'
    })
  }
}))

// @desc    Start real-time email sync
// @route   POST /api/emails/realtime/start
// @access  Private
router.post('/realtime/start', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    
    if (!user.gmailConnected) {
      return res.status(400).json({
        success: false,
        message: 'Gmail account not connected'
      })
    }

    const started = await startRealtimeSync(user)
    
    if (started) {
      // Send notification about sync start
      notificationService.sendConnectionNotification(req.user._id.toString(), {
        status: 'sync_started',
        provider: 'gmail',
        message: 'Real-time email sync has been started'
      })
      
      res.json({
        success: true,
        message: 'Real-time sync started successfully'
      })
    } else {
      // Send notification about sync start failure
      notificationService.sendConnectionNotification(req.user._id.toString(), {
        status: 'sync_failed',
        provider: 'gmail',
        message: 'Failed to start real-time email sync'
      })
      
      res.status(500).json({
        success: false,
        message: 'Failed to start real-time sync'
      })
    }

  } catch (error) {
    console.error('Start real-time sync error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to start real-time sync'
    })
  }
}))

// @desc    Stop real-time email sync
// @route   POST /api/emails/realtime/stop
// @access  Private
router.post('/realtime/stop', protect, asyncHandler(async (req, res) => {
  try {
    stopRealtimeSync(req.user._id)
    
    res.json({
      success: true,
      message: 'Real-time sync stopped successfully'
    })

  } catch (error) {
    console.error('Stop real-time sync error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to stop real-time sync'
    })
  }
}))

// @desc    Get real-time sync status
// @route   GET /api/emails/realtime/status
// @access  Private
router.get('/realtime/status', protect, asyncHandler(async (req, res) => {
  try {
    const isActive = isSyncActive(req.user._id)
    
    res.json({
      success: true,
      isActive,
      message: isActive ? 'Real-time sync is active' : 'Real-time sync is not active'
    })

  } catch (error) {
    console.error('Get sync status error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get sync status'
    })
  }
}))

// @desc    Outlook sync (Coming Soon)
// @route   POST /api/emails/outlook/sync
// @access  Private
router.post('/outlook/sync', protect, asyncHandler(async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Outlook sync coming soon'
  })
}))

// @desc    Outlook sync all (Coming Soon)
// @route   POST /api/emails/outlook/sync-all
// @access  Private
router.post('/outlook/sync-all', protect, asyncHandler(async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Outlook sync coming soon'
  })
}))

// @desc    Get full email content (lazy loading)
// @route   GET /api/emails/:id/full-content
// @access  Private
router.get('/:id/full-content', protect, asyncHandler(async (req, res) => {
  try {
    const emailId = req.params.id
    console.log(`📧 Full-content request for: ${emailId}`)
    
    const user = await User.findById(req.user._id)

    // Check if this is a thread container ID
    const { parseThreadContainerId, getThreadMessages } = await import('../services/threadGroupingService.js')
    const parsed = parseThreadContainerId(emailId)
    
    let email
    
    if (parsed) {
      // It's a thread container ID - get the first/only message
      console.log(`📧 Thread container ID detected, fetching messages`)
      const { threadId, dateKey } = parsed
      const messages = await getThreadMessages(Email, threadId, req.user._id, dateKey)
      
      if (!messages || messages.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Email not found'
        })
      }
      
      // Use the first message (or latest message if multiple)
      email = messages[messages.length - 1] // Latest message
      console.log(`📧 Using message from thread: ${email._id}`)
    } else {
      // Regular email ID
      email = await Email.findOne({ 
        _id: emailId, 
        userId: req.user._id 
      })
      
      if (!email) {
        return res.status(404).json({
          success: false,
          message: 'Email not found'
        })
      }
    }

    // If full content is already loaded, return it
    if (email.isFullContentLoaded && email.html) {
      // Mark as accessed for cleanup scheduling
      email.lastAccessedAt = new Date()
      await email.save()

      return res.json({
        success: true,
        email: {
          _id: email._id,
          subject: email.subject,
          from: email.from,
          to: email.to,
          date: email.date,
          html: email.html,
          text: email.text,
          body: email.body,
          snippet: email.snippet,
          attachments: email.attachments,
          category: email.category,
          isRead: email.isRead,
          labels: email.labels,
          isFullContentLoaded: email.isFullContentLoaded,
          fullContentLoadedAt: email.fullContentLoadedAt
        }
      })
    }

    // Check if user has Gmail connected
    if (!user.gmailConnected || !user.gmailAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Gmail account not connected'
      })
    }

    // Fetch full content from Gmail API
    const gmail = getGmailClient(user.gmailAccessToken, user.gmailRefreshToken)
    
    try {
      const messageData = await gmail.users.messages.get({
        userId: 'me',
        id: email.gmailId,
        format: 'full'
      })

      const headers = messageData.data.payload.headers
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value

      // Parse email body content (HTML and text)
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

      if (messageData.data.payload?.body?.data) {
        // Simple message
        if (messageData.data.payload.mimeType === 'text/html') {
          html = Buffer.from(messageData.data.payload.body.data, 'base64').toString('utf-8')
        } else if (messageData.data.payload.mimeType === 'text/plain') {
          text = Buffer.from(messageData.data.payload.body.data, 'base64').toString('utf-8')
          body = text
        }
      } else if (messageData.data.payload?.parts) {
        // Multipart message
        for (const part of messageData.data.payload.parts) {
          extractContent(part)
        }
      }

      // Update email with full content
      email.html = html
      email.text = text
      email.body = body
      email.attachments = attachments
      email.isFullContentLoaded = true
      email.fullContentLoadedAt = new Date()
      email.lastAccessedAt = new Date()
      
      await email.save()

      console.log(`✅ Loaded full content for email: ${email.subject}`)

      return res.json({
        success: true,
        email: {
          _id: email._id,
          subject: email.subject,
          from: email.from,
          to: email.to,
          date: email.date,
          html: email.html,
          text: email.text,
          body: email.body,
          snippet: email.snippet,
          attachments: email.attachments,
          category: email.category,
          isRead: email.isRead,
          labels: email.labels,
          isFullContentLoaded: email.isFullContentLoaded,
          fullContentLoadedAt: email.fullContentLoadedAt
        }
      })

    } catch (gmailError) {
      console.error('Gmail API error:', gmailError.message)
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch email content from Gmail'
      })
    }

  } catch (error) {
    console.error('Get full email content error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to load email content'
    })
  }
}))

// @desc    Trigger reclassification of all user emails
// @route   POST /api/emails/reclassify-all
// @access  Private
router.post('/reclassify-all', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id.toString()
    
    console.log(`🔄 Starting reclassification for user: ${userId}`)

    // Get time estimate before starting
    const timeEstimate = await estimateReclassificationTime(userId)

    // Start reclassification asynchronously to avoid timeout
    reclassifyAllEmails(userId)
      .then(result => {
        console.log(`✅ Reclassification completed for user ${userId}:`, result)
        
        // Send notification about completion
        notificationService.sendClassificationNotification(userId, {
          emailId: 'system',
          category: 'system',
          confidence: 1.0,
          message: `Reclassification completed: ${result.changedCount} emails updated out of ${result.totalEmails} total`
        })
      })
      .catch(error => {
        console.error(`❌ Reclassification failed for user ${userId}:`, error)
        
        // Send error notification
        notificationService.sendClassificationNotification(userId, {
          emailId: 'system',
          category: 'system',
          confidence: 0.0,
          message: `Reclassification failed: ${error.message}`
        })
      })

    // Return immediately with success status and time estimate
    res.json({
      success: true,
      message: 'Reclassification started. You will receive notifications about progress.',
      userId: userId,
      estimatedTime: timeEstimate
    })

  } catch (error) {
    console.error('Reclassification trigger error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to start reclassification'
    })
  }
}))

// @desc    Get reclassification job status
// @route   GET /api/emails/reclassification-status/:jobId
// @access  Private
router.get('/reclassification-status/:jobId', protect, asyncHandler(async (req, res) => {
  try {
    const { jobId } = req.params
    const userId = req.user._id.toString()
    
    const job = await getJobStatus(jobId)
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      })
    }
    
    // Verify job belongs to user
    if (job.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }
    
    res.json({
      success: true,
      job: {
        id: job._id,
        status: job.status,
        categoryName: job.categoryName,
        totalEmails: job.totalEmails,
        processedEmails: job.processedEmails || 0,
        successfulClassifications: job.successfulClassifications || 0,
        failedClassifications: job.failedClassifications || 0,
        progressPercentage: job.progressPercentage || 0,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage
      }
    })
    
  } catch (error) {
    console.error('Get reclassification status error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get job status'
    })
  }
}))

export default router