// Security routes for audit logs and security management
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { 
  enhancedAuth, 
  activityLogger, 
  adminActionLogger,
  dataAccessLogger 
} from '../middleware/security.js'
import securityService from '../services/securityService.js'
import AuditLog from '../models/AuditLog.js'
import User from '../models/User.js'

const router = express.Router()

// @desc    Get security metrics
// @route   GET /api/security/metrics
// @access  Private (Admin)
router.get('/metrics', enhancedAuth, asyncHandler(async (req, res) => {
  try {
    const metrics = await securityService.getSecurityMetrics()
    
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching security metrics:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security metrics',
      error: error.message
    })
  }
}))

// @desc    Get audit logs
// @route   GET /api/security/audit-logs
// @access  Private (Admin)
router.get('/audit-logs', enhancedAuth, asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      eventType,
      severity,
      userId,
      ip,
      startDate,
      endDate,
      source
    } = req.query

    // Build query
    const query = {}
    
    if (eventType) query.eventType = eventType
    if (severity) query.severity = severity
    if (userId) query.userId = userId
    if (ip) query.ip = ip
    if (source) query['metadata.source'] = source
    
    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = new Date(startDate)
      if (endDate) query.timestamp.$lte = new Date(endDate)
    }

    // Execute query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const auditLogs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email')
      .lean()

    const totalCount = await AuditLog.countDocuments(query)

    res.json({
      success: true,
      data: auditLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message
    })
  }
}))

// @desc    Get security events
// @route   GET /api/security/events
// @access  Private (Admin)
router.get('/events', enhancedAuth, asyncHandler(async (req, res) => {
  try {
    const { limit = 100 } = req.query
    
    const events = await AuditLog.getSecurityEvents(parseInt(limit))
    
    res.json({
      success: true,
      events
    })
  } catch (error) {
    console.error('Error fetching security events:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security events',
      error: error.message
    })
  }
}))

// @desc    Get events by user
// @route   GET /api/security/events/user/:userId
// @access  Private (Admin)
router.get('/events/user/:userId', enhancedAuth, asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params
    const { limit = 100 } = req.query
    
    const events = await AuditLog.getEventsByUser(userId, parseInt(limit))
    
    res.json({
      success: true,
      events
    })
  } catch (error) {
    console.error('Error fetching user events:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user events',
      error: error.message
    })
  }
}))

// @desc    Get events by IP
// @route   GET /api/security/events/ip/:ip
// @access  Private (Admin)
router.get('/events/ip/:ip', enhancedAuth, asyncHandler(async (req, res) => {
  try {
    const { ip } = req.params
    const { limit = 100 } = req.query
    
    const events = await AuditLog.getEventsByIP(ip, parseInt(limit))
    
    res.json({
      success: true,
      events
    })
  } catch (error) {
    console.error('Error fetching IP events:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IP events',
      error: error.message
    })
  }
}))

// @desc    Get event statistics
// @route   GET /api/security/statistics
// @access  Private (Admin)
router.get('/statistics', enhancedAuth, asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      })
    }
    
    const statistics = await AuditLog.getEventStatistics(startDate, endDate)
    
    res.json({
      success: true,
      statistics,
      period: { startDate, endDate }
    })
  } catch (error) {
    console.error('Error fetching event statistics:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event statistics',
      error: error.message
    })
  }
}))

