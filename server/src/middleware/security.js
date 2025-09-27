// Advanced security middleware
import crypto from 'crypto'
import securityService from '../services/securityService.js'
import AuditLog from '../models/AuditLog.js'

// Security validation middleware
export const securityValidation = (req, res, next) => {
  try {
    // Validate request for security threats
    const validation = securityService.validateRequest(req)
    
    if (!validation.isValid) {
      // Log security threat
      securityService.logSecurityEvent('SECURITY_THREAT_DETECTED', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        issues: validation.issues,
        path: req.path,
        method: req.method,
        query: req.query,
        body: req.body
      })
      
      return res.status(400).json({
        success: false,
        message: 'Security validation failed',
        issues: validation.issues
      })
    }
    
    next()
  } catch (error) {
    console.error('Security validation error:', error)
    next()
  }
}

// IP whitelist/blacklist middleware
export const ipFiltering = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress
  
  // Check if IP is blacklisted
  if (securityService.isIPBlacklisted(clientIP)) {
    securityService.logSecurityEvent('BLOCKED_IP_ACCESS', {
      ip: clientIP,
      path: req.path,
      method: req.method
    })
    
    return res.status(403).json({
      success: false,
      message: 'Access denied from this IP address'
    })
  }
  
  // Check if IP is whitelisted (if whitelist is configured)
  if (process.env.IP_WHITELIST && !securityService.isIPWhitelisted(clientIP)) {
    securityService.logSecurityEvent('NON_WHITELISTED_IP_ACCESS', {
      ip: clientIP,
      path: req.path,
      method: req.method
    })
    
    return res.status(403).json({
      success: false,
      message: 'Access denied: IP not whitelisted'
    })
  }
  
  next()
}

// Brute force protection middleware - TEMPORARILY DISABLED
export const bruteForceProtection = (req, res, next) => {
  // TEMPORARILY DISABLED to fix JWT authentication issues
  // TODO: Re-enable with proper configuration
  return next()
  
  /* ORIGINAL CODE - DISABLED
  const clientIP = req.ip || req.connection.remoteAddress
  
  // Skip brute force protection for Gmail OAuth to prevent 429 errors
  if (req.path === '/api/auth/gmail/connect' || req.path === '/api/auth/gmail/callback') {
    // Clear any existing blocks for this IP to ensure Gmail OAuth works
    securityService.resetFailedAttempts(clientIP)
    return next()
  }
  
  // Check if IP is blocked
  if (securityService.isBlocked(clientIP)) {
    return res.status(429).json({
      success: false,
      message: 'Too many failed attempts. Please try again later.',
      retryAfter: 900 // 15 minutes
    })
  }
  
  next()
  */
}

// Enhanced authentication middleware
export const enhancedAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      securityService.logSecurityEvent('UNAUTHORIZED_ACCESS', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        reason: 'No token provided'
      })
      
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      })
    }
    
    const decoded = securityService.verifyToken(token)
    req.user = { _id: decoded.userId }
    
    // Log successful authentication
    securityService.logSecurityEvent('AUTHENTICATION_SUCCESS', {
      userId: decoded.userId,
      ip: req.ip,
      path: req.path,
      method: req.method
    })
    
    next()
  } catch (error) {
    securityService.logSecurityEvent('AUTHENTICATION_FAILED', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      reason: error.message
    })
    
    return res.status(401).json({
      success: false,
      message: 'Access denied. Invalid token.'
    })
  }
}

// Activity logging middleware
export const activityLogger = (eventType, options = {}) => {
  return async (req, res, next) => {
    const originalSend = res.send
    
    res.send = function(data) {
      // Log the activity
      securityService.logSecurityEvent(eventType, {
        userId: req.user?._id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        ...options
      })
      
      originalSend.call(this, data)
    }
    
    next()
  }
}

// Data access logging middleware
export const dataAccessLogger = (dataType) => {
  return async (req, res, next) => {
    const originalSend = res.send
    
    res.send = function(data) {
      // Log data access
      securityService.logSecurityEvent('DATA_ACCESS', {
        userId: req.user?._id,
        ip: req.ip,
        dataType,
        action: req.method,
        path: req.path,
        recordCount: Array.isArray(data) ? data.length : 1
      })
      
      originalSend.call(this, data)
    }
    
    next()
  }
}

// Admin action logging middleware
export const adminActionLogger = (action) => {
  return async (req, res, next) => {
    const originalSend = res.send
    
    res.send = function(data) {
      // Log admin action
      securityService.logSecurityEvent('ADMIN_ACTION', {
        userId: req.user?._id,
        ip: req.ip,
        action,
        path: req.path,
        method: req.method,
        data: req.body
      })
      
      originalSend.call(this, data)
    }
    
    next()
  }
}

// Export action logging middleware
export const exportLogger = (exportType) => {
  return async (req, res, next) => {
    const originalSend = res.send
    
    res.send = function(data) {
      // Log export action
      securityService.logSecurityEvent('DATA_EXPORT', {
        userId: req.user?._id,
        ip: req.ip,
        exportType,
        format: req.body?.format || 'unknown',
        recordCount: req.body?.recordCount || 0,
        filters: req.body?.filters || {}
      })
      
      originalSend.call(this, data)
    }
    
    next()
  }
}

// Security headers middleware
export const securityHeaders = (req, res, next) => {
  // Apply security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // Remove server information
  res.removeHeader('X-Powered-By')
  
  next()
}

// Request ID middleware
export const requestId = (req, res, next) => {
  req.requestId = crypto.randomUUID()
  res.setHeader('X-Request-ID', req.requestId)
  next()
}

// Suspicious activity detection middleware
export const suspiciousActivityDetection = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress
  
  // Track suspicious patterns
  const suspiciousPatterns = [
    // SQL injection attempts
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    // XSS attempts
    /<script[^>]*>.*?<\/script>/gi,
    // Path traversal attempts
    /\.\.\//g,
    // Command injection attempts
    /[;&|`$()]/g
  ]
  
  const requestString = JSON.stringify({
    query: req.query,
    body: req.body,
    path: req.path
  })
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      securityService.trackSuspiciousActivity(clientIP, 'SUSPICIOUS_PATTERN_DETECTED', {
        pattern: pattern.toString(),
        path: req.path,
        method: req.method
      })
      break
    }
  }
  
  next()
}

// Rate limiting per user middleware
export const userRateLimit = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const userRequests = new Map()
  
  return (req, res, next) => {
    if (!req.user?._id) {
      return next()
    }
    
    const userId = req.user._id.toString()
    const now = Date.now()
    
    // Clean old entries
    for (const [key, value] of userRequests.entries()) {
      if (now - value.firstRequest > windowMs) {
        userRequests.delete(key)
      }
    }
    
    // Check current user
    const userRequest = userRequests.get(userId) || { count: 0, firstRequest: now }
    
    if (userRequest.count >= maxRequests) {
      securityService.logSecurityEvent('USER_RATE_LIMIT_EXCEEDED', {
        userId,
        ip: req.ip,
        path: req.path,
        method: req.method
      })
      
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((userRequest.firstRequest + windowMs - now) / 1000)
      })
    }
    
    // Update request count
    userRequest.count++
    userRequests.set(userId, userRequest)
    
    next()
  }
}

// Data sanitization middleware
export const dataSanitization = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body)
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query)
  }
  
  next()
}

// Helper function to sanitize objects
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }
  
  const sanitized = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      sanitized[key] = value
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim()
    } else {
      sanitized[key] = sanitizeObject(value)
    }
  }
  
  return sanitized
}
