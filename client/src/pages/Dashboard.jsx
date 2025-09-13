import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import EmailList from '../components/EmailList'
import EmailReader from '../components/EmailReader'
import CategoryTabs from '../components/CategoryTabs'
import AnalyticsDashboard from '../components/AnalyticsDashboard'
import { api } from '../services/api'
import emailService from '../services/emailService'
import ModernIcon from '../components/ModernIcon'

const Dashboard = () => {
  const { user, token, connectGmailAccount, connectMicrosoftAccount } = useAuth()
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
    categories: 0,
    processedToday: 0
  })

  // New state for email management
  const [emails, setEmails] = useState([])
  const [selectedEmailId, setSelectedEmailId] = useState(null)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [currentCategory, setCurrentCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [emailDetailLoading, setEmailDetailLoading] = useState(false)

  // Handle token from URL parameters (Gmail OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken = urlParams.get('token')
    const connected = urlParams.get('connected')
    
    if (urlToken && connected === '1') {
      // Store token in localStorage and update auth context
      localStorage.setItem('token', urlToken)
      // Set axios default header
      api.defaults.headers.common['Authorization'] = `Bearer ${urlToken}`
      
      // Show success message
      toast.success('Gmail connected successfully!')
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname)
      
      // Reload the page to refresh auth context
      window.location.reload()
    }
  }, [])

  // Check current connection status on component mount
  useEffect(() => {
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
        }
      } catch (error) {
        console.error('Failed to check connection status:', error)
      } finally {
        setLoadingConnections(false)
      }
    }

    const loadStats = async () => {
      if (!token) return
      
    try {
      const response = await api.get('/api/analytics/stats')
      if (response.data.success) {
        setStats(response.data.stats)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

    const loadAll = async () => {
      await Promise.all([checkConnectionStatus(), loadStats()]).catch(() => {})
    }

    if (token) {
      loadAll()
    }
  }, [token])

  // Load emails function
  const loadEmails = async () => {
    if (!token) return
    
    setEmailsLoading(true)
    try {
      const response = await emailService.list({
        page: currentPage,
        category: currentCategory,
        provider: 'gmail',
        q: searchQuery
      })
      
      if (response.success) {
        setEmails(response.items || [])
        setTotalPages(Math.ceil(response.total / 25))
      }
    } catch (error) {
      console.error('Failed to load emails:', error)
      toast.error('Failed to load emails')
    } finally {
      setEmailsLoading(false)
    }
  }

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

  // Load emails when filters change
  useEffect(() => {
    if (token && gmailConnected) {
      loadEmails()
    }
  }, [token, gmailConnected, currentCategory, searchQuery, currentPage])

  // Load email details when selection changes
  useEffect(() => {
    if (selectedEmailId) {
      loadEmailDetails(selectedEmailId)
    }
  }, [selectedEmailId])

  // Realtime updates with exponential backoff
  useEffect(() => {
    if (!token || !gmailConnected) return

    let es, retry = 0, closed = false
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    
    const connect = () => {
      if (closed) return
      const url = `${base}/api/analytics/realtime?token=${encodeURIComponent(token)}`
      es = new EventSource(url)
      
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          retry = 0 // Reset retry on successful message
          
          if (data.type === 'new_email') {
            // Prepend new email to list if it matches current filters
            if (currentCategory === 'All' || data.category === currentCategory) {
              setEmails(prev => [data.email, ...prev])
              setStats(prev => ({
                ...prev,
                totalEmails: prev.totalEmails + 1
              }))
            }
          } else if (data.type === 'analytics_update') {
            // Update analytics
            setStats(data.stats)
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error)
        }
      }

      es.onerror = () => {
        es?.close()
        retry = Math.min(retry + 1, 6)
        setTimeout(connect, 250 * (2 ** retry)) // Exponential backoff
      }
    }
    
    connect()
    
    return () => {
      closed = true
      es?.close()
    }
  }, []) // Empty deps - one connection only

  const handleGmailConnection = async () => {
    setConnectingGmail(true)
    try {
      const response = await api.get('/api/auth/gmail/connect')
      if (response.data.success) {
        // Open Gmail OAuth in new window
        window.open(response.data.authUrl, 'gmail-oauth', 'width=500,height=600,scrollbars=yes,resizable=yes')
        
        // Listen for the OAuth completion with polling
        const pollForConnection = async () => {
          try {
            const userResponse = await api.get('/api/auth/me')
            if (userResponse.data.success && userResponse.data.user.gmailConnected) {
              setGmailConnected(true)
              toast.success('Gmail account connected successfully!')
              return true
            }
          } catch (error) {
            // Connection not ready yet
          }
          return false
        }

        // Poll every 2 seconds for up to 5 minutes
        let pollCount = 0
        const maxPolls = 150 // 5 minutes at 2 second intervals
        
        const poll = async () => {
          if (pollCount >= maxPolls) return
          pollCount++
          
          const connected = await pollForConnection()
          if (!connected && pollCount < maxPolls) {
            setTimeout(poll, 2000)
          }
        }
        
        setTimeout(poll, 2000)
      } else {
        toast.error('Failed to initiate Gmail connection')
      }
    } catch (error) {
      toast.error('Failed to connect Gmail account')
    } finally {
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
        await loadAll()
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
      const { data } = await api.post('/api/emails/gmail/sync-all')
      toast.success(`Synced ${data.synced}/${data.total} • Classified ${data.classified}`)
      await loadAll()
      await loadEmails()
    } catch (error) {
      console.error('Sync error:', error)
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
      loadEmails() // Refresh list
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
      loadEmails() // Refresh list
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
    setCurrentCategory(category)
    setCurrentPage(1) // Reset to first page
    // Clear selected email when changing categories
    setSelectedEmailId(null)
    setSelectedEmail(null)
  }

  const handleSearchChange = (query) => {
    setSearchQuery(query)
    setCurrentPage(1) // Reset to first page
    // Clear selected email when searching
    setSelectedEmailId(null)
    setSelectedEmail(null)
  }

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
            Welcome back, {user?.name || 'User'}! 
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
                    <p className="text-sm text-slate-600">Connect your Gmail account</p>
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
                    <div className="text-sm font-bold text-slate-800">{stats.totalEmails}</div>
                    <div className="text-xs text-slate-600">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-800">{stats.categories}</div>
                    <div className="text-xs text-slate-600">Categories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-800">{stats.processedToday}</div>
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
                      className="flex-1 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg rounded-xl px-4 py-2 font-medium hover:from-emerald-500 hover:to-emerald-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {syncLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Syncing...
                        </>
                      ) : (
                        <>
                          <ModernIcon type="sync" size={16} />
                          Sync Now
                        </>
                      )}
                    </button>
                    <button 
                      onClick={handleGmailDisconnection}
                      className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-xl px-4 py-2 font-medium transition-all duration-300"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
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
              <h3 className="text-lg font-bold text-slate-800 mb-0.5">{stats.totalEmails?.toLocaleString() || 0}</h3>
              <p className="text-xs text-slate-600 font-medium">Total Emails</p>
              <div className="mt-1.5 h-0.5 bg-blue-100/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min((stats.totalEmails || 0) / 10000 * 100, 100)}%` }}
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
              <h3 className="text-lg font-bold text-slate-800 mb-0.5">{stats.categories || 5}</h3>
              <p className="text-xs text-slate-600 font-medium">Categories</p>
              <div className="mt-1.5 flex gap-0.5">
                {['Academic', 'Promotions', 'Placement', 'Spam', 'Other'].slice(0, stats.categories || 5).map((cat, i) => {
                  // Calculate actual percentage based on email distribution (simulate real data)
                  const categoryDistribution = {
                    'Academic': 35,
                    'Promotions': 25, 
                    'Placement': 15,
                    'Spam': 10,
                    'Other': 15
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
              <h3 className="text-lg font-bold text-slate-800 mb-0.5">{stats.processedToday || 0}</h3>
              <p className="text-xs text-slate-600 font-medium">Processed Today</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="flex-1 h-0.5 bg-amber-100/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((stats.processedToday || 0) / 100 * 100, 100)}%` }}
                  ></div>
                </div>
                <div className={`w-1.5 h-1.5 rounded-full ${(stats.processedToday || 0) > 0 ? 'bg-amber-400 animate-pulse' : 'bg-amber-200'}`}></div>
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
              <div className="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Provider Selector */}
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium shadow-lg">
                      Gmail
                    </button>
                    <button 
                      disabled
                      className="px-4 py-2 bg-slate-200/60 text-slate-400 rounded-lg font-medium cursor-not-allowed"
                    >
                      Outlook
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        Coming Soon
                      </span>
                    </button>
                  </div>
                  
                  {/* Search Input */}
                  <div className="flex-1">
                    <div className="relative">
                      <ModernIcon 
                        type="search" 
                        size={20} 
                        color="#6b7280" 
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5"
                      />
                      <input
                        type="text"
                        placeholder="Search emails..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white/40 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                </div>
              </div>

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
                    "bg-white/40 backdrop-blur-xl border border-white/20 rounded-2xl shadow",
                    "overflow-hidden flex flex-col",
                    "transition-[flex-basis] duration-300 ease-out",
                    selectedEmail ? "lg:basis-[min(460px,40%)] basis-full" : "basis-full"
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between p-4 border-b border-white/20">
                    <h3 className="text-lg font-semibold text-slate-800">Emails</h3>
                    <span className="text-sm text-slate-600">
                      {stats.totalEmails} emails
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <EmailList
                      items={emails}
                      selectedId={selectedEmailId}
                      onSelect={handleEmailSelect}
                      loading={emailsLoading}
                      onPageChange={handlePageChange}
                      totalEmails={stats.totalEmails}
                      currentPage={currentPage}
                      totalPages={totalPages}
                    />
                  </div>
                </section>

                {/* RIGHT: Email Reader pane (hidden until selected) */}
                <section
                  className={[
                    "bg-white/40 backdrop-blur-xl border border-white/20 rounded-2xl shadow",
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
          ) : (
            <AnalyticsDashboard />
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard
