// Bulk operations routes for email management
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import Email from '../models/Email.js'
import { classifyEmail } from '../services/classificationService.js'
import { sendEmailSyncUpdate } from '../services/websocketService.js'

const router = express.Router()

// @desc    Bulk categorize emails
// @route   POST /api/bulk/categorize
// @access  Private
router.post('/categorize', protect, asyncHandler(async (req, res) => {
  try {
    const { emailIds, category, reason } = req.body
    const userId = req.user._id

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email IDs are required'
      })
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      })
    }

    // Validate category
    const validCategories = ['Academic', 'Promotions', 'Placement', 'Spam', 'Other']
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      })
    }

    // Update emails in bulk
    const result = await Email.updateMany(
      { 
        _id: { $in: emailIds },
        userId 
      },
      { 
        $set: { 
          category,
          classification: {
            label: category,
            confidence: 1.0, // Manual classification
            modelVersion: 'manual',
            classifiedAt: new Date(),
            reason: reason || 'Manual bulk categorization'
          },
          updatedAt: new Date()
        }
      }
    )

    // Get updated emails for WebSocket notification
    const updatedEmails = await Email.find({
      _id: { $in: emailIds },
      userId
    }).select('gmailId subject from category classification')

    // Send WebSocket updates
    updatedEmails.forEach(email => {
      sendEmailSyncUpdate(userId.toString(), email)
    })

    res.json({
      success: true,
      message: `Successfully categorized ${result.modifiedCount} emails`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    })

  } catch (error) {
    console.error('Bulk categorize error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to categorize emails',
      error: error.message
    })
  }
}))

// @desc    Bulk delete emails
// @route   POST /api/bulk/delete
// @access  Private
router.post('/delete', protect, asyncHandler(async (req, res) => {
  try {
    const { emailIds, permanent = false } = req.body
    const userId = req.user._id

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email IDs are required'
      })
    }

    let result
    if (permanent) {
      // Permanent deletion
      result = await Email.deleteMany({
        _id: { $in: emailIds },
        userId
      })
    } else {
      // Soft deletion (mark as deleted)
      result = await Email.updateMany(
        { 
          _id: { $in: emailIds },
          userId 
        },
        { 
          $set: { 
            deleted: true,
            deletedAt: new Date(),
            updatedAt: new Date()
          }
        }
      )
    }

    res.json({
      success: true,
      message: `Successfully ${permanent ? 'permanently deleted' : 'moved to trash'} ${result.modifiedCount || result.deletedCount} emails`,
      modifiedCount: result.modifiedCount || result.deletedCount,
      matchedCount: result.matchedCount
    })

  } catch (error) {
    console.error('Bulk delete error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete emails',
      error: error.message
    })
  }
}))

// @desc    Bulk mark as read/unread
// @route   POST /api/bulk/mark-read
// @access  Private
router.post('/mark-read', protect, asyncHandler(async (req, res) => {
  try {
    const { emailIds, read = true } = req.body
    const userId = req.user._id

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email IDs are required'
      })
    }

    const result = await Email.updateMany(
      { 
        _id: { $in: emailIds },
        userId 
      },
      { 
        $set: { 
          isRead: read,
          updatedAt: new Date()
        }
      }
    )

    res.json({
      success: true,
      message: `Successfully marked ${result.modifiedCount} emails as ${read ? 'read' : 'unread'}`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    })

  } catch (error) {
    console.error('Bulk mark read error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to mark emails as read/unread',
      error: error.message
    })
  }
}))

// @desc    Bulk move emails to folder/label
// @route   POST /api/bulk/move
// @access  Private
router.post('/move', protect, asyncHandler(async (req, res) => {
  try {
    const { emailIds, folder, label } = req.body
    const userId = req.user._id

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email IDs are required'
      })
    }

    if (!folder && !label) {
      return res.status(400).json({
        success: false,
        message: 'Folder or label is required'
      })
    }

    const updateData = { updatedAt: new Date() }
    
    if (folder) {
      updateData.folder = folder
    }
    
    if (label) {
      updateData.labels = [label]
    }

    const result = await Email.updateMany(
      { 
        _id: { $in: emailIds },
        userId 
      },
      { 
        $set: updateData
      }
    )

    res.json({
      success: true,
      message: `Successfully moved ${result.modifiedCount} emails`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    })

  } catch (error) {
    console.error('Bulk move error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to move emails',
      error: error.message
    })
  }
}))

