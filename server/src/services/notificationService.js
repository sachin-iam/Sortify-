// Notification service for push notifications and email alerts
import { WebSocketServer } from 'ws'
import nodemailer from 'nodemailer'
import cron from 'node-cron'
import Notification from '../models/Notification.js'

class NotificationService {
  constructor() {
    this.wsServer = null
    this.emailTransporter = null
    this.notificationQueue = []
    this.userPreferences = new Map()
    this.scheduledNotifications = new Map()
    
    this.initializeEmailTransporter()
    this.startNotificationProcessor()
    this.initializeSampleData()
  }

  initializeEmailTransporter() {
    // Initialize email transporter for sending email alerts
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
      }
    })
  }

  initializeSampleData() {
    // Add some sample notifications for testing (in a real app, this would be loaded from database)
    const now = new Date()
    const sampleNotifications = [
      {
        id: this.generateNotificationId(),
        userId: 'sample-user-id', // This will be replaced by actual user ID when real notifications are created
        type: 'new_email',
        title: 'Welcome to Sortify',
        message: 'Your email management system is now set up and ready to use.',
        data: { welcome: true },
        timestamp: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
        read: false,
        archived: false
      },
      {
        id: this.generateNotificationId(),
        userId: 'sample-user-id',
        type: 'system',
        title: 'System Ready',
        message: 'All systems are operational and ready for email processing.',
        data: { system: true },
        timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        read: true,
        archived: false
      }
    ]
    
    this.notificationQueue.push(...sampleNotifications)
    console.log('📱 Notification service initialized with sample data')
  }

  setWebSocketServer(wsServer) {
    this.wsServer = wsServer
  }

  // Push notification methods
  async sendPushNotification(userId, notification) {
    const notificationData = {
      id: this.generateNotificationId(),
      userId,
      type: notification.type || 'info',
      title: notification.title,
      message: notification.message,
      data: notification.data || {},
      timestamp: new Date().toISOString(),
      read: false,
      archived: false
    }

    try {
      // Save to database
      const dbNotification = new Notification(notificationData)
      await dbNotification.save()
      
      console.log(`📢 Notification saved to database:`, {
        id: notificationData.id,
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title
      })
    } catch (error) {
      console.error('Error saving notification to database:', error)
      // Fallback: still add to memory queue if database save fails
      this.notificationQueue.push(notificationData)
    }

    // Send via WebSocket if user is connected
    this.sendWebSocketNotification(userId, notificationData)

    return notificationData
  }

  sendWebSocketNotification(userId, notification) {
    if (!this.wsServer) return

    this.wsServer.clients.forEach((client) => {
      if (client.userId === userId && client.readyState === WebSocketServer.OPEN) {
        client.send(JSON.stringify({
          type: 'notification',
          data: notification
        }))
      }
    })
  }

  // Email alert methods
  async sendEmailAlert(userId, email, alertData) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@sortify.com',
        to: email,
        subject: alertData.subject || 'Sortify Alert',
        html: this.generateEmailTemplate(alertData)
      }

      const result = await this.emailTransporter.sendMail(mailOptions)
      console.log('📧 Email alert sent:', result.messageId)
      
      return { success: true, messageId: result.messageId }
    } catch (error) {
      console.error('❌ Email alert failed:', error)
      return { success: false, error: error.message }
    }
  }

  generateEmailTemplate(alertData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${alertData.subject || 'Sortify Alert'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .alert-type { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 20px; }
          .alert-info { background-color: #dbeafe; color: #1e40af; }
          .alert-warning { background-color: #fef3c7; color: #d97706; }
          .alert-error { background-color: #fee2e2; color: #dc2626; }
          .alert-success { background-color: #d1fae5; color: #059669; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
          .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Sortify Alert</h1>
            <p>Email Management System</p>
          </div>
          <div class="content">
            <div class="alert-type alert-${alertData.type || 'info'}">
              ${alertData.type || 'info'}
            </div>
            <h2>${alertData.title || 'Notification'}</h2>
            <p>${alertData.message || 'You have a new notification from Sortify.'}</p>
            ${alertData.data ? this.formatAlertData(alertData.data) : ''}
            ${alertData.actionUrl ? `<a href="${alertData.actionUrl}" class="button">View Details</a>` : ''}
          </div>
          <div class="footer">
            <p>This is an automated message from Sortify. Please do not reply to this email.</p>
            <p>© 2024 Sortify. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  formatAlertData(data) {
    if (!data || typeof data !== 'object') return ''
    
    let html = '<div style="margin-top: 20px; padding: 15px; background-color: #f8fafc; border-radius: 8px;">'
    Object.keys(data).forEach(key => {
      html += `<p><strong>${key}:</strong> ${data[key]}</p>`
    })
    html += '</div>'
    return html
  }

  // Notification types
  async sendNewEmailNotification(userId, emailData) {
    return await this.sendPushNotification(userId, {
      type: 'new_email',
      title: 'New Email Received',
      message: `From: ${emailData.from}\nSubject: ${emailData.subject}`,
      data: {
        emailId: emailData._id,
        category: emailData.category,
        isRead: emailData.isRead
      }
    })
  }

  async sendClassificationNotification(userId, classificationData) {
    return await this.sendPushNotification(userId, {
      type: 'classification',
      title: 'Email Classified',
      message: `Email categorized as: ${classificationData.category}`,
      data: {
        emailId: classificationData.emailId,
        category: classificationData.category,
        confidence: classificationData.confidence
      }
    })
  }

  async sendBulkOperationNotification(userId, operationData) {
    return await this.sendPushNotification(userId, {
      type: 'bulk_operation',
      title: 'Bulk Operation Completed',
      message: `${operationData.operation} completed on ${operationData.count} emails`,
      data: {
        operation: operationData.operation,
        count: operationData.count,
        success: operationData.success
      }
    })
  }

  async sendSyncStatusNotification(userId, statusData) {
    return await this.sendPushNotification(userId, {
      type: 'sync_status',
      title: 'Sync Status Update',
      message: `Email sync: ${statusData.status}`,
      data: {
        status: statusData.status,
        message: statusData.message,
        timestamp: statusData.timestamp
      }
    })
  }

  async sendSystemAlert(userId, alertData) {
    return await this.sendPushNotification(userId, {
      type: 'system',
      title: alertData.title || 'System Alert',
      message: alertData.message,
      data: alertData.data || {}
    })
  }

  // Email operations notifications
  async sendEmailOperationNotification(userId, operationData) {
    const operationMessages = {
      'created': 'Email created',
      'updated': 'Email updated',
      'deleted': 'Email deleted',
      'archived': 'Email archived',
      'unarchived': 'Email unarchived',
      'marked_read': 'Email marked as read',
      'marked_unread': 'Email marked as unread',
      'categorized': 'Email categorized',
      'exported': 'Emails exported'
    }

    return await this.sendPushNotification(userId, {
      type: 'email_operation',
      title: operationMessages[operationData.operation] || 'Email Operation',
      message: operationData.message || `${operationData.operation} operation completed`,
      data: {
        operation: operationData.operation,
        emailId: operationData.emailId,
        emailSubject: operationData.emailSubject,
        count: operationData.count || 1
      }
    })
  }

  // User profile notifications
  async sendProfileUpdateNotification(userId, updateData) {
    return await this.sendPushNotification(userId, {
      type: 'profile_update',
      title: 'Profile Updated',
      message: updateData.message || 'Your profile has been updated',
      data: {
        updatedFields: updateData.updatedFields || [],
        timestamp: new Date().toISOString()
      }
    })
  }

  // Connection notifications
  async sendConnectionNotification(userId, connectionData) {
    const statusMessages = {
      'connected': 'Account Connected',
      'disconnected': 'Account Disconnected',
      'reconnected': 'Account Reconnected',
      'sync_started': 'Sync Started',
      'sync_stopped': 'Sync Stopped',
      'sync_completed': 'Sync Completed',
      'sync_failed': 'Sync Failed'
    }

    return await this.sendPushNotification(userId, {
      type: 'connection',
      title: statusMessages[connectionData.status] || 'Connection Update',
      message: connectionData.message || `${connectionData.provider} ${connectionData.status}`,
      data: {
        provider: connectionData.provider,
        status: connectionData.status,
        details: connectionData.details
      }
    })
  }

  // Category management notifications
  async sendCategoryNotification(userId, categoryData) {
    const operationMessages = {
      'created': 'Category Created',
      'updated': 'Category Updated',
      'deleted': 'Category Deleted',
      'merged': 'Categories Merged'
    }

    return await this.sendPushNotification(userId, {
      type: 'category_management',
      title: operationMessages[categoryData.operation] || 'Category Operation',
      message: categoryData.message || `Category operation: ${categoryData.operation}`,
      data: {
        operation: categoryData.operation,
        categoryName: categoryData.categoryName,
        categoryId: categoryData.categoryId
      }
    })
  }

  // Performance notifications
  async sendPerformanceNotification(userId, performanceData) {
    return await this.sendPushNotification(userId, {
      type: 'performance',
      title: 'Performance Update',
      message: performanceData.message || 'System performance metrics updated',
      data: {
        metrics: performanceData.metrics,
        status: performanceData.status
      }
    })
  }

  // Authentication and login notifications
  async sendLoginNotification(userId, loginData) {
    return await this.sendPushNotification(userId, {
      type: 'login',
      title: 'User Logged In',
      message: loginData.message || `User logged in successfully`,
      data: {
        loginTime: loginData.loginTime || new Date().toISOString(),
        ipAddress: loginData.ipAddress,
        userAgent: loginData.userAgent,
        location: loginData.location
      }
    })
  }

  // Refinement summary notifications (Phase 2)
  async sendRefinementSummaryNotification(userId, summaryData) {
    return await this.sendPushNotification(userId, {
      type: 'refinement_summary',
      title: summaryData.title || '✨ Email Classification Refined',
      message: summaryData.message,
      data: {
        totalProcessed: summaryData.totalProcessed || 0,
        reclassified: summaryData.reclassified || 0,
        avgConfidenceImprovement: summaryData.avgConfidenceImprovement || 0,
        categoryChanges: summaryData.categoryChanges || {},
        phase: summaryData.phase || 'Phase 2',
        timestamp: new Date().toISOString()
      }
    })
  }

  async sendAuthNotification(userId, authData) {
    return await this.sendPushNotification(userId, {
      type: 'auth',
      title: authData.title || 'Authentication Event',
      message: authData.message || 'Authentication event occurred',
      data: {
        eventType: authData.eventType, // login, logout, password_change, etc.
        timestamp: new Date().toISOString(),
        ...authData.data
      }
    })
  }

  // User preferences
  setUserPreferences(userId, preferences) {
    this.userPreferences.set(userId, {
      pushNotifications: preferences.pushNotifications !== false,
      emailAlerts: preferences.emailAlerts !== false,
      notificationTypes: preferences.notificationTypes || [
        'new_email', 
        'classification', 
        'bulk_operation', 
        'sync_status',
        'email_operation',
        'profile_update',
        'connection',
        'category_management',
        'performance',
        'system',
        'login',
        'auth',
        'refinement_summary'
      ],
      quietHours: preferences.quietHours || { start: '22:00', end: '08:00' },
      ...preferences
    })
  }

  getUserPreferences(userId) {
    return this.userPreferences.get(userId) || {
      pushNotifications: true,
      emailAlerts: false,
      notificationTypes: [
        'new_email', 
        'classification', 
        'bulk_operation',
        'sync_status',
        'email_operation',
        'profile_update',
        'connection',
        'category_management',
        'performance',
        'system',
        'login',
        'auth',
        'refinement_summary'
      ],
      quietHours: { start: '22:00', end: '08:00' }
    }
  }

  // Scheduled notifications
  scheduleNotification(userId, notification, scheduleTime) {
    const scheduleId = this.generateNotificationId()
    const job = cron.schedule(scheduleTime, async () => {
      try {
        await this.sendPushNotification(userId, notification)
        this.scheduledNotifications.delete(scheduleId)
      } catch (error) {
        console.error('Error sending scheduled notification:', error)
        this.scheduledNotifications.delete(scheduleId)
      }
    }, { scheduled: false })

    this.scheduledNotifications.set(scheduleId, job)
    job.start()

    return scheduleId
  }

  cancelScheduledNotification(scheduleId) {
    const job = this.scheduledNotifications.get(scheduleId)
    if (job) {
      job.stop()
      this.scheduledNotifications.delete(scheduleId)
      return true
    }
    return false
  }

  // Notification processing
  startNotificationProcessor() {
    setInterval(() => {
      this.processNotificationQueue()
    }, 1000) // Process every second
  }

  async processNotificationQueue() {
    if (this.notificationQueue.length === 0) return

    const notification = this.notificationQueue.shift()
    const preferences = this.getUserPreferences(notification.userId)

    // Check if user wants this type of notification
    if (!preferences.notificationTypes.includes(notification.type)) {
      return
    }

    // Check quiet hours
    if (this.isQuietHours(preferences.quietHours)) {
      return
    }

    // Send email alert if enabled
    if (preferences.emailAlerts) {
      // You would need to get user email from database
      // await this.sendEmailAlert(notification.userId, userEmail, notification)
    }

    console.log('📱 Notification processed:', notification.id)
  }

  isQuietHours(quietHours) {
    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()
    const startTime = this.timeToMinutes(quietHours.start)
    const endTime = this.timeToMinutes(quietHours.end)

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime
    } else {
      return currentTime >= startTime || currentTime <= endTime
    }
  }

  timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number)
    return hours * 60 + minutes
  }

  // Utility methods
  generateNotificationId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Get notification statistics
  getNotificationStats(userId) {
    const userNotifications = this.notificationQueue.filter(n => n.userId === userId)
    return {
      total: userNotifications.length,
      unread: userNotifications.filter(n => !n.read).length,
      byType: userNotifications.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1
        return acc
      }, {})
    }
  }

  // Clear old notifications
  clearOldNotifications(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const cutoff = new Date(Date.now() - maxAge)
    this.notificationQueue = this.notificationQueue.filter(n => 
      new Date(n.timestamp) > cutoff
    )
  }
}

// Create singleton instance
const notificationService = new NotificationService()

export default notificationService
