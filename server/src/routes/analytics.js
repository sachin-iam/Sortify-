import express from 'express'
import Email from '../models/Email.js'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = express.Router()

// @desc    Get email statistics
// @route   GET /api/analytics/stats
// @access  Private
router.get('/stats', protect, asyncHandler(async (req, res) => {
  const stats = await Email.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: null,
        totalEmails: { $sum: 1 },
        totalByProvider: {
          $push: {
            provider: '$provider',
            count: 1
          }
        },
        totalByCategory: {
          $push: {
            category: '$classification.label',
            count: 1
          }
        },
        unreadCount: {
          $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
        },
        processedToday: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$createdAt', new Date(new Date().setHours(0, 0, 0, 0))] },
                  { $lt: ['$createdAt', new Date(new Date().setHours(23, 59, 59, 999))] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ])

  const result = stats[0] || {
    totalEmails: 0,
    totalByProvider: [],
    totalByCategory: [],
    unreadCount: 0,
    processedToday: 0
  }

  // Count unique categories
  const categoryCount = new Set(
    result.totalByCategory
      .filter(item => item.category !== null)
      .map(item => item.category)
  ).size

  res.json({
    success: true,
    stats: {
      totalEmails: result.totalEmails,
      categories: categoryCount,
      processedToday: result.processedToday,
      unreadCount: result.unreadCount
    }
  })
}))

// @desc    Get category counts for charts
// @route   GET /api/analytics/categories
// @access  Private
router.get('/categories', protect, asyncHandler(async (req, res) => {
  const categoryData = await Email.aggregate([
    { $match: { user: req.user._id, 'classification.label': { $ne: null } } },
    {
      $group: {
        _id: '$classification.label',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        label: '$_id',
        count: 1,
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ])

  res.json({
    success: true,
    data: categoryData
  })
}))

// @desc    Get classification accuracy metrics
// @route   GET /api/analytics/accuracy
// @access  Private
router.get('/accuracy', protect, asyncHandler(async (req, res) => {
  const accuracyData = await Email.aggregate([
    { 
      $match: { 
        user: req.user._id,
        'classification.label': { $ne: null },
        'manualLabels': { $exists: true, $ne: [] }
      } 
    },
    {
      $addFields: {
        isCorrect: {
          $in: ['$classification.label', '$manualLabels']
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        accuracyBreakdown: {
          $push: {
            category: '$classification.label',
            isCorrect: '$isCorrect'
          }
        }
      }
    }
  ])

  const result = accuracyData[0] || { total: 0, correct: 0, accuracyBreakdown: [] }
  
  // Calculate overall accuracy
  const overallAccuracy = result.total > 0 ? (result.correct / result.total) * 100 : 0

  // Calculate accuracy by category
  const categoryAccuracy = {}
  result.accuracyBreakdown.forEach(item => {
    if (!categoryAccuracy[item.category]) {
      categoryAccuracy[item.category] = { correct: 0, total: 0 }
    }
    categoryAccuracy[item.category].total++
    if (item.isCorrect) {
      categoryAccuracy[item.category].correct++
    }
  })

  const accuracyBreakdown = Object.entries(categoryAccuracy).map(([category, data]) => ({
    category,
    correct: data.correct,
    total: data.total,
    accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0
  }))

  res.json({
    success: true,
    data: {
      overallAccuracy: Math.round(overallAccuracy * 100) / 100,
      correct: result.correct,
      total: result.total,
      accuracyBreakdown
    }
  })
}))

// @desc    Get misclassifications
// @route   GET /api/analytics/misclassifications
// @access  Private
router.get('/misclassifications', protect, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50

  const misclassifications = await Email.find({
    user: req.user._id,
    'classification.label': { $ne: null },
    'manualLabels': { $exists: true, $ne: [] },
    $expr: {
      $not: {
        $in: ['$classification.label', '$manualLabels']
      }
    }
  })
  .select('subject from date classification manualLabels')
  .sort({ date: -1 })
  .limit(limit)

  res.json({
    success: true,
    data: misclassifications
  })
}))

// @desc    Export analytics data as CSV
// @route   GET /api/analytics/export
// @access  Private
router.get('/export', protect, asyncHandler(async (req, res) => {
  const emails = await Email.find({ user: req.user._id })
    .select('subject from date provider classification manualLabels')
    .sort({ date: -1 })

  // Create CSV content
  const csvHeader = 'Subject,From,Date,Provider,ML Classification,Confidence,Manual Labels\n'
  const csvRows = emails.map(email => {
    const subject = `"${(email.subject || '').replace(/"/g, '""')}"`
    const from = `"${(email.from || '').replace(/"/g, '""')}"`
    const date = email.date ? email.date.toISOString() : ''
    const provider = email.provider || ''
    const mlClassification = email.classification?.label || ''
    const confidence = email.classification?.confidence || ''
    const manualLabels = `"${(email.manualLabels || []).join('; ').replace(/"/g, '""')}"`
    
    return `${subject},${from},${date},${provider},${mlClassification},${confidence},${manualLabels}`
  }).join('\n')

  const csvContent = csvHeader + csvRows

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="sortify-analytics-${new Date().toISOString().split('T')[0]}.csv"`)
  res.send(csvContent)
}))

// @desc    Get performance metrics
// @route   GET /api/analytics/performance
// @access  Private
router.get('/performance', protect, asyncHandler(async (req, res) => {
  const performanceData = await Email.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        },
        count: { $sum: 1 },
        classifiedCount: {
          $sum: {
            $cond: [
              { $ne: ['$classification.label', null] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 }
    },
    { $limit: 30 }
  ])

  res.json({
    success: true,
    data: performanceData
  })
}))

export default router
