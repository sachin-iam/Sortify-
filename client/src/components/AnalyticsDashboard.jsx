import React, { useState, useEffect, useRef, useCallback } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { analyticsService } from '../services/analyticsService'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import toast from 'react-hot-toast'
import ModernIcon from './ModernIcon'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']

const AnalyticsDashboard = () => {
  const { lastMessage } = useWebSocketContext()
  const [categoryData, setCategoryData] = useState([])
  const [accuracyData, setAccuracyData] = useState({})
  const [misclassifications, setMisclassifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshLoading, setRefreshLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const debounceTimerRef = useRef(null)

  // Extract data loading logic into a reusable function
  const loadAnalyticsData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshLoading(true)
      } else {
        setLoading(true)
      }
      
      const [categories, accuracy, misclassificationsData] = await Promise.all([
        analyticsService.getCategoryCounts(),
        analyticsService.getClassificationAccuracy(),
        analyticsService.getMisclassifications(10000) // Remove the 50 limit to analyze all emails
      ])

      // Safely handle API responses
      setCategoryData(Array.isArray(categories?.data) ? categories.data : [])
      setAccuracyData(typeof accuracy?.data === 'object' && accuracy.data ? accuracy.data : {})
      setMisclassifications(Array.isArray(misclassificationsData?.data) ? misclassificationsData.data : [])
      
      if (isRefresh) {
        toast.success('Analytics data refreshed successfully!')
      }
    } catch (error) {
      toast.error('Failed to load analytics data')
      console.error('Error loading analytics:', error)
    } finally {
      if (isRefresh) {
        setRefreshLoading(false)
      } else {
        setLoading(false)
      }
    }
  }

  // Handle manual refresh
  const handleRefresh = () => {
    loadAnalyticsData(true)
  }

  // Debounced refresh for Phase 2 updates (max every 2-3 seconds)
  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    debounceTimerRef.current = setTimeout(() => {
      loadAnalyticsData(true)
      debounceTimerRef.current = null
    }, 2500) // 2.5 second debounce
  }, [])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Load data once when component mounts
    loadAnalyticsData()
  }, []) // Empty dependency array to run only once on mount

  // Handle WebSocket updates for category changes and reclassifications
  useEffect(() => {
    if (!lastMessage) return
    
    console.log('AnalyticsDashboard received WebSocket message:', lastMessage)
    
    switch (lastMessage.type) {
      case 'category_updated':
        console.log('🏷️ AnalyticsDashboard received category update:', lastMessage.data)
        // Refresh analytics when categories change
        loadAnalyticsData()
        break
        
      case 'reclassification_complete':
        console.log('✅ AnalyticsDashboard received reclassification complete:', lastMessage.data)
        // Refresh analytics when reclassification completes
        loadAnalyticsData()
        break
        
      case 'reclassification_phase1_complete':
        console.log('✅ Phase 1 complete, refreshing analytics:', lastMessage.data)
        // Immediate refresh after Phase 1 completes
        loadAnalyticsData(true)
        break
        
      case 'phase2_category_changed':
        console.log('🔄 Phase 2 category changed, debounced refresh:', lastMessage.data)
        // Debounced refresh for Phase 2 category changes (silent, no visible indicator)
        debouncedRefresh()
        break
        
      case 'phase2_batch_complete':
        console.log('📦 Phase 2 batch complete, debounced refresh:', lastMessage.data)
        // Debounced refresh after Phase 2 batch if categories changed
        if (lastMessage.data?.categoriesChanged > 0) {
          debouncedRefresh()
        }
        break
        
      case 'reclassification_progress':
        console.log('🔄 AnalyticsDashboard received reclassification progress:', lastMessage.data)
        // Show progress for Phase 1 batches, Phase 2 is silent
        if (lastMessage.data?.phase === 1) {
          // Optionally update a progress indicator for Phase 1
        }
        break
        
      case 'email_synced':
        console.log('📧 AnalyticsDashboard received email sync update:', lastMessage.data)
        // Refresh analytics when new emails are synced
        loadAnalyticsData()
        break
        
      default:
        break
    }
  }, [lastMessage, debouncedRefresh])

  if (loading) {
    return (
      <div className="card-glass p-8">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-slate-800">Loading analytics data...</p>
        </div>
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
      <div className="card-glass p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <ModernIcon type="analytics" size={28} color="#3b82f6" />
            Analytics Dashboard
          </h2>
          <button
            onClick={handleRefresh}
            disabled={refreshLoading}
            className="px-4 py-2 bg-blue-500/80 hover:bg-blue-500 border border-blue-400/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {refreshLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <ModernIcon type="sync" size={16} color="white" />
            )}
            {refreshLoading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card-glass p-2">
        <div className="flex space-x-2">
          <button 
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'overview' 
                ? 'bg-slate-200/50 text-slate-800' 
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'accuracy' 
                ? 'bg-slate-200/50 text-slate-800' 
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
            onClick={() => setActiveTab('accuracy')}
          >
            Accuracy
          </button>
          <button 
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'misclassifications' 
                ? 'bg-slate-200/50 text-slate-800' 
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
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="card-glass text-center p-6"
            >
              <div className="mb-2">
                <ModernIcon type="email" size={32} color="#3b82f6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">{categoryData.reduce((sum, item) => sum + item.count, 0)}</h3>
              <p className="text-slate-600">Total Emails</p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="card-glass text-center p-6"
            >
              <div className="mb-2">
                <ModernIcon type="folder" size={32} color="#10b981" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">{categoryData.length}</h3>
              <p className="text-slate-600">Categories</p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="card-glass text-center p-6"
            >
              <div className="mb-2">
                <ModernIcon type="target" size={32} color="#f59e0b" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">{accuracyData.overallAccuracy || 0}%</h3>
              <p className="text-slate-600">Overall Accuracy</p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="card-glass text-center p-6"
            >
              <div className="mb-2">
                <ModernIcon type="robot" size={32} color="#8b5cf6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">{accuracyData.total || 0}</h3>
              <p className="text-slate-600">Classified Emails</p>
            </motion.div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="card-glass p-6"
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Email Distribution by Category</h3>
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
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="card-glass p-6"
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Category Counts</h3>
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
        </div>
      )}

      {/* Accuracy Tab */}
      {activeTab === 'accuracy' && (
        <div className="space-y-6">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="card-glass p-6"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Classification Accuracy</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-800 mb-2">{accuracyData.overallAccuracy || 0}%</div>
                <p className="text-slate-600">Overall Accuracy</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-800 mb-2">{accuracyData.correct || 0}</div>
                <p className="text-slate-600">Correct Classifications</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-800 mb-2">{accuracyData.total || 0}</div>
                <p className="text-slate-600">Total Classifications</p>
              </div>
            </div>
          </motion.div>

          {accuracyData.accuracyBreakdown && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="card-glass p-6"
            >
              <h4 className="text-lg font-semibold text-slate-800 mb-4">Accuracy by Category</h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 text-slate-600">Category</th>
                      <th className="text-left py-3 text-slate-600">Correct</th>
                      <th className="text-left py-3 text-slate-600">Total</th>
                      <th className="text-left py-3 text-slate-600">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accuracyData.accuracyBreakdown.map((item, index) => (
                      <tr key={index} className="border-b border-white/5">
                        <td className="py-3 text-slate-800">{item.category}</td>
                        <td className="py-3 text-slate-600">{item.correct}</td>
                        <td className="py-3 text-slate-600">{item.total}</td>
                        <td className="py-3 text-slate-600">{item.accuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Misclassifications Tab */}
      {activeTab === 'misclassifications' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="card-glass p-6"
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Recent Misclassifications</h3>
            <p className="text-slate-600">Emails where ML classification doesn't match manual labels</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 text-slate-600">Subject</th>
                  <th className="text-left py-3 text-slate-600">From</th>
                  <th className="text-left py-3 text-slate-600">Date</th>
                  <th className="text-left py-3 text-slate-600">ML Classification</th>
                  <th className="text-left py-3 text-slate-600">Manual Labels</th>
                </tr>
              </thead>
              <tbody>
                {misclassifications.map((email, index) => (
                  <tr key={index} className="border-b border-white/5">
                    <td className="py-3 text-slate-800 max-w-xs truncate">{email.subject}</td>
                    <td className="py-3 text-slate-600">{email.from}</td>
                    <td className="py-3 text-slate-600">{new Date(email.date).toLocaleDateString()}</td>
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span className="text-slate-800">{email.classification?.label}</span>
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
                  </tr>
                ))}
              </tbody>
            </table>
            {misclassifications.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎉</div>
                <p className="text-slate-600">No misclassifications found!</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

export default AnalyticsDashboard
