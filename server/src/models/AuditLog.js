// Audit log model for security and compliance tracking
import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGOUT',
      'PASSWORD_CHANGED',
      'BRUTE_FORCE_DETECTED',
      'SUSPICIOUS_ACTIVITY_DETECTED',
      'SESSION_CREATED',
      'SESSION_INVALIDATED',
      'RATE_LIMIT_EXCEEDED',
      'UNAUTHORIZED_ACCESS',
      'DATA_EXPORT',
      'DATA_DELETE',
      'DATA_UPDATE',
      'DATA_CREATE',
      'ADMIN_ACTION',
      'EMAIL_CLASSIFIED',
      'EMAIL_SYNCED',
      'CATEGORY_CREATED',
      'CATEGORY_UPDATED',
      'CATEGORY_DELETED',
      'BULK_OPERATION',
      'TEMPLATE_CREATED',
      'TEMPLATE_UPDATED',
      'TEMPLATE_DELETED',
      'NOTIFICATION_SENT',
      'EXPORT_GENERATED',
      'PERFORMANCE_OPTIMIZATION',
      'SECURITY_SCAN',
      'SYSTEM_ERROR'
    ]
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Some events may not have a user (system events)
  },
  
  sessionId: {
    type: String,
    required: false
  },
  
  ip: {
    type: String,
    required: false
  },
  
  userAgent: {
    type: String,
    required: false
  },
  
  severity: {
    type: String,
    required: true,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'INFO'],
    default: 'INFO'
  },
  
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // Additional metadata
  metadata: {
    requestId: String,
    correlationId: String,
    source: {
      type: String,
      enum: ['API', 'WEB', 'MOBILE', 'SYSTEM', 'ADMIN'],
      default: 'API'
    },
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development'
    }
  },
  
  // Compliance fields
  compliance: {
    gdprRelevant: {
      type: Boolean,
      default: false
    },
    dataRetention: {
      type: Date,
      default: function() {
        // Default retention: 7 years for compliance
        return new Date(Date.now() + (7 * 365 * 24 * 60 * 60 * 1000))
      }
    },
    encrypted: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  collection: 'auditlogs'
})

// Indexes for performance
auditLogSchema.index({ eventType: 1, timestamp: -1 })
auditLogSchema.index({ userId: 1, timestamp: -1 })
auditLogSchema.index({ ip: 1, timestamp: -1 })
auditLogSchema.index({ severity: 1, timestamp: -1 })
auditLogSchema.index({ timestamp: -1 })
auditLogSchema.index({ 'metadata.source': 1, timestamp: -1 })

// TTL index for automatic cleanup
auditLogSchema.index(
  { 'compliance.dataRetention': 1 },
  { expireAfterSeconds: 0 }
)

// Virtual for formatted timestamp
auditLogSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString()
})

// Virtual for event description
auditLogSchema.virtual('description').get(function() {
  const descriptions = {
    'LOGIN_SUCCESS': 'User successfully logged in',
    'LOGIN_FAILED': 'Failed login attempt',
    'LOGOUT': 'User logged out',
    'PASSWORD_CHANGED': 'User changed password',
    'BRUTE_FORCE_DETECTED': 'Brute force attack detected',
    'SUSPICIOUS_ACTIVITY_DETECTED': 'Suspicious activity detected',
    'SESSION_CREATED': 'New session created',
    'SESSION_INVALIDATED': 'Session invalidated',
    'RATE_LIMIT_EXCEEDED': 'Rate limit exceeded',
    'UNAUTHORIZED_ACCESS': 'Unauthorized access attempt',
    'DATA_EXPORT': 'Data exported',
    'DATA_DELETE': 'Data deleted',
    'DATA_UPDATE': 'Data updated',
    'DATA_CREATE': 'Data created',
    'ADMIN_ACTION': 'Administrative action performed',
    'EMAIL_CLASSIFIED': 'Email classified',
    'EMAIL_SYNCED': 'Email synchronized',
    'CATEGORY_CREATED': 'Category created',
    'CATEGORY_UPDATED': 'Category updated',
    'CATEGORY_DELETED': 'Category deleted',
    'BULK_OPERATION': 'Bulk operation performed',
    'TEMPLATE_CREATED': 'Template created',
    'TEMPLATE_UPDATED': 'Template updated',
    'TEMPLATE_DELETED': 'Template deleted',
    'NOTIFICATION_SENT': 'Notification sent',
    'EXPORT_GENERATED': 'Export generated',
    'PERFORMANCE_OPTIMIZATION': 'Performance optimization performed',
    'SECURITY_SCAN': 'Security scan performed',
    'SYSTEM_ERROR': 'System error occurred'
  }
  
  return descriptions[this.eventType] || 'Unknown event'
})

// Static methods
auditLogSchema.statics.getEventsByUser = function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'name email')
}

auditLogSchema.statics.getSecurityEvents = function(limit = 100) {
  return this.find({
    severity: { $in: ['HIGH', 'CRITICAL'] }
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'name email')
}

auditLogSchema.statics.getEventsByType = function(eventType, limit = 100) {
  return this.find({ eventType })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'name email')
}

auditLogSchema.statics.getEventsByIP = function(ip, limit = 100) {
  return this.find({ ip })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'name email')
}

auditLogSchema.statics.getEventsByDateRange = function(startDate, endDate, limit = 1000) {
  return this.find({
    timestamp: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'name email')
}

auditLogSchema.statics.getEventStatistics = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: {
          eventType: '$eventType',
          severity: '$severity'
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        uniqueIPs: { $addToSet: '$ip' }
      }
    },
    {
      $group: {
        _id: '$_id.eventType',
        totalCount: { $sum: '$count' },
        severities: {
          $push: {
            severity: '$_id.severity',
            count: '$count'
          }
        },
        uniqueUsers: { $sum: { $size: '$uniqueUsers' } },
        uniqueIPs: { $sum: { $size: '$uniqueIPs' } }
      }
    },
    {
      $sort: { totalCount: -1 }
    }
  ])
}

// Instance methods
auditLogSchema.methods.toSafeObject = function() {
  const obj = this.toObject()
  
  // Remove sensitive data
  if (obj.data && obj.data.password) {
    delete obj.data.password
  }
  
  if (obj.data && obj.data.token) {
    delete obj.data.token
  }
  
  return obj
}

auditLogSchema.methods.isSecurityEvent = function() {
  return ['HIGH', 'CRITICAL'].includes(this.severity)
}

auditLogSchema.methods.isComplianceRelevant = function() {
  return this.compliance.gdprRelevant
}

// Pre-save middleware
auditLogSchema.pre('save', function(next) {
  // Set environment
  if (!this.metadata.environment) {
    this.metadata.environment = process.env.NODE_ENV || 'development'
  }
  
  // Generate correlation ID if not present
  if (!this.metadata.correlationId) {
    this.metadata.correlationId = require('crypto').randomUUID()
  }
  
  next()
})

const AuditLog = mongoose.model('AuditLog', auditLogSchema)

export default AuditLog
