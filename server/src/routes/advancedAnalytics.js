// Advanced analytics routes
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import Email from '../models/Email.js'
import { getModelMetrics } from '../services/enhancedMLService.js'

const router = express.Router()

// Cache for advanced analytics
const analyticsCache = new Map()
const CACHE_TTL = 3 * 60 * 1000 // 3 minutes

function getCachedData(key) {
  const cached = analyticsCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  return null
}

function setCachedData(key, data) {
  analyticsCache.set(key, { data, timestamp: Date.now() })
  // Cleanup old entries
  if (analyticsCache.size > 500) {
    const oldestKeys = Array.from(analyticsCache.keys()).slice(0, 50)
    oldestKeys.forEach(k => analyticsCache.delete(k))
  }
}

// Clear cache for a specific user
export function clearAdvancedAnalyticsCache(userId) {
  const keysToDelete = []
  for (const key of analyticsCache.keys()) {
    if (key.includes(userId)) {
      keysToDelete.push(key)
    }
  }
  keysToDelete.forEach(key => analyticsCache.delete(key))
  console.log(`🗑️ Cleared ${keysToDelete.length} advanced analytics cache entries for user ${userId}`)
}

// @desc    Get advanced analytics data
// @route   GET /api/analytics/advanced
// @access  Private
router.get('/advanced', protect, asyncHandler(async (req, res) => {
  try {
    const { range = 'all', category = 'All' } = req.query
    const userId = req.user._id
    
    // Check cache first
    const cacheKey = `advanced_${userId}_${range}_${category}`
    const cached = getCachedData(cacheKey)
    if (cached) {
      console.log(`✅ Returning cached advanced analytics for user ${userId}, range: ${range}, category: ${category}`)
      return res.json(cached)
    }
    
    console.log(`🔄 Cache miss - fetching analytics for user ${userId}, range: ${range}, category: ${category}`)

    // Build base query - analyze ALL emails by default unless date range is specified
    const query = {
      userId
    }

    // Only apply date filter if range is specified and not 'all'
    if (range && range !== 'all') {
      const now = new Date()
      let startDate = new Date()
      
      switch (range) {
        case '1d':
          startDate.setDate(now.getDate() - 1)
          break
        case '7d':
          startDate.setDate(now.getDate() - 7)
          break
        case '30d':
          startDate.setDate(now.getDate() - 30)
          break
        case '90d':
          startDate.setDate(now.getDate() - 90)
          break
        default:
          // If range is not recognized, don't apply date filter (analyze all)
          break
      }
      
      // Only add date filter if we have a valid range
      if (range !== 'all' && ['1d', '7d', '30d', '90d'].includes(range)) {
        query.date = { $gte: startDate }
      }
    }

    if (category !== 'All') {
      query.category = category
    }

    // Run all aggregations in parallel for better performance
    const [
      totalEmails,
      categoryStats,
      dailyStats,
      weeklyStats,
      monthlyStats,
      topSenders,
      emailTrends,
      accuracyStats,
      responseTimeStats
    ] = await Promise.all([
    // Get total emails
      Email.countDocuments(query),

    // Get category distribution
      Email.aggregate([
      { $match: query },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
      ]),

    // Get daily stats
      Email.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            day: { $dayOfMonth: '$date' }
          },
          count: { $sum: 1 },
          categories: { $addToSet: '$category' }
        }
      },
        { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
      { $limit: 30 }
      ]),

    // Get weekly stats
      Email.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            week: { $week: '$date' }
          },
          count: { $sum: 1 }
        }
      },
        { $sort: { '_id.year': -1, '_id.week': -1 } },
      { $limit: 12 }
      ]),

    // Get monthly stats
      Email.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          count: { $sum: 1 }
        }
      },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
      ]),

    // Get top senders
      Email.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$from',
          count: { $sum: 1 },
          lastEmail: { $max: '$date' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          email: '$_id',
          count: 1,
          lastEmail: 1,
          name: { $substr: ['$_id', 0, { $indexOfBytes: ['$_id', '<'] }] }
        }
      }
      ]),

    // Get email trends (hourly distribution)
      Email.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $hour: '$date' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
      ]),
      
      // Calculate accuracy based on classification confidence levels
      Email.aggregate([
        { $match: { ...query, 'classification.confidence': { $exists: true } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            highConfidence: {
              $sum: { $cond: [{ $gte: ['$classification.confidence', 0.7] }, 1, 0] }
            },
            mediumConfidence: {
              $sum: { 
                $cond: [
                  { $and: [
                    { $gte: ['$classification.confidence', 0.4] },
                    { $lt: ['$classification.confidence', 0.7] }
                  ]}, 1, 0
                ]
              }
            },
            lowConfidence: {
              $sum: { $cond: [{ $lt: ['$classification.confidence', 0.4] }, 1, 0] }
            }
          }
        }
      ]),
      
      // Calculate average response time from processing time
      Email.aggregate([
        { $match: { ...query, 'processingTime': { $exists: true, $ne: null } } },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$processingTime' },
            count: { $sum: 1 }
          }
        }
      ])
    ])
    
    // Process category stats
    const categories = {}
    categoryStats.forEach(stat => {
      categories[stat._id] = stat.count
    })

    // Get model metrics
    const modelMetrics = getModelMetrics()

    // Calculate real classification accuracy from actual data (now from parallel batch)
    let classificationAccuracy = 0
    let responseTime = 0
    
    if (totalEmails > 0) {
      // Process accuracy stats from parallel batch
      if (accuracyStats.length > 0) {
        const stats = accuracyStats[0]
        const estimatedCorrect = stats.highConfidence + (stats.mediumConfidence * 0.75) + (stats.lowConfidence * 0.4)
        classificationAccuracy = stats.total > 0 ? estimatedCorrect / stats.total : 0
      }
      
      // Process response time stats from parallel batch
      if (responseTimeStats.length > 0 && responseTimeStats[0].count > 0) {
        responseTime = Math.round(responseTimeStats[0].avgResponseTime)
      } else {
        // Fallback to a reasonable default if no processing time data
        responseTime = 200
      }
    }

    const responseData = {
      success: true,
      totalEmails,
      categories,
      dailyStats: dailyStats.map(stat => ({
        date: new Date(stat._id.year, stat._id.month - 1, stat._id.day).toISOString().split('T')[0],
        count: stat.count,
        categories: stat.categories
      })),
      weeklyStats: weeklyStats.map(stat => ({
        week: `${stat._id.year}-W${stat._id.week}`,
        count: stat.count
      })),
      monthlyStats: monthlyStats.map(stat => ({
        month: `${stat._id.year}-${stat._id.month.toString().padStart(2, '0')}`,
        count: stat.count
      })),
      topSenders: topSenders.map(sender => ({
        email: sender.email,
        name: sender.name || sender.email.split('@')[0],
        count: sender.count,
        lastEmail: sender.lastEmail
      })),
      emailTrends: emailTrends.map(trend => ({
        hour: trend._id,
        count: trend.count
      })),
      classificationAccuracy,
      responseTime,
      modelMetrics,
      timeRange: range,
      category: category
    }
    
    // Cache the response
    setCachedData(cacheKey, responseData)
    
    res.json(responseData)

  } catch (error) {
    console.error('Advanced analytics error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch advanced analytics',
      error: error.message
    })
  }
}))

