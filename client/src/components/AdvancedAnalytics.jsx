import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../services/api'
import ModernIcon from './ModernIcon'

const AdvancedAnalytics = () => {
  const [analytics, setAnalytics] = useState({
    totalEmails: 0,
    categories: {},
    dailyStats: [],
    weeklyStats: [],
    monthlyStats: [],
    topSenders: [],
    emailTrends: [],
    classificationAccuracy: 0,
    responseTime: 0
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [selectedCategory, setSelectedCategory] = useState('All')

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange, selectedCategory])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/analytics/advanced?range=${timeRange}&category=${selectedCategory}`)
      setAnalytics(response.data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Academic': 'from-blue-500 to-blue-600',
      'Promotions': 'from-purple-500 to-purple-600',
      'Placement': 'from-green-500 to-green-600',
      'Spam': 'from-red-500 to-red-600',
      'Other': 'from-gray-500 to-gray-600'
    }
    return colors[category] || 'from-gray-500 to-gray-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <ModernIcon type="analytics" size={24} color="#3b82f6" />
          Advanced Analytics
        </h2>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800"
          >
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800"
          >
            <option value="All">All Categories</option>
            {Object.keys(analytics.categories).map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Emails</p>
              <p className="text-3xl font-bold text-slate-800">{formatNumber(analytics.totalEmails)}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <ModernIcon type="email" size={24} color="white" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-green-100/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Classification Accuracy</p>
              <p className="text-3xl font-bold text-slate-800">{(analytics.classificationAccuracy * 100).toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
              <ModernIcon type="settings" size={24} color="white" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-purple-100/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Categories</p>
              <p className="text-3xl font-bold text-slate-800">{Object.keys(analytics.categories).length}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
              <ModernIcon type="settings" size={24} color="white" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-orange-100/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Avg Response Time</p>
              <p className="text-3xl font-bold text-slate-800">{analytics.responseTime}ms</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
              <ModernIcon type="settings" size={24} color="white" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Category Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
      >
        <h3 className="text-lg font-bold text-slate-800 mb-4">Category Distribution</h3>
        <div className="space-y-3">
          {Object.entries(analytics.categories).map(([category, count], index) => (
            <div key={category} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${getCategoryColor(category)}`}></div>
                <span className="font-medium text-slate-800">{category}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full bg-gradient-to-r ${getCategoryColor(category)}`}
                    style={{ width: `${(count / analytics.totalEmails) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm font-semibold text-slate-600 w-12 text-right">
                  {formatNumber(count)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Top Senders */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
      >
        <h3 className="text-lg font-bold text-slate-800 mb-4">Top Senders</h3>
        <div className="space-y-3">
          {analytics.topSenders.slice(0, 5).map((sender, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-white/40 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-slate-800">{sender.email}</p>
                  <p className="text-sm text-slate-600">{sender.name}</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-600">{sender.count} emails</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Email Trends Chart Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
      >
        <h3 className="text-lg font-bold text-slate-800 mb-4">Email Trends</h3>
        <div className="h-64 flex items-center justify-center bg-white/40 rounded-xl">
          <div className="text-center">
            <ModernIcon type="analytics" size={48} color="#94a3b8" />
            <p className="text-slate-500 mt-2">Chart visualization coming soon</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default AdvancedAnalytics