// @desc    Generate security report
// @route   POST /api/security/report
// @access  Private (Admin)
router.post('/report', enhancedAuth, adminActionLogger('SECURITY_REPORT_GENERATED'), asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.body
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      })
    }
    
    const report = await securityService.generateSecurityReport(startDate, endDate)
    
    if (format === 'csv') {
      // Generate CSV report
      const csvData = generateCSVReport(report)
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename=security-report-${Date.now()}.csv`)
      res.send(csvData)
    } else {
      res.json({
        success: true,
        report
      })
    }
  } catch (error) {
    console.error('Error generating security report:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to generate security report',
      error: error.message
    })
  }
}))

// @desc    Block IP address
// @route   POST /api/security/block-ip
// @access  Private (Admin)
router.post('/block-ip', enhancedAuth, adminActionLogger('IP_BLOCKED'), asyncHandler(async (req, res) => {
  try {
    const { ip, reason } = req.body
    
    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required'
      })
    }
    
    // Add to blocked IPs
    securityService.blockedIPs.add(ip)
    
    // Log the action
    await securityService.logSecurityEvent('IP_BLOCKED', {
      ip,
      reason,
      blockedBy: req.user._id
    })
    
    res.json({
      success: true,
      message: 'IP address blocked successfully'
    })
  } catch (error) {
    console.error('Error blocking IP:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to block IP address',
      error: error.message
    })
  }
}))

// @desc    Unblock IP address
// @route   POST /api/security/unblock-ip
// @access  Private (Admin)
router.post('/unblock-ip', enhancedAuth, adminActionLogger('IP_UNBLOCKED'), asyncHandler(async (req, res) => {
  try {
    const { ip } = req.body
    
    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required'
      })
    }
    
    // Remove from blocked IPs
    securityService.blockedIPs.delete(ip)
    securityService.resetFailedAttempts(ip)
    
    // Log the action
    await securityService.logSecurityEvent('IP_UNBLOCKED', {
      ip,
      unblockedBy: req.user._id
    })
    
    res.json({
      success: true,
      message: 'IP address unblocked successfully'
    })
  } catch (error) {
    console.error('Error unblocking IP:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to unblock IP address',
      error: error.message
    })
  }
}))

// @desc    Get blocked IPs
// @route   GET /api/security/blocked-ips
// @access  Private (Admin)
router.get('/blocked-ips', enhancedAuth, asyncHandler(async (req, res) => {
  try {
    const blockedIPs = Array.from(securityService.blockedIPs)
    
    res.json({
      success: true,
      blockedIPs
    })
  } catch (error) {
    console.error('Error fetching blocked IPs:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked IPs',
      error: error.message
    })
  }
}))

// @desc    Reset failed attempts
// @route   POST /api/security/reset-attempts
// @access  Private (Admin)
router.post('/reset-attempts', enhancedAuth, adminActionLogger('FAILED_ATTEMPTS_RESET'), asyncHandler(async (req, res) => {
  try {
    const { identifier } = req.body
    
    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Identifier is required'
      })
    }
    
    securityService.resetFailedAttempts(identifier)
    
    // Log the action
    await securityService.logSecurityEvent('FAILED_ATTEMPTS_RESET', {
      identifier,
      resetBy: req.user._id
    })
    
    res.json({
      success: true,
      message: 'Failed attempts reset successfully'
    })
  } catch (error) {
    console.error('Error resetting failed attempts:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to reset failed attempts',
      error: error.message
    })
  }
}))

// @desc    Get user activity
// @route   GET /api/security/user-activity/:userId
// @access  Private (Admin)
router.get('/user-activity/:userId', enhancedAuth, dataAccessLogger('USER_ACTIVITY'), asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params
    const { limit = 100 } = req.query
    
    const events = await AuditLog.getEventsByUser(userId, parseInt(limit))
    
    res.json({
      success: true,
      events
    })
  } catch (error) {
    console.error('Error fetching user activity:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activity',
      error: error.message
    })
  }
}))

// @desc    Get system health
// @route   GET /api/security/health
// @access  Private (Admin)
router.get('/health', enhancedAuth, asyncHandler(async (req, res) => {
  try {
    const health = await securityService.getSecurityMetrics()
    
    res.json({
      success: true,
      health: {
        status: 'healthy',
        ...health,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error fetching security health:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security health',
      error: error.message
    })
  }
}))

// Helper function to generate CSV report
function generateCSVReport(report) {
  const headers = ['Event Type', 'Count', 'Severity', 'Unique Users', 'Unique IPs']
  const rows = [headers.join(',')]
  
  report.eventsByType.forEach(event => {
    const row = [
      event._id,
      event.totalCount,
      event.severities.map(s => `${s.severity}:${s.count}`).join(';'),
      event.uniqueUsers,
      event.uniqueIPs
    ].map(field => `"${field}"`).join(',')
    rows.push(row)
  })
  
  return rows.join('\n')
}

export default router
