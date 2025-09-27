import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import ModernIcon from './ModernIcon'

const SecurityDashboard = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [securityEvents, setSecurityEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [filters, setFilters] = useState({
    eventType: '',
    severity: '',
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    if (isOpen) {
      fetchSecurityData()
    }
  }, [isOpen])

  const fetchSecurityData = async () => {
    try {
      setLoading(true)
      const [metricsRes, auditLogsRes, eventsRes] = await Promise.all([
        api.get('/api/security/metrics'),
        api.get('/api/security/audit-logs?limit=50'),
        api.get('/api/security/events?limit=20')
      ])

      setMetrics(metricsRes.data.metrics)
      setAuditLogs(auditLogsRes.data.data)
      setSecurityEvents(eventsRes.data.events)
    } catch (error) {
      console.error('Error fetching security data:', error)
      toast.error('Failed to load security data')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const applyFilters = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value)
      })
      
      const response = await api.get(`/api/security/audit-logs?${queryParams.toString()}`)
      setAuditLogs(response.data.data)
    } catch (error) {
      console.error('Error applying filters:', error)
      toast.error('Failed to apply filters')
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity) => {
    const colors = {
      'LOW': 'text-green-600 bg-green-100',
      'MEDIUM': 'text-yellow-600 bg-yellow-100',
      'HIGH': 'text-orange-600 bg-orange-100',
      'CRITICAL': 'text-red-600 bg-red-100',
      'INFO': 'text-blue-600 bg-blue-100'
    }
    return colors[severity] || 'text-gray-600 bg-gray-100'
  }

  const getSeverityIcon = (severity) => {
    const icons = {
      'LOW': '✅',
      'MEDIUM': '⚠️',
      'HIGH': '🚨',
      'CRITICAL': '🔥',
      'INFO': 'ℹ️'
    }
    return icons[severity] || '❓'
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString()
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
          className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl shadow-blue-100/20 max-w-7xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/30 bg-gradient-to-r from-white/60 to-white/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <ModernIcon type="security" size={24} color="#3b82f6" />
                  Security Dashboard
                </h2>
                <p className="text-slate-600 mt-1">
                  Security monitoring and audit logs
                </p>
              </div>
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

          {/* Tabs */}
          <div className="p-6 border-b border-white/30">
            <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
              {[
                { id: 'overview', label: 'Overview', icon: '📊' },
                { id: 'audit-logs', label: 'Audit Logs', icon: '📋' },
                { id: 'security-events', label: 'Security Events', icon: '🚨' },
                { id: 'filters', label: 'Filters', icon: '🔍' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-300px)]">
            {/* Overview Tab */}
            {activeTab === 'overview' && metrics && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-800">Security Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl">
                    <div className="text-2xl font-bold text-red-600">
                      {metrics.blockedIPs || 0}
                    </div>
                    <div className="text-sm text-red-800">Blocked IPs</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl">
                    <div className="text-2xl font-bold text-orange-600">
                      {metrics.failedAttempts || 0}
                    </div>
                    <div className="text-sm text-orange-800">Failed Attempts</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl">
                    <div className="text-2xl font-bold text-yellow-600">
                      {metrics.suspiciousActivities || 0}
                    </div>
                    <div className="text-sm text-yellow-800">Suspicious Activities</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                    <div className="text-2xl font-bold text-purple-600">
                      {metrics.securityAlerts || 0}
                    </div>
                    <div className="text-sm text-purple-800">Security Alerts</div>
                  </div>
                </div>
              </div>
            )}

            {/* Audit Logs Tab */}
            {activeTab === 'audit-logs' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">Recent Audit Logs</h3>
                <div className="space-y-2">
                  {auditLogs.map((log, index) => (
                    <div key={index} className="p-4 bg-slate-50 rounded-xl border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(log.severity)}`}>
                            {getSeverityIcon(log.severity)} {log.severity}
                          </span>
                          <span className="text-sm font-medium text-slate-700">
                            {log.eventType}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {log.description || 'No description available'}
                      </div>
                      {log.userId && (
                        <div className="text-xs text-slate-500 mt-1">
                          User: {log.userId.name || log.userId.email || 'Unknown'}
                        </div>
                      )}
                      {log.ip && (
                        <div className="text-xs text-slate-500">
                          IP: {log.ip}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security Events Tab */}
            {activeTab === 'security-events' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">Security Events</h3>
                <div className="space-y-2">
                  {securityEvents.map((event, index) => (
                    <div key={index} className="p-4 bg-red-50 rounded-xl border border-red-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(event.severity)}`}>
                            {getSeverityIcon(event.severity)} {event.severity}
                          </span>
                          <span className="text-sm font-medium text-slate-700">
                            {event.eventType}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {event.description || 'No description available'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters Tab */}
            {activeTab === 'filters' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">Filter Audit Logs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Event Type</label>
                    <select
                      value={filters.eventType}
                      onChange={(e) => handleFilterChange('eventType', e.target.value)}
                      className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">All Event Types</option>
                      <option value="LOGIN_SUCCESS">Login Success</option>
                      <option value="LOGIN_FAILED">Login Failed</option>
                      <option value="BRUTE_FORCE_DETECTED">Brute Force Detected</option>
                      <option value="SUSPICIOUS_ACTIVITY_DETECTED">Suspicious Activity</option>
                      <option value="DATA_EXPORT">Data Export</option>
                      <option value="ADMIN_ACTION">Admin Action</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
                    <select
                      value={filters.severity}
                      onChange={(e) => handleFilterChange('severity', e.target.value)}
                      className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">All Severities</option>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                      <option value="INFO">Info</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
                <button
                  onClick={applyFilters}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Applying...' : 'Apply Filters'}
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/30 bg-gradient-to-r from-white/60 to-white/40">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchSecurityData}
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

export default SecurityDashboard
