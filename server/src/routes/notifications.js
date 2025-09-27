// Notification routes for push notifications and email alerts
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import notificationService from '../services/notificationService.js'

const router = express.Router()

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const { type, limit = 50, offset = 0 } = req.query

    // Get notifications from service (in a real app, this would be from database)
    const allNotifications = notificationService.notificationQueue
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    let notifications = allNotifications

    if (type) {
      notifications = notifications.filter(n => n.type === type)
    }

    const paginatedNotifications = notifications.slice(offset, offset + parseInt(limit))

    res.json({
      success: true,
      notifications: paginatedNotifications,
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length
    })

  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    })
  }
}))

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id

    // Find and update notification
    const notification = notificationService.notificationQueue.find(n => 
      n.id === id && n.userId === userId
    )

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      })
    }

    notification.read = true
    notification.readAt = new Date().toISOString()

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification
    })

  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    })
  }
}))

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
router.put('/read-all', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id

    // Mark all user notifications as read
    const userNotifications = notificationService.notificationQueue.filter(n => 
      n.userId === userId && !n.read
    )

    userNotifications.forEach(notification => {
      notification.read = true
      notification.readAt = new Date().toISOString()
    })

    res.json({
      success: true,
      message: `Marked ${userNotifications.length} notifications as read`,
      count: userNotifications.length
    })

  } catch (error) {
    console.error('Mark all notifications read error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    })
  }
}))

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id

    const notificationIndex = notificationService.notificationQueue.findIndex(n => 
      n.id === id && n.userId === userId
    )

    if (notificationIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      })
    }

    notificationService.notificationQueue.splice(notificationIndex, 1)

    res.json({
      success: true,
      message: 'Notification deleted'
    })

  } catch (error) {
    console.error('Delete notification error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    })
  }
}))

// @desc    Clear all notifications
// @route   DELETE /api/notifications/clear-all
// @access  Private
router.delete('/clear-all', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id

    const initialLength = notificationService.notificationQueue.length
    notificationService.notificationQueue = notificationService.notificationQueue.filter(n => 
      n.userId !== userId
    )

    const deletedCount = initialLength - notificationService.notificationQueue.length

    res.json({
      success: true,
      message: `Cleared ${deletedCount} notifications`,
      count: deletedCount
    })

  } catch (error) {
    console.error('Clear all notifications error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to clear all notifications',
      error: error.message
    })
  }
}))

// @desc    Get notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
router.get('/preferences', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const preferences = notificationService.getUserPreferences(userId)

    res.json({
      success: true,
      preferences
    })

  } catch (error) {
    console.error('Get notification preferences error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification preferences',
      error: error.message
    })
  }
}))

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
router.put('/preferences', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const preferences = req.body

    // Validate preferences
    const validTypes = ['new_email', 'classification', 'bulk_operation', 'sync_status', 'system']
    if (preferences.notificationTypes) {
      const invalidTypes = preferences.notificationTypes.filter(type => !validTypes.includes(type))
      if (invalidTypes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid notification types: ${invalidTypes.join(', ')}`
        })
      }
    }

    notificationService.setUserPreferences(userId, preferences)
    const updatedPreferences = notificationService.getUserPreferences(userId)

    res.json({
      success: true,
      message: 'Notification preferences updated',
      preferences: updatedPreferences
    })

  } catch (error) {
    console.error('Update notification preferences error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences',
      error: error.message
    })
  }
}))

// @desc    Send test notification
// @route   POST /api/notifications/test
// @access  Private
router.post('/test', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const { type = 'test', title, message } = req.body

    const notification = notificationService.sendPushNotification(userId, {
      type,
      title: title || 'Test Notification',
      message: message || 'This is a test notification from Sortify',
      data: { test: true }
    })

    res.json({
      success: true,
      message: 'Test notification sent',
      notification
    })

  } catch (error) {
    console.error('Send test notification error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    })
  }
}))

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private
router.get('/stats', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const stats = notificationService.getNotificationStats(userId)

    res.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Get notification stats error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification statistics',
      error: error.message
    })
  }
}))

// @desc    Schedule notification
// @route   POST /api/notifications/schedule
// @access  Private
router.post('/schedule', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const { notification, scheduleTime } = req.body

    if (!notification || !scheduleTime) {
      return res.status(400).json({
        success: false,
        message: 'Notification and scheduleTime are required'
      })
    }

    const scheduleId = notificationService.scheduleNotification(userId, notification, scheduleTime)

    res.json({
      success: true,
      message: 'Notification scheduled',
      scheduleId
    })

  } catch (error) {
    console.error('Schedule notification error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to schedule notification',
      error: error.message
    })
  }
}))

// @desc    Cancel scheduled notification
// @route   DELETE /api/notifications/schedule/:scheduleId
// @access  Private
router.delete('/schedule/:scheduleId', protect, asyncHandler(async (req, res) => {
  try {
    const { scheduleId } = req.params

    const cancelled = notificationService.cancelScheduledNotification(scheduleId)

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled notification not found'
      })
    }

    res.json({
      success: true,
      message: 'Scheduled notification cancelled'
    })

  } catch (error) {
    console.error('Cancel scheduled notification error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to cancel scheduled notification',
      error: error.message
    })
  }
}))

export default router
