import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import EmailList from '../components/EmailList'
import EmailReader from '../components/EmailReader'
import CategoryTabs from '../components/CategoryTabs'
import SuperAnalyticsDashboard from '../components/SuperAnalyticsDashboard'
import CategoryManagement from '../components/CategoryManagement'
import BulkOperations from '../components/BulkOperations'
import NotificationCenter from '../components/NotificationCenter'
import PerformanceDashboard from '../components/PerformanceDashboard'
import CategoriesCard from '../components/CategoriesCard'
import { api } from '../services/api'
import emailService from '../services/emailService'
import ModernIcon from '../components/ModernIcon'

const Dashboard = () => {
  const { user, token, connectGmailAccount, updateTokenFromOAuth } = useAuth()
  const { isConnected, connectionStatus, subscribeToEvents, lastMessage } = useWebSocketContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeView, setActiveView] = useState('emails')
  const [syncLoading, setSyncLoading] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [stats, setStats] = useState({
    totalEmails: 0,
    categories: 7,
    processedToday: 0
  })
  
  // Force refresh state
  const [forceRefresh, setForceRefresh] = useState(0)

  // Ensure stats is never undefined
  const safeStats = stats || {
    totalEmails: 0,
    categories: 7,
    processedToday: 0
  }

  // New state for email management
  const [emails, setEmails] = useState([])
  const [selectedEmailId, setSelectedEmailId] = useState(null)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [currentCategory, setCurrentCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [allEmails, setAllEmails] = useState([]) // Store all emails for client-side filtering
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [emailDetailLoading, setEmailDetailLoading] = useState(false)
  const [selectedEmails, setSelectedEmails] = useState([])
  const [showBulkOperations, setShowBulkOperations] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false)
  const [categoryTabsRefresh, setCategoryTabsRefresh] = useState(0)
  const [currentCategoryCount, setCurrentCategoryCount] = useState(0)
  
  // Rate limiting for API calls
  const [lastApiCall, setLastApiCall] = useState(0)
  const [statsLoading, setStatsLoading] = useState(false)
  const API_CALL_THROTTLE = 5000 // 5 seconds throttle - much more reasonable

  // Email fetching function
  const fetchEmails = useCallback(async (skipThrottle = false, categoryOverride = null) => {
    const now = Date.now()
    if (!skipThrottle && now - lastApiCall < API_CALL_THROTTLE) {
      console.log('⏳ Throttling API call...')
      return
    }
    
    try {
      setEmailsLoading(true)
      setLastApiCall(now)
      
      // Use the category override if provided, otherwise use current category
      const categoryToUse = categoryOverride !== null ? categoryOverride : currentCategory
      
      console.log('📧 Fetching emails...', { currentPage, currentCategory, categoryToUse, searchQuery })
      console.log('📧 User token:', token ? 'Present' : 'Missing')
      console.log('📧 Gmail connected:', gmailConnected)
      console.log('📧 API call parameters:', { page: currentPage, category: categoryToUse, q: searchQuery })
      
      const response = await emailService.getEmails({
        page: currentPage,
        category: categoryToUse,
        q: searchQuery,
        limit: searchQuery.trim() ? 25 : 100 // Load more emails when not searching for better client-side search
      })
      
      console.log('📧 Email API response:', response)
      console.log('📧 Response items:', response.items)
      console.log('📧 Response total:', response.total)
      
      if (response.success) {
        const emailItems = response.items || []
        
        // Filter out emails with hidden/test categories like WebSocketTestCategory
        const validCategories = ['Academic', 'Promotions', 'Placement', 'Spam', 'Newsletter', 'Other']
        const filteredEmailItems = emailItems.filter(email => {
          if (!email.category) return true // Keep emails without category
          // If showing "All", filter out hidden categories, otherwise show only selected category
          if (categoryToUse === 'All') {
            return validCategories.includes(email.category)
          } else {
            return email.category === categoryToUse
          }
        })
        
        setEmails(filteredEmailItems)
        
        // Set the category-specific count - use filtered count for "All" category, server total for specific categories
        const countToShow = categoryToUse === 'All' ? filteredEmailItems.length : (response.total || 0)
        setCurrentCategoryCount(countToShow)
        
        // Store all emails for client-side search (only when not searching)
        if (!searchQuery.trim()) {
          setAllEmails(filteredEmailItems)
        }
        
        setTotalPages(Math.ceil(response.total / 25))
        console.log('✅ Emails loaded:', filteredEmailItems.length, 'out of', response.total || 0)
        console.log('✅ First email:', filteredEmailItems[0])
        console.log('✅ Email categories:', filteredEmailItems.map(email => ({ subject: email.subject, category: email.category })))
        console.log('✅ Search query:', searchQuery || 'none')
      } else {
        console.error('❌ Email API failed:', response.message)
        setEmails([])
        setCurrentCategoryCount(0)
        setTotalPages(1)
      }
    } catch (error) {
      console.error('❌ Error fetching emails:', error)
      setEmails([])
      setCurrentCategoryCount(0)
      setTotalPages(1)
    } finally {
      setEmailsLoading(false)
    }
  }, [currentPage, currentCategory, searchQuery, lastApiCall, API_CALL_THROTTLE])

  // Stats fetching function with debouncing
  const fetchStats = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && now - lastApiCall < API_CALL_THROTTLE) {
      console.log('⏳ Throttling stats API call...')
      return
    }
    
    // Prevent multiple simultaneous calls
    if (statsLoading) {
      console.log('⏳ Stats already loading, skipping...')
      return
    }
    
    // Only fetch stats if we have a token and Gmail is connected
    if (!token) {
      console.log('⏸️ Skipping stats fetch - no token')
      return
    }
    
    if (!gmailConnected) {
      console.log('⏸️ Skipping stats fetch - Gmail not connected')
      return
    }
    
    try {
      setStatsLoading(true)
      setLastApiCall(now)
      console.log('📊 Fetching stats...', { token: !!token, gmailConnected, force })
      const response = await emailService.getStats()
      console.log('📊 Raw response from emailService:', response)
      console.log('📊 Stats API response:', response)
      
      if (response.success && response.stats) {
        console.log('✅ Stats loaded successfully:', response.stats)
        setStats(response.stats)
      } else {
        console.warn('⚠️ Stats API returned unsuccessful response:', response)
        // Set fallback stats if no data available
        if (!stats || Object.keys(stats).length === 0) {
          console.log('📊 Setting fallback stats as no data available')
          setStats({
            totalEmails: 0,
            categories: 7,
            processedToday: 0,
            unreadCount: 0,
            lastSyncTime: null
          })
        }
      }
    } catch (error) {
      console.error('❌ Error fetching stats:', error)
      // Set fallback stats on error if no data available
      if (!stats || Object.keys(stats).length === 0) {
        console.log('📊 Setting fallback stats on error as no data available')
        setStats({
          totalEmails: 0,
          categories: 7,
          processedToday: 0,
          unreadCount: 0,
          lastSyncTime: null
        })
      }
    } finally {
      setStatsLoading(false)
    }
  }, [lastApiCall, API_CALL_THROTTLE, token, gmailConnected, stats, statsLoading])

  // Handle Gmail OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const gmailAuth = urlParams.get('gmail_auth')
    
    if (gmailAuth === 'success') {
      console.log('🎉 Gmail OAuth successful, refreshing connection status...')
      // Remove the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname)
      
      // Refresh connection status and data
      checkConnectionStatus()
      setTimeout(() => {
        fetchStats(true) // Force fetch stats first
        loadData()
      }, 1000) // Wait a bit for the connection status to update
    }
  }, [])

  // Fetch stats when token changes - only once
  useEffect(() => {
    if (token) {
      console.log('🔑 Token available, fetching stats...')
      // Add a small delay to prevent immediate spam
      setTimeout(() => {
        fetchStats(true)
      }, 1000)
    }
  }, [token, fetchStats])

  // Periodic connection status check and stats refresh
  useEffect(() => {
    if (!token) return
    
    const interval = setInterval(() => {
      checkConnectionStatus()
      // Refresh stats periodically but not too frequently
      console.log('🔄 Periodic stats refresh...')
      fetchStats(true)
    }, 30000) // Check every 30 seconds - much more reasonable
    
    return () => clearInterval(interval)
  }, [token, gmailConnected, fetchStats])

  // Load initial data on component mount
  useEffect(() => {
    console.log('🚀 Component mounted, loading initial data...')
    console.log('🔍 Current state:', { token: !!token, gmailConnected, currentPage, currentCategory, searchQuery })
    
    // Only fetch stats if Gmail is connected to avoid unnecessary calls
    if (token && gmailConnected) {
      console.log('📊 Force fetching stats on component mount...')
      setTimeout(() => {
        fetchStats(true)
      }, 2000) // Add delay to prevent spam
    }
    
    // Only load data if Gmail is connected
    if (!gmailConnected) {
      console.log('⏳ Gmail not connected, skipping data load')
      setStats({
        totalEmails: 0,
        categories: 7,
        processedToday: 0
      })
      setEmails([])
      return
    }
    
    // Load data when Gmail is connected
    const loadData = async () => {
      try {
        setEmailsLoading(true)
        console.log('📧 Fetching emails...', { currentPage, currentCategory, searchQuery })
        
        // Force fetch stats when Gmail connects
        console.log('📊 Force fetching stats on Gmail connection...')
        await fetchStats(true)
        
        // Single attempt to get emails
        try {
          const response = await emailService.getEmails({
            page: currentPage,
            category: currentCategory,
            q: searchQuery,
            limit: 100 // Load more emails initially for better client-side search
          })
          
          console.log('📧 Email API response:', response)
          
          if (response && response.success) {
            const emailItems = response.items || []
            setEmails(emailItems)
            
            // Store all emails for client-side search
            setAllEmails(emailItems)
            
            setTotalPages(Math.ceil((response.total || 0) / 25))
            console.log('✅ Emails loaded:', emailItems.length, 'out of', response.total || 0)
          } else {
            console.warn('⚠️ Email API returned unsuccessful response:', response)
            setEmails([])
            setTotalPages(1)
          }
        } catch (apiError) {
          console.error('❌ Email API error:', apiError)
          setEmails([])
          setTotalPages(1)
        }
      } catch (error) {
        console.error('❌ Error in loadData:', error)
        setEmails([])
        setTotalPages(1)
      } finally {
        setEmailsLoading(false)
      }
      
      // Load stats with fallback
      try {
        const statsResponse = await emailService.getStats()
        console.log('📊 Stats API response:', statsResponse)
        if (statsResponse && statsResponse.success && statsResponse.stats) {
          setStats(statsResponse.stats)
          console.log('✅ Stats loaded:', statsResponse.stats)
        } else {
          console.warn('⚠️ Stats API failed, using fallback')
          setStats({
            totalEmails: 0,
            categories: 7,
            processedToday: 0
          })
        }
      } catch (error) {
        console.error('❌ Error fetching stats:', error)
        setStats({
          totalEmails: 0,
          categories: 7,
          processedToday: 0
        })
      }
    }
    
    // Load data immediately
    loadData()
    
    // Remove periodic check to prevent infinite loops
  }, [gmailConnected]) // Run when Gmail connection status changes

  // Load data when filters change (except category - handled by handleCategoryChange)
  useEffect(() => {
    if (!token || !gmailConnected) return
    
    console.log('🔄 Filters changed, loading data...', { currentPage })
    const timeoutId = setTimeout(() => {
      fetchEmails()
      fetchStats()
    }, 300) // Debounce API calls
    
    return () => clearTimeout(timeoutId)
  }, [currentPage, searchQuery, token, gmailConnected])

  // Debug emails state changes
  useEffect(() => {
    console.log('🔍 Emails state changed:', {
      emailsLength: emails?.length || 0,
      emailsArray: emails,
      currentCategory,
      searchQuery,
      currentPage
    })
  }, [emails, currentCategory, searchQuery, currentPage])

  // Check URL parameters for tab navigation
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'notifications') {
      setShowNotifications(true)
      // Clear the parameter after opening
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

  // WebSocket event handlers
  const handleEmailSync = (emailData) => {
    console.log('📧 Real-time email sync:', emailData)
    // Refresh emails list
    fetchEmails()
    // Update stats
    fetchStats()
  }

  const handleCategoryUpdate = (categoryData) => {
    console.log('🏷️ Real-time category update:', categoryData)
    // Refresh categories, emails, and stats when categories change
    fetchEmails(true)
    fetchStats(true)
    // Trigger CategoryTabs refresh
    setCategoryTabsRefresh(prev => prev + 1)
  }

  const handleSyncStatus = (statusData) => {
    console.log('🔄 Real-time sync status:', statusData)
    if (statusData.status === 'active') {
      setSyncLoading(false)
    }
  }

  // Bulk operations handlers
  const handleBulkSelect = (emails) => {
    setSelectedEmails(emails)
    setShowBulkOperations(emails.length > 0)
  }

  const handleBulkOperationComplete = () => {
    setSelectedEmails([])
    setShowBulkOperations(false)
    // Refresh emails list
    fetchEmails()
  }


  // Email management functions
  const handleArchive = async (emailId) => {
    try {
      const response = await emailService.archiveEmail(emailId)
      if (response.success) {
        toast.success('Email archived successfully')
        fetchEmails()
      }
    } catch (error) {
      console.error('Error archiving email:', error)
      toast.error('Failed to archive email')
    }
  }

  const handleDelete = async (emailId) => {
    try {
      const response = await emailService.deleteEmail(emailId)
      if (response.success) {
        toast.success('Email deleted successfully')
        fetchEmails()
        if (selectedEmailId === emailId) {
          setSelectedEmailId(null)
          setSelectedEmail(null)
        }
      }
    } catch (error) {
      console.error('Error deleting email:', error)
      toast.error('Failed to delete email')
    }
  }

  const handleExport = (emailId) => {
    // This will be handled by the ExportModal component
    console.log('Export email:', emailId)
  }

  const handleCloseEmail = () => {
    setSelectedEmailId(null)
    setSelectedEmail(null)
  }




  // Subscribe to WebSocket events (debounced to prevent multiple subscriptions)
  useEffect(() => {
    if (isConnected) {
      console.log('🔌 WebSocket connected, subscribing to events')
      // Use a small delay to prevent multiple rapid subscriptions
      const timeoutId = setTimeout(() => {
        subscribeToEvents(['email_synced', 'category_updated', 'sync_status'])
      }, 100)
      
      return () => clearTimeout(timeoutId)
    } else {
      console.log('🔌 WebSocket not connected, will subscribe when connected')
    }
  }, [isConnected, subscribeToEvents])

  // Handle WebSocket category updates
  useEffect(() => {
    if (lastMessage?.type === 'category_updated') {
      console.log('🏷️ Dashboard received category update:', lastMessage.data)
      handleCategoryUpdate(lastMessage.data)
    }
  }, [lastMessage])

  // Listen for messages from popup windows (Gmail OAuth)
  useEffect(() => {
    const handleMessage = (event) => {
      console.log('Message received:', event.data)
      console.log('Message origin:', event.origin)
      console.log('Expected origins:', ['http://localhost:5000', 'http://localhost:3000', 'http://localhost:3001'])
      
      // Accept messages from localhost origins (development)
      const allowedOrigins = ['http://localhost:5000', 'http://localhost:3000', 'http://localhost:3001']
      
      if (event.data && event.data.type === 'GMAIL_LOGIN_SUCCESS') {
        console.log('Gmail login success message received!')
        
        // Stop the connecting state
        setConnectingGmail(false)
        
        // Store token and update auth context
        localStorage.setItem('token', event.data.token)
        api.defaults.headers.common['Authorization'] = `Bearer ${event.data.token}`
        
        // Show beautiful 3D glass design success toast
        toast.success('🎉 Gmail Connected Successfully!', {
          duration: 4000,
          style: {
            background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: '20px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.15), 0 0 0 1px rgba(16,185,129,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
            color: '#065f46',
            fontSize: '16px',
            fontWeight: '700',
            padding: '20px 24px',
            maxWidth: '450px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          },
          icon: '✨'
        })
        
        // Reload the page to refresh auth context
        setTimeout(() => {
          console.log('Reloading page with new token')
          window.location.reload()
        }, 1000)
      } else if (event.data && event.data.type === 'GMAIL_LOGIN_ERROR') {
        console.log('Gmail login error message received!')
        toast.error('❌ Login failed. Please try again.', {
          duration: 4000,
          style: {
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '20px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.15), 0 0 0 1px rgba(239,68,68,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
            color: '#991b1b',
            fontSize: '16px',
            fontWeight: '700',
            padding: '20px 24px',
            maxWidth: '450px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          },
          icon: '❌'
        })
      }
    }

    console.log('Setting up message listener for Gmail OAuth')
    window.addEventListener('message', handleMessage)
    
    return () => {
      console.log('Cleaning up message listener')
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  // Note: OAuth callback processing has been moved to OAuthCallback.jsx page

  // Check current connection status function
    const checkConnectionStatus = async () => {
      if (!token) {
        setLoadingConnections(false)
        return
      }

      try {
        const response = await api.get('/auth/me')
        if (response.data.success) {
          setGmailConnected(response.data.user.gmailConnected || false)
        // Update user object with Gmail name if available
        if (response.data.user.gmailName && user) {
          user.gmailName = response.data.user.gmailName
        }
        }
      } catch (error) {
        console.error('Failed to check connection status:', error)
      } finally {
        setLoadingConnections(false)
      }
    }

  // Load stats function (removed duplicate - using fetchStats instead)

  // Check current connection status on component mount
  useEffect(() => {
    if (token) {
      checkConnectionStatus()
      fetchStats() // Use the optimized fetchStats instead of loadStats
    }
  }, [token, fetchStats])

  // Load emails function (removed duplicate - using fetchEmails instead)

  // Load email details
  const loadEmailDetails = async (emailId) => {
    if (!emailId) return
    
    setEmailDetailLoading(true)
    try {
      const response = await emailService.detail(emailId)
      if (response.success) {
        setSelectedEmail(response.email)
      }
    } catch (error) {
      console.error('Failed to load email details:', error)
      toast.error('Failed to load email details')
    } finally {
      setEmailDetailLoading(false)
    }
  }

  // Load emails when filters change (handled by main useEffect with debounce)

  // Load email details when selection changes
  useEffect(() => {
    if (selectedEmailId) {
      loadEmailDetails(selectedEmailId)
    }
  }, [selectedEmailId])

  // Realtime updates handled by WebSocket (removed duplicate EventSource)

  const handleGmailConnection = async () => {
    // Prevent multiple simultaneous connection attempts
    if (connectingGmail) {
      console.log('Gmail connection already in progress, skipping...')
      return
    }
    
    setConnectingGmail(true)
    try {
      const response = await api.get('/auth/gmail/connect')
      if (response.data.success) {
        console.log('Redirecting to Gmail OAuth:', response.data.authUrl)
        
        // Redirect to Gmail OAuth in the same tab
        window.location.href = response.data.authUrl
        
        // The OAuth callback will redirect back to dashboard with token
        // and the URL parameter handler will process it
      } else {
        toast.error('Failed to initiate Gmail connection')
        setConnectingGmail(false)
      }
    } catch (error) {
      console.error('Gmail connection error:', error)
      if (error.response?.status === 429) {
        toast.error('Too many requests. Please wait a moment before trying again.')
      } else {
        toast.error('Failed to connect Gmail account')
      }
      setConnectingGmail(false)
    }
  }

  const handleGmailDisconnection = async () => {
    try {
      setDisconnecting(true)
      const response = await emailService.disconnectGmail()
      if (response.success) {
        toast.success('Disconnected & data removed')
        // Clear local UI
        setEmails([])
        setSelectedEmailId(null)
        setSelectedEmail(null)
        setGmailConnected(false)
        // Reload header stats & user
        await checkConnectionStatus()
        await fetchStats()
      } else {
        toast.error('Failed to disconnect Gmail account')
      }
    } catch (error) {
      console.error('Gmail disconnection error:', error)
      const errorMessage = error?.response?.data?.message || error.message || 'Failed to disconnect Gmail account'
      toast.error(errorMessage)
    } finally {
      setDisconnecting(false)
    }
  }


  const syncGmailEmails = async () => {
    if (!token) {
      toast.error('Please login first')
      return
    }
    
    if (!gmailConnected) {
      toast.error('Please connect your Gmail account first')
      return
    }
    
    setSyncLoading(true)
    try {
      console.log('🔄 Starting Gmail sync...')
      const data = await emailService.syncGmail()
      console.log('✅ Gmail sync response:', data)
      
      if (data.success) {
        toast.success(`Synced ${data.synced}/${data.total} • Classified ${data.classified}`)
        await checkConnectionStatus()
        await fetchStats() // Use optimized fetchStats
        await fetchEmails() // Use optimized fetchEmails
      } else {
        toast.error(data.message || 'Sync failed')
      }
    } catch (error) {
      console.error('❌ Sync error:', error)
      const errorMessage = error?.response?.data?.message || error.message || 'Failed to sync emails'
      toast.error(errorMessage)
    } finally {
      setSyncLoading(false)
    }
  }

  // Email action handlers
  const handleEmailSelect = (emailId) => {
    // Toggle behavior: if clicking the same email, close it
    if (selectedEmailId === emailId) {
      setSelectedEmailId(null)
      setSelectedEmail(null)
    } else {
      setSelectedEmailId(emailId)
      if (emailId) {
        loadEmailDetail(emailId)
      } else {
        setSelectedEmail(null)
      }
    }
  }

  const handleEmailClose = () => {
    setSelectedEmailId(null)
    setSelectedEmail(null)
  }

  const handleEmailArchive = async (emailId) => {
    try {
      await emailService.archive(emailId)
      toast.success('Email archived')
      fetchEmails() // Refresh list
      if (selectedEmailId === emailId) {
        setSelectedEmailId(null)
        setSelectedEmail(null)
      }
    } catch (error) {
      console.error('Archive error:', error)
      toast.error('Failed to archive email')
    }
  }

  const handleEmailDelete = async (emailId) => {
    try {
      await emailService.remove(emailId)
      toast.success('Email deleted')
      fetchEmails() // Refresh list
      if (selectedEmailId === emailId) {
        setSelectedEmailId(null)
        setSelectedEmail(null)
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete email')
    }
  }

  const handleEmailExport = async (emailId) => {
    try {
      await emailService.export(emailId)
      toast.success('Email exported')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export email')
    }
  }

  const handleCategoryChange = (category) => {
    console.log('🔄 Category changed to:', category)
    setCurrentCategory(category)
    setCurrentPage(1) // Reset to first page
    setCurrentCategoryCount(0) // Reset category count immediately for better UX
    // Clear selected email when changing categories
    setSelectedEmailId(null)
    setSelectedEmail(null)
    // Fetch emails for the new category immediately with the new category value
    fetchEmails(true, category) // Force fetch without throttling and pass the new category
  }

  const handleSearchChange = (query) => {
    setSearchQuery(query)
    setCurrentPage(1) // Reset to first page
    // Clear selected email when searching
    setSelectedEmailId(null)
    setSelectedEmail(null)
    
    // Immediate client-side filtering for instant feedback
    if (query.trim()) {
      const filteredEmails = allEmails.filter(email => 
        email.subject?.toLowerCase().includes(query.toLowerCase()) ||
        email.from?.toLowerCase().includes(query.toLowerCase()) ||
        email.snippet?.toLowerCase().includes(query.toLowerCase())
      )
      setEmails(filteredEmails)
    } else {
      // If no search query, show all emails (will be updated by server call)
      setEmails(allEmails)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setCurrentPage(1)
    setSelectedEmailId(null)
    setSelectedEmail(null)
    // Restore all emails when clearing search
    setEmails(allEmails)
  }

  // Server search effect - only for queries longer than 2 characters to reduce API calls
  useEffect(() => {
    if (!token || !gmailConnected || searchQuery.trim().length < 2) return
    
    setIsSearching(true)
    const timeoutId = setTimeout(() => {
      fetchEmails().finally(() => setIsSearching(false))
    }, 300) // Slightly longer debounce for server calls
    
    return () => {
      clearTimeout(timeoutId)
      setIsSearching(false)
    }
  }, [searchQuery, token, gmailConnected, fetchEmails])

  const handlePageChange = (page) => {
    setCurrentPage(page)
    // Clear selected email when changing pages
    setSelectedEmailId(null)
    setSelectedEmail(null)
  }


  return (
    <div className="min-h-screen p-3 relative">
      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-4"
        >
          <h1 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-2">
            Welcome back, {user?.gmailName || user?.name || 'User'}! 
            <ModernIcon type="welcome" size={20} color="#3b82f6" />
          </h1>
          <p className="text-slate-600 text-sm">
            Manage and organize your emails efficiently with AI-powered classification
          </p>
        </motion.div>

        {/* Email Service Connections */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <h2 className="text-base font-semibold text-slate-800 mb-3">Connect Your Email Services</h2>
          
          {/* Gmail Connection + Sync Status Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4">
            {/* LEFT: Quick Stats Cards */}
            <div className="lg:col-span-3 space-y-3 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 lg:space-y-3">
              {/* Unread Card */}
              <div className="bg-blue-400/30 backdrop-blur-xl border border-blue-200/20 rounded-xl p-2 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ModernIcon type="email" size={12} color="#2563eb" />
                    <span className="text-xs text-slate-600 font-medium">Unread</span>
                  </div>
                <h3 className="text-xl font-bold text-slate-800">2920</h3>
              </div>

              {/* Starred Card */}
              <div className="bg-orange-400/30 backdrop-blur-xl border border-orange-200/20 rounded-xl p-2 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm text-yellow-500">⭐</span>
                  <span className="text-xs text-slate-600 font-medium">Starred</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800">18</h3>
              </div>

              {/* Draft Card */}
              <div className="bg-gray-400/30 backdrop-blur-xl border border-gray-200/20 rounded-xl p-2 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm text-yellow-400">✏️</span>
                  <span className="text-xs text-slate-600 font-medium">Draft</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800">5</h3>
              </div>
            </div>

            {/* RIGHT: Gmail + Sync Cards */}
            <div className="lg:col-span-9 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4">
            {/* Gmail Connection Card */}
            <div className="lg:col-span-8 bg-gradient-to-br from-blue-400/60 to-purple-10/40 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-500">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-200 rounded-xl">
                  <ModernIcon type="email" size={18} color="#3b82f6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-slate-800">Gmail</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      gmailConnected 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {gmailConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    {gmailConnected 
                      ? 'Your Gmail is connected and syncing' 
                      : 'Connect your Gmail account to start organizing emails'
                    }
                  </p>
                  
                  {/* Stats Row */}
                  {gmailConnected && (
                    <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <h4 className="text-2xl font-bold text-slate-800">{stats?.totalEmails || 6187}</h4>
                          <p className="text-sm text-slate-600">Total</p>
                        </div>
                        <div className="text-center">
                          <h4 className="text-2xl font-bold text-slate-800">{stats?.categories || 7}</h4>
                          <p className="text-sm text-slate-600">Categories</p>
                        </div>
                        <div className="text-center">
                          <h4 className="text-2xl font-bold text-slate-800">{stats?.processedToday || 12}</h4>
                          <p className="text-sm text-slate-600">Today</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {gmailConnected ? (
                      <>
                        <button 
                          onClick={syncGmailEmails}
                          disabled={syncLoading}
                          className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {syncLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              Syncing...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Sync Now
                            </>
                          )}
                        </button>
                        <button 
                          onClick={handleGmailDisconnection}
                          className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-all"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={handleGmailConnection}
                        disabled={connectingGmail}
                        className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {connectingGmail ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            Connecting...
                          </>
                        ) : (
                          <>
                            <ModernIcon type="email" size={12} />
                            Connect Gmail
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sync Status Card */}
            <div className="lg:col-span-4 bg-gradient-to-br from-green-300/80 to-green-50/60 backdrop-blur-xl border border-green-200/30 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-500">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-200/60 rounded-xl">
                  <ModernIcon type="sync" size={16} color="#10b981" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-bold text-slate-800">Sync Status</h3>
                    <span className="px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                      Complete
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    All systems operational
                  </p>
                  
                  {/* Progress Box */}
                  <div className="bg-white/80 border border-white/50 rounded-xl p-3 mb-3 text-center">
                    <h4 className="text-3xl font-bold text-slate-800">99%</h4>
                    <p className="text-xs text-slate-600">Progress</p>
                  </div>

                  {/* Check Status Button */}
                  <button 
                    onClick={() => fetchStats(true)}
                    className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Check Status
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Stats Cards */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4"
        >
          {/* Total Emails Card */}
          <div className="group relative bg-blue-300/30 backdrop-blur-xl border border-blue-200/30 rounded-2xl p-4 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-500 cursor-pointer">
            <div className="absolute top-2 right-2">
              <span className="px-1.5 py-0.5 bg-blue-200/60 text-blue-700 text-[9px] font-medium rounded-full">
                +12%
              </span>
              <p className="text-[7px] text-slate-500 text-right mt-0.5">vs last week</p>
            </div>
            <div className="p-1.5 bg-blue-200/60 rounded-lg inline-block mb-2">
              <ModernIcon type="email" size={16} color="#3b82f6" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-1">6,175</h3>
            <p className="text-xs text-slate-600 font-medium">Total Emails</p>
          </div>

          {/* Categories Card */}
          <CategoriesCard categories={stats?.categories || 7} />

          {/* Processed Today Card */}
          <div className="relative bg-[#F8EBE4] rounded-xl p-4 shadow-sm hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
            {/* Icon - Top Left */}
            <div className="absolute top-3 left-3">
              <div className="w-6 h-6 bg-[#F0C8B4] rounded-lg flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
            
            {/* Live/Real-time - Top Right */}
            <div className="absolute top-3 right-3 text-right">
              <div className="text-[#E87C3E] font-bold text-sm">Live</div>
              <div className="text-[#707070] text-xs">Real-time</div>
            </div>
            
            {/* Large Number - Middle Left */}
            <div className="pt-8 pb-2">
              <div className="text-[#333333] font-bold text-3xl">6175</div>
            </div>
            
            {/* Processed Today - Bottom Left */}
            <div className="text-[#555555] text-sm font-medium">Processed Today</div>
          </div>

          {/* Gmail Status Card */}
          <div className="group relative bg-gradient-to-br from-pink-50/30 to-white/60 backdrop-blur-xl border border-pink-200/20 rounded-2xl p-4 hover:shadow-2xl hover:scale-105 transition-all duration-500">
            <div className="absolute top-2 right-2">
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-medium rounded-full">
                Connected
              </span>
              <p className="text-[7px] text-slate-500 text-right mt-0.5">Gmail Status</p>
            </div>
            <div className="p-1.5 bg-pink-100/30 rounded-lg inline-block mb-2">
              <ModernIcon type="email" size={16} color="#ec4899" />
            </div>
            <div className="space-y-2 mt-2">
              <button 
                onClick={syncGmailEmails}
                disabled={syncLoading || !gmailConnected}
                className="w-full bg-green-500 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-green-600 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
              >
                ✉️ Sync Gmail
              </button>
              <button 
                onClick={() => {
                  console.log('🔄 Force refreshing data and categories...')
                  setForceRefresh(prev => prev + 1)
                  fetchStats(true)
                  fetchEmails(true)
                  toast.success('Data refreshed!')
                }}
                className="w-full bg-blue-500 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-600 transition-all flex items-center justify-center gap-1"
              >
                🔄 Refresh Data
              </button>
            </div>
          </div>
        </motion.div>

        {/* View Toggle */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <div className="flex space-x-1 glass p-0.5 rounded-lg w-fit">
            <button 
              className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-1 ${
                activeView === 'emails' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
              onClick={() => setActiveView('emails')}
            >
              <svg className={`w-2 h-2 ${activeView === 'emails' ? 'text-white' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Emails
            </button>
            <button 
              className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-1 ${
                activeView === 'analytics' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
              onClick={() => setActiveView('analytics')}
            >
              <svg className={`w-2 h-2 ${activeView === 'analytics' ? 'text-white' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </button>
            <button 
              className="px-2.5 py-1.5 rounded-md text-sm font-medium transition-all duration-300 text-slate-600 hover:bg-blue-50 hover:text-blue-600 relative flex items-center gap-1"
              onClick={() => setShowNotifications(true)}
            >
              <svg className="w-2 h-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-5H4v5zM9 12h6v-5H9v5zM4 12h5V7H4v5z" />
              </svg>
              Notifications
            </button>
            <button 
              className="px-2.5 py-1.5 rounded-md text-sm font-medium transition-all duration-300 text-slate-600 hover:bg-blue-50 hover:text-blue-600 relative flex items-center gap-1"
              onClick={() => setShowPerformanceDashboard(true)}
            >
              <svg className="w-2 h-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Performance
            </button>
          </div>
        </motion.div>

        {/* Content */}

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {activeView === 'emails' ? (
            <div className="space-y-6">
              {/* Top Bar with Provider Selector and Search */}
              <div className="backdrop-blur-xl bg-gradient-to-r from-white/60 via-white/50 to-white/40 border border-white/40 rounded-2xl p-4 shadow-lg shadow-blue-100/10 relative z-20">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Gmail Status */}
                  <div className="flex gap-2">
                    <button className="group relative px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          gmailConnected ? 'bg-white' : 'bg-white/60'
                        }`}></div>
                        <span>Gmail</span>
                        {gmailConnected && (
                          <div className="flex items-center gap-1 text-xs">
                            <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
                            <span>Live</span>
                          </div>
                        )}
                      </div>
                       <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </button>
                  </div>
                  
                  {/* Search Input */}
                  <div className="flex-1">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        {isSearching ? (
                          <div className="animate-spin">
                            <svg 
                              className="h-4 w-4 text-emerald-600" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                              />
                            </svg>
                          </div>
                        ) : (
                          <svg 
                            className="h-4 w-4 text-slate-500 transition-colors duration-300 group-focus-within:text-emerald-600" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                            />
                          </svg>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder={isSearching ? "Searching..." : "Search emails..."}
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        disabled={isSearching}
                        className="w-full pl-10 pr-10 py-2 bg-gradient-to-r from-white/60 to-white/40 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 shadow-lg hover:shadow-xl transition-all duration-300 text-slate-800 placeholder-slate-500 font-medium backdrop-blur-sm disabled:opacity-70 disabled:cursor-wait"
                      />
                      
                      {/* Clear Search Button */}
                      {searchQuery && (
                        <button
                          onClick={clearSearch}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center z-10 hover:bg-white/20 rounded-r-xl transition-colors duration-200"
                          disabled={isSearching}
                        >
                          <svg 
                            className="h-3 w-3 text-slate-500 hover:text-slate-700 transition-colors duration-200" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M6 18L18 6M6 6l12 12" 
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category Management */}
                  <CategoryManagement onCategoryUpdate={() => {
                    fetchEmails(true)
                    fetchStats(true)
                    // Trigger CategoryTabs refresh
                    setCategoryTabsRefresh(prev => prev + 1)
                  }} />
                </div>
              </div>

              {/* Search Results Indicator */}
              {searchQuery && (
                <div className="backdrop-blur-xl bg-gradient-to-r from-blue-50/40 via-white/30 to-blue-50/40 border border-white/30 rounded-xl p-3 shadow-lg relative z-15">
                  <div className="flex items-center gap-2">
                    <ModernIcon type="search" size={16} color="#3b82f6" />
                    <div className="flex-1">
                      <span className="text-xs font-medium text-slate-700">
                        Search results for "{searchQuery}"
                      </span>
                      <span className="text-xs text-slate-500 ml-1">
                        {emails.length} emails found
                      </span>
                      {isSearching && (
                        <span className="text-xs text-blue-600 ml-1 animate-pulse">
                          Searching server...
                        </span>
                      )}
                      {searchQuery.trim().length < 2 && (
                        <span className="text-xs text-amber-600 ml-1">
                          Showing client-side results
                        </span>
                      )}
                    </div>
                    <button
                      onClick={clearSearch}
                      className="text-xs text-slate-600 hover:text-slate-800 underline"
                    >
                      Clear search
                    </button>
                  </div>
                </div>
              )}

              {/* Category Tabs */}
              <CategoryTabs 
                value={currentCategory} 
                onChange={handleCategoryChange}
                refreshTrigger={categoryTabsRefresh}
              />

              {/* Main Layout */}
              <div className="space-y-4">
                  {/* Dynamic Split Layout */}
                  <div
                    className="
                      relative
                      flex lg:flex-row flex-col
                      gap-3 lg:gap-4
                      h-[calc(100vh-180px)]
                      transition-all duration-500 ease-out
                    "
                  >
                {/* LEFT: Email List pane */}
                <section
                  className={[
                    "bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl shadow-blue-100/20",
                    "overflow-hidden flex flex-col relative z-10",
                    "transition-[flex-basis] duration-300 ease-out",
                    selectedEmail ? "lg:flex-[0_0_42%] lg:min-w-[400px] lg:max-w-[500px] basis-full" : "basis-full"
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between p-4 border-b border-white/30 bg-gradient-to-r from-white/60 to-white/40">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                      <ModernIcon type="email" size={16} color="#3b82f6" />
                      Emails
                      {currentCategory !== 'All' && (
                        <span className="text-sm font-medium text-slate-500 ml-1">
                          - {currentCategory}
                        </span>
                      )}
                    </h3>
                    <span className="text-xs font-semibold text-slate-600 bg-gradient-to-r from-emerald-100 to-blue-100 px-2 py-0.5 rounded-full">
                      {currentCategoryCount || 0} emails
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-[calc(100vh-280px)] max-h-[calc(100vh-80px)]">
                     <EmailList
                       items={emails}
                       selectedId={selectedEmailId}
                       onSelect={handleEmailSelect}
                       loading={emailsLoading}
                       onPageChange={handlePageChange}
                       totalEmails={stats?.totalEmails || 0}
                       currentPage={currentPage}
                       totalPages={totalPages}
                       onBulkSelect={handleBulkSelect}
                       selectedEmails={selectedEmails}
                       gmailConnected={gmailConnected}
                       isCompact={!!selectedEmail}
                     />
                  </div>
                </section>

                {/* RIGHT: Email Reader pane (hidden until selected) */}
                <section
                  className={[
                    "bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl shadow-blue-100/20",
                    "overflow-hidden flex flex-col lg:flex-[0_0_58%] lg:min-w-[600px] relative z-10",
                    "transition-opacity duration-200",
                    selectedEmail ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                  ].join(" ")}
                  style={{ display: selectedEmail ? undefined : "none" }}
                >
                  <div className="flex-1 overflow-y-auto">
                    <EmailReader
                      email={selectedEmail}
                      onArchive={handleEmailArchive}
                      onDelete={handleEmailDelete}
                      onExport={handleEmailExport}
                      onClose={handleEmailClose}
                      loading={emailDetailLoading}
                    />
                  </div>
                </section>
                  </div>
              </div>
            </div>
          ) : activeView === 'analytics' ? (
            <SuperAnalyticsDashboard />
          ) : null}
        </motion.div>
      </div>

      {/* Bulk Operations Modal */}
      {showBulkOperations && (
        <BulkOperations
          selectedEmails={selectedEmails}
          onOperationComplete={handleBulkOperationComplete}
          onClose={() => setShowBulkOperations(false)}
        />
      )}


      {/* Notification Center Modal */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNotificationUpdate={() => window.dispatchEvent(new CustomEvent('notificationUpdated'))}
      />


      {/* Performance Dashboard */}
      <PerformanceDashboard
        isOpen={showPerformanceDashboard}
        onClose={() => setShowPerformanceDashboard(false)}
      />

    </div>
  )
}

export default Dashboard