// @desc    Bulk reclassify emails with ML
// @route   POST /api/bulk/reclassify
// @access  Private
router.post('/reclassify', protect, asyncHandler(async (req, res) => {
  try {
    const { emailIds } = req.body
    const userId = req.user._id

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email IDs are required'
      })
    }

    // Get emails to reclassify
    const emails = await Email.find({
      _id: { $in: emailIds },
      userId
    }).select('subject snippet body text category classification')

    let reclassifiedCount = 0
    const results = []

    // Reclassify each email
    for (const email of emails) {
      try {
        const classification = await classifyEmail(
          email.subject, 
          email.snippet, 
          email.body || email.text
        )

        // Update email with new classification
        await Email.findByIdAndUpdate(email._id, {
          category: classification.label,
          classification: {
            label: classification.label,
            confidence: classification.confidence,
            modelVersion: '2.1.0',
            classifiedAt: new Date(),
            reason: 'Bulk reclassification'
          },
          updatedAt: new Date()
        })

        results.push({
          emailId: email._id,
          oldCategory: email.category,
          newCategory: classification.label,
          confidence: classification.confidence
        })

        reclassifiedCount++

        // Send WebSocket update
        sendEmailSyncUpdate(userId.toString(), {
          gmailId: email.gmailId,
          subject: email.subject,
          category: classification.label,
          classification: {
            label: classification.label,
            confidence: classification.confidence
          }
        })

      } catch (error) {
        console.error(`Error reclassifying email ${email._id}:`, error)
        results.push({
          emailId: email._id,
          error: error.message
        })
      }
    }

    res.json({
      success: true,
      message: `Successfully reclassified ${reclassifiedCount} emails`,
      reclassifiedCount,
      totalEmails: emails.length,
      results
    })

  } catch (error) {
    console.error('Bulk reclassify error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to reclassify emails',
      error: error.message
    })
  }
}))

// @desc    Get bulk operation status
// @route   GET /api/bulk/status/:operationId
// @access  Private
router.get('/status/:operationId', protect, asyncHandler(async (req, res) => {
  try {
    const { operationId } = req.params
    const userId = req.user._id

    // This would typically check a job queue or database for operation status
    // For now, return a mock status
    res.json({
      success: true,
      operationId,
      status: 'completed',
      progress: 100,
      message: 'Operation completed successfully'
    })

  } catch (error) {
    console.error('Bulk operation status error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get operation status',
      error: error.message
    })
  }
}))

// @desc    Get available bulk operations
// @route   GET /api/bulk/operations
// @access  Private
router.get('/operations', protect, asyncHandler(async (req, res) => {
  try {
    const operations = [
      {
        id: 'categorize',
        name: 'Categorize',
        description: 'Change category of selected emails',
        icon: '🏷️',
        requiresInput: true,
        inputType: 'select',
        options: ['Academic', 'Promotions', 'Placement', 'Spam', 'Other']
      },
      {
        id: 'delete',
        name: 'Delete',
        description: 'Move emails to trash or permanently delete',
        icon: '🗑️',
        requiresInput: true,
        inputType: 'checkbox',
        options: ['Permanent deletion']
      },
      {
        id: 'mark-read',
        name: 'Mark as Read/Unread',
        description: 'Change read status of emails',
        icon: '👁️',
        requiresInput: true,
        inputType: 'select',
        options: ['Mark as Read', 'Mark as Unread']
      },
      {
        id: 'move',
        name: 'Move to Folder',
        description: 'Move emails to a specific folder',
        icon: '📁',
        requiresInput: true,
        inputType: 'text',
        placeholder: 'Enter folder name'
      },
      {
        id: 'reclassify',
        name: 'Reclassify with ML',
        description: 'Reclassify emails using machine learning',
        icon: '🤖',
        requiresInput: false
      }
    ]

    res.json({
      success: true,
      operations
    })

  } catch (error) {
    console.error('Get bulk operations error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get bulk operations',
      error: error.message
    })
  }
}))

export default router
