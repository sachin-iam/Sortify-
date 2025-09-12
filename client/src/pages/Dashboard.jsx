import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import EmailList from '../components/EmailList'
import CategoryFilter from '../components/CategoryFilter'
import AnalyticsDashboard from '../components/AnalyticsDashboard'
import { api } from '../services/api'

const Dashboard = () => {
  const { user, token, connectGmailAccount, connectMicrosoftAccount } = useAuth()
  const [activeView, setActiveView] = useState('emails')
  const [syncLoading, setSyncLoading] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [connectingOutlook, setConnectingOutlook] = useState(false)
  const [stats, setStats] = useState({
    totalEmails: 0,
    categories: 0,
    processedToday: 0
  })

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

    checkConnectionStatus()
    loadStats()

    // Set up real-time data refresh
    const refreshInterval = setInterval(() => {
      loadStats()
      checkConnectionStatus()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(refreshInterval)
  }, [token])

  const loadStats = async () => {
    try {
      const response = await api.get('/api/analytics/stats')
      if (response.data.success) {
        setStats(response.data.stats)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleGmailConnection = async () => {
    setConnectingGmail(true)
    try {
      const response = await api.get('/api/auth/gmail/connect')
      if (response.data.success) {
        // Open Gmail OAuth in new window
        window.open(response.data.authUrl, 'gmail-oauth', 'width=500,height=600,scrollbars=yes,resizable=yes')
        
        // Listen for the OAuth completion
        const checkConnection = setInterval(async () => {
          try {
            const userResponse = await api.get('/api/auth/me')
            if (userResponse.data.success && userResponse.data.user.gmailConnected) {
              setGmailConnected(true)
              toast.success('Gmail account connected successfully!')
              clearInterval(checkConnection)
            }
          } catch (error) {
            // Connection not ready yet
          }
        }, 2000)

        // Clear interval after 5 minutes
        setTimeout(() => clearInterval(checkConnection), 300000)
      } else {
        toast.error('Failed to initiate Gmail connection')
      }
    } catch (error) {
      toast.error('Failed to connect Gmail account')
    } finally {
      setConnectingGmail(false)
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
      toast.error('Failed to connect Microsoft Outlook account')
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
      const response = await api.post('/api/emails/gmail/sync')
      if (response.data.success) {
        toast.success(`Synced ${response.data.savedCount} emails from Gmail`)
        loadStats()
      } else {
        toast.error(response.data.error || 'Failed to sync Gmail emails')
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Failed to sync emails')
    } finally {
      setSyncLoading(false)
    }
  }

  const syncOutlookEmails = async () => {
    if (!token) {
      toast.error('Please login first')
      return
    }
    
    if (!outlookConnected) {
      toast.error('Please connect your Microsoft Outlook account first')
      return
    }
    
    setSyncLoading(true)
    try {
      const response = await api.post('/api/emails/outlook/sync')
      if (response.data.success) {
        toast.success(`Synced ${response.data.savedCount} emails from Outlook`)
        loadStats()
      } else {
        toast.error(response.data.error || 'Failed to sync Outlook emails')
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Failed to sync emails')
    } finally {
      setSyncLoading(false)
    }
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
          <h1 className="text-3xl font-bold text-white mb-1">
            Welcome back, {user?.name || 'User'}! 👋
          </h1>
          <p className="text-white/70 text-base">
            Manage and organize your emails efficiently with AI-powered classification
          </p>
        </motion.div>

        {/* Email Service Connections */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h2 className="text-xl font-semibold text-white mb-4">Connect Your Email Services</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card-glass">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <span className="text-white text-xl">📧</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Gmail</h3>
                  <p className="text-white/70">Connect your Gmail account</p>
                </div>
              </div>
              <button 
                onClick={handleGmailConnection}
                className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
                  gmailConnected 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'btn-glass'
                }`}
                disabled={connectingGmail}
              >
                {connectingGmail ? 'Connecting...' : (gmailConnected ? '✅ Connected' : '🔗 Connect Gmail')}
              </button>
            </div>

            <div className="card-glass">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <span className="text-white text-xl">📬</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Microsoft Outlook</h3>
                  <p className="text-white/70">Connect your Outlook account</p>
                </div>
              </div>
              <button 
                onClick={handleOutlookConnection}
                className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
                  outlookConnected 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'btn-glass'
                }`}
                disabled={connectingOutlook}
              >
                {connectingOutlook ? 'Connecting...' : (outlookConnected ? '✅ Connected' : '🔗 Connect Outlook')}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
        >
          <div className="card-glass text-center">
            <div className="text-3xl mb-2">📧</div>
            <h3 className="text-2xl font-bold text-white">{stats.totalEmails}</h3>
            <p className="text-white/70">Total Emails</p>
          </div>
          <div className="card-glass text-center">
            <div className="text-3xl mb-2">📁</div>
            <h3 className="text-2xl font-bold text-white">{stats.categories}</h3>
            <p className="text-white/70">Categories</p>
          </div>
          <div className="card-glass text-center">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="text-2xl font-bold text-white">{stats.processedToday}</h3>
            <p className="text-white/70">Processed Today</p>
          </div>
          <div className="card-glass text-center">
            <div className="flex space-x-2">
              <button 
                onClick={syncGmailEmails}
                disabled={syncLoading || !gmailConnected}
                className="flex-1 py-2 px-3 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
              >
                {syncLoading ? '🔄' : '🔄'} Gmail
              </button>
              <button 
                onClick={syncOutlookEmails}
                disabled={syncLoading || !outlookConnected}
                className="flex-1 py-2 px-3 text-sm bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
              >
                {syncLoading ? '🔄' : '🔄'} Outlook
              </button>
            </div>
            <p className="text-white/70 text-sm mt-2">Sync Emails</p>
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
                  ? 'bg-white/20 text-white' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setActiveView('emails')}
            >
              📧 Emails
            </button>
            <button 
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                activeView === 'analytics' 
                  ? 'bg-white/20 text-white' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
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
              <CategoryFilter />
              <EmailList />
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
