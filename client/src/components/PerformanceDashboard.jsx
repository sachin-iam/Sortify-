import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import ModernIcon from './ModernIcon'

const PerformanceDashboard = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchPerformanceData()
    }
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (autoRefresh && isOpen) {
      const interval = setInterval(fetchPerformanceData, 5000) // Refresh every 5 seconds
      setRefreshInterval(interval)
      return () => clearInterval(interval)
    } else if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
  }, [autoRefresh, isOpen])

  const fetchPerformanceData = async () => {
    try {
      setLoading(true)
      const [metricsRes, healthRes] = await Promise.all([
        api.get('/api/performance/metrics'),
        api.get('/api/performance/health')
      ])

      setMetrics(metricsRes.data.metrics)
      setHealth(healthRes.data.health)
    } catch (error) {
      console.error('Error fetching performance data:', error)
      toast.error('Failed to load performance data')
    } finally {
      setLoading(false)
    }
  }

  const handleOptimizeMemory = async () => {
    try {
      setLoading(true)
      await api.post('/api/performance/optimize/memory')
      toast.success('Memory optimization completed')
      fetchPerformanceData()
    } catch (error) {
      console.error('Error optimizing memory:', error)
      toast.error('Failed to optimize memory')
    } finally {
      setLoading(false)
    }
  }

  const handleOptimizeDatabase = async () => {
    try {
      setLoading(true)
      await api.post('/api/performance/optimize/database')
      toast.success('Database optimization completed')
      fetchPerformanceData()
    } catch (error) {
      console.error('Error optimizing database:', error)
      toast.error('Failed to optimize database')
    } finally {
      setLoading(false)
    }
  }

  const handleClearCache = async () => {
    try {
      setLoading(true)
      await api.post('/api/performance/cache/clear')
      toast.success('Cache cleared successfully')
      fetchPerformanceData()
    } catch (error) {
      console.error('Error clearing cache:', error)
      toast.error('Failed to clear cache')
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'unhealthy': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getHealthIcon = (status) => {
    switch (status) {
      case 'healthy': return '✅'
      case 'warning': return '⚠️'
      case 'unhealthy': return '❌'
      default: return '❓'
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl shadow-blue-100/20 max-w-6xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/30 bg-gradient-to-r from-white/60 to-white/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <ModernIcon type="performance" size={24} color="#3b82f6" />
                  Performance Dashboard
                </h2>
                <p className="text-slate-600 mt-1">
                  System performance monitoring and optimization
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">Auto Refresh</span>
                </label>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* System Health */}
            {health && (
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <span className={getHealthColor(health.status)}>
                    {getHealthIcon(health.status)}
                  </span>
                  System Health
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                    <div className="text-2xl font-bold text-blue-600">
                      {health.status?.toUpperCase()}
                    </div>
                    <div className="text-sm text-blue-800">Status</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                    <div className="text-2xl font-bold text-green-600">
                      {formatUptime(health.uptime || 0)}
                    </div>
                    <div className="text-sm text-green-800">Uptime</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                    <div className="text-2xl font-bold text-purple-600">
                      {health.cacheSize || 0}
                    </div>
                    <div className="text-sm text-purple-800">Cache Size</div>
                  </div>
                </div>
              </div>
            )}

            {/* Memory Usage */}
            {health?.memoryUsage && (
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Memory Usage</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl">
                    <div className="text-2xl font-bold text-orange-600">
                      {health.memoryUsage.rss}
                    </div>
                    <div className="text-sm text-orange-800">RSS Memory</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl">
                    <div className="text-2xl font-bold text-red-600">
                      {health.memoryUsage.heapUsed}
                    </div>
                    <div className="text-sm text-red-800">Heap Used</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl">
                    <div className="text-2xl font-bold text-indigo-600">
                      {health.memoryUsage.heapTotal}
                    </div>
                    <div className="text-sm text-indigo-800">Heap Total</div>
                  </div>
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            {metrics && (
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Performance Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                    <div className="text-2xl font-bold text-green-600">
                      {metrics.totalProcessed || 0}
                    </div>
                    <div className="text-sm text-green-800">Total Processed</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                    <div className="text-2xl font-bold text-blue-600">
                      {metrics.averageProcessingTime?.toFixed(2) || 0}ms
                    </div>
                    <div className="text-sm text-blue-800">Avg Processing Time</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                    <div className="text-2xl font-bold text-purple-600">
                      {metrics.cacheHitRate?.toFixed(1) || 0}%
                    </div>
                    <div className="text-sm text-purple-800">Cache Hit Rate</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl">
                    <div className="text-2xl font-bold text-red-600">
                      {metrics.errors || 0}
                    </div>
                    <div className="text-sm text-red-800">Errors</div>
                  </div>
                </div>
              </div>
            )}

            {/* Cache Statistics */}
            {metrics && (
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Cache Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl">
                    <div className="text-2xl font-bold text-cyan-600">
                      {metrics.cacheHits || 0}
                    </div>
                    <div className="text-sm text-cyan-800">Cache Hits</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl">
                    <div className="text-2xl font-bold text-yellow-600">
                      {metrics.cacheMisses || 0}
                    </div>
                    <div className="text-sm text-yellow-800">Cache Misses</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl">
                    <div className="text-2xl font-bold text-pink-600">
                      {metrics.cacheSize || 0}
                    </div>
                    <div className="text-sm text-pink-800">Cache Size</div>
                  </div>
                </div>
              </div>
            )}

            {/* Optimization Actions */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Optimization Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleOptimizeMemory}
                  disabled={loading}
                  className="p-4 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <ModernIcon type="memory" size={20} color="#ffffff" />
                    Optimize Memory
                  </div>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleOptimizeDatabase}
                  disabled={loading}
                  className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <ModernIcon type="database" size={20} color="#ffffff" />
                    Optimize Database
                  </div>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClearCache}
                  disabled={loading}
                  className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <ModernIcon type="cache" size={20} color="#ffffff" />
                    Clear Cache
                  </div>
                </motion.button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/30 bg-gradient-to-r from-white/60 to-white/40">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchPerformanceData}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-200/60 text-slate-700 rounded-xl font-semibold hover:bg-slate-300/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-700"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <ModernIcon type="refresh" size={16} color="#475569" />
                      Refresh
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-slate-200/60 text-slate-700 rounded-xl font-semibold hover:bg-slate-300/60 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default PerformanceDashboard
