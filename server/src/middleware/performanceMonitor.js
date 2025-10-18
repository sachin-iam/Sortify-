// Performance monitoring middleware
import { performance } from 'perf_hooks'
import performanceService from '../services/performanceService.js'

// Request timing middleware
export const requestTiming = (req, res, next) => {
  const startTime = performance.now()
  
  // Override res.end to capture response time
  const originalEnd = res.end
  res.end = function(...args) {
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Log slow requests
    if (duration > 1000) { // 1 second
      console.warn(`🐌 Slow request: ${req.method} ${req.path} - ${duration.toFixed(2)}ms`)
    }
    
    // Add performance headers
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`)
    res.setHeader('X-Process-Time', `${process.uptime().toFixed(2)}s`)
    
    originalEnd.apply(this, args)
  }
  
  next()
}

// Memory monitoring middleware
export const memoryMonitor = (req, res, next) => {
  const memUsage = process.memoryUsage()
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  }
  
  // Add memory headers
  res.setHeader('X-Memory-RSS', `${memUsageMB.rss}MB`)
  res.setHeader('X-Memory-Heap', `${memUsageMB.heapUsed}MB`)
  
  // Log high memory usage
  if (memUsageMB.heapUsed > 500) { // 500MB
    console.warn(`⚠️ High memory usage: ${memUsageMB.heapUsed}MB`)
  }
  
  next()
}

// Database query monitoring
export const dbQueryMonitor = (req, res, next) => {
  const startTime = performance.now()
  let queryCount = 0
  
  // Override res.json to capture query metrics
  const originalJson = res.json
  res.json = function(data) {
    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    // Add query performance headers
    res.setHeader('X-Query-Time', `${queryTime.toFixed(2)}ms`)
    res.setHeader('X-Query-Count', queryCount.toString())
    
    return originalJson.call(this, data)
  }
  
  next()
}

// Rate limiting middleware
export const rateLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const requests = new Map()
  
  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress
    const now = Date.now()
    
    // Clean old entries
    for (const [key, value] of requests.entries()) {
      if (now - value.firstRequest > windowMs) {
        requests.delete(key)
      }
    }
    
    // Check current client
    const clientRequests = requests.get(clientId) || { count: 0, firstRequest: now }
    
    if (clientRequests.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests',
        retryAfter: Math.ceil((clientRequests.firstRequest + windowMs - now) / 1000)
      })
    }
    
    // Update request count
    clientRequests.count++
    requests.set(clientId, clientRequests)
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests)
    res.setHeader('X-RateLimit-Remaining', maxRequests - clientRequests.count)
    res.setHeader('X-RateLimit-Reset', new Date(clientRequests.firstRequest + windowMs).toISOString())
    
    next()
  }
}

// Performance metrics endpoint
export const performanceMetrics = async (req, res) => {
  try {
    console.log('Getting performance metrics...')
    const metrics = await performanceService.getMetrics()
    console.log('Metrics obtained:', metrics)
    
    const health = await performanceService.healthCheck()
    console.log('Health check completed:', health)
    
    res.json({
      success: true,
      metrics,
      health,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in performanceMetrics:', error)
    // Track this error in the performance service
    performanceService.trackError('performance_metrics', error.message)
    res.status(500).json({
      success: false,
      message: 'Failed to get performance metrics',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// Memory optimization endpoint
export const optimizeMemory = async (req, res) => {
  try {
    performanceService.optimizeMemory()
    
    res.json({
      success: true,
      message: 'Memory optimization completed',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to optimize memory',
      error: error.message
    })
  }
}

// Database optimization endpoint
export const optimizeDatabase = async (req, res) => {
  try {
    const result = await performanceService.optimizeDatabase()
    
    res.json({
      success: true,
      message: 'Database optimization completed',
      result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to optimize database',
      error: error.message
    })
  }
}
