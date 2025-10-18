import React, { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts'
import { motion } from 'framer-motion'
import { analyticsService } from '../services/analyticsService'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import ModernIcon from './ModernIcon'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']

const SuperAnalyticsDashboard = () => {
  // State from AnalyticsDashboard
  const [categoryData, setCategoryData] = useState([])
  const [accuracyData, setAccuracyData] = useState({})
  const [misclassifications, setMisclassifications] = useState([])
  
  // State from AdvancedAnalytics
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
  const [activeTab, setActiveTab] = useState('overview')
  const [timeRange, setTimeRange] = useState('7d')
  const [selectedCategory, setSelectedCategory] = useState('All')

  useEffect(() => {
    loadAllAnalyticsData()
  }, [timeRange, selectedCategory])

  const loadAllAnalyticsData = async () => {
    try {
      setLoading(true)
      
      // Load data from both services
      const [categories, accuracy, misclassificationsData, advancedAnalytics] = await Promise.all([
        analyticsService.getCategoryCounts(),
        analyticsService.getClassificationAccuracy(),
        analyticsService.getMisclassifications(50),
        api.get(`/analytics/advanced?range=${timeRange}&category=${selectedCategory}`)
      ])

      setCategoryData(categories.data || [])
      setAccuracyData(accuracy.data || {})
      setMisclassifications(misclassificationsData.data || [])
      setAnalytics(advancedAnalytics.data || {})
    } catch (error) {
      toast.error('Failed to load analytics data')
      console.error('Error loading analytics:', error)
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
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <ModernIcon type="analytics" size={32} color="#3b82f6" />
            Super Analytics Dashboard
          </h2>
          <div className="flex gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 font-medium"
            >
              <option value="1d">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 font-medium"
            >
              <option value="All">All Categories</option>
              {Object.keys(analytics.categories).map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-2 shadow-2xl shadow-blue-100/20">
        <div className="flex space-x-2">
          <button 
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'overview' 
                ? 'bg-blue-500 text-white shadow-lg' 
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'accuracy' 
                ? 'bg-blue-500 text-white shadow-lg' 
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
            onClick={() => setActiveTab('accuracy')}
          >
            Accuracy
          </button>
          <button 
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'trends' 
                ? 'bg-blue-500 text-white shadow-lg' 
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
            onClick={() => setActiveTab('trends')}
          >
            Trends
          </button>
          <button 
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'senders' 
                ? 'bg-blue-500 text-white shadow-lg' 
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
            onClick={() => setActiveTab('senders')}
          >
            Top Senders
          </button>
          <button 
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'misclassifications' 
                ? 'bg-blue-500 text-white shadow-lg' 
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
            onClick={() => setActiveTab('misclassifications')}
          >
            Misclassifications
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Enhanced Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-blue-400/30 to-blue-200/20 backdrop-blur-xl border border-blue-200/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20 hover:shadow-3xl hover:scale-105 transition-all duration-500"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Total Emails</p>
                  <p className="text-3xl font-bold text-slate-800">{formatNumber(analytics.totalEmails || categoryData.reduce((sum, item) => sum + item.count, 0))}</p>
                  <p className="text-xs text-slate-500 mt-1">All time</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <ModernIcon type="email" size={24} color="white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-green-400/30 to-green-200/20 backdrop-blur-xl border border-green-200/30 rounded-2xl p-6 shadow-2xl shadow-green-100/20 hover:shadow-3xl hover:scale-105 transition-all duration-500"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Categories</p>
                  <p className="text-3xl font-bold text-slate-800">{categoryData.length || Object.keys(analytics.categories).length}</p>
                  <p className="text-xs text-slate-500 mt-1">Active categories</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <ModernIcon type="folder" size={24} color="white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-purple-400/30 to-purple-200/20 backdrop-blur-xl border border-purple-200/30 rounded-2xl p-6 shadow-2xl shadow-purple-100/20 hover:shadow-3xl hover:scale-105 transition-all duration-500"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Accuracy</p>
                  <p className="text-3xl font-bold text-slate-800">{((analytics.classificationAccuracy || accuracyData.overallAccuracy || 0) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-slate-500 mt-1">ML Classification</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <ModernIcon type="target" size={24} color="white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-orange-400/30 to-orange-200/20 backdrop-blur-xl border border-orange-200/30 rounded-2xl p-6 shadow-2xl shadow-orange-100/20 hover:shadow-3xl hover:scale-105 transition-all duration-500"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Response Time</p>
                  <p className="text-3xl font-bold text-slate-800">{analytics.responseTime || 0}ms</p>
                  <p className="text-xs text-slate-500 mt-1">Average</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                  <ModernIcon type="settings" size={24} color="white" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <ModernIcon type="chart" size={20} color="#3b82f6" />
                Email Distribution by Category
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ label, percent }) => `${label} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <ModernIcon type="chart" size={20} color="#10b981" />
                Category Counts
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.7)" />
                  <YAxis stroke="rgba(255,255,255,0.7)" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Category Distribution with Progress Bars */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
          >
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ModernIcon type="chart" size={20} color="#8b5cf6" />
              Category Distribution
            </h3>
            <div className="space-y-4">
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
        </div>
      )}

      {/* Accuracy Tab */}
      {activeTab === 'accuracy' && (
        <div className="space-y-6">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <ModernIcon type="target" size={20} color="#10b981" />
              Classification Accuracy
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-slate-800 mb-2">{((analytics.classificationAccuracy || accuracyData.overallAccuracy || 0) * 100).toFixed(1)}%</div>
                <p className="text-slate-600 font-medium">Overall Accuracy</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-slate-800 mb-2">{accuracyData.correct || 0}</div>
                <p className="text-slate-600 font-medium">Correct Classifications</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-slate-800 mb-2">{accuracyData.total || 0}</div>
                <p className="text-slate-600 font-medium">Total Classifications</p>
              </div>
            </div>
          </motion.div>

          {accuracyData.accuracyBreakdown && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
            >
              <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <ModernIcon type="chart" size={20} color="#f59e0b" />
                Accuracy by Category
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 text-slate-600 font-medium">Category</th>
                      <th className="text-left py-3 text-slate-600 font-medium">Correct</th>
                      <th className="text-left py-3 text-slate-600 font-medium">Total</th>
                      <th className="text-left py-3 text-slate-600 font-medium">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accuracyData.accuracyBreakdown.map((item, index) => (
                      <tr key={index} className="border-b border-white/5 hover:bg-white/10 transition-colors">
                        <td className="py-3 text-slate-800 font-medium">{item.category}</td>
                        <td className="py-3 text-slate-600">{item.correct}</td>
                        <td className="py-3 text-slate-600">{item.total}</td>
                        <td className="py-3 text-slate-600 font-semibold">{item.accuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
          >
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ModernIcon type="chart" size={20} color="#06b6d4" />
              Email Trends Over Time
            </h3>
            <div className="h-64 flex items-center justify-center bg-white/40 rounded-xl">
              <div className="text-center">
                <ModernIcon type="analytics" size={48} color="#94a3b8" />
                <p className="text-slate-500 mt-2">Advanced trend analysis coming soon</p>
                <p className="text-xs text-slate-400 mt-1">Time series charts and forecasting</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
          >
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ModernIcon type="chart" size={20} color="#8b5cf6" />
              Category Performance Trends
            </h3>
            <div className="h-64 flex items-center justify-center bg-white/40 rounded-xl">
              <div className="text-center">
                <ModernIcon type="chart" size={48} color="#94a3b8" />
                <p className="text-slate-500 mt-2">Category trend analysis coming soon</p>
                <p className="text-xs text-slate-400 mt-1">Performance metrics over time</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Top Senders Tab */}
      {activeTab === 'senders' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
        >
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ModernIcon type="users" size={20} color="#3b82f6" />
            Top Senders
          </h3>
          <div className="space-y-3">
            {analytics.topSenders && analytics.topSenders.slice(0, 10).map((sender, index) => (
              <motion.div
                key={index}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-4 bg-white/40 rounded-xl hover:bg-white/60 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{sender.email}</p>
                    <p className="text-sm text-slate-600">{sender.name || 'Unknown'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold text-slate-600">{sender.count}</span>
                  <p className="text-xs text-slate-500">emails</p>
                </div>
              </motion.div>
            ))}
            {(!analytics.topSenders || analytics.topSenders.length === 0) && (
              <div className="text-center py-12">
                <ModernIcon type="users" size={48} color="#94a3b8" />
                <p className="text-slate-500 mt-2">No sender data available</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Misclassifications Tab */}
      {activeTab === 'misclassifications' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl shadow-blue-100/20"
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <ModernIcon type="alert" size={20} color="#ef4444" />
              Recent Misclassifications
            </h3>
            <p className="text-slate-600">Emails where ML classification doesn't match manual labels</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 text-slate-600 font-medium">Subject</th>
                  <th className="text-left py-3 text-slate-600 font-medium">From</th>
                  <th className="text-left py-3 text-slate-600 font-medium">Date</th>
                  <th className="text-left py-3 text-slate-600 font-medium">ML Classification</th>
                  <th className="text-left py-3 text-slate-600 font-medium">Manual Labels</th>
                </tr>
              </thead>
              <tbody>
                {misclassifications.map((email, index) => (
                  <motion.tr
                    key={index}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/10 transition-colors"
                  >
                    <td className="py-3 text-slate-800 max-w-xs truncate font-medium">{email.subject}</td>
                    <td className="py-3 text-slate-600">{email.from}</td>
                    <td className="py-3 text-slate-600">{new Date(email.date).toLocaleDateString()}</td>
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span className="text-slate-800 font-medium">{email.classification?.label}</span>
                        <span className="text-xs text-slate-500">
                          ({email.classification?.confidence ? (email.classification.confidence * 100).toFixed(1) + '%' : 'N/A'})
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {email.labels?.map((label, labelIndex) => (
                          <span key={labelIndex} className="px-2 py-1 bg-slate-100/50 text-slate-600 rounded text-xs">
                            {label}
                          </span>
                        ))}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {misclassifications.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎉</div>
                <p className="text-slate-600 font-medium">No misclassifications found!</p>
                <p className="text-sm text-slate-500 mt-1">Your ML model is performing perfectly</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

export default SuperAnalyticsDashboard
