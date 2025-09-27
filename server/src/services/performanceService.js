// Performance optimization service for handling large email volumes (100k+)
import { performance } from 'perf_hooks'
import { EventEmitter } from 'events'
import Email from '../models/Email.js'
import { classifyEmail } from './classificationService.js'
import { sendEmailSyncUpdate } from './websocketService.js'

class PerformanceService extends EventEmitter {
  constructor() {
    super()
    this.batchSize = 50 // Process emails in batches
    this.maxConcurrency = 5 // Maximum concurrent operations
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutes
    this.processingQueue = []
    this.isProcessing = false
    this.metrics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    }
    
    // Start cleanup interval
    setInterval(() => this.cleanupCache(), this.cacheTimeout)
  }

  // Optimized email processing with batching and concurrency control
  async processEmailsOptimized(emails, options = {}) {
    const startTime = performance.now()
    const {
      batchSize = this.batchSize,
      maxConcurrency = this.maxConcurrency,
      enableCaching = true,
      enableClassification = true,
      enableWebSocketUpdates = true
    } = options

    try {
      this.emit('processingStarted', { totalEmails: emails.length })
      
      // Split emails into batches
      const batches = this.createBatches(emails, batchSize)
      const results = []
      
      // Process batches with concurrency control
      for (let i = 0; i < batches.length; i += maxConcurrency) {
        const concurrentBatches = batches.slice(i, i + maxConcurrency)
        
        const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
          const actualBatchIndex = i + batchIndex
          return this.processBatch(batch, {
            batchIndex: actualBatchIndex,
            totalBatches: batches.length,
            enableCaching,
            enableClassification,
            enableWebSocketUpdates
          })
        })
        
        const batchResults = await Promise.allSettled(batchPromises)
        results.push(...batchResults)
        
        // Emit progress update
        this.emit('batchProcessed', {
          processedBatches: i + concurrentBatches.length,
          totalBatches: batches.length,
          progress: ((i + concurrentBatches.length) / batches.length) * 100
        })
      }
      
      const endTime = performance.now()
      const processingTime = endTime - startTime
      
      // Update metrics
      this.updateMetrics(emails.length, processingTime)
      
      this.emit('processingCompleted', {
        totalEmails: emails.length,
        processingTime,
        results: results.filter(r => r.status === 'fulfilled').map(r => r.value)
      })
      
      return {
        success: true,
        totalProcessed: emails.length,
        processingTime,
        results: results.filter(r => r.status === 'fulfilled').map(r => r.value),
        errors: results.filter(r => r.status === 'rejected').map(r => r.reason)
      }
      
    } catch (error) {
      console.error('Error in optimized email processing:', error)
      this.emit('processingError', error)
      throw error
    }
  }

  // Create batches from email array
  createBatches(emails, batchSize) {
    const batches = []
    for (let i = 0; i < emails.length; i += batchSize) {
      batches.push(emails.slice(i, i + batchSize))
    }
    return batches
  }

  // Process a single batch
  async processBatch(batch, options = {}) {
    const { batchIndex, totalBatches, enableCaching, enableClassification, enableWebSocketUpdates } = options
    const startTime = performance.now()
    
    try {
      const results = []
      
      for (const email of batch) {
        try {
          // Check cache first
          if (enableCaching) {
            const cached = this.getFromCache(email.gmailId)
            if (cached) {
              results.push(cached)
              this.metrics.cacheHits++
              continue
            }
          }
          
          // Process email
          let processedEmail = { ...email }
          
          // Classification
          if (enableClassification && email.subject) {
            const classification = await classifyEmail(
              email.subject,
              email.snippet || '',
              email.body || email.text || '',
              email.userId
            )
            processedEmail.classification = classification
          }
          
          // Cache result
          if (enableCaching) {
            this.setCache(email.gmailId, processedEmail)
          }
          
          results.push(processedEmail)
          this.metrics.cacheMisses++
          
        } catch (error) {
          console.error(`Error processing email ${email.gmailId}:`, error)
          this.metrics.errors++
          results.push({ ...email, error: error.message })
        }
      }
      
      const endTime = performance.now()
      const batchTime = endTime - startTime
      
      // Send WebSocket update
      if (enableWebSocketUpdates) {
        sendEmailSyncUpdate({
          type: 'batch_processed',
          batchIndex,
          totalBatches,
          processedCount: results.length,
          processingTime: batchTime
        })
      }
      
      return {
        batchIndex,
        processedCount: results.length,
        processingTime: batchTime,
        results
      }
      
    } catch (error) {
      console.error(`Error processing batch ${batchIndex}:`, error)
      throw error
    }
  }

  // Optimized email fetching with pagination and indexing
  async fetchEmailsOptimized(userId, options = {}) {
    const {
      page = 1,
      limit = 50,
      category = 'All',
      search = '',
      sortBy = 'date',
      sortOrder = 'desc',
      dateRange = {},
      useIndex = true
    } = options

    try {
      // Build optimized query
      const query = this.buildOptimizedQuery(userId, {
        category,
        search,
        dateRange
      })

      // Build sort object
      const sort = this.buildSortObject(sortBy, sortOrder)

      // Calculate skip value
      const skip = (page - 1) * limit

      // Execute query with optimization
      const emails = await Email.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select(this.getOptimizedFields())
        .lean() // Use lean() for better performance
        .exec()

      // Get total count efficiently
      const totalCount = await Email.countDocuments(query)

      return {
        emails,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      }

    } catch (error) {
      console.error('Error fetching emails optimized:', error)
      throw error
    }
  }

  // Build optimized query
  buildOptimizedQuery(userId, filters) {
    const query = { userId }

    // Category filter
    if (filters.category && filters.category !== 'All') {
      query.category = filters.category
    }

    // Date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      query.date = {}
      if (filters.dateRange.start) {
        query.date.$gte = new Date(filters.dateRange.start)
      }
      if (filters.dateRange.end) {
        query.date.$lte = new Date(filters.dateRange.end)
      }
    }

    // Search filter (optimized with text index)
    if (filters.search) {
      query.$text = { $search: filters.search }
    }

    return query
  }

  // Build sort object
  buildSortObject(sortBy, sortOrder) {
    const order = sortOrder === 'desc' ? -1 : 1
    return { [sortBy]: order }
  }

  // Get optimized field selection
  getOptimizedFields() {
    return 'subject from date category isRead snippet classification gmailId attachments'
  }

  // Cache management
  setCache(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    })
  }

  getFromCache(key) {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value
    }
    if (cached) {
      this.cache.delete(key)
    }
    return null
  }

  cleanupCache() {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key)
      }
    }
  }

  // Database optimization methods
  async optimizeDatabase() {
    try {
      // Create indexes for better performance
      await this.createIndexes()
      
      // Analyze collection statistics
      const stats = await this.getCollectionStats()
      
      return {
        success: true,
        indexes: stats.indexes,
        collectionStats: stats.collectionStats
      }
    } catch (error) {
      console.error('Error optimizing database:', error)
      throw error
    }
  }

  // Create performance indexes
  async createIndexes() {
    const indexes = [
      // User and date compound index
      { userId: 1, date: -1 },
      // Category index
      { category: 1 },
      // Read status index
      { isRead: 1 },
      // Text search index
      { subject: 'text', snippet: 'text', body: 'text' },
      // Gmail ID unique index
      { gmailId: 1 },
      // Classification confidence index
      { 'classification.confidence': -1 }
    ]

    for (const index of indexes) {
      try {
        await Email.collection.createIndex(index)
        console.log(`✅ Created index:`, index)
      } catch (error) {
        if (error.code !== 85) { // Index already exists
          console.error(`❌ Error creating index:`, error)
        }
      }
    }
  }

  // Get collection statistics
  async getCollectionStats() {
    try {
      const stats = await Email.collection.stats()
      const indexes = await Email.collection.indexes()
      
      return {
        collectionStats: {
          count: stats.count,
          size: stats.size,
          avgObjSize: stats.avgObjSize,
          storageSize: stats.storageSize,
          totalIndexSize: stats.totalIndexSize
        },
        indexes: indexes.map(index => ({
          name: index.name,
          key: index.key,
          size: index.size
        }))
      }
    } catch (error) {
      console.error('Error getting collection stats:', error)
      return null
    }
  }

  // Memory optimization
  optimizeMemory() {
    // Clear old cache entries
    this.cleanupCache()
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    
    // Log memory usage
    const memUsage = process.memoryUsage()
    console.log('Memory usage:', {
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
    })
  }

  // Update performance metrics
  updateMetrics(processedCount, processingTime) {
    this.metrics.totalProcessed += processedCount
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime + processingTime) / 2
  }

  // Get performance metrics
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100,
      memoryUsage: process.memoryUsage()
    }
  }

  // Reset metrics
  resetMetrics() {
    this.metrics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    }
  }

  // Health check
  async healthCheck() {
    try {
      const metrics = this.getMetrics()
      const memUsage = process.memoryUsage()
      
      return {
        status: 'healthy',
        metrics,
        memoryUsage: {
          rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
        },
        cacheSize: this.cache.size,
        uptime: process.uptime()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      }
    }
  }
}

// Create singleton instance
const performanceService = new PerformanceService()

export default performanceService
