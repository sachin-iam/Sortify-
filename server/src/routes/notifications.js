// Notification routes for push notifications and email alerts
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import notificationService from '../services/notificationService.js'
import Notification from '../models/Notification.js'

const router = express.Router()

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const { type, limit = 50, offset = 0 } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      })
    }

    console.log('Fetching notifications for user:', userId)

    // Get notifications from database
    const userIdString = userId.toString()
    console.log('Looking for notifications with userId:', { userIdString, userId })
    
    // Fetch notifications from database
    let allNotifications = await Notification.find({
      userId: { $in: [userIdString, userId] },
      archived: false
    }).sort({ timestamp: -1 })
    
    // Convert to plain objects for consistency
    allNotifications = allNotifications.map(n => n.toObject())
    
    console.log('Found notifications for user:', allNotifications.length)
    console.log('User notifications:', allNotifications.map(n => ({ id: n.id, userId: n.userId, type: n.type, title: n.title })))

    // Check if user has any notifications, including archived ones, to avoid creating duplicate welcome notifications
    const allUserNotifications = await Notification.find({
      userId: { $in: [userIdString, userId] }
    })
    
    // More strict check for welcome notification to prevent duplicates
    const hasWelcomeNotification = allUserNotifications.some(n => 
      n.title === 'Welcome to Sortify' && 
      n.data?.welcome === true && 
      (n.userId === userIdString || n.userId === userId)
    )
    
    // If no notifications found for this user, check if there are sample notifications we can claim
    if (allNotifications.length === 0) {
      // Check if there are sample notifications we can assign to this user
      const sampleNotifications = await Notification.find({
        userId: 'sample-user-id',
        archived: false
      })
      
      if (sampleNotifications.length > 0) {
        console.log(`Found ${sampleNotifications.length} sample notifications, assigning to user ${userIdString}`)
        // Assign sample notifications to this user in database
        await Notification.updateMany(
          { userId: 'sample-user-id', archived: false },
          { $set: { userId: userIdString } }
        )
        // Re-fetch notifications after assignment
        allNotifications = await Notification.find({
          userId: { $in: [userIdString, userId] },
          archived: false
        }).sort({ timestamp: -1 })
        allNotifications = allNotifications.map(n => n.toObject())
      } else if (!hasWelcomeNotification) {
        console.log('No notifications found for user, creating welcome notification')
        
        // First, clean up any duplicate welcome notifications for this user
        const duplicateWelcomeNotifications = await Notification.find({
          userId: { $in: [userIdString, userId] },
          title: 'Welcome to Sortify',
          data: { welcome: true }
        })
        
        if (duplicateWelcomeNotifications.length > 1) {
          console.log(`Found ${duplicateWelcomeNotifications.length} duplicate welcome notifications, cleaning up`)
          // Keep the most recent one, archive the rest
          const sortedDuplicates = duplicateWelcomeNotifications.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
          )
          const toArchive = sortedDuplicates.slice(1) // Archive all except the first one
          
          for (const dup of toArchive) {
            await Notification.findByIdAndUpdate(dup._id, {
              $set: { archived: true, archivedAt: new Date().toISOString() }
            })
          }
        }
        
        const welcomeNotification = await notificationService.sendPushNotification(userIdString, {
          type: 'system',
          title: 'Welcome to Sortify',
          message: 'Your notification center is ready! You\'ll receive updates about your email management here.',
          data: { welcome: true }
        })
        
        // Re-fetch from database to ensure the notification is properly stored
        allNotifications = await Notification.find({
          userId: { $in: [userIdString, userId] },
          archived: false
        }).sort({ timestamp: -1 })
        allNotifications = allNotifications.map(n => n.toObject())
      }
      
      console.log('After processing user notifications, found:', allNotifications.length)
    }

    let notifications = allNotifications

    if (type) {
      notifications = notifications.filter(n => n.type === type)
    }

    const paginatedNotifications = notifications.slice(offset, offset + parseInt(limit))

    console.log(`Returning ${paginatedNotifications.length} notifications for user ${userId}`)

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
    const userIdString = userId.toString()

    console.log('Mark as read request:', { id, userId, userIdString })

    // Find notification in database with robust user ID matching
    let notification = await Notification.findOne({
      id: id,
      userId: { $in: [userIdString, userId] },
      archived: false
    })

    // If not found by exact match, try finding by ID only and update userId if needed
    if (!notification) {
      notification = await Notification.findOne({
        id: id,
        archived: false
      })
      
      if (notification && notification.userId !== userIdString && notification.userId !== userId) {
        console.log('Updating notification userId to match current user for mark as read operation')
        await Notification.findByIdAndUpdate(notification._id, {
          $set: { userId: userIdString }
        })
        notification.userId = userIdString
      }
    }

    // Last fallback: if still not found, try to find the most recent unread notification for this user
    if (!notification) {
      console.log('Notification not found by ID, checking for user unread notifications')
      notification = await Notification.findOne({
        userId: { $in: [userIdString, userId] },
        archived: false,
        read: false
      }).sort({ timestamp: -1 })
      
      if (notification) {
        console.log('Found unread notification as fallback:', notification.title)
      }
    }

    if (!notification) {
      const availableNotifications = await Notification.find({
        userId: { $in: [userIdString, userId] }
      }).select('id userId title read archived').limit(10)
      
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
        debug: {
          requestedId: id,
          requestedUserId: userIdString,
          availableNotifications: availableNotifications.map(n => ({
            id: n.id,
            userId: n.userId,
            title: n.title,
            read: n.read,
            archived: n.archived
          }))
        }
      })
    }

    // Update notification in database
    const updatedNotification = await Notification.findByIdAndUpdate(
      notification._id,
      {
        $set: {
          read: true,
          readAt: new Date().toISOString()
        }
      },
      { new: true }
    )

    console.log('Notification marked as read in database:', {
      id: updatedNotification.id,
      userId: updatedNotification.userId,
      read: updatedNotification.read
    })

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification: updatedNotification.toObject()
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
    const userIdString = userId.toString()

    // Mark all user notifications as read in database (only non-archived ones)
    const result = await Notification.updateMany(
      {
        userId: { $in: [userIdString, userId] },
        read: false,
        archived: false
      },
      {
        $set: {
          read: true,
          readAt: new Date().toISOString()
        }
      }
    )

    console.log('Marked notifications as read in database:', {
      userId: userIdString,
      modifiedCount: result.modifiedCount
    })

    res.json({
      success: true,
      message: `Marked ${result.modifiedCount} notifications as read`,
      count: result.modifiedCount
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
    const userIdString = userId.toString()

    const notification = await Notification.findOne({
      id: id,
      userId: { $in: [userIdString, userId] },
      archived: false
    })

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      })
    }

    // Mark as archived instead of deleting
    await Notification.findByIdAndUpdate(notification._id, {
      $set: {
        archived: true,
        archivedAt: new Date().toISOString()
      }
    })

    console.log('Notification archived in database:', {
      id: notification.id,
      userId: notification.userId
    })

    res.json({
      success: true,
      message: 'Notification archived'
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
    const userIdString = userId.toString()

    // Mark all user notifications as archived in database instead of deleting them
    const result = await Notification.updateMany(
      {
        userId: { $in: [userIdString, userId] },
        archived: false
      },
      {
        $set: {
          archived: true,
          archivedAt: new Date().toISOString()
        }
      }
    )

    console.log('Archived all notifications in database:', {
      userId: userIdString,
      modifiedCount: result.modifiedCount
    })

    res.json({
      success: true,
      message: `Archived ${result.modifiedCount} notifications`,
      count: result.modifiedCount
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

    const notification = await notificationService.sendPushNotification(userId, {
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
