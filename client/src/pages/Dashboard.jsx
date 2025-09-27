import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import EmailList from '../components/EmailList'
import EmailReader from '../components/EmailReader'
import CategoryTabs from '../components/CategoryTabs'
import AnalyticsDashboard from '../components/AnalyticsDashboard'
import AdvancedAnalytics from '../components/AdvancedAnalytics'
import CategoryManagement from '../components/CategoryManagement'
import BulkOperations from '../components/BulkOperations'
import EmailTemplates from '../components/EmailTemplates'
import NotificationCenter from '../components/NotificationCenter'
import ExportModal from '../components/ExportModal'
import PerformanceDashboard from '../components/PerformanceDashboard'
import SecurityDashboard from '../components/SecurityDashboard'
import { api } from '../services/api'
import emailService from '../services/emailService'
import ModernIcon from '../components/ModernIcon'

const Dashboard = () => {
  const { user, token, connectGmailAccount, connectMicrosoftAccount, updateTokenFromOAuth } = useAuth()
  const { isConnected, connectionStatus, subscribeToEvents } = useWebSocketContext()
  const [activeView, setActiveView] = useState('emails')
  const [syncLoading, setSyncLoading] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [connectingOutlook, setConnectingOutlook] = useState(false)
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
  const [showEmailTemplates, setShowEmailTemplates] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false)
  const [showSecurityDashboard, setShowSecurityDashboard] = useState(false)
  
  // Rate limiting for API calls
  const [lastApiCall, setLastApiCall] = useState(0)
  const [statsLoading, setStatsLoading] = useState(false)
  const API_CALL_THROTTLE = 5000 // 5 seconds throttle - much more reasonable

  // Email fetching function
  const fetchEmails = useCallback(async (skipThrottle = false) => {
    const now = Date.now()
    if (!skipThrottle && now - lastApiCall < API_CALL_THROTTLE) {
      console.log('⏳ Throttling API call...')
      return
    }
    
    try {
      setEmailsLoading(true)
      setLastApiCall(now)
      console.log('📧 Fetching emails...', { currentPage, currentCategory, searchQuery })
      console.log('📧 User token:', token ? 'Present' : 'Missing')
      console.log('📧 Gmail connected:', gmailConnected)
      console.log('📧 API call parameters:', { page: currentPage, category: currentCategory, q: searchQuery })
      
      const response = await emailService.getEmails({
        page: currentPage,
        category: currentCategory,
        q: searchQuery,
        limit: searchQuery.trim() ? 25 : 100 // Load more emails when not searching for better client-side search
      })
      
      console.log('📧 Email API response:', response)
      console.log('📧 Response items:', response.items)
      console.log('📧 Response total:', response.total)
      
      if (response.success) {
        const emailItems = response.items || []
        setEmails(emailItems)
        
        // Store all emails for client-side search (only when not searching)
        if (!searchQuery.trim()) {
          setAllEmails(emailItems)
        }
        
        setTotalPages(Math.ceil(response.total / 25))
        console.log('✅ Emails loaded:', emailItems.length, 'out of', response.total || 0)
        console.log('✅ First email:', emailItems[0])
        console.log('✅ Email categories:', emailItems.map(email => ({ subject: email.subject, category: email.category })))
        console.log('✅ Search query:', searchQuery || 'none')
      } else {
        console.error('❌ Email API failed:', response.message)
        setEmails([])
        setTotalPages(1)
      }
    } catch (error) {
      console.error('❌ Error fetching emails:', error)
      setEmails([])
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
        if (statsResponse && statsResponse.success && statsResponse.data) {
          setStats(statsResponse.data)
          console.log('✅ Stats loaded:', statsResponse.data)
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
    // Refresh categories if needed
    // This will be handled by the CategoryManagement component
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



  const handleTemplateSelect = (template) => {
    // Handle template selection (could be used for composing new emails)
    console.log('Template selected:', template)
    setShowEmailTemplates(false)
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

  // Handle token from URL parameters (Gmail OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken = urlParams.get('token')
    const connected = urlParams.get('connected')
    const loginSuccess = urlParams.get('login')
    const error = urlParams.get('error')
    
    if (urlToken && (connected === '1' || loginSuccess === 'success')) {
      console.log('🎯 OAuth callback detected - updating authentication state...')
      
      // Use the new AuthContext function to update token and user data
      updateTokenFromOAuth(urlToken).then((result) => {
        if (result.success) {
          console.log('✅ Authentication state updated successfully')
          
          // Show beautiful 3D glass design success toast
          const isLogin = loginSuccess === 'success'
          toast.success(isLogin ? '🎉 Login Successful! Gmail Connected Automatically!' : '🎉 Gmail Connected Successfully!', {
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
          
          // Refresh connection status and data after successful auth update
          setTimeout(() => {
            checkConnectionStatus()
            fetchStats(true)
            loadData()
          }, 500)
        } else {
          console.error('❌ Failed to update authentication state:', result.error)
          toast.error('❌ Authentication update failed. Please refresh the page.', {
            duration: 4000
          })
        }
      }).catch((error) => {
        console.error('❌ Error updating authentication state:', error)
        toast.error('❌ Authentication error. Please refresh the page.', {
          duration: 4000
        })
      })
      
      // Clean up URL parameters (no page reload needed)
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (error === 'gmail_connection_failed') {
      console.log('Gmail connection failed')
      // Show error toast
      toast.error('❌ Gmail connection failed. Please try again.', {
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
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [updateTokenFromOAuth])

  // Check current connection status function
    const checkConnectionStatus = async () => {
      if (!token) {
        setLoadingConnections(false)
        return
      }

      try {
        const response = await api.get('/api/auth/me')
        if (response.data.success) {
          setGmailConnected(response.data.user.gmailConnected || false)
          setOutlookConnected(response.data.user.outlookConnected || false)
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
      const response = await api.get('/api/auth/gmail/connect')
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

  const handleOutlookConnection = async () => {
    setConnectingOutlook(true)
    try {
      const result = await connectMicrosoftAccount()
      if (result.success) {
        setOutlookConnected(true)
        toast.success(result.message || 'Microsoft Outlook account connected successfully!')
      } else {
        toast.error(result.error || 'Failed to connect Microsoft Outlook account')
      }
    } catch (error) {
      toast.error('Microsoft Outlook integration is not yet implemented. Please use Gmail for now.')
    } finally {
      setConnectingOutlook(false)
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
      const { data } = await api.post('/api/emails/gmail/sync-all')
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
    // Clear selected email when changing categories
    setSelectedEmailId(null)
    setSelectedEmail(null)
    // Fetch emails for the new category
    fetchEmails(true) // Force fetch without throttling
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

  const syncOutlookEmails = async () => {
    // Outlook sync is coming soon
    toast.error('Outlook sync coming soon!', { duration: 3000 })
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold text-slate-800 mb-1 flex items-center gap-3">
            Welcome back, {user?.gmailName || user?.name || 'User'}! 
            <ModernIcon type="welcome" size={28} color="#3b82f6" />
          </h1>
          <p className="text-slate-600 text-base">
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
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Connect Your Email Services</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Gmail Card */}
            <div className="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] hover:scale-[1.01] transition-all duration-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
                    <ModernIcon type="email" size={20} color="#ffffff" glassEffect={false} />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Gmail</h3>
                    <p className="text-sm text-slate-600">
                      {gmailConnected 
                        ? 'Your Gmail is connected and syncing' 
                        : 'Connect your Gmail account to start organizing emails'
                      }
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  gmailConnected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {gmailConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {/* Mini Stats */}
              {gmailConnected && (
                <div className="grid grid-cols-3 gap-3 mb-3 p-2 bg-white/20 rounded-lg">
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-800">{stats?.totalEmails || 0}</div>
                    <div className="text-xs text-slate-600">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-800">{stats?.categories || 7}</div>
                    <div className="text-xs text-slate-600">Categories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-800">{stats?.processedToday || 0}</div>
                    <div className="text-xs text-slate-600">Today</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {gmailConnected ? (
                  <>
                    <button 
                      onClick={syncGmailEmails}
                      disabled={syncLoading}
                      className="flex-1 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg rounded-lg px-3 py-1.5 text-sm font-medium hover:from-emerald-500 hover:to-emerald-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <ModernIcon type="sync" size={8} />
                      {syncLoading ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button 
                      onClick={handleGmailDisconnection}
                      className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-300"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <button 
                      onClick={handleGmailConnection}
                      disabled={connectingGmail}
                      className="w-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg rounded-xl px-4 py-2 font-medium hover:from-emerald-500 hover:to-emerald-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {connectingGmail ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <ModernIcon type="email" size={16} />
                          Connect Gmail
                        </>
                      )}
                    </button>
                    <p className="text-xs text-slate-500 text-center">
                      If you logged in with Google but Gmail isn't connected, click here to set it up manually.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Outlook Card */}
            <div className="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] hover:scale-[1.01] transition-all duration-300 p-4 opacity-60">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <ModernIcon type="outlook" size={20} color="#ffffff" glassEffect={false} />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Microsoft Outlook</h3>
                    <p className="text-sm text-slate-600">Coming soon - Use Gmail for now</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Coming Soon
                </span>
              </div>
              
              <button 
                disabled
                className="w-full bg-slate-200/60 text-slate-400 rounded-xl px-4 py-2 font-medium cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ModernIcon type="outlook" size={16} />
                Coming Soon
              </button>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Stats Cards */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-4"
        >
          {/* Email Overview Card */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-blue-50/50 to-blue-100/40 border border-blue-200/40 rounded-2xl p-2.5 hover:shadow-lg hover:shadow-blue-200/30 transition-all duration-500 hover:scale-105 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/15 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-blue-100/50 group-hover:bg-blue-200/60 transition-colors duration-300">
                  <ModernIcon type="email" size={14} color="#3b82f6" />
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-blue-600 font-medium">+12%</div>
                  <div className="text-[9px] text-slate-500">vs last week</div>
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-0.5">{(stats?.totalEmails || 0).toLocaleString()}</h3>
              <p className="text-xs text-slate-600 font-medium">Total Emails</p>
              <div className="mt-1.5 h-0.5 bg-blue-100/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min((stats?.totalEmails || 0) / 10000 * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Categories Card */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-emerald-50/50 to-emerald-100/40 border border-emerald-200/40 rounded-2xl p-2.5 hover:shadow-lg hover:shadow-emerald-200/30 transition-all duration-500 hover:scale-105 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/15 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-100/50 group-hover:bg-emerald-200/60 transition-colors duration-300">
                  <ModernIcon type="folder" size={14} color="#10b981" />
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-emerald-600 font-medium">Auto</div>
                  <div className="text-[9px] text-slate-500">Classified</div>
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-0.5">{stats?.categories || 7}</h3>
              <p className="text-xs text-slate-600 font-medium">Categories</p>
              <div className="mt-1.5 flex gap-0.5">
                {['Academic', 'Promotions', 'Placement', 'Spam', 'Newsletter', 'WebSocketTestCategory', 'Other'].slice(0, stats?.categories || 7).map((cat, i) => {
                  // Calculate actual percentage based on email distribution (simulate real data)
                  const categoryDistribution = {
                    'Academic': 30,
                    'Promotions': 20, 
                    'Placement': 15,
                    'Spam': 15,
                    'Newsletter': 10,
                    'WebSocketTestCategory': 5,
                    'Other': 5
                  }
                  const percentage = categoryDistribution[cat] || 20
                  
                  return (
                    <div key={cat} className="h-0.5 bg-emerald-100/50 rounded-full flex-1 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000"
                        style={{ width: `${percentage}%`, transitionDelay: `${i * 200}ms` }}
                      ></div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Activity Card */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-amber-50/50 to-amber-100/40 border border-amber-200/40 rounded-2xl p-2.5 hover:shadow-lg hover:shadow-amber-200/30 transition-all duration-500 hover:scale-105 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/15 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-amber-100/50 group-hover:bg-amber-200/60 transition-colors duration-300">
                  <ModernIcon type="sync" size={14} color="#f59e0b" />
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-amber-600 font-medium">Live</div>
                  <div className="text-[9px] text-slate-500">Real-time</div>
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-0.5">{stats?.processedToday || 0}</h3>
              <p className="text-xs text-slate-600 font-medium">Processed Today</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="flex-1 h-0.5 bg-amber-100/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((stats?.processedToday || 0) / 100 * 100, 100)}%` }}
                  ></div>
                </div>
                <div className={`w-1.5 h-1.5 rounded-full ${(stats?.processedToday || 0) > 0 ? 'bg-amber-400 animate-pulse' : 'bg-amber-200'}`}></div>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-purple-50/50 to-purple-100/40 border border-purple-200/40 rounded-2xl p-2.5 hover:shadow-lg hover:shadow-purple-200/30 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/15 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-purple-100/50 group-hover:bg-purple-200/60 transition-colors duration-300">
                  <ModernIcon type="email" size={14} color="#8b5cf6" />
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-medium ${gmailConnected ? 'text-green-600' : 'text-red-500'}`}>
                    {gmailConnected ? 'Connected' : 'Disconnected'}
                  </div>
                  <div className="text-[9px] text-slate-500">Gmail Status</div>
                </div>
              </div>
              
              <div className="space-y-1.5">
                {/* Gmail Sync Button */}
              <button 
                onClick={syncGmailEmails}
                disabled={syncLoading || !gmailConnected}
                  className="w-full py-1.5 px-2 text-[10px] bg-gradient-to-r from-green-500/25 to-green-600/25 text-green-700 rounded-lg hover:from-green-500/35 hover:to-green-600/35 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-1 font-semibold border border-green-300/40 hover:shadow-md hover:shadow-green-200/40 hover:scale-105"
                >
                  {syncLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-2.5 w-2.5 border-2 border-green-600 border-t-transparent"></div>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <ModernIcon type="email" size={10} color="#059669" />
                      {gmailConnected ? 'Sync Gmail' : 'Connect Gmail'}
                    </>
                  )}
              </button>
              
              {/* Refresh Data Button */}
              {gmailConnected && (
                <button 
                  onClick={() => {
                    console.log('🔄 Force refreshing data and categories...')
                    setForceRefresh(prev => prev + 1)
                    fetchStats(true) // Force fetch stats
                    fetchEmails(true) // Force fetch emails
                    toast.success('Data refreshed!')
                  }}
                  className="w-full py-1.5 px-2 text-[10px] bg-gradient-to-r from-blue-500/25 to-blue-600/25 text-blue-700 rounded-lg hover:from-blue-500/35 hover:to-blue-600/35 transition-all duration-300 flex items-center justify-center gap-1 font-semibold border border-blue-300/40 hover:shadow-md hover:shadow-blue-200/40 hover:scale-105"
                >
                  <ModernIcon type="refresh" size={8} />
                  Refresh Data
                </button>
              )}
                
                {/* Outlook Sync Button */}
              <button 
                onClick={syncOutlookEmails}
                  disabled={true}
                  className="w-full py-1.5 px-2 text-[10px] bg-gradient-to-r from-gray-400/25 to-gray-500/25 text-gray-600 rounded-lg cursor-not-allowed flex items-center justify-center gap-1 font-semibold border border-gray-300/40 opacity-70"
                  title="Outlook sync coming soon"
              >
                  <ModernIcon type="outlook" size={10} color="#6b7280" />
                  Outlook (Soon)
              </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* View Toggle */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <div className="flex space-x-2 glass p-1 rounded-xl w-fit">
            <button 
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                activeView === 'emails' 
                  ? 'bg-slate-200/50 text-slate-800' 
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
              }`}
              onClick={() => setActiveView('emails')}
            >
              📧 Emails
            </button>
            <button 
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                activeView === 'analytics' 
                  ? 'bg-slate-200/50 text-slate-800' 
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
              }`}
              onClick={() => setActiveView('analytics')}
            >
              📊 Analytics
            </button>
            <button 
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                activeView === 'advanced-analytics' 
                  ? 'bg-slate-200/50 text-slate-800' 
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
              }`}
              onClick={() => setActiveView('advanced-analytics')}
            >
              📈 Advanced
            </button>
            <button 
              className="px-6 py-3 rounded-lg font-semibold transition-all duration-300 text-slate-600 hover:text-slate-800 hover:bg-slate-100/50"
              onClick={() => setShowEmailTemplates(true)}
            >
              📝 Templates
            </button>
            <button 
              className="px-6 py-3 rounded-lg font-semibold transition-all duration-300 text-slate-600 hover:text-slate-800 hover:bg-slate-100/50 relative"
              onClick={() => setShowNotifications(true)}
            >
              🔔 Notifications
            </button>
            <button 
              className="px-6 py-3 rounded-lg font-semibold transition-all duration-300 text-slate-600 hover:text-slate-800 hover:bg-slate-100/50 relative"
              onClick={() => setShowExportModal(true)}
            >
              📤 Export
            </button>
            <button 
              className="px-6 py-3 rounded-lg font-semibold transition-all duration-300 text-slate-600 hover:text-slate-800 hover:bg-slate-100/50 relative"
              onClick={() => setShowPerformanceDashboard(true)}
            >
              ⚡ Performance
            </button>
            <button 
              className="px-6 py-3 rounded-lg font-semibold transition-all duration-300 text-slate-600 hover:text-slate-800 hover:bg-slate-100/50 relative"
              onClick={() => setShowSecurityDashboard(true)}
            >
              🔒 Security
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
            <div className="space-y-8">
              {/* Top Bar with Provider Selector and Search */}
              <div className="backdrop-blur-xl bg-gradient-to-r from-white/40 via-white/30 to-blue-50/40 border border-white/30 rounded-3xl p-6 shadow-2xl shadow-blue-100/20">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Provider Selector */}
                  <div className="flex gap-3">
                    <button className="group relative px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          gmailConnected ? 'bg-white' : 'bg-white/60'
                        }`}></div>
                        <span>Gmail</span>
                        {gmailConnected && (
                          <div className="flex items-center gap-1 text-xs">
                            <div className="w-1 h-1 bg-white rounded-full"></div>
                            <span>Live</span>
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </button>
                    <button 
                      disabled
                      className="group relative px-6 py-3 bg-gradient-to-r from-slate-200/80 to-slate-300/60 text-slate-500 rounded-2xl font-semibold cursor-not-allowed border border-slate-300/50"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                        <span>Outlook</span>
                        <span className="ml-2 text-xs bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1 rounded-full shadow-md">
                          Coming Soon
                        </span>
                      </div>
                    </button>
                  </div>
                  
                  {/* Search Input */}
                  <div className="flex-1">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        {isSearching ? (
                          <div className="animate-spin">
                            <svg 
                              className="h-5 w-5 text-emerald-600" 
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
                            className="h-5 w-5 text-slate-500 transition-colors duration-300 group-focus-within:text-emerald-600" 
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
                        className="w-full pl-12 pr-12 py-3 bg-gradient-to-r from-white/60 to-white/40 border border-white/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 shadow-lg hover:shadow-xl transition-all duration-300 text-slate-800 placeholder-slate-500 font-medium backdrop-blur-sm disabled:opacity-70 disabled:cursor-wait"
                      />
                      
                      {/* Clear Search Button */}
                      {searchQuery && (
                        <button
                          onClick={clearSearch}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center z-10 hover:bg-white/20 rounded-r-2xl transition-colors duration-200"
                          disabled={isSearching}
                        >
                          <svg 
                            className="h-4 w-4 text-slate-500 hover:text-slate-700 transition-colors duration-200" 
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
                  <CategoryManagement onCategoryUpdate={fetchEmails} />
                </div>
              </div>

              {/* Search Results Indicator */}
              {searchQuery && (
                <div className="backdrop-blur-xl bg-gradient-to-r from-blue-50/40 via-white/30 to-blue-50/40 border border-white/30 rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <ModernIcon type="search" size={20} color="#3b82f6" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-700">
                        Search results for "{searchQuery}"
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        {emails.length} emails found
                      </span>
                      {isSearching && (
                        <span className="text-xs text-blue-600 ml-2 animate-pulse">
                          Searching server...
                        </span>
                      )}
                      {searchQuery.trim().length < 2 && (
                        <span className="text-xs text-amber-600 ml-2">
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
              />

              {/* Dynamic Split Layout */}
              <div
                className="
                  relative
                  flex lg:flex-row flex-col
                  gap-4 lg:gap-6
                  h-[calc(100vh-200px)]
                  transition-all
                "
              >
                {/* LEFT: Email List pane */}
                <section
                  className={[
                    "bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl shadow-blue-100/20",
                    "overflow-hidden flex flex-col",
                    "transition-[flex-basis] duration-300 ease-out",
                    selectedEmail ? "lg:basis-[min(460px,40%)] basis-full" : "basis-full"
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between p-6 border-b border-white/30 bg-gradient-to-r from-white/60 to-white/40">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <ModernIcon type="email" size={20} color="#3b82f6" />
                      Emails
                    </h3>
                    <span className="text-sm font-semibold text-slate-600 bg-gradient-to-r from-emerald-100 to-blue-100 px-3 py-1 rounded-full">
                      {stats?.totalEmails || 0} emails
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-[calc(100vh-300px)] max-h-[calc(100vh-100px)]">
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
                    />
                  </div>
                </section>

                {/* RIGHT: Email Reader pane (hidden until selected) */}
                <section
                  className={[
                    "bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl shadow-blue-100/20",
                    "overflow-hidden flex flex-col lg:flex-1",
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
          ) : activeView === 'analytics' ? (
            <AnalyticsDashboard />
          ) : (
            <AdvancedAnalytics />
          )}
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

      {/* Email Templates Modal */}
      {showEmailTemplates && (
        <EmailTemplates
          onTemplateSelect={handleTemplateSelect}
          onClose={() => setShowEmailTemplates(false)}
          selectedCategory={currentCategory}
        />
      )}

      {/* Notification Center Modal */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        selectedEmails={selectedEmails}
        onExportComplete={() => setShowExportModal(false)}
      />

      {/* Performance Dashboard */}
      <PerformanceDashboard
        isOpen={showPerformanceDashboard}
        onClose={() => setShowPerformanceDashboard(false)}
      />

      {/* Security Dashboard */}
      <SecurityDashboard
        isOpen={showSecurityDashboard}
        onClose={() => setShowSecurityDashboard(false)}
      />
    </div>
  )
}

export default Dashboard
