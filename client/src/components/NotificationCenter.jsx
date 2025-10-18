import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import { 
  BellIcon,
  XMarkIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  PlayIcon,
  CheckIcon,
  ClockIcon,
  UserIcon,
  ArrowPathIcon,
  FolderIcon,
  ChartBarIcon,
  EnvelopeIcon,
  PencilIcon,
  KeyIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'

const NotificationCenter = ({ isOpen, onClose, onNotificationUpdate }) => {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [preferences, setPreferences] = useState(null)
  const [showPreferences, setShowPreferences] = useState(false)
  const [markingAsRead, setMarkingAsRead] = useState(new Set())
  const { lastMessage } = useWebSocketContext()

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        toast.error('Authentication required')
        return
      }

      const response = await api.get('/notifications')
      console.log('NotificationCenter API response:', response.data)
      if (response.data.success) {
        const newNotifications = response.data.notifications || []
        setNotifications(prevNotifications => {
          // Merge with existing to preserve any local updates
          const merged = [...newNotifications]
          
          // If we have local updates that aren't reflected in the server response,
          // preserve them temporarily (within 2 minutes of the update)
          prevNotifications.forEach(prevNotif => {
            const existsInNew = newNotifications.find(n => n.id === prevNotif.id)
            if (!existsInNew && prevNotif.readAt) {
              const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
              if (new Date(prevNotif.readAt) > twoMinutesAgo) {
                merged.push(prevNotif)
              }
            }
          })
          
          console.log('NotificationCenter merged notifications:', {
            prev: prevNotifications.length,
            new: newNotifications.length,
            merged: merged.length
          })
          
          return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        })
      } else {
        throw new Error(response.data.message || 'Failed to fetch notifications')
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
      toast.error('Failed to load notifications')
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPreferences = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await api.get('/notifications/preferences')
      if (response.data.success) {
        setPreferences(response.data.preferences || {
          pushNotifications: true,
          emailAlerts: false,
          notificationTypes: ['new_email', 'classification', 'bulk_operation', 'sync_status', 'email_operation', 'profile_update', 'connection', 'category_management', 'performance', 'system'],
          quietHours: { start: '22:00', end: '08:00' }
        })
      }
    } catch (error) {
      console.error('Error fetching preferences:', error)
      setPreferences({
        pushNotifications: true,
        emailAlerts: false,
        notificationTypes: ['new_email', 'classification', 'bulk_operation', 'sync_status', 'email_operation', 'profile_update', 'connection', 'category_management', 'performance', 'system'],
        quietHours: { start: '22:00', end: '08:00' }
      })
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
      fetchPreferences()
    }
  }, [isOpen, fetchNotifications, fetchPreferences])

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'notification') {
      const newNotification = lastMessage.data
      setNotifications(prev => [newNotification, ...prev])
      
      // Show toast notification
      toast.success(newNotification.title, {
        duration: 4000,
        style: {
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(147,51,234,0.1))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          color: '#1e40af',
          fontSize: '16px',
          fontWeight: '600',
          padding: '20px 24px',
          maxWidth: '500px'
        }
      })
    }
  }, [lastMessage])

  const markAsRead = async (notificationId) => {
    // Prevent multiple simultaneous requests for the same notification
    if (markingAsRead.has(notificationId)) {
      console.log('Already marking notification as read:', notificationId)
      return
    }

    // Verify the notification exists before making the request
    const notification = notifications.find(n => n.id === notificationId)
    if (!notification) {
      console.error('Notification not found in local state:', notificationId)
      toast.error('Notification not found')
      return
    }

    if (notification.read) {
      console.log('Notification is already read:', notificationId)
      return
    }

    try {
      setMarkingAsRead(prev => new Set(prev).add(notificationId))
      console.log('Marking notification as read:', {
        id: notificationId,
        title: notification.title,
        read: notification.read,
        userId: notification.userId || 'not set'
      })
      
      const response = await api.put(`/notifications/${notificationId}/read`)
      console.log('Mark as read response:', response.data)
      
      if (response.data.success) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, read: true, readAt: response.data.notification?.readAt } : n)
        )
        toast.success('Notification marked as read')
        
        // Add a delay to ensure backend processing is complete and state is updated
        setTimeout(() => {
          console.log('NotificationCenter: Dispatching notificationUpdated event after mark as read')
          // Notify parent component about the update
          if (onNotificationUpdate) {
            console.log('NotificationCenter: Calling onNotificationUpdate callback')
            onNotificationUpdate()
          }
          // Also dispatch a global event for cross-component updates
          console.log('NotificationCenter: Dispatching global notificationUpdated event')
          window.dispatchEvent(new CustomEvent('notificationUpdated', { 
            detail: { 
              action: 'markAsRead', 
              notificationId: notificationId,
              timestamp: new Date().toISOString()
            } 
          }))
        }, 500) // Increased delay to 500ms
      } else {
        throw new Error(response.data.message || 'Failed to mark as read')
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
      console.error('Error details:', error.response?.data || error.message)
      console.error('Full error object:', error)
      
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error'
      toast.error(`Failed to mark notification as read: ${errorMessage}`)
    } finally {
      setMarkingAsRead(prev => {
        const newSet = new Set(prev)
        newSet.delete(notificationId)
        return newSet
      })
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await api.put('/notifications/read-all')
      if (response.data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        toast.success('All notifications marked as read')
        
        // Add delay to ensure backend processing is complete and state is updated
        setTimeout(() => {
          console.log('NotificationCenter: Dispatching notificationUpdated event after mark all as read')
          // Notify parent component about the update
          if (onNotificationUpdate) {
            console.log('NotificationCenter: Calling onNotificationUpdate callback for mark all as read')
            onNotificationUpdate()
          }
          // Also dispatch a global event for cross-component updates
          console.log('NotificationCenter: Dispatching global notificationUpdated event for mark all as read')
          window.dispatchEvent(new CustomEvent('notificationUpdated', { 
            detail: { 
              action: 'markAllAsRead', 
              timestamp: new Date().toISOString()
            } 
          }))
        }, 500)
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
      toast.error('Failed to mark all as read')
    }
  }


  const clearAll = async () => {
    try {
      const response = await api.delete('/notifications/clear-all')
      if (response.data.success) {
        setNotifications([])
        toast.success('All notifications archived')
        
        // Add delay to ensure backend processing is complete
        setTimeout(() => {
          console.log('NotificationCenter: Dispatching notificationUpdated event after clear all')
          // Notify parent component about the update
          if (onNotificationUpdate) {
            console.log('NotificationCenter: Calling onNotificationUpdate callback for clear all')
            onNotificationUpdate()
          }
          // Also dispatch a global event for cross-component updates
          console.log('NotificationCenter: Dispatching global notificationUpdated event for clear all')
          window.dispatchEvent(new CustomEvent('notificationUpdated', { 
            detail: { 
              action: 'clearAll', 
              timestamp: new Date().toISOString()
            } 
          }))
        }, 500)
      }
    } catch (error) {
      console.error('Error archiving all notifications:', error)
      toast.error('Failed to archive all notifications')
    }
  }

  const updatePreferences = async (newPreferences) => {
    try {
      const response = await api.put('/notifications/preferences', newPreferences)
      if (response.data.success) {
        setPreferences(newPreferences)
        toast.success('Notification preferences updated')
      }
    } catch (error) {
      console.error('Error updating preferences:', error)
      toast.error('Failed to update preferences')
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_email':
        return <EnvelopeIcon className="w-5 h-5" />
      case 'classification':
        return <CheckCircleIcon className="w-5 h-5" />
      case 'bulk_operation':
        return <Cog6ToothIcon className="w-5 h-5" />
      case 'sync_status':
        return <ArrowPathIcon className="w-5 h-5" />
      case 'system':
        return <Cog6ToothIcon className="w-5 h-5" />
      case 'test':
        return <PlayIcon className="w-5 h-5" />
      case 'email_operation':
        return <PencilIcon className="w-5 h-5" />
      case 'profile_update':
        return <UserIcon className="w-5 h-5" />
      case 'connection':
        return <ArrowPathIcon className="w-5 h-5" />
      case 'category_management':
        return <FolderIcon className="w-5 h-5" />
      case 'performance':
        return <ChartBarIcon className="w-5 h-5" />
      case 'login':
        return <KeyIcon className="w-5 h-5" />
      case 'auth':
        return <ShieldCheckIcon className="w-5 h-5" />
      default:
        return <BellIcon className="w-5 h-5" />
    }
  }

  const getNotificationBgColor = (type) => {
    switch (type) {
      case 'new_email':
        return 'bg-blue-50'
      case 'classification':
        return 'bg-green-50'
      case 'bulk_operation':
        return 'bg-purple-50'
      case 'sync_status':
        return 'bg-orange-50'
      case 'system':
        return 'bg-gray-50'
      case 'test':
        return 'bg-pink-50'
      case 'email_operation':
        return 'bg-indigo-50'
      case 'profile_update':
        return 'bg-teal-50'
      case 'connection':
        return 'bg-cyan-50'
      case 'category_management':
        return 'bg-yellow-50'
      case 'performance':
        return 'bg-emerald-50'
      case 'login':
        return 'bg-blue-50'
      case 'auth':
        return 'bg-red-50'
      default:
        return 'bg-gray-50'
    }
  }

  const getNotificationIconColor = (type) => {
    switch (type) {
      case 'new_email':
        return 'text-blue-600'
      case 'classification':
        return 'text-green-600'
      case 'bulk_operation':
        return 'text-purple-600'
      case 'sync_status':
        return 'text-orange-600'
      case 'system':
        return 'text-gray-600'
      case 'test':
        return 'text-pink-600'
      case 'email_operation':
        return 'text-indigo-600'
      case 'profile_update':
        return 'text-teal-600'
      case 'connection':
        return 'text-cyan-600'
      case 'category_management':
        return 'text-yellow-600'
      case 'performance':
        return 'text-emerald-600'
      case 'login':
        return 'text-blue-600'
      case 'auth':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true
    if (filter === 'unread') return !notification.read
    if (filter === 'security') return ['connection', 'profile_update', 'system', 'login', 'auth'].includes(notification.type)
    return notification.type === filter
  })

  const unreadCount = notifications.filter(n => !n.read).length

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-200"
        >
          {/* Header */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BellIcon className="w-6 h-6 text-gray-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
                  <p className="text-sm text-gray-600">
                    {notifications.length} total notifications
                    {unreadCount > 0 && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {unreadCount} unread
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreferences(!showPreferences)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Cog6ToothIcon className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    filter === 'all' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    filter === 'unread' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  onClick={() => setFilter('security')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    filter === 'security' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Security ({notifications.filter(n => ['connection', 'profile_update', 'system', 'login', 'auth'].includes(n.type)).length})
                </button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={markAllAsRead}
                  className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                  disabled={unreadCount === 0}
                >
                  Mark All Read
                </button>
                <button
                  onClick={clearAll}
                  className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                  disabled={notifications.length === 0}
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-16">
                    <BellIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
                    <p className="text-gray-500">
                      {filter === 'unread' 
                        ? 'No unread notifications' 
                        : filter === 'security' 
                        ? 'No security notifications' 
                        : 'You\'re all caught up!'}
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 transition-colors ${
                        notification.read 
                          ? 'bg-white hover:bg-gray-50' 
                          : 'bg-blue-50 hover:bg-blue-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${getNotificationBgColor(notification.type)} flex items-center justify-center`}>
                          <span className={getNotificationIconColor(notification.type)}>
                            {getNotificationIcon(notification.type)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className={`text-sm font-medium ${
                                notification.read ? 'text-gray-900' : 'text-gray-900'
                              }`}>
                                {notification.title}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-500">
                                  {new Date(notification.timestamp).toLocaleString()}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  notification.type === 'new_email' ? 'bg-blue-100 text-blue-800' :
                                  notification.type === 'classification' ? 'bg-green-100 text-green-800' :
                                  notification.type === 'bulk_operation' ? 'bg-purple-100 text-purple-800' :
                                  notification.type === 'sync_status' ? 'bg-orange-100 text-orange-800' :
                                  notification.type === 'system' ? 'bg-gray-100 text-gray-800' :
                                  'bg-pink-100 text-pink-800'
                                }`}>
                                  {notification.type.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-3">
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                              )}
                              <button
                                onClick={() => {
                                  console.log('Clicking mark as read for notification:', notification.id)
                                  markAsRead(notification.id)
                                }}
                                disabled={markingAsRead.has(notification.id) || notification.read}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  markingAsRead.has(notification.id) 
                                    ? 'text-gray-300 cursor-not-allowed' 
                                    : notification.read
                                    ? 'text-gray-300 cursor-default'
                                    : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                }`}
                                title={notification.read ? "Already read" : "Mark as read"}
                              >
                                <CheckIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Preferences Modal */}
          {showPreferences && preferences && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-200"
              >
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                  <div>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={preferences.pushNotifications}
                        onChange={(e) => setPreferences({...preferences, pushNotifications: e.target.checked})}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-700">Push Notifications</span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={preferences.emailAlerts}
                        onChange={(e) => setPreferences({...preferences, emailAlerts: e.target.checked})}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-700">Email Alerts</span>
                    </label>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700 block mb-3">Notification Types</label>
                    <div className="space-y-2">
                      {['new_email', 'classification', 'bulk_operation', 'sync_status', 'system', 'email_operation', 'profile_update', 'connection', 'category_management', 'performance'].map(type => (
                        <label key={type} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={preferences.notificationTypes.includes(type)}
                            onChange={(e) => {
                              const newTypes = e.target.checked
                                ? [...preferences.notificationTypes, type]
                                : preferences.notificationTypes.filter(t => t !== type)
                              setPreferences({...preferences, notificationTypes: newTypes})
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-gray-700 capitalize">{type.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowPreferences(false)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      updatePreferences(preferences)
                      setShowPreferences(false)
                    }}
                    className="px-4 py-2 text-white bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Save Preferences
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default NotificationCenter
