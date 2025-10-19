import React, { useState, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import ModernIcon from './ModernIcon'
import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { api } from '../services/api'
import NotificationCenter from './NotificationCenter'

const Navbar = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false)
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false)
  const [notificationFilter, setNotificationFilter] = useState('all')

  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'analytics' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ]

  const fetchNotifications = useCallback(async (forceRefresh = false) => {
    try {
      const token = localStorage.getItem('token')
      if (!token || !user) return

      console.log('Navbar fetching notifications, forceRefresh:', forceRefresh)

      const response = await api.get('/notifications', {
        params: { limit: 20 } // Fetch more to ensure we have enough for both normal and security
      })
      if (response.data.success) {
        const newNotifications = response.data.notifications || []
        
        setNotifications(prevNotifications => {
          // If this is a forced refresh (from global event), always use fresh data
          if (forceRefresh) {
            console.log('Navbar force refresh - using fresh data:', newNotifications.length, 'notifications')
            console.log('Unread count from fresh data:', newNotifications.filter(n => !n.read).length)
            return newNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          }
          
          // For regular polling, merge intelligently to avoid overriding recent local changes
          const mergedNotifications = [...newNotifications]
          
          // Add any notifications from previous state that might have been updated locally
          // but be more conservative about this
          prevNotifications.forEach(prevNotif => {
            const existsInNew = newNotifications.find(n => n.id === prevNotif.id)
            if (!existsInNew && !prevNotif.archived) {
              // Only keep if it was very recently updated (within last 2 minutes)
              const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
              if (prevNotif.readAt && new Date(prevNotif.readAt) > twoMinutesAgo) {
                mergedNotifications.push(prevNotif)
              }
            }
          })
          
          console.log('Navbar merged notifications:', {
            prev: prevNotifications.length,
            new: newNotifications.length,
            merged: mergedNotifications.length,
            unreadCount: mergedNotifications.filter(n => !n.read).length
          })
          
          return mergedNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        })
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchNotifications(true) // Initial fetch should be forced
      
      // Set up polling for new notifications, but less frequently to avoid overriding local changes
      const interval = setInterval(() => fetchNotifications(false), 60000) // Poll every 60 seconds, not forced
      return () => clearInterval(interval)
    }
  }, [user, fetchNotifications])

  // Handle clicks outside notification dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isNotificationDropdownOpen && !event.target.closest('.notification-dropdown')) {
        setIsNotificationDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isNotificationDropdownOpen])

  // Listen for global notification updates
  useEffect(() => {
    const handleNotificationUpdate = (event) => {
      console.log('Navbar received notification update event:', event.detail)
      console.log('Navbar current unread count before refresh:', notifications.filter(n => !n.read).length)
      
      // Force refresh when explicitly notified
      setTimeout(() => {
        console.log('Navbar: Starting force refresh after event')
        fetchNotifications(true)
      }, 100) // Small delay to ensure the backend has updated
    }

    window.addEventListener('notificationUpdated', handleNotificationUpdate)
    return () => window.removeEventListener('notificationUpdated', handleNotificationUpdate)
  }, [fetchNotifications, notifications])

  const filteredNotifications = notifications.filter(notification => {
    switch (notificationFilter) {
      case 'unread':
        return !notification.read
      case 'new':
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        return new Date(notification.timestamp) > oneHourAgo
      case 'security':
        return ['connection', 'profile_update', 'system', 'login', 'auth'].includes(notification.type)
      default:
        return true
    }
  })

  const unreadCount = notifications.filter(n => !n.read).length
  const newCount = filteredNotifications.length
  
  // Debug unread count calculation
  useEffect(() => {
    console.log('Navbar unread count updated:', {
      totalNotifications: notifications.length,
      unreadCount: unreadCount,
      notifications: notifications.map(n => ({ id: n.id, read: n.read, title: n.title }))
    })
  }, [notifications, unreadCount])

  const handleLogout = () => {
    logout()
    setIsMenuOpen(false)
  }

  return (
    <motion.nav 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-gradient-to-r from-purple-900 via-violet-900 to-indigo-900 backdrop-blur-md border-b border-purple-700/30 sticky top-0 z-50 shadow-lg shadow-purple-900/20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-7 h-7 bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-sm rounded-md flex items-center justify-center border border-white/20">
              <span className="text-white font-semibold text-sm">S</span>
            </div>
            <span className="text-white font-semibold text-lg tracking-wide">Sortify</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                  location.pathname === item.path
                    ? 'text-white border-b border-white/60 bg-white/10 rounded-md'
                    : 'text-white/80 hover:text-white hover:border-b hover:border-white/40 hover:bg-white/5 rounded-md'
                }`}
              >
                <ModernIcon type={item.icon} size={14} color={location.pathname === item.path ? '#ffffff' : '#e2e8f0'} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            <div className="relative notification-dropdown">
              <button
                onClick={() => setIsNotificationDropdownOpen(!isNotificationDropdownOpen)}
                className="relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200"
              >
                <BellIcon className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 rounded-full h-2 w-2"></span>
                )}
              </button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {isNotificationDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 flex flex-col"
                  >
                    {/* Header */}
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        <button
                          onClick={() => {
                            setIsNotificationDropdownOpen(false)
                            // Navigate to dashboard and pass a query param to open notifications tab
                            navigate('/?tab=notifications')
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View All
                        </button>
                      </div>
                      
                      {/* Filter Tabs */}
                      <div className="flex space-x-1 mt-2" onClick={(e) => e.stopPropagation()}>
                        {[
                          { key: 'all', label: 'All', count: notifications.length },
                          { key: 'unread', label: 'Unread', count: notifications.filter(n => !n.read).length },
                          { key: 'new', label: 'New', count: notifications.filter(n => new Date(n.timestamp) > new Date(Date.now() - 60 * 60 * 1000)).length },
                          { key: 'security', label: 'Security', count: notifications.filter(n => ['connection', 'profile_update', 'system', 'login', 'auth'].includes(n.type)).length }
                        ].map(filter => (
                          <button
                            key={filter.key}
                            onClick={(e) => {
                              e.stopPropagation()
                              setNotificationFilter(filter.key)
                            }}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                              notificationFilter === filter.key
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                          >
                            {filter.label} {filter.count > 0 && `(${filter.count})`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notification List */}
                    <div className="flex-1 overflow-y-auto min-h-0 notification-scroll">
                      {(() => {
                        // Show only latest 6 notifications based on current filter
                        const displayNotifications = filteredNotifications
                          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                          .slice(0, 6)
                        
                        return displayNotifications.length > 0 ? (
                          displayNotifications.map(notification => (
                            <div
                              key={notification.id}
                              className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                                !notification.read ? 'bg-blue-50' : 'bg-white'
                              }`}
                              onClick={() => {
                                setIsNotificationDropdownOpen(false)
                                setIsNotificationCenterOpen(true) // Open full notification center
                              }}
                            >
                              <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-0.5">
                                  <div className={`w-2 h-2 rounded-full ${!notification.read ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {notification.title}
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {new Date(notification.timestamp).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            No {notificationFilter} notifications
                          </div>
                        )
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="hidden md:flex items-center space-x-3">
              {user?.avatar || user?.gmailName ? (
                <img 
                  src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.gmailName || user.name)}&background=64748b&color=fff&size=28`}
                  alt={user.name}
                  className="w-7 h-7 rounded-full border border-slate-200"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
              ) : null}
              <div 
                className={`w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center ${user?.avatar || user?.gmailName ? 'hidden' : ''}`}
                style={{ display: user?.avatar || user?.gmailName ? 'none' : 'flex' }}
              >
                <span className="text-white font-medium text-xs">
                  {user?.name?.charAt(0)?.toUpperCase() || user?.gmailName?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-white font-medium text-sm">
                {user?.name || user?.gmailName || 'User'}
              </span>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-1.5 rounded-md text-white/80 hover:bg-white/10 transition-colors"
            >
              <ModernIcon type="menu" size={18} color="#e2e8f0" glassEffect={false} />
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="hidden md:block px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200 text-sm font-medium border border-white/20 hover:border-white/30"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/20 bg-gradient-to-r from-purple-800/50 to-violet-800/50 backdrop-blur-md"
          >
            <div className="py-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-2 rounded-md transition-all duration-200 ${
                    location.pathname === item.path
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ModernIcon type={item.icon} size={14} color={location.pathname === item.path ? '#ffffff' : '#e2e8f0'} />
                  <span className="text-sm font-normal">{item.label}</span>
                </Link>
              ))}
              <div className="px-4 py-3 border-t border-white/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                  {user?.avatar || user?.gmailName ? (
                    <img 
                      src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.gmailName || user.name)}&background=64748b&color=fff&size=28`}
                      alt={user.name}
                      className="w-7 h-7 rounded-full border border-slate-200"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center ${user?.avatar || user?.gmailName ? 'hidden' : ''}`}
                    style={{ display: user?.avatar || user?.gmailName ? 'none' : 'flex' }}
                  >
                    <span className="text-white font-medium text-xs">
                      {user?.name?.charAt(0)?.toUpperCase() || user?.gmailName?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                    <span className="text-white font-medium text-sm">
                      {user?.name || user?.gmailName || 'User'}
                    </span>
                  </div>
                  {/* Mobile Notification Bell */}
                  <div className="relative">
                    <button
                      onClick={() => setIsNotificationCenterOpen(true)}
                      className="relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200"
                    >
                      <BellIcon className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 rounded-full h-2 w-2"></span>
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200 text-sm font-medium border border-white/20 hover:border-white/30"
                >
                  Logout
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Notification Center Modal */}
      <NotificationCenter 
        isOpen={isNotificationCenterOpen} 
        onClose={() => {
          setIsNotificationCenterOpen(false)
          fetchNotifications() // Refresh notifications when modal closes
        }}
        onNotificationUpdate={fetchNotifications} // Refresh notifications when any update happens
      />
    </motion.nav>
  )
}

export default Navbar
