import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import ModernIcon from './ModernIcon'

const NotificationCenter = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [preferences, setPreferences] = useState(null)
  const [showPreferences, setShowPreferences] = useState(false)
  const { lastMessage } = useWebSocketContext()

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
      fetchPreferences()
    }
  }, [isOpen])

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

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/notifications')
      setNotifications(response.data.notifications)
    } catch (error) {
      console.error('Error fetching notifications:', error)
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const fetchPreferences = async () => {
    try {
      const response = await api.get('/api/notifications/preferences')
      setPreferences(response.data.preferences)
    } catch (error) {
      console.error('Error fetching preferences:', error)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/api/notifications/${notificationId}/read`)
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Failed to mark notification as read')
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.put('/api/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Error marking all as read:', error)
      toast.error('Failed to mark all as read')
    }
  }

  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/api/notifications/${notificationId}`)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast.error('Failed to delete notification')
    }
  }

  const clearAll = async () => {
    try {
      await api.delete('/api/notifications/clear-all')
      setNotifications([])
      toast.success('All notifications cleared')
    } catch (error) {
      console.error('Error clearing all notifications:', error)
      toast.error('Failed to clear all notifications')
    }
  }

  const updatePreferences = async (newPreferences) => {
    try {
      await api.put('/api/notifications/preferences', newPreferences)
      setPreferences(newPreferences)
      toast.success('Notification preferences updated')
    } catch (error) {
      console.error('Error updating preferences:', error)
      toast.error('Failed to update preferences')
    }
  }

  const sendTestNotification = async () => {
    try {
      await api.post('/api/notifications/test', {
        type: 'test',
        title: 'Test Notification',
        message: 'This is a test notification from Sortify'
      })
      toast.success('Test notification sent!')
    } catch (error) {
      console.error('Error sending test notification:', error)
      toast.error('Failed to send test notification')
    }
  }

  const getNotificationIcon = (type) => {
    const icons = {
      'new_email': '📧',
      'classification': '🏷️',
      'bulk_operation': '⚡',
      'sync_status': '🔄',
      'system': '⚙️',
      'test': '🧪'
    }
    return icons[type] || '📢'
  }

  const getNotificationColor = (type) => {
    const colors = {
      'new_email': 'from-blue-500 to-blue-600',
      'classification': 'from-green-500 to-green-600',
      'bulk_operation': 'from-purple-500 to-purple-600',
      'sync_status': 'from-orange-500 to-orange-600',
      'system': 'from-gray-500 to-gray-600',
      'test': 'from-pink-500 to-pink-600'
    }
    return colors[type] || 'from-gray-500 to-gray-600'
  }

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true
    if (filter === 'unread') return !notification.read
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
          className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl shadow-blue-100/20 max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/30 bg-gradient-to-r from-white/60 to-white/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <ModernIcon type="bell" size={24} color="#3b82f6" />
                  Notifications
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-sm px-2 py-1 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </h2>
                <p className="text-slate-600 mt-1">
                  {notifications.length} total notifications
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={sendTestNotification}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                >
                  <ModernIcon type="play" size={16} color="#ffffff" />
                  Test
                </button>
                <button
                  onClick={() => setShowPreferences(!showPreferences)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                >
                  <ModernIcon type="settings" size={16} color="#ffffff" />
                  Settings
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                    filter === 'all' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                    filter === 'unread' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={markAllAsRead}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                >
                  Mark All Read
                </button>
                <button
                  onClick={clearAll}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto max-h-[calc(90vh-200px)]">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="p-6">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-12">
                    <ModernIcon type="bell" size={48} color="#94a3b8" />
                    <h3 className="text-xl font-semibold text-slate-600 mt-4">No notifications</h3>
                    <p className="text-slate-500 mt-2">
                      {filter === 'unread' ? 'No unread notifications' : 'You\'re all caught up!'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredNotifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-2xl border transition-all duration-300 ${
                          notification.read 
                            ? 'bg-white/60 border-white/50' 
                            : 'bg-blue-50/60 border-blue-200/50 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 bg-gradient-to-r ${getNotificationColor(notification.type)} rounded-xl flex items-center justify-center text-lg flex-shrink-0`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-slate-800">
                                  {notification.title}
                                </h3>
                                <p className="text-slate-600 text-sm mt-1">
                                  {notification.message}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-slate-500">
                                    {new Date(notification.timestamp).toLocaleString()}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    notification.type === 'new_email' ? 'bg-blue-100 text-blue-800' :
                                    notification.type === 'classification' ? 'bg-green-100 text-green-800' :
                                    notification.type === 'bulk_operation' ? 'bg-purple-100 text-purple-800' :
                                    notification.type === 'sync_status' ? 'bg-orange-100 text-orange-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {notification.type.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-3">
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                )}
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
                                  title="Mark as read"
                                >
                                  <ModernIcon type="check" size={14} color="#10b981" />
                                </button>
                                <button
                                  onClick={() => deleteNotification(notification.id)}
                                  className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <ModernIcon type="trash" size={14} color="#ef4444" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
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
                className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
              >
                <div className="p-6 border-b border-white/30">
                  <h3 className="text-xl font-bold text-slate-800">Notification Preferences</h3>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                  <div>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={preferences.pushNotifications}
                        onChange={(e) => setPreferences({...preferences, pushNotifications: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-slate-700">Push Notifications</span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={preferences.emailAlerts}
                        onChange={(e) => setPreferences({...preferences, emailAlerts: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-slate-700">Email Alerts</span>
                    </label>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-2">Notification Types</label>
                    <div className="space-y-2">
                      {['new_email', 'classification', 'bulk_operation', 'sync_status', 'system'].map(type => (
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
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-slate-700 capitalize">{type.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-6 border-t border-white/30 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowPreferences(false)}
                    className="px-4 py-2 bg-slate-200/60 text-slate-700 rounded-lg font-semibold hover:bg-slate-300/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      updatePreferences(preferences)
                      setShowPreferences(false)
                    }}
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
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
