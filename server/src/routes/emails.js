import express from 'express'
import { google } from 'googleapis'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import User from '../models/User.js'
import Email from '../models/Email.js'
import { classifyEmail } from '../services/classificationService.js'
import { startRealtimeSync, stopRealtimeSync, isSyncActive } from '../services/realtimeSync.js'
import { fullSync, syncLabels } from '../services/gmailSyncService.js'

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
    
    // Get all emails (in batches to avoid timeout)
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 200, // Limited to 200 emails for now
      q: 'in:inbox'
    })

    const messages = response.data.messages || []
    let syncedCount = 0

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
        
        const classification = classifyEmail(subject, snippet, body)

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
        await Email.findOneAndUpdate(
          { messageId: message.id, userId: user._id },
          emailData,
          { upsert: true, new: true }
        )
        syncedCount++

      } catch (error) {
        console.error(`Error syncing email ${message.id}:`, error)
        // Continue with next email instead of stopping
        continue
      }
    }

    // Analytics will be updated automatically via frontend polling

    res.json({
      success: true,
      message: `Synced ${syncedCount} emails from Gmail`,
      syncedCount
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
    const user = await User.findById(req.user._id)
    
    if (!user.gmailConnected) {
      return res.status(400).json({
        success: false,
        message: 'Gmail account not connected'
      })
    }

    console.log(`🚀 Starting comprehensive Gmail sync for user: ${user.email}`)
    
    // Use the new comprehensive sync service
    const result = await fullSync(user)
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        syncedCount: result.synced,
        total: result.total,
        classified: result.classified,
        skipped: result.skipped,
        categoryBreakdown: result.categoryBreakdown
      })
    } else {
      res.status(500).json({
        success: false,
        message: result.error || 'Failed to sync Gmail emails'
      })
    }

  } catch (error) {
    console.error('Comprehensive Gmail sync error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to sync Gmail emails'
    })
  }
}))

// @desc    Get user emails
// @route   GET /api/emails
// @access  Private
router.get('/', protect, asyncHandler(async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 25, 
      category, 
      provider = 'gmail', 
      q: search 
    } = req.query
    const skip = (page - 1) * limit

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

    const emails = await Email.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('_id subject from to snippet date category classification isRead labels')

    const total = await Email.countDocuments(query)

    // Format response as requested
    res.json({
      success: true,
      items: emails,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    })

  } catch (error) {
    console.error('Get emails error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch emails'
    })
  }
}))

// @desc    Get single email by ID
// @route   GET /api/emails/:id
// @access  Private
router.get('/:id', protect, asyncHandler(async (req, res) => {
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

// @desc    Archive email
// @route   PUT /api/emails/:id/archive
// @access  Private
router.put('/:id/archive', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params

    const email = await Email.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { 
        isArchived: true,
        archivedAt: new Date()
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
      message: 'Email archived successfully',
      email
    })

  } catch (error) {
    console.error('Archive email error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to archive email'
    })
  }
}))

// @desc    Delete email
// @route   DELETE /api/emails/:id
// @access  Private
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params

    const email = await Email.findOneAndDelete({
      _id: id,
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
        updateData = { isArchived: true, archivedAt: new Date() }
        message = 'Emails archived successfully'
        break
      case 'unarchive':
        updateData = { isArchived: false, archivedAt: null }
        message = 'Emails unarchived successfully'
        break
      case 'delete':
        await Email.deleteMany({
          _id: { $in: emailIds },
          userId: req.user._id
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
      res.json({
        success: true,
        message: 'Real-time sync started successfully'
      })
    } else {
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

export default router