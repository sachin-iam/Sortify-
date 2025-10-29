import React, { useState, useEffect, useRef, useCallback } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts'
import { motion } from 'framer-motion'
import { analyticsService } from '../services/analyticsService'
import { api } from '../services/api'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import { getCategoryColor } from '../utils/categoryColors'
import toast from 'react-hot-toast'
import ModernIcon from './ModernIcon'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']

const SuperAnalyticsDashboard = () => {
  const { lastMessage } = useWebSocketContext()
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
  const [refreshLoading, setRefreshLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [timeRange, setTimeRange] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('All')
  
  // Simple flag to prevent unnecessary reloading
  const lastLoadParamsRef = useRef('')
  const debounceTimerRef = useRef(null)

  // Extract data loading logic into a reusable function
  const loadAllAnalyticsData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshLoading(true)
      } else {
        setLoading(true)
      }
      
      // Load data from both services - analyze all emails by default
      const [categories, accuracy, misclassificationsData, advancedAnalytics] = await Promise.all([
        analyticsService.getCategoryCounts(),
        analyticsService.getClassificationAccuracy(),
        analyticsService.getMisclassifications(10000), // Remove the 50 limit to get all emails
        api.get(`/analytics/advanced?range=${timeRange}&category=${selectedCategory}`)
      ])

      // Safely handle API responses
      setCategoryData(Array.isArray(categories?.data) ? categories.data : [])
      setAccuracyData(typeof accuracy?.data === 'object' && accuracy.data ? accuracy.data : {})
      setMisclassifications(Array.isArray(misclassificationsData?.data) ? misclassificationsData.data : [])
      setAnalytics(typeof advancedAnalytics?.data === 'object' && advancedAnalytics.data ? advancedAnalytics.data : {})
      
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
  const handleRefresh = async () => {
    loadAllAnalyticsData(true)
  }

  // Debounced refresh for Phase 2 updates (max every 2-3 seconds)
  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    debounceTimerRef.current = setTimeout(() => {
      loadAllAnalyticsData(true)
      debounceTimerRef.current = null
    }, 2500) // 2.5 second debounce
  }, [timeRange, selectedCategory])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const currentParams = `${timeRange}-${selectedCategory}`
    
    // Only load if parameters have actually changed
    if (currentParams !== lastLoadParamsRef.current) {
      loadAllAnalyticsData()
      lastLoadParamsRef.current = currentParams
    }
  }, [timeRange, selectedCategory])

  // Handle WebSocket updates for category changes and reclassifications
  useEffect(() => {
    if (!lastMessage) return
    
    console.log('SuperAnalyticsDashboard received WebSocket message:', lastMessage)
    
    switch (lastMessage.type) {
      case 'category_updated':
        console.log('🏷️ SuperAnalyticsDashboard received category update:', lastMessage.data)
        // Refresh analytics when categories change
        loadAllAnalyticsData()
        break
        
      case 'reclassification_complete':
        console.log('✅ SuperAnalyticsDashboard received reclassification complete:', lastMessage.data)
        // Refresh analytics when reclassification completes
        loadAllAnalyticsData()
        break
        
      case 'reclassification_phase1_complete':
        console.log('✅ Phase 1 complete, refreshing analytics:', lastMessage.data)
        // Immediate refresh after Phase 1 completes
        loadAllAnalyticsData(true)
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
        console.log('🔄 SuperAnalyticsDashboard received reclassification progress:', lastMessage.data)
        // Show progress for Phase 1 batches
        if (lastMessage.data?.phase === 1) {
          // Optionally update a progress indicator for Phase 1
          // Phase 2 progress is silent
        }
        break
        
      case 'email_synced':
        console.log('📧 SuperAnalyticsDashboard received email sync update:', lastMessage.data)
        // Refresh analytics when new emails are synced
        loadAllAnalyticsData()
        break
        
      default:
        break
    }
  }, [lastMessage, timeRange, selectedCategory, debouncedRefresh])

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
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
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 font-medium"
            >
              <option value="all">All Time</option>
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
              <ResponsiveContainer width="100%" height={450}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="40%"
                    cy="50%"
                    labelLine={({ cx, cy, midAngle, outerRadius, percent, index }) => {
                      if (!categoryData[index]) return null;
                      
                      const RADIAN = Math.PI / 180;
                      const startRadius = outerRadius + 5;
                      const startX = cx + startRadius * Math.cos(-midAngle * RADIAN);
                      const startY = cy + startRadius * Math.sin(-midAngle * RADIAN);
                      
                      // Distribute labels to different positions around container
                      const totalItems = categoryData.length;
                      const containerWidth = 600;
                      const containerHeight = 450;
                      const padding = 20;
                      
                      // Define positions: top-left, top-right, right, bottom-right, bottom-left, left
                      const positions = [
                        { x: padding + 50, y: padding + 30, anchor: 'start' }, // top-left
                        { x: containerWidth - padding - 50, y: padding + 30, anchor: 'end' }, // top-right
                        { x: containerWidth - padding - 50, y: containerHeight * 0.35, anchor: 'end' }, // right-mid-top
                        { x: containerWidth - padding - 50, y: containerHeight * 0.55, anchor: 'end' }, // right-mid
                        { x: containerWidth - padding - 50, y: containerHeight * 0.75, anchor: 'end' }, // right-mid-bottom
                        { x: containerWidth - padding - 50, y: containerHeight - padding - 30, anchor: 'end' }, // bottom-right
                        { x: padding + 50, y: containerHeight - padding - 30, anchor: 'start' }, // bottom-left
                        { x: padding + 50, y: containerHeight * 0.75, anchor: 'start' }, // left-mid-bottom
                        { x: padding + 50, y: containerHeight * 0.55, anchor: 'start' }, // left-mid
                        { x: padding + 50, y: containerHeight * 0.35, anchor: 'start' }, // left-mid-top
                      ];
                      
                      // Assign position based on index
                      const position = positions[index % positions.length];
                      const endX = position.x;
                      const endY = position.y;
                      
                      // Create bent path with quadratic curve
                      const bendX = startX + (endX - startX) * 0.5;
                      const bendY = startY + (endY - startY) * 0.6;
                      
                      // Z-index pattern: 0, 4, 8, 12, etc.
                      const zIndex = index * 4;
                      
                      return (
                        <g style={{ zIndex: zIndex }}>
                          <path
                            d={`M ${startX},${startY} Q ${bendX},${bendY} ${endX},${endY}`}
                            stroke="#64748b"
                            strokeWidth="1.2"
                            fill="none"
                            style={{ 
                              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
                              zIndex: zIndex
                            }}
                          />
                          <circle 
                            cx={endX} 
                            cy={endY} 
                            r="2.5" 
                            fill="#64748b"
                            style={{ zIndex: zIndex }}
                          />
                        </g>
                      );
                    }}
                    label={({ cx, cy, midAngle, outerRadius, percent, index }) => {
                      if (!categoryData[index]) return null;
                      
                      // Distribute labels to different positions around container
                      const containerWidth = 600;
                      const containerHeight = 450;
                      const padding = 20;
                      
                      // Define positions matching labelLine positions
                      const positions = [
                        { x: padding + 50, y: padding + 30, anchor: 'start' }, // top-left
                        { x: containerWidth - padding - 50, y: padding + 30, anchor: 'end' }, // top-right
                        { x: containerWidth - padding - 50, y: containerHeight * 0.35, anchor: 'end' }, // right-mid-top
                        { x: containerWidth - padding - 50, y: containerHeight * 0.55, anchor: 'end' }, // right-mid
                        { x: containerWidth - padding - 50, y: containerHeight * 0.75, anchor: 'end' }, // right-mid-bottom
                        { x: containerWidth - padding - 50, y: containerHeight - padding - 30, anchor: 'end' }, // bottom-right
                        { x: padding + 50, y: containerHeight - padding - 30, anchor: 'start' }, // bottom-left
                        { x: padding + 50, y: containerHeight * 0.75, anchor: 'start' }, // left-mid-bottom
                        { x: padding + 50, y: containerHeight * 0.55, anchor: 'start' }, // left-mid
                        { x: padding + 50, y: containerHeight * 0.35, anchor: 'start' }, // left-mid-top
                      ];
                      
                      // Assign position based on index
                      const position = positions[index % positions.length];
                      const labelX = position.x;
                      const labelY = position.y;
                      
                      // Z-index pattern: 0, 4, 8, 12, etc.
                      const zIndex = index * 4;

                      return (
                        <g style={{ zIndex: zIndex }}>
                          <text 
                            x={labelX} 
                            y={labelY} 
                            fill="#1e293b"
                            textAnchor={position.anchor} 
                            dominantBaseline="middle"
                            fontSize="11"
                            fontWeight="600"
                            style={{ 
                              textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                              zIndex: zIndex
                            }}
                          >
                            {`${categoryData[index].label} (${(percent * 100).toFixed(1)}%)`}
                          </text>
                        </g>
                      );
                    }}
                    outerRadius={70}
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" />
                  <XAxis 
                    dataKey="label" 
                    stroke="#475569" 
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke="#475569" 
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
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
              {Object.entries(analytics.categories).map(([category, count], index) => {
                const percentage = ((count / analytics.totalEmails) * 100).toFixed(1)
                const categoryColor = getCategoryColor(category, 'hex')
                return (
                  <div key={category} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/20 transition-all duration-200">
                    <div className="flex items-center gap-3 flex-1">
                      <div 
                        className="w-4 h-4 rounded-full shadow-md"
                        style={{ 
                          backgroundColor: categoryColor,
                          border: `2px solid ${categoryColor}40`
                        }}
                      ></div>
                      <span className="font-semibold text-slate-800 text-sm">{category}</span>
                    </div>
                    <div className="flex items-center gap-4 flex-1 justify-end">
                      <div className="w-48 bg-slate-300/80 rounded-full h-3 shadow-inner">
                        <div
                          className="h-3 rounded-full shadow-lg transition-all duration-500"
                          style={{ 
                            width: `${Math.max(percentage, 2)}%`,
                            minWidth: percentage > 0 ? '8px' : '0',
                            background: `linear-gradient(90deg, ${categoryColor}, ${categoryColor}dd)`
                          }}
                        ></div>
                      </div>
                      <div className="flex items-baseline gap-1 min-w-[80px]">
                        <span className="text-base font-bold text-slate-800">
                          {formatNumber(count)}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          ({percentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
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
