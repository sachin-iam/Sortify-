import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import ModernIcon from '../components/ModernIcon'

const Settings = () => {
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [preferencesLoading, setPreferencesLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    emailPreferences: {
      notifications: true,
      marketing: false
    }
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [connections, setConnections] = useState({
    gmail: { connected: false, email: null, name: null },
    outlook: { connected: false, email: null }
  })

  // Load user data and connections
  useEffect(() => {
    const loadUserData = async () => {
      if (user) {
        setUserData({
          name: user.name || '',
          email: user.email || '',
          emailPreferences: user.emailPreferences || {
            notifications: true,
            marketing: false
          }
        })
      }
      
      // Load connections status
      try {
        const response = await api.get('/api/auth/connections')
        if (response.data.success) {
          setConnections(response.data.connections)
          setUserData(prev => ({
            ...prev,
            emailPreferences: response.data.emailPreferences || prev.emailPreferences
          }))
        }
      } catch (error) {
        console.error('Failed to load connections:', error)
      }
    }

    loadUserData()
  }, [user])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    
    if (name.startsWith('emailPreferences.')) {
      const prefKey = name.split('.')[1]
      setUserData(prev => ({
        ...prev,
        emailPreferences: {
          ...prev.emailPreferences,
          [prefKey]: type === 'checkbox' ? checked : value
        }
      }))
    } else {
      setUserData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }))
    }
  }

  const handlePasswordChange = (e) => {
    const { name, value } = e.target
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await api.put('/api/auth/profile', {
        name: userData.name,
        emailPreferences: userData.emailPreferences
      })
      
      if (response.data.success) {
        toast.success('Profile updated successfully!', {
          duration: 3000,
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
            textAlign: 'center'
          },
          icon: '✨'
        })
      } else {
        toast.error('Failed to update profile')
      }
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error(error.response?.data?.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long')
      return
    }

    setPasswordLoading(true)

    try {
      const response = await api.put('/api/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
      
      if (response.data.success) {
        toast.success('Password changed successfully!', {
          duration: 3000,
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
            textAlign: 'center'
          },
          icon: '🔒'
        })
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast.error('Failed to change password')
      }
    } catch (error) {
      console.error('Password change error:', error)
      toast.error(error.response?.data?.message || 'Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleEmailPreferencesChange = async (preference, value) => {
    setPreferencesLoading(true)

    try {
      const response = await api.put('/api/auth/email-preferences', {
        [preference]: value
      })
      
      if (response.data.success) {
        setUserData(prev => ({
          ...prev,
          emailPreferences: response.data.emailPreferences
        }))
        toast.success('Email preferences updated!', {
          duration: 2000,
          style: {
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(37,99,235,0.1))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: '20px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.15), 0 0 0 1px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
            color: '#1e40af',
            fontSize: '16px',
            fontWeight: '700',
            padding: '20px 24px',
            maxWidth: '450px',
            textAlign: 'center'
          },
          icon: '📧'
        })
      } else {
        toast.error('Failed to update email preferences')
      }
    } catch (error) {
      console.error('Email preferences error:', error)
      toast.error('Failed to update email preferences')
    } finally {
      setPreferencesLoading(false)
    }
  }

  const handleGmailConnection = async () => {
    setConnectionsLoading(true)
    
    try {
      const response = await api.get('/api/auth/gmail/connect')
      if (response.data.success) {
        window.location.href = response.data.authUrl
      } else {
        toast.error('Failed to initiate Gmail connection')
      }
    } catch (error) {
      console.error('Gmail connection error:', error)
      toast.error('Failed to connect Gmail account')
    } finally {
      setConnectionsLoading(false)
    }
  }

  const handleGmailDisconnection = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Gmail account? This will remove all synced emails.')) {
      return
    }

    setConnectionsLoading(true)

    try {
      const response = await api.post('/api/auth/gmail/disconnect')
      if (response.data.success) {
        setConnections(prev => ({
          ...prev,
          gmail: { connected: false, email: null }
        }))
        toast.success('Gmail account disconnected successfully!', {
          duration: 3000,
          style: {
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '20px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.15), 0 0 0 1px rgba(239,68,68,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
            color: '#dc2626',
            fontSize: '16px',
            fontWeight: '700',
            padding: '20px 24px',
            maxWidth: '450px',
            textAlign: 'center'
          },
          icon: '📧'
        })
      } else {
        toast.error('Failed to disconnect Gmail account')
      }
    } catch (error) {
      console.error('Gmail disconnection error:', error)
      toast.error('Failed to disconnect Gmail account')
    } finally {
      setConnectionsLoading(false)
    }
  }

  const handleOutlookConnection = async () => {
    toast.error('Outlook integration is coming soon!', {
      duration: 3000,
      style: {
        background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.1))',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(251,191,36,0.3)',
        borderRadius: '20px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.15), 0 0 0 1px rgba(251,191,36,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
        color: '#d97706',
        fontSize: '16px',
        fontWeight: '700',
        padding: '20px 24px',
        maxWidth: '450px',
        textAlign: 'center'
      },
      icon: '🚧'
    })
  }

  const handleDeleteAccount = async () => {
    const confirmText = 'DELETE'
    const userInput = prompt(
      `This action cannot be undone. This will permanently delete your account and all associated data.\n\nType "${confirmText}" to confirm:`
    )

    if (userInput !== confirmText) {
      return
    }

    setDeleteLoading(true)

    try {
      const response = await api.delete('/api/auth/account')
      if (response.data.success) {
        toast.success('Account deleted successfully', {
          duration: 2000,
          style: {
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '20px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.15), 0 0 0 1px rgba(239,68,68,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
            color: '#dc2626',
            fontSize: '16px',
            fontWeight: '700',
            padding: '20px 24px',
            maxWidth: '450px',
            textAlign: 'center'
          },
          icon: '🗑️'
        })
        
        // Redirect to login after account deletion
        setTimeout(() => {
          logout()
        }, 2000)
      } else {
        toast.error('Failed to delete account')
      }
    } catch (error) {
      console.error('Account deletion error:', error)
      toast.error('Failed to delete account')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            Settings 
            <ModernIcon type="settings" size={32} color="#3b82f6" />
          </h1>
          <p className="text-slate-600 text-lg">
            Manage your account settings and preferences
          </p>
        </motion.div>

        <div className="space-y-8">
          {/* Profile Settings */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="card-glass p-6"
          >
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Profile Information</h2>
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={userData.name}
                  onChange={handleInputChange}
                  className="input-glass w-full"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-medium mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={userData.email}
                  disabled
                  className="input-glass w-full opacity-50 cursor-not-allowed"
                  placeholder="Your email address"
                />
                <p className="text-slate-500 text-xs mt-1">Email cannot be changed</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Saving...
                  </>
                ) : 'Save Profile'}
              </button>
            </form>
          </motion.div>

          {/* Email Preferences */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="card-glass p-6"
          >
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Email Preferences</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-slate-800 font-medium">Notifications</h3>
                  <p className="text-slate-600 text-sm">Receive email notifications about important updates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userData.emailPreferences.notifications}
                    onChange={(e) => handleEmailPreferencesChange('notifications', e.target.checked)}
                    className="sr-only peer"
                    disabled={preferencesLoading}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-slate-800 font-medium">Marketing Emails</h3>
                  <p className="text-slate-600 text-sm">Receive promotional emails and product updates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userData.emailPreferences.marketing}
                    onChange={(e) => handleEmailPreferencesChange('marketing', e.target.checked)}
                    className="sr-only peer"
                    disabled={preferencesLoading}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </motion.div>

          {/* Change Password */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="card-glass p-6"
          >
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="input-glass w-full"
                  placeholder="Enter your current password"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-medium mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className="input-glass w-full"
                  placeholder="Enter your new password"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-medium mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="input-glass w-full"
                  placeholder="Confirm your new password"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Changing...
                  </>
                ) : 'Change Password'}
              </button>
            </form>
          </motion.div>

          {/* Email Sync Services */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="card-glass p-6"
          >
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Email Sync Services</h2>
            
            {/* Gmail Section */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 font-bold text-sm">G</span>
                </div>
                <div>
                  <h3 className="text-slate-800 font-medium">Gmail - Google Mail Integration</h3>
                  <p className="text-slate-600 text-sm">Sync your Gmail inbox with AI-powered classification</p>
                </div>
              </div>

              {connections.gmail.connected ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ModernIcon type="success" size={20} color="#16a34a" />
                      <div>
                        <p className="text-green-800 font-medium">Gmail Connected</p>
                        <p className="text-green-600 text-sm">
                          {connections.gmail.name || connections.gmail.email}
                        </p>
                        <p className="text-green-500 text-xs">{connections.gmail.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleGmailDisconnection}
                      disabled={connectionsLoading}
                      className="px-4 py-2 text-sm text-white bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {connectionsLoading ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ModernIcon type="warning" size={20} color="#d97706" />
                      <div>
                        <p className="text-yellow-800 font-medium">Gmail Not Connected</p>
                        <p className="text-yellow-600 text-sm">Connect to sync emails</p>
                      </div>
                    </div>
                    <button
                      onClick={handleGmailConnection}
                      disabled={connectionsLoading}
                      className="px-4 py-2 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {connectionsLoading ? 'Connecting...' : 'Connect Gmail'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Outlook Section */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">O</span>
                </div>
                <div>
                  <h3 className="text-slate-800 font-medium">Outlook - Microsoft Outlook Integration</h3>
                  <p className="text-slate-600 text-sm">Sync your Outlook inbox with AI-powered classification</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ModernIcon type="email" size={20} color="#6b7280" />
                    <div>
                      <p className="text-gray-800 font-medium">Coming Soon</p>
                      <p className="text-gray-600 text-sm">Outlook integration in development</p>
                    </div>
                  </div>
                  <button
                    onClick={handleOutlookConnection}
                    disabled
                    className="px-4 py-2 text-sm text-white bg-gray-400 rounded-lg cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Connected Accounts */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="card-glass p-6"
          >
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Connected Accounts</h2>
            <div className="space-y-4">
              {connections.gmail.connected && (
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ModernIcon type="email" size={20} color="#16a34a" />
                    <div>
                      <h3 className="text-slate-800 font-medium">
                        {connections.gmail.name || 'Gmail'}
                      </h3>
                      <p className="text-slate-600 text-sm">
                        {connections.gmail.email} • Connected for email sync
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleGmailDisconnection}
                    disabled={connectionsLoading}
                    className="px-3 py-1 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                </div>
              )}
              
              {!connections.gmail.connected && !connections.outlook.connected && (
                <div className="text-center py-8 text-slate-500">
                  <ModernIcon type="email" size={48} color="#9ca3af" />
                  <p className="mt-2">No email accounts connected</p>
                  <p className="text-sm">Connect an email account to start syncing</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Danger Zone */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="card-glass p-6 border border-red-500/20"
          >
            <h2 className="text-xl font-semibold text-red-400 mb-6">Danger Zone</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-slate-800 font-medium">Delete Account</h3>
                  <p className="text-slate-600 text-sm">Permanently delete your account and all data</p>
                </div>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-slate-800 font-medium">Logout</h3>
                  <p className="text-slate-600 text-sm">Sign out of your account</p>
                </div>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm text-white bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default Settings