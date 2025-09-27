// Advanced security service for authentication, authorization, and threat detection
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { EventEmitter } from 'events'
import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'

class SecurityService extends EventEmitter {
  constructor() {
    super()
    this.failedAttempts = new Map()
    this.blockedIPs = new Set()
    this.suspiciousActivities = new Map()
    this.securityConfig = {
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      suspiciousThreshold: 10,
      maxSuspiciousActivities: 100,
      passwordMinLength: 8,
      passwordRequireSpecial: true,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      refreshTokenExpiry: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
    
    // Start cleanup intervals
    setInterval(() => this.cleanupSecurityData(), 5 * 60 * 1000) // Every 5 minutes
  }

  // Password security
  async hashPassword(password) {
    const saltRounds = 12
    return await bcrypt.hash(password, saltRounds)
  }

  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword)
  }

  validatePasswordStrength(password) {
    const errors = []
    
    if (password.length < this.securityConfig.passwordMinLength) {
      errors.push(`Password must be at least ${this.securityConfig.passwordMinLength} characters long`)
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }
    
    if (this.securityConfig.passwordRequireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // JWT token management
  generateAccessToken(userId) {
    return jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )
  }

  generateRefreshToken(userId) {
    return jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
  }

  verifyToken(token, type = 'access') {
    try {
      const secret = type === 'refresh' 
        ? (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET)
        : process.env.JWT_SECRET
      
      return jwt.verify(token, secret)
    } catch (error) {
      throw new Error('Invalid or expired token')
    }
  }

  // Rate limiting and brute force protection
  trackFailedAttempt(identifier, type = 'login') {
    const key = `${type}:${identifier}`
    const now = Date.now()
    
    if (!this.failedAttempts.has(key)) {
      this.failedAttempts.set(key, { count: 0, firstAttempt: now, lastAttempt: now })
    }
    
    const attempt = this.failedAttempts.get(key)
    attempt.count++
    attempt.lastAttempt = now
    
    // Check if threshold exceeded
    if (attempt.count >= this.securityConfig.maxFailedAttempts) {
      this.blockedIPs.add(identifier)
      this.emit('securityAlert', {
        type: 'brute_force',
        identifier,
        attempts: attempt.count,
        timestamp: now
      })
      
      // Log security event
      this.logSecurityEvent('BRUTE_FORCE_DETECTED', {
        identifier,
        attempts: attempt.count,
        type
      })
    }
    
    return {
      isBlocked: this.blockedIPs.has(identifier),
      attemptsRemaining: Math.max(0, this.securityConfig.maxFailedAttempts - attempt.count),
      lockoutTime: attempt.count >= this.securityConfig.maxFailedAttempts 
        ? this.securityConfig.lockoutDuration 
        : 0
    }
  }

  resetFailedAttempts(identifier, type = 'login') {
    const key = `${type}:${identifier}`
    this.failedAttempts.delete(key)
    this.blockedIPs.delete(identifier)
  }

  isBlocked(identifier) {
    return this.blockedIPs.has(identifier)
  }

  // Suspicious activity detection
  trackSuspiciousActivity(identifier, activity, metadata = {}) {
    const now = Date.now()
    
    if (!this.suspiciousActivities.has(identifier)) {
      this.suspiciousActivities.set(identifier, [])
    }
    
    const activities = this.suspiciousActivities.get(identifier)
    activities.push({
      activity,
      metadata,
      timestamp: now
    })
    
    // Keep only recent activities
    const cutoff = now - (60 * 60 * 1000) // 1 hour
    const recentActivities = activities.filter(act => act.timestamp > cutoff)
    this.suspiciousActivities.set(identifier, recentActivities)
    
    // Check if threshold exceeded
    if (recentActivities.length >= this.securityConfig.suspiciousThreshold) {
      this.emit('securityAlert', {
        type: 'suspicious_activity',
        identifier,
        activities: recentActivities.length,
        timestamp: now
      })
      
      // Log security event
      this.logSecurityEvent('SUSPICIOUS_ACTIVITY_DETECTED', {
        identifier,
        activityCount: recentActivities.length,
        activities: recentActivities.map(act => act.activity)
      })
    }
    
    return recentActivities.length
  }

  // IP whitelist/blacklist management
  isIPWhitelisted(ip) {
    const whitelist = process.env.IP_WHITELIST?.split(',') || []
    return whitelist.includes(ip)
  }

  isIPBlacklisted(ip) {
    const blacklist = process.env.IP_BLACKLIST?.split(',') || []
    return blacklist.includes(ip) || this.blockedIPs.has(ip)
  }

  // Session management
  async createSession(userId, deviceInfo = {}) {
    const sessionId = crypto.randomUUID()
    const accessToken = this.generateAccessToken(userId)
    const refreshToken = this.generateRefreshToken(userId)
    
    // Log session creation
    await this.logSecurityEvent('SESSION_CREATED', {
      userId,
      sessionId,
      deviceInfo,
      ip: deviceInfo.ip
    })
    
    return {
      sessionId,
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + this.securityConfig.sessionTimeout)
    }
  }

  async invalidateSession(sessionId, reason = 'LOGOUT') {
    // Log session invalidation
    await this.logSecurityEvent('SESSION_INVALIDATED', {
      sessionId,
      reason
    })
  }

  // Security headers middleware
  getSecurityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://gmail.googleapis.com"],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: []
        }
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    })
  }

  // Rate limiting configuration
  getRateLimitConfig() {
    return {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: 15 * 60 // 15 minutes in seconds
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.trackSuspiciousActivity(req.ip, 'RATE_LIMIT_EXCEEDED', {
          path: req.path,
          method: req.method
        })
        
        res.status(429).json({
          success: false,
          message: 'Too many requests from this IP, please try again later.',
          retryAfter: 15 * 60
        })
      }
    }
  }

  // Audit logging
  async logSecurityEvent(eventType, data) {
    try {
      const auditLog = new AuditLog({
        eventType,
        data,
        timestamp: new Date(),
        severity: this.getEventSeverity(eventType)
      })
      
      await auditLog.save()
      
      // Emit event for real-time monitoring
      this.emit('auditLog', {
        eventType,
        data,
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('Error logging security event:', error)
    }
  }

  getEventSeverity(eventType) {
    const severityMap = {
      'LOGIN_SUCCESS': 'INFO',
      'LOGIN_FAILED': 'WARN',
      'LOGOUT': 'INFO',
      'PASSWORD_CHANGED': 'INFO',
      'BRUTE_FORCE_DETECTED': 'CRITICAL',
      'SUSPICIOUS_ACTIVITY_DETECTED': 'HIGH',
      'SESSION_CREATED': 'INFO',
      'SESSION_INVALIDATED': 'INFO',
      'RATE_LIMIT_EXCEEDED': 'MEDIUM',
      'UNAUTHORIZED_ACCESS': 'HIGH',
      'DATA_EXPORT': 'INFO',
      'DATA_DELETE': 'HIGH',
      'ADMIN_ACTION': 'HIGH'
    }
    
    return severityMap[eventType] || 'INFO'
  }

  // Security monitoring
  async getSecurityMetrics() {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)
    const oneDayAgo = now - (24 * 60 * 60 * 1000)
    
    // Get recent security events
    const recentEvents = await AuditLog.find({
      timestamp: { $gte: new Date(oneHourAgo) }
    }).sort({ timestamp: -1 })
    
    // Get blocked IPs count
    const blockedIPsCount = this.blockedIPs.size
    
    // Get failed attempts count
    const failedAttemptsCount = Array.from(this.failedAttempts.values())
      .reduce((sum, attempt) => sum + attempt.count, 0)
    
    // Get suspicious activities count
    const suspiciousActivitiesCount = Array.from(this.suspiciousActivities.values())
      .reduce((sum, activities) => sum + activities.length, 0)
    
    return {
      blockedIPs: blockedIPsCount,
      failedAttempts: failedAttemptsCount,
      suspiciousActivities: suspiciousActivitiesCount,
      recentEvents: recentEvents.length,
      securityAlerts: recentEvents.filter(event => 
        ['CRITICAL', 'HIGH'].includes(event.severity)
      ).length
    }
  }

  // Cleanup security data
  cleanupSecurityData() {
    const now = Date.now()
    const cutoff = now - (24 * 60 * 60 * 1000) // 24 hours
    
    // Clean up old failed attempts
    for (const [key, attempt] of this.failedAttempts.entries()) {
      if (attempt.lastAttempt < cutoff) {
        this.failedAttempts.delete(key)
      }
    }
    
    // Clean up old suspicious activities
    for (const [identifier, activities] of this.suspiciousActivities.entries()) {
      const recentActivities = activities.filter(act => act.timestamp > cutoff)
      if (recentActivities.length === 0) {
        this.suspiciousActivities.delete(identifier)
      } else {
        this.suspiciousActivities.set(identifier, recentActivities)
      }
    }
    
    // Clean up old blocked IPs (after lockout duration)
    for (const ip of this.blockedIPs) {
      const attempt = this.failedAttempts.get(`login:${ip}`)
      if (attempt && attempt.lastAttempt < cutoff) {
        this.blockedIPs.delete(ip)
      }
    }
  }

  // Security validation
  validateRequest(req) {
    const issues = []
    
    // Check for suspicious headers
    if (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',').length > 3) {
      issues.push('Suspicious X-Forwarded-For header')
    }
    
    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+'.*'\s*=\s*'.*')/i
    ]
    
    const queryString = JSON.stringify(req.query)
    const bodyString = JSON.stringify(req.body)
    
    for (const pattern of sqlPatterns) {
      if (pattern.test(queryString) || pattern.test(bodyString)) {
        issues.push('Potential SQL injection detected')
        break
      }
    }
    
    // Check for XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ]
    
    for (const pattern of xssPatterns) {
      if (pattern.test(queryString) || pattern.test(bodyString)) {
        issues.push('Potential XSS attack detected')
        break
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    }
  }

  // Generate security report
  async generateSecurityReport(startDate, endDate) {
    const events = await AuditLog.find({
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).sort({ timestamp: -1 })
    
    const report = {
      period: { startDate, endDate },
      totalEvents: events.length,
      eventsByType: {},
      eventsBySeverity: {},
      topIPs: {},
      securityAlerts: events.filter(event => 
        ['CRITICAL', 'HIGH'].includes(event.severity)
      ),
      recommendations: []
    }
    
    // Analyze events
    events.forEach(event => {
      // Count by type
      report.eventsByType[event.eventType] = 
        (report.eventsByType[event.eventType] || 0) + 1
      
      // Count by severity
      report.eventsBySeverity[event.severity] = 
        (report.eventsBySeverity[event.severity] || 0) + 1
      
      // Count by IP
      if (event.data.ip) {
        report.topIPs[event.data.ip] = 
          (report.topIPs[event.data.ip] || 0) + 1
      }
    })
    
    // Generate recommendations
    if (report.eventsByType['BRUTE_FORCE_DETECTED'] > 0) {
      report.recommendations.push('Consider implementing CAPTCHA for login attempts')
    }
    
    if (report.eventsByType['SUSPICIOUS_ACTIVITY_DETECTED'] > 5) {
      report.recommendations.push('Review and strengthen rate limiting policies')
    }
    
    if (report.eventsBySeverity['CRITICAL'] > 0) {
      report.recommendations.push('Immediate security review required')
    }
    
    return report
  }
}

// Create singleton instance
const securityService = new SecurityService()

export default securityService
