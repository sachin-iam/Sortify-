// User Feedback Routes for Email Classification System
// Provides hooks for user interaction tracking and model improvement

import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import Email from '../models/Email.js'
import TrainingSample from '../models/TrainingSample.js'
import User from '../models/User.js'
import { classifyEmail } from '../services/enhancedClassificationService.js'

const router = express.Router()

// @desc    Record user correction to email classification
// @route   POST /api/feedback/correction
// @access  Private
router.post('/correction', protect, asyncHandler(async (req, res) => {
  try {
    const { emailId, correctCategory, reason } = req.body
    const userId = req.user._id

    if (!emailId || !correctCategory) {
      return res.status(400).json({
        success: false,
        message: 'Email ID and correct category are required'
      })
    }

    // Find the email
    const email = await Email.findOne({ _id: emailId, userId })
    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      })
    }

    // Store the correction as a training sample
    const trainingSample = await TrainingSample.create({
      userId,
      emailId: email._id,
      subject: email.subject,
      body: email.body,
      html: email.html,
      from: email.from,
      to: email.to,
      date: email.date,
      trueLabel: correctCategory,
      predictedLabel: email.category,
      confidence: email.classification?.confidence || 0.5,
      labeledBy: 'correction',
      isValidated: true,
      source: 'user_correction',
      metadata: {
        originalClassification: email.classification,
        correctionReason: reason || 'User correction',
        extractedFeatures: email.extractedFeatures
      }
    })

    // Update the email with the correct category
    await Email.findByIdAndUpdate(emailId, {
      category: correctCategory,
      classification: {
        ...email.classification,
        label: correctCategory,
        confidence: 1.0, // Manual correction has full confidence
        modelVersion: 'user-corrected',
        classifiedAt: new Date(),
        reason: reason || 'User correction'
      }
    })

    // Update user feedback statistics
    await User.findByIdAndUpdate(userId, {
      $inc: {
        'feedbackStats.correctionsCount': 1
      },
      $set: {
        'feedbackStats.lastFeedbackAt': new Date()
      }
    })

    res.json({
      success: true,
      message: 'Classification correction recorded successfully',
      trainingSampleId: trainingSample._id,
      updatedCategory: correctCategory
    })

  } catch (error) {
    console.error('Feedback correction error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to record feedback correction'
    })
  }
}))

// @desc    Track user actions (open, reply, delete, archive)
// @route   POST /api/feedback/action
// @access  Private
router.post('/action', protect, asyncHandler(async (req, res) => {
  try {
    const { emailId, action, timestamp } = req.body
    const userId = req.user._id

    if (!emailId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Email ID and action are required'
      })
    }

    // Valid actions
    const validActions = ['open', 'reply', 'delete', 'archive', 'mark_important', 'mark_spam']
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: `Invalid action. Must be one of: ${validActions.join(', ')}`
      })
    }

    const email = await Email.findOne({ _id: emailId, userId })
    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found'
      })
    }

    // Create training sample for user action tracking
    // TODO: In future implementation, this will be used for behavior-based learning
    const trainingSample = await TrainingSample.create({
      userId,
      emailId: email._id,
      subject: email.subject,
      body: email.body,
      html: email.html,
      from: email.from,
      to: email.to,
      date: email.date,
      trueLabel: email.category,
      predictedLabel: email.category,
      confidence: 1.0,
      labeledBy: 'system',
      isValidated: true,
      source: 'user_action',
      metadata: {
        userAction: action,
        actionTimestamp: timestamp || new Date(),
        originalClassification: email.classification,
        extractedFeatures: email.extractedFeatures
      }
    })

    // Update user feedback statistics
    await User.findByIdAndUpdate(userId, {
      $inc: {
        [`feedbackStats.${action}Count`]: 1
      },
      $set: {
        'feedbackStats.lastFeedbackAt': new Date()
      }
    })

    res.json({
      success: true,
      message: `User action '${action}' recorded successfully`,
      trainingSampleId: trainingSample._id
    })

  } catch (error) {
    console.error('Feedback action error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to record user action'
    })
  }
}))

