import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
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

const DashboardNew = () => {
  const { user, token, connectGmailAccount, connectMicrosoftAccount, updateTokenFromOAuth } = useAuth()
  const { isConnected, connectionStatus, subscribeToEvents } = useWebSocketContext()
  const [activeView, setActiveView] = useState('emails')
  const [syncLoading, setSyncLoading] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [connectingOutlook, setConnectingOutlook] = useState(false)
  const [emails, setEmails] = useState([])
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [stats, setStats] = useState({ total: 0, unread: 0, important: 0, spam: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showExportModal, setShowExportModal] = useState(false)
  const [bulkSelected, setBulkSelected] = useState([])
  const [showBulkActions, setShowBulkActions] = useState(false)

  // FIXED OAUTH HANDLING - NO PAGE RELOAD
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken = urlParams.get('token')
    const connected = urlParams.get('connected')
    const loginSuccess = urlParams.get('login')
    const error = urlParams.get('error')
    
    console.log('🔍 DashboardNew OAuth Check:', { urlToken: !!urlToken, connected, loginSuccess, error })
    
    if (urlToken && (connected === '1' || loginSuccess === 'success')) {
      console.log('🎯 OAuth callback detected - USING updateTokenFromOAuth...')
      
      // Use AuthContext function to update token and authentication state
      updateTokenFromOAuth(urlToken).then((result) => {
        if (result.success) {
          console.log('✅ Authentication state updated successfully via updateTokenFromOAuth')
          
          // Show success message
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
      
      // Clean up URL parameters (NO PAGE RELOAD)
      window.history.replaceState({}, document.title, window.location.pathname)
      
    } else if (error === 'gmail_connection_failed') {
      console.log('❌ Gmail connection failed')
      toast.error('❌ Gmail connection failed. Please try again.', {
        duration: 4000
      })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [updateTokenFromOAuth])

  // Rest of the component logic (copied from original Dashboard)
  useEffect(() => {
    if (token) {
      checkConnectionStatus()
      fetchStats(true)
      loadData()
    }
  }, [token])

  const checkConnectionStatus = async () => {
    if (!token) {
      setLoadingConnections(false)
      return
    }

    try {
      const response = await api.get('/api/connections/status')
      if (response.data.success) {
        const { gmail, outlook } = response.data.connections
        setGmailConnected(gmail?.connected || false)
        setOutlookConnected(outlook?.connected || false)
        console.log('📧 Connection status updated:', { gmail: gmail?.connected, outlook: outlook?.connected })
      }
    } catch (error) {
      console.error('Failed to fetch connection status:', error)
    } finally {
      setLoadingConnections(false)
    }
  }

  const fetchStats = async (showLoading = false) => {
    if (!token) return

    if (showLoading) setSyncLoading(true)
    
    try {
      const response = await api.get('/api/emails/stats')
      if (response.data.success) {
        setStats(response.data.stats)
        console.log('📊 Stats updated:', response.data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      if (showLoading) setSyncLoading(false)
    }
  }

  const loadData = async () => {
    if (!token) return

    setLoading(true)
    try {
      const response = await api.get('/api/emails')
      if (response.data.success) {
        setEmails(response.data.emails || [])
        console.log('📧 Emails loaded:', response.data.emails?.length || 0)
      }
    } catch (error) {
      console.error('Failed to load emails:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSyncEmails = async () => {
    if (!token) return

    setSyncLoading(true)
    try {
      const response = await api.post('/api/emails/sync')
      if (response.data.success) {
        toast.success('📧 Emails synced successfully!')
        await fetchStats()
        await loadData()
      } else {
        toast.error(response.data.message || 'Failed to sync emails')
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Failed to sync emails')
    } finally {
      setSyncLoading(false)
    }
  }

  const handleGmailConnect = async () => {
    setConnectingGmail(true)
    const result = await connectGmailAccount()
    if (result.success) {
      toast.success('Redirecting to Gmail authorization...')
    } else {
      toast.error(result.error || 'Failed to connect Gmail')
    }
    setConnectingGmail(false)
  }

  const handleOutlookConnect = async () => {
    setConnectingOutlook(true)
    const result = await connectMicrosoftAccount()
    if (result.success) {
      toast.success('Redirecting to Microsoft authorization...')
    } else {
      toast.error(result.error || 'Failed to connect Outlook')
    }
    setConnectingOutlook(false)
  }

  const filteredEmails = emails.filter(email => {
    const matchesFilter = filter === 'all' || 
      (filter === 'unread' && !email.read) ||
      (filter === 'important' && email.important) ||
      (filter === 'spam' && email.spam)
    
    const matchesSearch = !searchTerm || 
      email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.from?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.body?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesFilter && matchesSearch
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="glass-card p-8 text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-slate-800">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Dashboard</h1>
          <p className="text-slate-600">Welcome back, {user?.name || 'User'}!</p>
        </div>

        {/* Connection Status */}
        <div className="glass-card p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Email Connections</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-white/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${gmailConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-slate-700">Gmail</span>
              </div>
              {!gmailConnected && (
                <button
                  onClick={handleGmailConnect}
                  disabled={connectingGmail}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {connectingGmail ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
            <div className="flex items-center justify-between p-4 bg-white/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${outlookConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-slate-700">Outlook</span>
              </div>
              {!outlookConnected && (
                <button
                  onClick={handleOutlookConnect}
                  disabled={connectingOutlook}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {connectingOutlook ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="glass-card p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-slate-800">Email Statistics</h2>
            <button
              onClick={handleSyncEmails}
              disabled={syncLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {syncLoading ? 'Syncing...' : 'Sync Emails'}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white/50 rounded-lg">
              <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
              <div className="text-sm text-slate-600">Total</div>
            </div>
            <div className="text-center p-4 bg-white/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.unread}</div>
              <div className="text-sm text-slate-600">Unread</div>
            </div>
            <div className="text-center p-4 bg-white/50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.important}</div>
              <div className="text-sm text-slate-600">Important</div>
            </div>
            <div className="text-center p-4 bg-white/50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.spam}</div>
              <div className="text-sm text-slate-600">Spam</div>
            </div>
          </div>
        </div>

        {/* Email List */}
        <div className="glass-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-slate-800">Emails</h2>
            <input
              type="text"
              placeholder="Search emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <EmailList
            emails={filteredEmails}
            loading={loading}
            onRefresh={loadData}
          />
        </div>
      </div>
    </div>
  )
}

export default DashboardNew