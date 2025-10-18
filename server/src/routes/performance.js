// Performance optimization routes
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { 
  performanceMetrics, 
  optimizeMemory, 
  optimizeDatabase 
} from '../middleware/performanceMonitor.js'
import performanceService from '../services/performanceService.js'
import Email from '../models/Email.js'

const router = express.Router()

// @desc    Get performance metrics
// @route   GET /api/performance/metrics
// @access  Private
router.get('/metrics', protect, performanceMetrics)

// @desc    Optimize memory
// @route   POST /api/performance/optimize/memory
// @access  Private
router.post('/optimize/memory', protect, optimizeMemory)

// @desc    Optimize database
// @route   POST /api/performance/optimize/database
// @access  Private
router.post('/optimize/database', protect, optimizeDatabase)

// @desc    Get system health
// @route   GET /api/performance/health
// @access  Private
router.get('/health', protect, asyncHandler(async (req, res) => {
  try {
    console.log('Getting system health...')
    const health = await performanceService.healthCheck()
    console.log('Health check result:', health)
    
    res.json({
      success: true,
      health,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error getting system health:', error)
    // Track this error in the performance service
    performanceService.trackError('system_health', error.message)
    res.status(500).json({
      success: false,
      message: 'Failed to get system health',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}))

// @desc    Process emails with optimization
// @route   POST /api/performance/process-emails
// @access  Private
router.post('/process-emails', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const {
      batchSize = 50,
      maxConcurrency = 5,
      enableCaching = true,
      enableClassification = true,
      filters = {}
    } = req.body

    // Get emails to process
    let query = { userId }
    
    if (filters.category && filters.category !== 'All') {
      query.category = filters.category
    }

    if (filters.dateRange) {
      const { start, end } = filters.dateRange
      query.date = {}
      if (start) query.date.$gte = new Date(start)
      if (end) query.date.$lte = new Date(end)
    }

    const emails = await Email.find(query)
      .select('subject snippet body text gmailId userId')
      .lean()

    if (emails.length === 0) {
      return res.json({
        success: true,
        message: 'No emails to process',
        totalProcessed: 0
      })
    }

    // Process emails with optimization
    const result = await performanceService.processEmailsOptimized(emails, {
      batchSize,
      maxConcurrency,
      enableCaching,
      enableClassification
    })

    res.json({
      success: true,
      message: 'Emails processed successfully',
      result
    })

  } catch (error) {
    console.error('Error processing emails:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to process emails',
      error: error.message
    })
  }
}))

// @desc    Get optimized email list
// @route   GET /api/performance/emails
// @access  Private
router.get('/emails', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const {
      page = 1,
      limit = 50,
      category = 'All',
      search = '',
      sortBy = 'date',
      sortOrder = 'desc',
      dateRange = {}
    } = req.query

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      search,
      sortBy,
      sortOrder,
      dateRange: dateRange ? JSON.parse(dateRange) : {}
    }

    const result = await performanceService.fetchEmailsOptimized(userId, options)

    res.json({
      success: true,
      data: result.emails,
      pagination: result.pagination
    })

  } catch (error) {
    console.error('Error fetching optimized emails:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch emails',
      error: error.message
    })
  }
}))

// @desc    Reset performance metrics
// @route   POST /api/performance/reset-metrics
// @access  Private
router.post('/reset-metrics', protect, asyncHandler(async (req, res) => {
  try {
    performanceService.resetMetrics()
    
    res.json({
      success: true,
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reset metrics',
      error: error.message
    })
  }
}))

// @desc    Get cache statistics
// @route   GET /api/performance/cache
// @access  Private
router.get('/cache', protect, asyncHandler(async (req, res) => {
  try {
    const metrics = await performanceService.getMetrics()
    
    res.json({
      success: true,
      cache: {
        size: metrics.cacheSize,
        hitRate: metrics.cacheHitRate,
        hits: metrics.cacheHits,
        misses: metrics.cacheMisses
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get cache statistics',
      error: error.message
    })
  }
}))

// @desc    Clear cache
// @route   POST /api/performance/cache/clear
// @access  Private
router.post('/cache/clear', protect, asyncHandler(async (req, res) => {
  try {
    performanceService.clearCache()
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message
    })
  }
}))

// @desc    Get database statistics
// @route   GET /api/performance/database
// @access  Private
router.get('/database', protect, asyncHandler(async (req, res) => {
  try {
    const stats = await performanceService.getCollectionStats()
    
    res.json({
      success: true,
      database: stats
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get database statistics',
      error: error.message
    })
  }
}))

// @desc    Create database indexes
// @route   POST /api/performance/database/indexes
// @access  Private
router.post('/database/indexes', protect, asyncHandler(async (req, res) => {
  try {
    await performanceService.createIndexes()
    
    res.json({
      success: true,
      message: 'Database indexes created successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create database indexes',
      error: error.message
    })
  }
}))

export default router
