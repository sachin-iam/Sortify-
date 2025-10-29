import express from 'express'
import Email from '../models/Email.js'
import { protect } from '../middleware/auth.js'
import { sseAuth } from '../middleware/sseAuth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { getCategoryCount } from '../services/categoryService.js'
import { clearAdvancedAnalyticsCache } from './advancedAnalytics.js'

// Analytics cache to reduce database load
const analyticsCache = new Map()
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

function getCachedData(key, ttl = CACHE_TTL) {
  const cached = analyticsCache.get(key)
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data
  }
  return null
}

function setCachedData(key, data) {
  analyticsCache.set(key, { data, timestamp: Date.now() })
  // Cleanup old entries
  if (analyticsCache.size > 1000) {
    const oldestKeys = Array.from(analyticsCache.keys()).slice(0, 100)
    oldestKeys.forEach(k => analyticsCache.delete(k))
  }
}

/**
 * Clear analytics cache for a specific user
 * @param {string} userId - User ID
 */
export function clearAnalyticsCache(userId) {
  const keysToDelete = []
  for (const key of analyticsCache.keys()) {
    if (key.includes(userId)) {
      keysToDelete.push(key)
    }
  }
  keysToDelete.forEach(key => analyticsCache.delete(key))
  console.log(`🗑️ Cleared ${keysToDelete.length} analytics cache entries for user ${userId}`)
  
  // Also clear advanced analytics cache
  clearAdvancedAnalyticsCache(userId)
}

const router = express.Router()

// @desc    Get email statistics
// @route   GET /api/analytics/stats
// @access  Private
router.get('/stats', protect, asyncHandler(async (req, res) => {
  try {
    // Check cache first
    const cacheKey = `stats_${req.user._id}`
    const cached = getCachedData(cacheKey)
    if (cached) {
      return res.json({ success: true, stats: cached })
    }

    const stats = await Email.aggregate([
      { $match: { 
        userId: req.user._id,
        isDeleted: { $ne: true }
      } },
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
          starredCount: {
            $sum: { $cond: [{ $in: ['STARRED', { $ifNull: ['$labels', []] }] }, 1, 0] }
          },
          draftCount: {
            $sum: { $cond: [{ $in: ['DRAFT', { $ifNull: ['$labels', []] }] }, 1, 0] }
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
      starredCount: 0,
      draftCount: 0,
      processedToday: 0
    }

    // Count unique categories
    const categoryCount = new Set(
      result.totalByCategory
        .filter(item => item.category !== null)
        .map(item => item.category)
    ).size

    // Get dynamic category count from shared service
    const totalAvailableCategories = await getCategoryCount(req.user._id)

    const statsResponse = {
      totalEmails: result.totalEmails,
      categories: totalAvailableCategories, // Dynamic category count
      processedToday: result.processedToday,
      unreadCount: result.unreadCount,
      starredCount: result.starredCount || 0,
      draftCount: result.draftCount || 0,
      activeCategories: categoryCount // Add this for reference
    }

    // Cache the result before sending
    setCachedData(cacheKey, statsResponse)

    res.json({
      success: true,
      stats: statsResponse
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
    // Check cache first
    const cacheKey = `categories_${req.user._id}`
    const cached = getCachedData(cacheKey)
    if (cached) {
      return res.json({ success: true, data: cached })
    }

    // OPTIMIZED: Use the optimized getCategories function which has its own caching
    const { getCategories } = await import('../services/categoryService.js')
    const categories = await getCategories(req.user._id)

    // Transform to analytics format
    const categoryData = categories.map(cat => ({
      label: cat.name,
      count: cat.count
    }))

    // Sort by count descending
    categoryData.sort((a, b) => b.count - a.count)

    // Cache the result before sending
    setCachedData(cacheKey, categoryData)

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
    // Check if ML service is available
    const ML_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'
    let mlServiceAvailable = false
    
    try {
      const response = await fetch(`${ML_SERVICE_URL}/health`, { timeout: 2000 })
      mlServiceAvailable = response.ok
    } catch (error) {
      mlServiceAvailable = false
    }

    const accuracyData = await Email.aggregate([
      {
        $match: {
          userId: req.user._id,
          'classification.confidence': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          highConfidence: {
            $sum: {
              $cond: [{ $gte: ['$classification.confidence', 0.7] }, 1, 0]
            }
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
            $sum: {
              $cond: [{ $lt: ['$classification.confidence', 0.4] }, 1, 0]
            }
          },
          accuracyBreakdown: {
            $push: {
              category: '$category',
              confidence: '$classification.confidence',
              isHighConfidence: { $gte: ['$classification.confidence', 0.7] }
            }
          }
        }
      }
    ])

    const result = accuracyData[0] || { 
      total: 0, 
      highConfidence: 0, 
      mediumConfidence: 0, 
      lowConfidence: 0, 
      accuracyBreakdown: [] 
    }
    
    // Calculate realistic accuracy based on confidence levels
    // High confidence emails are likely more accurate
    const estimatedCorrect = result.highConfidence + (result.mediumConfidence * 0.75) + (result.lowConfidence * 0.4)
    const overallAccuracy = result.total > 0 ? (estimatedCorrect / result.total) * 100 : 0

    // Calculate accuracy by category
    const categoryAccuracy = {}
    result.accuracyBreakdown.forEach(item => {
      if (!categoryAccuracy[item.category]) {
        categoryAccuracy[item.category] = { 
          correct: 0, 
          total: 0, 
          highConfidence: 0,
          mediumConfidence: 0,
          lowConfidence: 0
        }
      }
      categoryAccuracy[item.category].total++
      
      // Estimate correctness based on confidence
      if (item.confidence >= 0.7) {
        categoryAccuracy[item.category].highConfidence++
        categoryAccuracy[item.category].correct += 1.0
      } else if (item.confidence >= 0.4) {
        categoryAccuracy[item.category].mediumConfidence++
        categoryAccuracy[item.category].correct += 0.75
      } else {
        categoryAccuracy[item.category].lowConfidence++
        categoryAccuracy[item.category].correct += 0.4
      }
    })

    const accuracyBreakdown = Object.entries(categoryAccuracy).map(([category, data]) => ({
      category,
      correct: Math.round(data.correct),
      total: data.total,
      accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 10000) / 100 : 0,
      confidenceDistribution: {
        high: data.highConfidence,
        medium: data.mediumConfidence,
        low: data.lowConfidence
      }
    }))

    res.json({
      success: true,
      data: {
        overallAccuracy: Math.round(overallAccuracy * 100) / 100,
        correct: Math.round(estimatedCorrect),
        total: result.total,
        mlServiceStatus: mlServiceAvailable ? 'available' : 'unavailable',
        confidenceDistribution: {
          high: result.highConfidence,
          medium: result.mediumConfidence,
          low: result.lowConfidence
        },
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
    // Use a reasonable limit for misclassifications (10000 max)
    const limit = parseInt(req.query.limit) || 10000

    // Query ONLY emails that are likely misclassified (low confidence or phase mismatch)
    // This dramatically improves performance by filtering at the database level
    const misclassifications = await Email.find({
      userId: req.user._id,
      $or: [
        { 'classification.confidence': { $lt: 0.6 } }, // Low confidence classifications
        { 'classification.phase1.label': { $exists: true, $ne: '$category' } } // Phase 1 and category mismatch
      ]
    })
    .select('subject from date category classification labels')
    .sort({ date: -1 })
    .limit(limit)
    .lean() // Use lean() for faster queries (returns plain JS objects)

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
router.get('/realtime', sseAuth, asyncHandler(async (req, res) => {
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
  }, 2 * 60 * 1000)

  res.on('close', () => {
    clearInterval(interval)
  })
}))

export default router
