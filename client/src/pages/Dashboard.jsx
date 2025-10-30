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
import ReclassificationProgress from '../components/ReclassificationProgress'
import DeleteConfirmationModal from '../components/DeleteConfirmationModal'
import { api } from '../services/api'
import emailService from '../services/emailService'
import ModernIcon from '../components/ModernIcon'

const Dashboard = () => {
  const { user, token, connectGmailAccount, updateTokenFromOAuth } = useAuth()
  const { isConnected, connectionStatus, subscribeToEvents, lastMessage } = useWebSocketContext()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Initialize activeView from URL params, default to 'emails'
  const [activeView, setActiveView] = useState(() => {
    const viewParam = searchParams.get('view')
    return viewParam && ['emails', 'analytics', 'notifications'].includes(viewParam) ? viewParam : 'emails'
  })
  const [syncLoading, setSyncLoading] = useState(false)
  const [fullSyncLoading, setFullSyncLoading] = useState(false)
  const [reclassifyLoading, setReclassifyLoading] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [stats, setStats] = useState({
    totalEmails: 0,
    categories: 0,
    processedToday: 0,
    unreadCount: 0,
    starredCount: 0,
    draftCount: 0
  })

  // Additional state for sync status and real-time data
  const [syncStatus, setSyncStatus] = useState({
    isActive: false,
    progress: 0,
    status: 'idle',
    lastSync: null
  })

  // State for percentage changes (can be calculated from historical data later)
  const [percentageChange, setPercentageChange] = useState({
    totalEmails: 0,
    processedToday: 0
  })
  
  // Force refresh state
  const [forceRefresh, setForceRefresh] = useState(0)

  // Ensure stats is never undefined
  const safeStats = stats || {
    totalEmails: 0,
    categories: 0,
    processedToday: 0,
    unreadCount: 0,
    starredCount: 0,
    draftCount: 0
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
  
  // Reclassification progress state
  const [reclassificationJobs, setReclassificationJobs] = useState([])
  const [showReclassificationProgress, setShowReclassificationProgress] = useState(false)
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [emailToDelete, setEmailToDelete] = useState(null)
  
  // Rate limiting for API calls
  const [lastApiCall, setLastApiCall] = useState(0)
  const [statsLoading, setStatsLoading] = useState(false)
  const API_CALL_THROTTLE = 1000 // 1 second throttle - balanced for performance and UX

  // Email fetching function
  const fetchEmails = useCallback(async (skipThrottle = false, categoryOverride = null) => {
    const now = Date.now()
    if (!skipThrottle && now - lastApiCall < API_CALL_THROTTLE) {
      console.log('⏳ Throttling API call...')
      return
    }
    
    try {
      // Only show loading spinner if we don't have emails yet (initial load)
      // For search/filter/pagination, keep existing emails visible
      if (emails.length === 0) {
        setEmailsLoading(true)
      }
      setLastApiCall(now)
      
      // Use the category override if provided, otherwise use current category
      const categoryToUse = categoryOverride !== null ? categoryOverride : currentCategory
      
      console.log('📧 Fetching emails...', { currentPage, currentCategory, categoryToUse, searchQuery })
      
      // OPTIMIZED: Use consistent smaller page sizes for faster loading
      // Search is handled by backend efficiently, no need for large limits
      const limit = 50 // Consistent limit for fast loading
      
      console.log('📧 API call parameters:', { 
        page: currentPage,
        category: categoryToUse, 
        q: searchQuery,
        limit
      })
      
      const response = await emailService.getEmails({
        page: currentPage,
        category: categoryToUse,
        q: searchQuery,
        limit
      })
      
      console.log('📧 Email API response:', response)
      console.log('📧 Response items:', response.items)
      console.log('📧 Response total:', response.total)
      
      if (response.success) {
        const emailItems = response.items || []
        
        // For "All" category, show all emails returned by server
        // For specific categories, server already filtered but ensure consistency
        const filteredEmailItems = emailItems.filter(email => {
          if (!email.category) return true // Keep emails without category
          // If showing "All", show all emails regardless of category
          if (categoryToUse === 'All') {
            return true
          } else {
            // Server should already filter, but double-check for consistency
            return email.category === categoryToUse
          }
        })
        
        setEmails(filteredEmailItems)
        
        // Set the category-specific count - use server total for all categories to show accurate counts
        const countToShow = response.total || 0
        setCurrentCategoryCount(countToShow)
        
        // Store all emails for quick restore when clearing search
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

  // Fetch sync status function
  const fetchSyncStatus = useCallback(async () => {
    if (!token || !gmailConnected) return
    
    try {
      const response = await api.get('/realtime/status')
      if (response.data.success) {
        setSyncStatus({
          isActive: response.data.syncStatus?.isActive || false,
          progress: response.data.syncStatus?.progress || 0,
          status: response.data.syncStatus?.status || 'idle',
          lastSync: response.data.syncStatus?.lastSync || null
        })
      }
    } catch (error) {
      console.error('❌ Error fetching sync status:', error)
    }
  }, [token, gmailConnected])

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
            categories: 0,
            processedToday: 0,
            unreadCount: 0,
            starredCount: 0,
            draftCount: 0,
            lastSyncTime: null
          })
        }
      }
      
      // Also fetch sync status
      await fetchSyncStatus()
    } catch (error) {
      console.error('❌ Error fetching stats:', error)
      // Set fallback stats on error if no data available
      if (!stats || Object.keys(stats).length === 0) {
        console.log('📊 Setting fallback stats on error as no data available')
        setStats({
          totalEmails: 0,
          categories: 0,
          processedToday: 0,
          unreadCount: 0,
          starredCount: 0,
          draftCount: 0,
          lastSyncTime: null
        })
      }
    } finally {
      setStatsLoading(false)
    }
  }, [lastApiCall, API_CALL_THROTTLE, token, gmailConnected, stats, statsLoading, fetchSyncStatus])

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

  // Periodic connection status check and stats refresh - More frequent for real-time data
  useEffect(() => {
    if (!token) return
    
    // Fast refresh for critical stats and sync status
    const fastInterval = setInterval(() => {
      if (gmailConnected) {
        console.log('🔄 Fast refresh for real-time data...')
        fetchStats(true)
        fetchSyncStatus()
      }
    }, 10000) // Every 10 seconds for real-time updates
    
    // Slower refresh for connection status
    const slowInterval = setInterval(() => {
      checkConnectionStatus()
      console.log('🔄 Connection status check...')
    }, 30000) // Every 30 seconds for connection status
    
    return () => {
      clearInterval(fastInterval)
      clearInterval(slowInterval)
    }
  }, [token, gmailConnected, fetchStats, fetchSyncStatus])

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
        categories: 0,
        processedToday: 0,
        unreadCount: 0,
        starredCount: 0,
        draftCount: 0
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
            limit: 50 // OPTIMIZED: Consistent limit for fast loading
          })
          
          console.log('📧 Email API response:', response)
          
          if (response && response.success) {
            const emailItems = response.items || []
            setEmails(emailItems)
            
            // Store all emails for quick restore when clearing search
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
            categories: 0,
            processedToday: 0,
            unreadCount: 0,
            starredCount: 0,
            draftCount: 0
          })
        }
      } catch (error) {
        console.error('❌ Error fetching stats:', error)
        setStats({
          totalEmails: 0,
          categories: 0,
          processedToday: 0,
          unreadCount: 0,
          starredCount: 0,
          draftCount: 0
        })
      }
    }
    
    // Load data immediately
    loadData()
    
    // Remove periodic check to prevent infinite loops
  }, [gmailConnected]) // Run when Gmail connection status changes

  // Load data when pagination changes (search is handled separately)
  useEffect(() => {
    if (!token || !gmailConnected) return
    
    // Only handle pagination changes here, not search
    // Search is handled by the dedicated search effect
    if (searchQuery.trim().length === 0) {
      console.log('🔄 Page changed, loading data...', { currentPage })
      // No search query - instant pagination
      fetchEmails(true) // skipThrottle = true for instant pagination
    }
  }, [currentPage, token, gmailConnected])

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

  // Update URL when activeView changes (for persistence across refreshes)
  useEffect(() => {
    const currentView = searchParams.get('view')
    if (currentView !== activeView) {
      setSearchParams({ view: activeView }, { replace: true })
    }
  }, [activeView])
  
  // Check URL parameters for tab navigation (legacy support)
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'notifications') {
      setActiveView('notifications')
      // Update to use view param instead
      setSearchParams({ view: 'notifications' }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // WebSocket event handlers
  const handleEmailSync = (emailData) => {
    console.log('📧 Real-time email sync:', emailData)
    // Refresh emails list
    fetchEmails()
    // Update stats
    fetchStats()
    fetchSyncStatus()
  }

  const handleCategoryUpdate = (categoryData) => {
    console.log('🏷️ Real-time category update:', categoryData)
    // Refresh categories, emails, and stats when categories change
    fetchEmails(true)
    fetchStats(true)
    fetchSyncStatus()
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
        subscribeToEvents(['email_synced', 'category_updated', 'sync_status', 'stats_updated', 'realtime_update', 'email_archived', 'email_unarchived', 'reclassification_started', 'reclassification_progress', 'reclassification_complete', 'reclassification_failed'])
      }, 100)
      
      return () => clearTimeout(timeoutId)
    } else {
      console.log('🔌 WebSocket not connected, will subscribe when connected')
    }
  }, [isConnected, subscribeToEvents])

  // Handle all WebSocket real-time updates
  useEffect(() => {
    if (!lastMessage) return
    
    console.log('📡 WebSocket message received:', lastMessage)
    
    switch (lastMessage.type) {
      case 'category_updated':
        console.log('🏷️ Dashboard received category update:', lastMessage.data)
        handleCategoryUpdate(lastMessage.data)
        break
        
      case 'email_synced':
        console.log('📧 Dashboard received email sync update:', lastMessage.data)
        handleEmailSync(lastMessage.data)
        break
        
      case 'sync_status':
        console.log('🔄 Dashboard received sync status update:', lastMessage.data)
        handleSyncStatus(lastMessage.data)
        // Update sync status immediately
        setSyncStatus(prev => ({
          ...prev,
          isActive: lastMessage.data?.isActive || false,
          progress: lastMessage.data?.progress || 0,
          status: lastMessage.data?.status || 'idle'
        }))
        break
        
      case 'stats_updated':
        console.log('📊 Dashboard received stats update:', lastMessage.data)
        // Force refresh stats when we get a stats update
        fetchStats(true)
        break
        
      case 'reclassification_started':
        console.log('🔄 Dashboard received reclassification start:', lastMessage.data)
        toast.success(`Started reclassifying emails for category: ${lastMessage.data?.categoryName || 'All Emails'}`, {
          duration: 5000
        })
        break
        
      case 'reclassification_progress':
        console.log('🔄 Dashboard received reclassification progress:', lastMessage.data)
        
        // Update reclassification jobs state
        setReclassificationJobs(prevJobs => {
          const existingIndex = prevJobs.findIndex(job => job.jobId === lastMessage.data.jobId)
          if (existingIndex !== -1) {
            // Update existing job
            const updatedJobs = [...prevJobs]
            updatedJobs[existingIndex] = { ...updatedJobs[existingIndex], ...lastMessage.data }
            return updatedJobs
          } else {
            // Add new job
            setShowReclassificationProgress(true)
            return [...prevJobs, lastMessage.data]
          }
        })
        
        // Show progress toast for major milestones
        if (lastMessage.data?.progress % 25 === 0) {
          toast.loading(
            `Reclassifying: ${lastMessage.data?.progress}% (${lastMessage.data?.processedEmails}/${lastMessage.data?.totalEmails} emails)`, 
            { id: 'reclassification_progress', duration: 10000 }
          )
        }
        break
        
      case 'reclassification_complete':
        console.log('✅ Dashboard received reclassification complete:', lastMessage.data)
        toast.dismiss('reclassification_progress')
        toast.success(`Reclassification completed! ${lastMessage.data?.successfulClassifications}/${lastMessage.data?.totalEmails} emails updated.`, {
          duration: 6000
        })
        // Refresh emails and stats after reclassification
        fetchEmails(true)
        fetchStats(true)
        break
        
      case 'reclassification_failed':
        console.log('❌ Dashboard received reclassification failed:', lastMessage.data)
        toast.dismiss('reclassification_progress')
        toast.error(`Reclassification failed: ${lastMessage.data?.error || 'Unknown error'}`, {
          duration: 8000
        })
        break
        
      case 'email_archived':
        console.log('📦 Dashboard received email archived:', lastMessage.data)
        // Mark email as archived but keep it visible in the list
        setEmails(prevEmails => prevEmails.map(email => 
          email._id === lastMessage.data?.emailId
            ? { ...email, isArchived: true, archivedAt: new Date() }
            : email
        ))
        // Update selected email if this email was open
        if (selectedEmail && selectedEmail._id === lastMessage.data?.emailId) {
          setSelectedEmail({ ...selectedEmail, isArchived: true, archivedAt: new Date() })
        }
        // Update stats
        fetchStats(true)
        // Show success notification
        toast.success(`Email archived${lastMessage.data?.gmailSynced ? ' and synced with Gmail' : ''}`, {
          duration: 3000
        })
        break
        
      case 'email_unarchived':
        console.log('📥 Dashboard received email unarchived:', lastMessage.data)
        // Mark email as unarchived in the list
        setEmails(prevEmails => prevEmails.map(email => 
          email._id === lastMessage.data?.emailId
            ? { ...email, isArchived: false, archivedAt: null }
            : email
        ))
        // Update selected email if this email was open
        if (selectedEmail && selectedEmail._id === lastMessage.data?.emailId) {
          setSelectedEmail({ ...selectedEmail, isArchived: false, archivedAt: null })
        }
        // Update stats
        fetchStats(true)
        // Show success notification
        toast.success(`Email unarchived${lastMessage.data?.gmailSynced ? ' and synced with Gmail' : ''}`, {
          duration: 3000
        })
        break
        
      case 'realtime_update':
        console.log('⚡ Dashboard received real-time update:', lastMessage.data)
        // Handle general real-time updates - refresh all data
        fetchStats(true)
        fetchSyncStatus()
        if (gmailConnected) {
          fetchEmails(true)
        }
        break
        
      default:
        console.log('📡 Unknown message type:', lastMessage.type)
    }
  }, [lastMessage, handleCategoryUpdate, handleEmailSync, handleSyncStatus, fetchStats, fetchSyncStatus, fetchEmails, gmailConnected, selectedEmailId, selectedEmail])

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

  // Real-time updates when user returns to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && gmailConnected && token) {
        console.log('👁️ Tab became visible - refreshing real-time data...')
        // Refresh all data when user returns to tab
        fetchStats(true)
        fetchSyncStatus()
        fetchEmails(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [gmailConnected, token, fetchStats, fetchSyncStatus, fetchEmails])

  // Load emails function (removed duplicate - using fetchEmails instead)

  // Load email details
  const loadEmailDetails = async (emailId) => {
    if (!emailId) return
    
    // First, check if this is a thread container from the current emails list
    const emailItem = emails.find(e => e._id === emailId)
    
    if (emailItem && emailItem.isThread) {
      // It's a thread container, just pass it directly to EmailReader
      // EmailReader will handle fetching all thread messages
      setSelectedEmail(emailItem)
      
      // Mark all messages in the thread as read
      if (emailItem.messageIds && emailItem.messageIds.length > 0 && !emailItem.isRead) {
        try {
          await emailService.markAsRead(emailItem.messageIds)
          // Update UI to mark thread as read
          setEmails(prevEmails => 
            prevEmails.map(e => 
              e._id === emailId ? { ...e, isRead: true } : e
            )
          )
          setSelectedEmail(prev => ({ ...prev, isRead: true }))
        } catch (error) {
          console.error('Failed to mark thread as read:', error)
        }
      }
      return
    }
    
    // For regular emails, fetch full details
    setEmailDetailLoading(true)
    try {
      const response = await emailService.detail(emailId)
      if (response.success) {
        setSelectedEmail(response.email)
        
        // Mark as read if it's unread
        if (!response.email.isRead) {
          try {
            await emailService.markAsRead(emailId)
            // Update UI to mark email as read
            setEmails(prevEmails => 
              prevEmails.map(e => 
                e._id === emailId ? { ...e, isRead: true } : e
              )
            )
            setSelectedEmail(prev => ({ ...prev, isRead: true }))
          } catch (error) {
            console.error('Failed to mark email as read:', error)
          }
        }
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
    } else {
      setSelectedEmail(null)
    }
  }, [selectedEmailId, emails])

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
        await fetchSyncStatus()
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
        // Show different messages based on whether new emails were found
        if (data.newEmailCount > 0) {
          toast.success(`🎉 Found ${data.newEmailCount} new email${data.newEmailCount > 1 ? 's' : ''}!`, {
            duration: 4000
          })
        } else if (data.checkedCount > 0) {
          toast(`✅ No new emails (checked ${data.checkedCount} recent emails)`, {
            duration: 3000,
            icon: 'ℹ️'
          })
        } else {
          toast('✅ Your inbox is up to date', {
            duration: 3000,
            icon: 'ℹ️'
          })
        }
        
        // Refresh data
        await checkConnectionStatus()
        await fetchStats() // Use optimized fetchStats
        await fetchSyncStatus() // Update sync status
        
        // Only refresh emails if new ones were synced
        if (data.newEmailCount > 0) {
          await fetchEmails(true) // Force refresh to show new emails
        }
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

  // Full Gmail sync (fetch ALL historical emails)
  const handleFullSync = async () => {
    if (!token || !gmailConnected) {
      toast.error('Please connect Gmail first')
      return
    }

    setFullSyncLoading(true)
    try {
      console.log('🚀 Starting FULL Gmail sync...')
      const response = await api.post('/emails/gmail/full-sync')
      
      if (response.data.success) {
        toast.success('📥 Full sync started! Fetching all 6,000+ emails from Gmail. This will take 15-30 minutes.', {
          duration: 6000
        })
        
        // Poll for updates every 10 seconds
        const pollInterval = setInterval(async () => {
          await fetchStats(true)
          await fetchEmails(true)
        }, 10000)
        
        // Clear after 30 minutes
        setTimeout(() => clearInterval(pollInterval), 1800000)
      }
    } catch (error) {
      console.error('❌ Full sync error:', error)
      toast.error(error?.response?.data?.message || 'Failed to start full sync')
    } finally {
      setFullSyncLoading(false)
    }
  }

  // Reclassify all emails with trained model
  const handleReclassifyAll = async () => {
    if (!token) {
      toast.error('Please login first')
      return
    }

    setReclassifyLoading(true)
    try {
      console.log('🔄 Starting reclassification...')
      const response = await api.post('/emails/reclassify-all')
      
      if (response.data.success) {
        toast.success('🤖 Reclassification started! Using trained model to classify all emails. This will take 10-20 minutes.', {
          duration: 6000
        })
        
        // Poll for updates every 10 seconds
        const pollInterval = setInterval(async () => {
          await fetchStats(true)
          await fetchEmails(true)
          setCategoryTabsRefresh(prev => prev + 1) // Refresh category tabs
        }, 10000)
        
        // Clear after 25 minutes
        setTimeout(() => clearInterval(pollInterval), 1500000)
      }
    } catch (error) {
      console.error('❌ Reclassification error:', error)
      toast.error(error?.response?.data?.message || 'Failed to start reclassification')
    } finally {
      setReclassifyLoading(false)
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
      // loadEmailDetails will be called by the useEffect that watches selectedEmailId
    }
  }

  const handleEmailClose = () => {
    setSelectedEmailId(null)
    setSelectedEmail(null)
  }

  const handleEmailArchive = async (emailId) => {
    // Check if this is a thread container
    const emailItem = emails.find(e => e._id === emailId)
    const isThreadContainer = emailItem && emailItem.isThread && emailItem.messageIds
    
    // Optimistic UI update: immediately mark email as archived
    const previousEmails = [...emails]
    
    // Immediately update UI - mark as archived but keep visible
    setEmails(prevEmails => prevEmails.map(email => 
      email._id === emailId 
        ? { ...email, isArchived: true, archivedAt: new Date() }
        : email
    ))
    
    // Update selected email if this email is open
    if (selectedEmail && selectedEmail._id === emailId) {
      setSelectedEmail({ ...selectedEmail, isArchived: true, archivedAt: new Date() })
    }
    
    try {
      if (isThreadContainer) {
        // Archive all emails in the thread using bulk operation
        const response = await emailService.bulkArchive(emailItem.messageIds)
        
        if (response.success) {
          toast.success(
            `📦 Thread archived (${emailItem.messageCount} messages)`,
            { duration: 3000 }
          )
          
          // Refresh stats to reflect the change
          fetchStats(true)
        } else {
          // Revert on failure
          setEmails(previousEmails)
          if (selectedEmail && selectedEmail._id === emailId) {
            setSelectedEmail(previousEmails.find(e => e._id === emailId) || null)
          }
          toast.error(response.message || 'Failed to archive thread')
        }
      } else {
        // Single email archive
        const response = await emailService.archive(emailId)
        
        if (response.success) {
          toast.success(
            response.gmailSynced 
              ? '📦 Email archived and synced with Gmail' 
              : '📦 Email archived locally',
            { duration: 3000 }
          )
          
          // Refresh stats to reflect the change
          fetchStats(true)
        } else {
          // Revert on failure
          setEmails(previousEmails)
          if (selectedEmail && selectedEmail._id === emailId) {
            setSelectedEmail(previousEmails.find(e => e._id === emailId) || null)
          }
          toast.error(response.message || 'Failed to archive email')
        }
      }
    } catch (error) {
      // Revert optimistic update on error
      console.error('Archive error:', error)
      setEmails(previousEmails)
      if (selectedEmail && selectedEmail._id === emailId) {
        setSelectedEmail(previousEmails.find(e => e._id === emailId) || null)
      }
      toast.error(error?.response?.data?.message || 'Failed to archive email')
    }
  }

  const handleEmailUnarchive = async (emailId) => {
    // Check if this is a thread container
    const emailItem = emails.find(e => e._id === emailId)
    const isThreadContainer = emailItem && emailItem.isThread && emailItem.messageIds
    
    // Optimistic UI update: immediately mark email as unarchived
    const previousEmails = [...emails]
    
    // Immediately update UI - mark as unarchived
    setEmails(prevEmails => prevEmails.map(email => 
      email._id === emailId 
        ? { ...email, isArchived: false, archivedAt: null }
        : email
    ))
    
    // Update selected email if this email is open
    if (selectedEmail && selectedEmail._id === emailId) {
      setSelectedEmail({ ...selectedEmail, isArchived: false, archivedAt: null })
    }
    
    try {
      if (isThreadContainer) {
        // Unarchive all emails in thread - we need to call unarchive for each
        // Since there's no bulk unarchive, we'll do them sequentially
        const loadingToast = toast.loading(`Unarchiving ${emailItem.messageCount} messages...`)
        
        for (const msgId of emailItem.messageIds) {
          await emailService.unarchive(msgId)
        }
        
        toast.dismiss(loadingToast)
        toast.success(
          `📥 Thread unarchived (${emailItem.messageCount} messages)`,
          { duration: 3000 }
        )
        
        // Refresh stats to reflect the change
        fetchStats(true)
      } else {
        // Single email unarchive
        const response = await emailService.unarchive(emailId)
        
        if (response.success) {
          toast.success(
            response.gmailSynced 
              ? '📥 Email unarchived and synced with Gmail' 
              : '📥 Email unarchived locally',
            { duration: 3000 }
          )
          
          // Refresh stats to reflect the change
          fetchStats(true)
        } else {
          // Revert on failure
          setEmails(previousEmails)
          if (selectedEmail && selectedEmail._id === emailId) {
            setSelectedEmail(previousEmails.find(e => e._id === emailId) || null)
          }
          toast.error(response.message || 'Failed to unarchive email')
        }
      }
    } catch (error) {
      // Revert optimistic update on error
      console.error('Unarchive error:', error)
      setEmails(previousEmails)
      if (selectedEmail && selectedEmail._id === emailId) {
        setSelectedEmail(previousEmails.find(e => e._id === emailId) || null)
      }
      toast.error(error?.response?.data?.message || 'Failed to unarchive email')
    }
  }

  const handleEmailDelete = async (emailId) => {
    // Check if this is a thread container
    const emailItem = emails.find(e => e._id === emailId)
    
    // Show the delete confirmation modal
    setEmailToDelete(emailItem)
    setShowDeleteModal(true)
  }
  
  const confirmEmailDelete = async (deleteFromGmail) => {
    if (!emailToDelete) return
    
    try {
      const isThreadContainer = emailToDelete.isThread && emailToDelete.messageIds
      
      if (isThreadContainer) {
        // Delete all emails in the thread using bulk operation
        await emailService.bulkDelete(emailToDelete.messageIds, deleteFromGmail)
        toast.success(`Thread deleted (${emailToDelete.messageCount} messages)${deleteFromGmail ? ' from Gmail too' : ''}`)
      } else {
        // Single email delete
        await emailService.remove(emailToDelete._id, deleteFromGmail)
        toast.success(`Email deleted${deleteFromGmail ? ' from Gmail too' : ''}`)
      }
      
      // Close modal and cleanup
      setShowDeleteModal(false)
      setEmailToDelete(null)
      
      // Refresh list
      fetchEmails()
      if (selectedEmailId === emailToDelete._id) {
        setSelectedEmailId(null)
        setSelectedEmail(null)
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete email')
      setShowDeleteModal(false)
      setEmailToDelete(null)
    }
  }

  const handleEmailExport = async (emailId) => {
    try {
      // Check if this is a thread container
      const emailItem = emails.find(e => e._id === emailId)
      const isThreadContainer = emailItem && emailItem.isThread && emailItem.messageIds
      
      if (isThreadContainer) {
        // Export all emails in the thread using bulk operation
        await emailService.bulkExport(emailItem.messageIds)
        toast.success(`Thread exported (${emailItem.messageCount} messages)`)
      } else {
        // Single email export
        await emailService.export(emailId)
        toast.success('Email exported')
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export email')
    }
  }

  const handleEmailReplySuccess = (sentEmailData, threadContainerId) => {
    if (!sentEmailData) {
      console.log('No sent email data, skipping email list update')
      return
    }
    
    console.log('📧 Updating email list after reply:', {
      threadContainerId,
      sentEmail: sentEmailData._id,
      snippet: sentEmailData.snippet
    })
    
    setEmails(prevEmails => {
      // Find and update the thread container or email
      const updatedEmails = prevEmails.map(email => {
        if (email._id === threadContainerId) {
          // Check if this was a single email that now becomes a thread
          const wasSingleEmail = !email.isThread
          
          if (wasSingleEmail) {
            // Convert single email to 2-message thread
            // Keep the original email._id (MongoDB ObjectId)
            // Backend will now handle fetching thread by email ID + threadId
            console.log('Converting single email to thread')
            return {
              ...email,
              isThread: true,
              messageCount: 2,
              messageIds: [email._id, sentEmailData._id],
              snippet: sentEmailData.body || sentEmailData.snippet || sentEmailData.text,
              latestDate: sentEmailData.date,
              date: sentEmailData.date,
              isRead: true
            }
          } else {
            // Update existing thread
            console.log('Updating existing thread')
            const existingIds = email.messageIds || []
            return {
              ...email,
              snippet: sentEmailData.body || sentEmailData.snippet || sentEmailData.text,
              latestDate: sentEmailData.date,
              date: sentEmailData.date,
              messageCount: email.messageCount + 1,
              messageIds: [...existingIds, sentEmailData._id],
              isRead: true
            }
          }
        }
        return email
      })
      
      // Sort by latest date (newest first) to move replied thread to top
      return updatedEmails.sort((a, b) => {
        const dateA = new Date(a.latestDate || a.date)
        const dateB = new Date(b.latestDate || b.date)
        return dateB - dateA
      })
    })
    
    // Also update the selected email if it's the same
    if (selectedEmail && selectedEmail._id === threadContainerId) {
      setSelectedEmail(prev => ({
        ...prev,
        snippet: sentEmailData.body || sentEmailData.snippet || sentEmailData.text,
        latestDate: sentEmailData.date,
        messageCount: prev.isThread ? prev.messageCount + 1 : 2,
        isThread: true,
        messageIds: prev.messageIds || [prev._id, sentEmailData._id]
      }))
    }
    
    console.log('✅ Email list updated after reply')
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
    // Allow any text length - no restrictions
    setSearchQuery(query)
    setCurrentPage(1) // Reset to first page
    // Clear selected email when searching
    setSelectedEmailId(null)
    setSelectedEmail(null)
    
    const trimmedQuery = query.trim()
    
    if (trimmedQuery) {
      // Set searching state immediately for instant feedback
      setIsSearching(true)
      console.log(`🔍 Search initiated: "${trimmedQuery}"`)
      // Don't clear emails here - keep showing current results until new ones load
    } else {
      // If no search query, restore all emails immediately
      setEmails(allEmails)
      setIsSearching(false)
    }
  }
  
  // Optimized server search effect - single debounced search
  useEffect(() => {
    if (!token || !gmailConnected) return
    
    const trimmedQuery = searchQuery.trim()
    
    if (trimmedQuery) {
      // Fast debounce for instant search feeling
      const timeoutId = setTimeout(() => {
        console.log(`🔍 Server search: "${trimmedQuery}"`)
        fetchEmails(true).finally(() => {
          setIsSearching(false)
        })
      }, 200) // 200ms debounce - faster for better UX
      
      return () => {
        clearTimeout(timeoutId)
      }
    } else {
      setIsSearching(false)
    }
  }, [searchQuery, token, gmailConnected, fetchEmails])

  const clearSearch = () => {
    setSearchQuery('')
    setCurrentPage(1)
    setSelectedEmailId(null)
    setSelectedEmail(null)
    setIsSearching(false)
    // Restore all emails when clearing search
    setEmails(allEmails)
  }

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
                <h3 className="text-xl font-bold text-slate-800">{stats?.unreadCount || 0}</h3>
              </div>

              {/* Starred Card */}
              <div className="bg-orange-400/30 backdrop-blur-xl border border-orange-200/20 rounded-xl p-2 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm text-yellow-500">⭐</span>
                  <span className="text-xs text-slate-600 font-medium">Starred</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800">{stats?.starredCount || 0}</h3>
              </div>

              {/* Draft Card */}
              <div className="bg-gray-400/30 backdrop-blur-xl border border-gray-200/20 rounded-xl p-2 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm text-yellow-400">✏️</span>
                  <span className="text-xs text-slate-600 font-medium">Draft</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800">{stats?.draftCount || 0}</h3>
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
                          <h4 className="text-2xl font-bold text-slate-800">{stats?.totalEmails || 0}</h4>
                          <p className="text-sm text-slate-600">Total</p>
                        </div>
                        <div className="text-center">
                          <h4 className="text-2xl font-bold text-slate-800">{stats?.categories || 0}</h4>
                          <p className="text-sm text-slate-600">Categories</p>
                        </div>
                        <div className="text-center">
                          <h4 className="text-2xl font-bold text-slate-800">{stats?.processedToday || 0}</h4>
                          <p className="text-sm text-slate-600">Today</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    {/* Row 1: Primary sync buttons */}
                    <div className="flex gap-2">
                    {gmailConnected ? (
                      <>
                        <button 
                          onClick={syncGmailEmails}
                          disabled={syncLoading || fullSyncLoading}
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
                              Sync New
                            </>
                          )}
                        </button>
                        <button 
                          onClick={handleFullSync}
                          disabled={syncLoading || fullSyncLoading}
                          className="flex-1 bg-purple-500 text-white py-2 rounded-lg font-semibold hover:bg-purple-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {fullSyncLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              Full Syncing...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              Full Sync (All)
                            </>
                          )}
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

                    {/* Row 2: Reclassify and Disconnect buttons */}
                    {gmailConnected && (
                      <div className="flex gap-2">
                        <button 
                          onClick={handleReclassifyAll}
                          disabled={reclassifyLoading}
                          className="flex-1 bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {reclassifyLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              Reclassifying...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              Reclassify All
                            </>
                          )}
                        </button>
                        <button 
                          onClick={handleGmailDisconnection}
                          disabled={disconnecting}
                          className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                          {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      </div>
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
                    <span className={`px-2 py-1 text-white text-xs font-medium rounded-full ${
                      syncStatus.isActive ? 'bg-green-500' : 
                      syncStatus.status === 'idle' ? 'bg-gray-500' : 'bg-blue-500'
                    }`}>
                      {syncStatus.isActive ? 'Active' : 
                       syncStatus.status === 'idle' ? 'Idle' : syncStatus.status || 'Checking...'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    {syncStatus.isActive ? 'Syncing in real-time' : 
                     syncStatus.status === 'idle' ? 'Ready to sync' : 
                     'All systems operational'}
                  </p>
                  
                  {/* Progress Box */}
                  <div className="bg-white/80 border border-white/50 rounded-xl p-3 mb-3 text-center">
                    <h4 className="text-3xl font-bold text-slate-800">
                      {syncStatus.progress || 0}%
                    </h4>
                    <p className="text-xs text-slate-600">Progress</p>
                  </div>

                  {/* Check Status Button */}
                  <button 
                    onClick={() => {
                      fetchStats(true)
                      fetchSyncStatus()
                    }}
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
              <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded-full ${
                percentageChange.totalEmails >= 0 
                  ? 'bg-green-200/60 text-green-700' 
                  : 'bg-red-200/60 text-red-700'
              }`}>
                {percentageChange.totalEmails >= 0 ? '+' : ''}{percentageChange.totalEmails}%
              </span>
              <p className="text-[7px] text-slate-500 text-right mt-0.5">vs last week</p>
            </div>
            <div className="p-1.5 bg-blue-200/60 rounded-lg inline-block mb-2">
              <ModernIcon type="email" size={16} color="#3b82f6" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-1">{(stats?.totalEmails || 0).toLocaleString()}</h3>
            <p className="text-xs text-slate-600 font-medium">Total Emails</p>
          </div>

          {/* Categories Card */}
          <CategoriesCard categories={stats?.categories || 0} />

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
              <div className="text-[#333333] font-bold text-3xl">{(stats?.processedToday || 0).toLocaleString()}</div>
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
                  fetchSyncStatus()
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
              className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-1 ${
                activeView === 'notifications' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
              onClick={() => setActiveView('notifications')}
            >
              <svg className={`w-2 h-2 ${activeView === 'notifications' ? 'text-white' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            <div className="w-0.5 h-0.5 bg-white rounded-full animate-pulse"></div>
                            <span>Live</span>
                          </div>
                        )}
                      </div>
                       <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </button>
                  </div>
                  
                  {/* Search Input */}
                  <div className="flex-1 min-w-0">
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
                        placeholder="Search emails by subject, sender, or content..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        autoComplete="off"
                        spellCheck="false"
                        className="w-full min-w-0 pl-10 pr-10 py-2 bg-gradient-to-r from-white/60 to-white/40 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 shadow-lg hover:shadow-xl transition-all duration-300 text-slate-800 placeholder-slate-500 font-medium backdrop-blur-sm overflow-hidden text-ellipsis"
                        style={{ maxWidth: '100%' }}
                      />
                      
                      {/* Clear Search Button */}
                      {searchQuery && (
                        <button
                          onClick={clearSearch}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center z-10 hover:bg-white/20 rounded-r-xl transition-colors duration-200 cursor-pointer"
                          title="Clear search"
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
                    fetchSyncStatus()
                    // Trigger CategoryTabs refresh
                    setCategoryTabsRefresh(prev => prev + 1)
                  }} />
                </div>
              </div>

              {/* Search Results Indicator */}
              {searchQuery && (
                <div className="backdrop-blur-xl bg-gradient-to-r from-blue-50/40 via-white/30 to-blue-50/40 border border-white/30 rounded-xl p-3 shadow-lg relative z-15">
                  <div className="flex items-center gap-2">
                    {isSearching ? (
                      <div className="animate-spin">
                        <ModernIcon type="sync" size={16} color="#3b82f6" />
                      </div>
                    ) : (
                      <ModernIcon type="search" size={16} color="#10b981" />
                    )}
                    <div className="flex-1">
                      <span className="text-xs font-medium text-slate-700">
                        {isSearching ? 'Searching' : 'Search results'} for "{searchQuery}"
                      </span>
                      {!isSearching && (
                        <span className="text-xs text-slate-500 ml-1">
                          - {emails.length} emails found
                        </span>
                      )}
                      {isSearching && (
                        <span className="text-xs text-blue-600 ml-1 animate-pulse">
                          Loading...
                        </span>
                      )}
                    </div>
                    <button
                      onClick={clearSearch}
                      className="text-xs text-slate-600 hover:text-slate-800 underline font-medium"
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
                  <div className="flex-1 overflow-y-auto min-h-[calc(100vh-280px)] max-h-[calc(100vh-80px)] relative">
                     {/* Subtle loading overlay during search - doesn't hide content */}
                     {isSearching && emails.length > 0 && (
                       <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-20 flex items-start justify-center pt-4">
                         <div className="bg-blue-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
                           <div className="animate-spin">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                             </svg>
                           </div>
                           <span className="text-sm font-medium">Searching...</span>
                         </div>
                       </div>
                     )}
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
                       searchQuery={searchQuery}
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
                      threadContainerId={selectedEmailId}
                      onArchive={handleEmailArchive}
                      onUnarchive={handleEmailUnarchive}
                      onDelete={handleEmailDelete}
                      onExport={handleEmailExport}
                      onClose={handleEmailClose}
                      onReplySuccess={handleEmailReplySuccess}
                      loading={emailDetailLoading}
                    />
                  </div>
                </section>
                  </div>
              </div>
            </div>
          ) : activeView === 'analytics' ? (
            <SuperAnalyticsDashboard />
          ) : activeView === 'notifications' ? (
            <NotificationCenter 
              isOpen={true} 
              onClose={() => setActiveView('emails')} 
              onNotificationUpdate={() => window.dispatchEvent(new CustomEvent('notificationUpdated'))}
            />
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

      {/* Reclassification Progress */}
      {reclassificationJobs.map((job, index) => (
        <ReclassificationProgress
          key={job.jobId || index}
          isVisible={showReclassificationProgress && job.status !== 'completed'}
          job={job}
          onClose={() => {
            if (job.status === 'completed' || job.status === 'failed') {
              setReclassificationJobs(prev => prev.filter(j => j.jobId !== job.jobId))
              if (reclassificationJobs.length === 1) {
                setShowReclassificationProgress(false)
              }
            }
          }}
          onViewDetails={() => {
            // Refresh emails to show updated categories
            fetchEmails(true)
            setCategoryTabsRefresh(prev => prev + 1)
          }}
        />
      ))}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setEmailToDelete(null)
        }}
        onConfirm={confirmEmailDelete}
        title={emailToDelete?.isThread ? "Delete Thread" : "Delete Email"}
        message="This action cannot be undone."
        isGmailEmail={gmailConnected}
        isThread={emailToDelete?.isThread && emailToDelete?.messageIds}
        messageCount={emailToDelete?.messageCount || 1}
      />

    </div>
  )
}

export default Dashboard
