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
        
        // Select first email if none selected
        if (response.items && response.items.length > 0 && !selectedEmailId) {
          setSelectedEmailId(response.items[0]._id)
        }
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
    setSelectedEmailId(emailId)
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
  }

  const handleSearchChange = (query) => {
    setSearchQuery(query)
    setCurrentPage(1) // Reset to first page
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

        {/* Stats Cards */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4"
        >
          <div className="card-glass text-center p-3">
              <div className="mb-1">
                <ModernIcon type="email" size={24} color="#3b82f6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{stats.totalEmails}</h3>
              <p className="text-sm text-slate-600">Total Emails</p>
          </div>
          <div className="card-glass text-center p-3">
            <div className="mb-1">
              <ModernIcon type="folder" size={24} color="#10b981" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">{stats.categories}</h3>
            <p className="text-sm text-slate-600">Categories</p>
          </div>
          <div className="card-glass text-center p-3">
            <div className="mb-1">
              <ModernIcon type="sync" size={24} color="#f59e0b" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">{stats.processedToday}</h3>
            <p className="text-sm text-slate-600">Processed Today</p>
          </div>
          <div className="card-glass text-center">
            <div className="space-y-3">
              {/* Gmail Sync Button */}
              <button 
                onClick={syncGmailEmails}
                disabled={syncLoading || !gmailConnected}
                className="w-full py-3 px-4 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {syncLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-400 border-t-transparent"></div>
                    Syncing Gmail...
                  </>
                ) : (
                  <>
                    <ModernIcon type="email" size={16} color="#10b981" />
                    Sync Gmail Inbox
                  </>
                )}
              </button>
              
              {/* Outlook Sync Button */}
              <button 
                onClick={syncOutlookEmails}
                disabled={true}
                className="w-full py-3 px-4 text-sm bg-gray-500/20 text-gray-400 rounded-lg cursor-not-allowed flex items-center justify-center gap-2 opacity-50"
                title="Outlook sync coming soon"
              >
                <ModernIcon type="outlook" size={16} color="#6b7280" />
                Outlook (Coming Soon)
              </button>
            </div>
            <p className="text-slate-600 text-sm mt-3">Email Sync Services</p>
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

              {/* Two-Pane Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-[420px,1fr] gap-6 min-h-[600px]">
                {/* Left Column - Email List */}
                <div className="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Emails</h3>
                    <span className="text-sm text-slate-600">
                      {emails.length} emails
                    </span>
                  </div>
                  <EmailList
                    items={emails}
                    selectedId={selectedEmailId}
                    onSelect={handleEmailSelect}
                    loading={emailsLoading}
                  />
                </div>

                {/* Right Column - Email Reader */}
                <div className="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl p-4">
                  <EmailReader
                    email={selectedEmail}
                    onArchive={handleEmailArchive}
                    onDelete={handleEmailDelete}
                    onExport={handleEmailExport}
                    loading={emailDetailLoading}
                  />
                </div>
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
