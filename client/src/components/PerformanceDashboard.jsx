import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { 
  HomeIcon, 
  Cog6ToothIcon, 
  ServerIcon,
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  FolderIcon
} from '@heroicons/react/24/outline'

const PerformanceDashboard = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(null)
  const [error, setError] = useState(null)

  const fetchPerformanceData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Authentication required')
        return
      }

      const [metricsRes, healthRes] = await Promise.allSettled([
        api.get('/performance/metrics'),
        api.get('/performance/health')
      ])

      // Handle successful responses with fallback data
      if (metricsRes.status === 'fulfilled' && metricsRes.value.data.success) {
        setMetrics(metricsRes.value.data.metrics || {
          totalProcessed: 0,
          averageProcessingTime: 0,
          cacheHits: 0,
          cacheMisses: 0,
          errors: 0,
          cacheSize: 0,
          cacheHitRate: 0
        })
      } else {
        // Use fallback metrics if API fails
        setMetrics({
          totalProcessed: 0,
          averageProcessingTime: 0,
          cacheHits: 0,
          cacheMisses: 0,
          errors: 0,
          cacheSize: 0,
          cacheHitRate: 0
        })
      }

      if (healthRes.status === 'fulfilled' && healthRes.value.data.success) {
        setHealth(healthRes.value.data.health || {
          status: 'healthy',
          uptime: 0,
          memoryUsage: { rss: '0 MB', heapUsed: '0 MB', heapTotal: '0 MB' },
          cacheSize: 0
        })
      } else {
        // Use fallback health data if API fails
        setHealth({
          status: 'healthy',
          uptime: 0,
          memoryUsage: { rss: '0 MB', heapUsed: '0 MB', heapTotal: '0 MB' },
          cacheSize: 0
        })
      }

    } catch (error) {
      console.error('Error fetching performance data:', error)
      setError('Failed to load performance data')
      
      // Set fallback data on error
      setMetrics({
        totalProcessed: 0,
        averageProcessingTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        errors: 0,
        cacheSize: 0,
        cacheHitRate: 0
      })
      setHealth({
        status: 'unhealthy',
        uptime: 0,
        memoryUsage: { rss: '0 MB', heapUsed: '0 MB', heapTotal: '0 MB' },
        cacheSize: 0
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchPerformanceData()
    }
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [isOpen, fetchPerformanceData])

  useEffect(() => {
    if (autoRefresh && isOpen) {
      const interval = setInterval(fetchPerformanceData, 10000) // Refresh every 10 seconds
      setRefreshInterval(interval)
      return () => clearInterval(interval)
    } else if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
  }, [autoRefresh, isOpen, fetchPerformanceData])

  const handleOptimizeMemory = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        toast.error('Authentication required')
        return
      }
      
      await api.post('/performance/optimize/memory')
      toast.success('Memory optimization completed')
      await fetchPerformanceData()
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
      const token = localStorage.getItem('token')
      if (!token) {
        toast.error('Authentication required')
        return
      }
      
      await api.post('/performance/optimize/database')
      toast.success('Database optimization completed')
      await fetchPerformanceData()
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
      const token = localStorage.getItem('token')
      if (!token) {
        toast.error('Authentication required')
        return
      }
      
      await api.post('/performance/cache/clear')
      toast.success('Cache cleared successfully')
      await fetchPerformanceData()
    } catch (error) {
      console.error('Error clearing cache:', error)
      toast.error('Failed to clear cache')
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0 || !bytes) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(Number(bytes)) / Math.log(k))
    return parseFloat((Number(bytes) / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatUptime = (seconds) => {
    if (!seconds) return '0s'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getHealthConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: CheckCircleIcon
        }
      case 'warning':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          icon: ExclamationTriangleIcon
        }
      case 'unhealthy':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: ExclamationTriangleIcon
        }
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          icon: ClockIcon
        }
    }
  }

  if (!isOpen) return null

  const healthConfig = getHealthConfig(health?.status)
  const HealthIcon = healthConfig.icon

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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white border border-gray-200 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <HomeIcon className="w-6 h-6 text-gray-700" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Performance Dashboard
                  </h2>
                  <p className="text-sm text-gray-600">
                    System monitoring and optimization
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  Auto Refresh
                </label>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="px-6 py-3 bg-red-50 border-b border-red-200">
              <div className="flex items-center gap-2 text-red-700">
                <ExclamationTriangleIcon className="w-5 h-5" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            
            {/* System Health */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <HealthIcon className="w-5 h-5 text-gray-700" />
                <h3 className="text-lg font-medium text-gray-900">System Health</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg border ${healthConfig.bgColor} ${healthConfig.borderColor}`}>
                  <div className="flex items-center gap-3">
                    <HealthIcon className={`w-6 h-6 ${healthConfig.color}`} />
                    <div>
                      <div className={`text-xl font-semibold ${healthConfig.color}`}>
                        {health?.status || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-600">Status</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <ClockIcon className="w-6 h-6 text-blue-600" />
                    <div>
                      <div className="text-xl font-semibold text-blue-600">
                        {formatUptime(health?.uptime || 0)}
                      </div>
                      <div className="text-sm text-gray-600">Uptime</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <ServerIcon className="w-6 h-6 text-purple-600" />
                    <div>
                      <div className="text-xl font-semibold text-purple-600">
                        {health?.cacheSize || metrics?.cacheSize || 0}
                      </div>
                      <div className="text-sm text-gray-600">Cache Entries</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Memory Usage */}
            {health?.memoryUsage && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FolderIcon className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-medium text-gray-900">Memory Usage</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Cog6ToothIcon className="w-6 h-6 text-orange-600" />
                      <div>
                        <div className="text-xl font-semibold text-orange-600">
                          {health.memoryUsage.rss || '0 MB'}
                        </div>
                        <div className="text-sm text-gray-600">RSS Memory</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <FolderIcon className="w-6 h-6 text-red-600" />
                      <div>
                        <div className="text-xl font-semibold text-red-600">
                          {health.memoryUsage.heapUsed || '0 MB'}
                        </div>
                        <div className="text-sm text-gray-600">Heap Used</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <ServerIcon className="w-6 h-6 text-indigo-600" />
                      <div>
                        <div className="text-xl font-semibold text-indigo-600">
                          {health.memoryUsage.heapTotal || '0 MB'}
                        </div>
                        <div className="text-sm text-gray-600">Heap Total</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            {metrics && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ChartBarIcon className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-medium text-gray-900">Performance Metrics</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xl font-semibold text-green-600">
                      {metrics.totalProcessed?.toLocaleString() || '0'}
                    </div>
                    <div className="text-sm text-gray-600">Total Processed</div>
                  </div>
                  
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xl font-semibold text-blue-600">
                      {metrics.averageProcessingTime ? 
                        `${Number(metrics.averageProcessingTime).toFixed(1)}ms` : '0ms'}
                    </div>
                    <div className="text-sm text-gray-600">Avg Processing Time</div>
                  </div>
                  
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xl font-semibold text-purple-600">
                      {metrics.cacheHitRate ? 
                        `${Number(metrics.cacheHitRate).toFixed(1)}%` : '0%'}
                    </div>
                    <div className="text-sm text-gray-600">Cache Hit Rate</div>
                  </div>
                  
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xl font-semibold text-red-600">
                      {metrics.errors || 0}
                    </div>
                    <div className="text-sm text-gray-600">Errors</div>
                  </div>
                </div>
              </div>
            )}

            {/* Cache Statistics */}
            {metrics && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ServerIcon className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-medium text-gray-900">Cache Statistics</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xl font-semibold text-cyan-600">
                      {metrics.cacheHits?.toLocaleString() || '0'}
                    </div>
                    <div className="text-sm text-gray-600">Cache Hits</div>
                  </div>
                  
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xl font-semibold text-yellow-600">
                      {metrics.cacheMisses?.toLocaleString() || '0'}
                    </div>
                    <div className="text-sm text-gray-600">Cache Misses</div>
                  </div>
                  
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xl font-semibold text-purple-600">
                      {metrics.cacheSize || 0}
                    </div>
                    <div className="text-sm text-gray-600">Current Cache Size</div>
                  </div>
                </div>
              </div>
            )}

            {/* Optimization Actions */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Cog6ToothIcon className="w-5 h-5 text-gray-700" />
                <h3 className="text-lg font-medium text-gray-900">Optimization Actions</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleOptimizeMemory}
                  disabled={loading}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FolderIcon className="w-5 h-5 text-green-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Optimize Memory</div>
                    <div className="text-sm text-gray-600">Clear memory cache</div>
                  </div>
                </button>
                
                <button
                  onClick={handleOptimizeDatabase}
                  disabled={loading}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ServerIcon className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Optimize Database</div>
                    <div className="text-sm text-gray-600">Rebuild indexes</div>
                  </div>
                </button>
                
                <button
                  onClick={handleClearCache}
                  disabled={loading}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowPathIcon className="w-5 h-5 text-purple-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Clear Cache</div>
                    <div className="text-sm text-gray-600">Reset all caches</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Last updated: {new Date().toLocaleTimeString()}
                {loading && <span className="ml-2 text-blue-600">Updating...</span>}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchPerformanceData}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <ArrowPathIcon className="w-4 h-4" />
                      Refresh
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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