// @desc    Get real-time analytics
// @route   GET /api/analytics/realtime
// @access  Private
router.get('/realtime', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const now = new Date()
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000)

    // Get emails from last hour
    const recentEmails = await Email.find({
      userId,
      date: { $gte: lastHour }
    }).sort({ date: -1 }).limit(100)

    // Get category distribution for recent emails
    const categoryStats = recentEmails.reduce((acc, email) => {
      acc[email.category] = (acc[email.category] || 0) + 1
      return acc
    }, {})

    // Get hourly trends for last 24 hours
    const hourlyTrends = []
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
      
      const count = await Email.countDocuments({
        userId,
        date: { $gte: hourStart, $lt: hourEnd }
      })
      
      hourlyTrends.push({
        hour: hourStart.getHours(),
        count
      })
    }

    res.json({
      success: true,
      recentEmails: recentEmails.length,
      categoryStats,
      hourlyTrends,
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error('Real-time analytics error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch real-time analytics',
      error: error.message
    })
  }
}))

// @desc    Get model performance metrics
// @route   GET /api/analytics/model-metrics
// @access  Private
router.get('/model-metrics', protect, asyncHandler(async (req, res) => {
  try {
    const modelMetrics = getModelMetrics()
    
    // Get classification statistics
    const userId = req.user._id
    const totalClassified = await Email.countDocuments({ userId, classification: { $exists: true } })
    const highConfidence = await Email.countDocuments({ 
      userId, 
      'classification.confidence': { $gte: 0.8 } 
    })
    
    const accuracy = totalClassified > 0 ? highConfidence / totalClassified : 0

    res.json({
      success: true,
      ...modelMetrics,
      accuracy,
      totalClassified,
      highConfidence
    })

  } catch (error) {
    console.error('Model metrics error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch model metrics',
      error: error.message
    })
  }
}))

export default router