// @desc    Get emails suggested for user validation (low confidence predictions)
// @route   GET /api/feedback/suggestions
// @access  Private
router.get('/suggestions', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const { limit = 10, confidenceThreshold = 0.7 } = req.query

    // Find emails with low confidence that haven't been validated
    const lowConfidenceEmails = await Email.find({
      userId,
      'classification.confidence': { $lt: parseFloat(confidenceThreshold) },
      isDeleted: false,
      isArchived: false
    })
    .sort({ 'classification.classifiedAt': -1 })
    .limit(parseInt(limit))
    .select('subject from snippet category classification date')

    // Check which ones already have training samples to avoid duplicates
    const emailIds = lowConfidenceEmails.map(email => email._id)
    const existingSamples = await TrainingSample.find({
      userId,
      emailId: { $in: emailIds }
    }).select('emailId')

    const existingEmailIds = new Set(existingSamples.map(sample => sample.emailId.toString()))

    const suggestions = lowConfidenceEmails
      .filter(email => !existingEmailIds.has(email._id.toString()))
      .map(email => ({
        emailId: email._id,
        subject: email.subject,
        from: email.from,
        snippet: email.snippet,
        currentCategory: email.category,
        confidence: email.classification?.confidence || 0.0,
        classifiedAt: email.classification?.classifiedAt,
        reason: 'Low confidence prediction'
      }))

    res.json({
      success: true,
      suggestions,
      count: suggestions.length,
      threshold: confidenceThreshold
    })

  } catch (error) {
    console.error('Feedback suggestions error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get validation suggestions'
    })
  }
}))

// @desc    Get user feedback statistics
// @route   GET /api/feedback/stats
// @access  Private
router.get('/stats', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id

    // Get training sample statistics
    const stats = await TrainingSample.getUserTrainingStats(userId)

    // Get user feedback stats from User model
    const user = await User.findById(userId).select('feedbackStats')
    const userFeedbackStats = user?.feedbackStats || {}

    res.json({
      success: true,
      stats: {
        ...stats,
        userFeedback: {
          correctionsCount: userFeedbackStats.correctionsCount || 0,
          lastFeedbackAt: userFeedbackStats.lastFeedbackAt,
          averageConfidence: userFeedbackStats.averageConfidence || 0.0,
          openCount: userFeedbackStats.openCount || 0,
          replyCount: userFeedbackStats.replyCount || 0,
          deleteCount: userFeedbackStats.deleteCount || 0,
          archiveCount: userFeedbackStats.archiveCount || 0
        }
      }
    })

  } catch (error) {
    console.error('Feedback stats error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback statistics'
    })
  }
}))

// @desc    Record unsubscribe action for learning
// @route   POST /api/feedback/unsubscribe
// @access  Private
router.post('/unsubscribe', protect, asyncHandler(async (req, res) => {
  try {
    const { emailId, senderDomain, unsubscribeReason } = req.body
    const userId = req.user._id

    // Find the email if emailId is provided
    let email = null
    if (emailId) {
      email = await Email.findOne({ _id: emailId, userId })
    }

    // Create training sample for unsubscribe behavior
    const trainingSample = await TrainingSample.create({
      userId,
      emailId: email?._id,
      subject: email?.subject || '',
      body: email?.body || '',
      from: email?.from || '',
      trueLabel: 'Promotions', // Unsubscribe typically indicates promotional content
      predictedLabel: email?.category || 'Other',
      confidence: 1.0,
      labeledBy: 'correction',
      isValidated: true,
      source: 'unsubscribe',
      metadata: {
        senderDomain,
        unsubscribeReason: unsubscribeReason || 'User clicked unsubscribe',
        originalClassification: email?.classification || null,
        actionType: 'unsubscribe'
      }
    })

    // Update user feedback statistics
    await User.findByIdAndUpdate(userId, {
      $inc: {
        'feedbackStats.unsubscribeCount': 1
      },
      $set: {
        'feedbackStats.lastFeedbackAt': new Date()
      }
    })

    res.json({
      success: true,
      message: 'Unsubscribe behavior recorded successfully',
      trainingSampleId: trainingSample._id
    })

  } catch (error) {
    console.error('Feedback unsubscribe error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to record unsubscribe behavior'
    })
  }
}))

export default router
