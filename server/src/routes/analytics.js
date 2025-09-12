import express from 'express'
import Email from '../models/Email.js'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = express.Router()

// @desc    Get email statistics
// @route   GET /api/analytics/stats
// @access  Private
router.get('/stats', protect, asyncHandler(async (req, res) => {
  try {
    const stats = await Email.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          totalEmails: { $sum: 1 },
          totalByProvider: {
            $push: {
              provider: 'gmail', // Default provider since we only support Gmail
              count: 1
            }
          },
          totalByCategory: {
            $push: {
              category: '$category',
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
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    })
  }
}))

// @desc    Get category counts for charts
// @route   GET /api/analytics/categories
// @access  Private
router.get('/categories', protect, asyncHandler(async (req, res) => {
  try {
    const categoryData = await Email.aggregate([
      { $match: { userId: req.user._id, category: { $ne: null } } },
      {
        $group: {
          _id: '$category',
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
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category data'
    })
  }
}))

// @desc    Get classification accuracy metrics
// @route   GET /api/analytics/accuracy
// @access  Private
router.get('/accuracy', protect, asyncHandler(async (req, res) => {
  try {
    const accuracyData = await Email.aggregate([
      {
        $match: {
          userId: req.user._id,
          category: { $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          correct: { $sum: 1 }, // For now, assume all are correct
          accuracyBreakdown: {
            $push: {
              category: '$category',
              isCorrect: true
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
  } catch (error) {
    console.error('Error fetching accuracy data:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch accuracy data'
    })
  }
}))

// @desc    Get misclassifications
// @route   GET /api/analytics/misclassifications
// @access  Private
router.get('/misclassifications', protect, asyncHandler(async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50

    const misclassifications = await Email.find({
      userId: req.user._id,
      category: { $ne: null }
    })
    .select('subject from date category classification labels')
    .sort({ date: -1 })
    .limit(limit)

    res.json({
      success: true,
      data: misclassifications
    })
  } catch (error) {
    console.error('Error fetching misclassifications:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch misclassifications'
    })
  }
}))

// @desc    Export analytics data as CSV
// @route   GET /api/analytics/export
// @access  Private
router.get('/export', protect, asyncHandler(async (req, res) => {
  try {
    const emails = await Email.find({ userId: req.user._id })
      .select('subject from date category snippet isRead')
      .sort({ date: -1 })

    if (emails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No emails found to export'
      })
    }

    // Create CSV content
    const csvHeader = 'Subject,From,Date,Category,Snippet,Is Read\n'
    const csvRows = emails.map(email => {
      const subject = `"${(email.subject || '').replace(/"/g, '""')}"`
      const from = `"${(email.from || '').replace(/"/g, '""')}"`
      const date = email.date ? email.date.toISOString() : ''
      const category = email.category || ''
      const snippet = `"${(email.snippet || '').replace(/"/g, '""')}"`
      const isRead = email.isRead ? 'Yes' : 'No'

      return `${subject},${from},${date},${category},${snippet},${isRead}`
    }).join('\n')

    const csvContent = csvHeader + csvRows
    const buffer = Buffer.from(csvContent, 'utf8')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="sortify-analytics-${new Date().toISOString().split('T')[0]}.csv"`)
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)

  } catch (error) {
    console.error('Export error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to export data'
    })
  }
}))

// @desc    Get performance metrics
// @route   GET /api/analytics/performance
// @access  Private
router.get('/performance', protect, asyncHandler(async (req, res) => {
  const performanceData = await Email.aggregate([
    { $match: { userId: req.user._id } },
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
              { $ne: ['$category', null] },
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

// @desc    Get real-time analytics updates
// @route   GET /api/analytics/realtime
// @access  Private
router.get('/realtime', protect, asyncHandler(async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  })

  // Send initial data
  res.write(`data: ${JSON.stringify({ connected: true })}\n\n`)

  // Keep connection alive
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ ping: Date.now() })}\n\n`)
  }, 30000)

  res.on('close', () => {
    clearInterval(interval)
  })
}))

export default router
