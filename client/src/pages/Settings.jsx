import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import ModernIcon from '../components/ModernIcon'

const Settings = () => {
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    emailPreferences: {
      notifications: true,
      marketing: false
    }
  })

  useEffect(() => {
    if (user) {
      setUserData({
        name: user.name || '',
        email: user.email || '',
        emailPreferences: {
          notifications: true,
          marketing: false
        }
      })
    }
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

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await api.put('/api/auth/profile', userData)
      if (response.data.success) {
        toast.success('Profile updated successfully!')
      } else {
        toast.error('Failed to update profile')
      }
    } catch (error) {
      toast.error('Failed to update profile')
      console.error('Profile update error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.target)
    const currentPassword = formData.get('currentPassword')
    const newPassword = formData.get('newPassword')
    const confirmPassword = formData.get('confirmPassword')

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      setLoading(false)
      return
    }

    try {
      const response = await api.put('/api/auth/change-password', {
        currentPassword,
        newPassword
      })
      if (response.data.success) {
        toast.success('Password changed successfully!')
        e.target.reset()
      } else {
        toast.error('Failed to change password')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password')
      console.error('Password change error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnectGmail = async () => {
    try {
      const response = await api.delete('/api/auth/gmail/disconnect')
      if (response.data.success) {
        toast.success('Gmail account disconnected successfully!')
      } else {
        toast.error('Failed to disconnect Gmail account')
      }
    } catch (error) {
      toast.error('Failed to disconnect Gmail account')
      console.error('Gmail disconnect error:', error)
    }
  }

  const handleDisconnectOutlook = async () => {
    try {
      const response = await api.delete('/api/auth/microsoft/disconnect')
      if (response.data.success) {
        toast.success('Microsoft Outlook account disconnected successfully!')
      } else {
        toast.error('Failed to disconnect Microsoft Outlook account')
      }
    } catch (error) {
      toast.error('Failed to disconnect Microsoft Outlook account')
      console.error('Outlook disconnect error:', error)
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
                {loading ? 'Saving...' : 'Save Profile'}
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-slate-800 font-medium">Notifications</h3>
                  <p className="text-slate-600 text-sm">Receive email notifications about important updates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="emailPreferences.notifications"
                    checked={userData.emailPreferences.notifications}
                    onChange={handleInputChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-slate-800 font-medium">Marketing Emails</h3>
                  <p className="text-slate-600 text-sm">Receive promotional emails and product updates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="emailPreferences.marketing"
                    checked={userData.emailPreferences.marketing}
                    onChange={handleInputChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
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
                  className="input-glass w-full"
                  placeholder="Enter your new password"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-medium mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="input-glass w-full"
                  placeholder="Confirm your new password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </motion.div>

          {/* Connected Accounts */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="card-glass p-6"
          >
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Connected Accounts</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
                    <ModernIcon type="email" size={20} color="#ffffff" glassEffect={false} />
                  </div>
                  <div>
                    <h3 className="text-slate-800 font-medium">Gmail</h3>
                    <p className="text-slate-600 text-sm">Connected for email sync</p>
                  </div>
                </div>
                <button
                  onClick={handleDisconnectGmail}
                  className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  Disconnect
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <ModernIcon type="outlook" size={20} color="#ffffff" glassEffect={false} />
                  </div>
                  <div>
                    <h3 className="text-slate-800 font-medium">Microsoft Outlook</h3>
                    <p className="text-slate-600 text-sm">Connected for email sync</p>
                  </div>
                </div>
                <button
                  onClick={handleDisconnectOutlook}
                  className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </motion.div>

          {/* Danger Zone */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="card-glass p-6 border border-red-500/20"
          >
            <h2 className="text-xl font-semibold text-red-400 mb-6">Danger Zone</h2>
            <div className="space-y-4">
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
