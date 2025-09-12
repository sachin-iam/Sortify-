import express from 'express'
import { google } from 'googleapis'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import User from '../models/User.js'
import Email from '../models/Email.js'

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
    
    // Get recent emails
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: 'in:inbox'
    })

    const messages = response.data.messages || []
    let syncedCount = 0

    for (const message of messages) {
      try {
        // Check if email already exists
        const existingEmail = await Email.findOne({ 
          gmailId: message.id,
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

        const emailData = {
          userId: user._id,
          gmailId: message.id,
          threadId: messageData.data.threadId,
          subject: getHeader('Subject') || 'No Subject',
          from: getHeader('From') || 'Unknown Sender',
          to: getHeader('To') || user.email,
          date: new Date(parseInt(messageData.data.internalDate)),
          snippet: messageData.data.snippet,
          body: messageData.data.payload.body?.data || '',
          isRead: messageData.data.labelIds?.includes('UNREAD') ? false : true,
          labels: messageData.data.labelIds || [],
          category: 'inbox' // Default category, will be classified by ML
        }

        await Email.create(emailData)
        syncedCount++

      } catch (error) {
        console.error(`Error syncing email ${message.id}:`, error)
        continue
      }
    }

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

// @desc    Get user emails
// @route   GET /api/emails
// @access  Private
router.get('/', protect, asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query
    const skip = (page - 1) * limit

    let query = { userId: req.user._id }

    if (category && category !== 'all') {
      query.category = category
    }

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

    const total = await Email.countDocuments(query)

    res.json({
      success: true,
      emails,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    })

  } catch (error) {
    console.error('Get emails error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch emails'
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

export default router