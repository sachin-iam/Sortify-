import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import ModernIcon from './ModernIcon'

const ExportModal = ({ isOpen, onClose, selectedEmails = [], onExportComplete }) => {
  const [formats, setFormats] = useState({})
  const [templates, setTemplates] = useState({})
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  // Export options
  const [exportOptions, setExportOptions] = useState({
    format: 'csv',
    template: 'basic',
    fields: [],
    filters: {
      category: 'All',
      isRead: undefined,
      search: ''
    },
    dateRange: {
      start: '',
      end: ''
    },
    includeAttachments: false,
    includeSummary: false
  })

  useEffect(() => {
    if (isOpen) {
      fetchExportData()
    }
  }, [isOpen])

  const fetchExportData = async () => {
    try {
      setLoading(true)
      const [formatsRes, templatesRes, statsRes] = await Promise.all([
        api.get('/api/export/formats'),
        api.get('/api/export/formats'), // Same endpoint returns both
        api.get('/api/export/stats')
      ])

      setFormats(formatsRes.data.formats)
      setTemplates(formatsRes.data.templates)
      setStats(statsRes.data.stats)
    } catch (error) {
      console.error('Error fetching export data:', error)
      toast.error('Failed to load export options')
    } finally {
      setLoading(false)
    }
  }

  const handleOptionChange = (key, value) => {
    setExportOptions(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleFilterChange = (key, value) => {
    setExportOptions(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: value
      }
    }))
  }

  const handleDateRangeChange = (key, value) => {
    setExportOptions(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [key]: value
      }
    }))
  }

  const handlePreview = async () => {
    try {
      setLoading(true)
      const response = await api.post('/api/export/preview', exportOptions)
      setPreview(response.data)
      setShowPreview(true)
    } catch (error) {
      console.error('Error generating preview:', error)
      toast.error('Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      setLoading(true)
      
      let response
      if (selectedEmails.length > 0) {
        // Export selected emails
        response = await api.post('/api/export/emails/selected', {
          emailIds: selectedEmails.map(email => email._id),
          ...exportOptions
        })
      } else {
        // Export all emails with filters
        response = await api.post('/api/export/emails', exportOptions)
      }

      // Create download link
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/octet-stream' 
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      const filename = response.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '') || 
                     `export_${Date.now()}.${exportOptions.format}`
      link.download = filename
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('Export completed successfully!')
      if (onExportComplete) {
        onExportComplete()
      }
      onClose()
    } catch (error) {
      console.error('Error exporting:', error)
      toast.error('Export failed')
    } finally {
      setLoading(false)
    }
  }

  const getFormatIcon = (format) => {
    const icons = {
      'csv': '📊',
      'xlsx': '📈',
      'json': '🔧',
      'pdf': '📄',
      'txt': '📝',
      'zip': '📦'
    }
    return icons[format] || '📁'
  }

  const getFormatColor = (format) => {
    const colors = {
      'csv': 'from-green-500 to-green-600',
      'xlsx': 'from-blue-500 to-blue-600',
      'json': 'from-yellow-500 to-yellow-600',
      'pdf': 'from-red-500 to-red-600',
      'txt': 'from-gray-500 to-gray-600',
      'zip': 'from-purple-500 to-purple-600'
    }
    return colors[format] || 'from-gray-500 to-gray-600'
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
          className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl shadow-blue-100/20 max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/30 bg-gradient-to-r from-white/60 to-white/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <ModernIcon type="download" size={24} color="#3b82f6" />
                  Export Emails
                </h2>
                <p className="text-slate-600 mt-1">
                  {selectedEmails.length > 0 
                    ? `${selectedEmails.length} selected emails` 
                    : 'Export all emails with filters'
                  }
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

          {/* Content */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Export Format */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Export Format</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(formats).map(([key, format]) => (
                  <motion.button
                    key={key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOptionChange('format', key)}
                    className={`p-4 rounded-2xl border transition-all duration-300 ${
                      exportOptions.format === key
                        ? 'bg-blue-100 border-blue-300 shadow-md'
                        : 'bg-white/60 border-white/50 hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 bg-gradient-to-r ${getFormatColor(key)} rounded-xl flex items-center justify-center text-xl`}>
                        {getFormatIcon(key)}
                      </div>
                      <div className="text-left">
                        <h4 className="font-semibold text-slate-800">{format.name}</h4>
                        <p className="text-xs text-slate-600">.{format.extension}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Export Template */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Export Template</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(templates).map(([key, template]) => (
                  <motion.button
                    key={key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOptionChange('template', key)}
                    className={`p-4 rounded-2xl border transition-all duration-300 ${
                      exportOptions.template === key
                        ? 'bg-green-100 border-green-300 shadow-md'
                        : 'bg-white/60 border-white/50 hover:bg-white/80'
                    }`}
                  >
                    <div className="text-left">
                      <h4 className="font-semibold text-slate-800">{template.name}</h4>
                      <p className="text-sm text-slate-600">{template.description}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={exportOptions.filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="All">All Categories</option>
                    <option value="Academic">Academic</option>
                    <option value="Promotions">Promotions</option>
                    <option value="Placement">Placement</option>
                    <option value="Spam">Spam</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Read Status</label>
                  <select
                    value={exportOptions.filters.isRead || ''}
                    onChange={(e) => handleFilterChange('isRead', e.target.value === '' ? undefined : e.target.value === 'true')}
                    className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">All</option>
                    <option value="true">Read</option>
                    <option value="false">Unread</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
                  <input
                    type="text"
                    value={exportOptions.filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Search in subject, from, or content..."
                    className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date Range</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={exportOptions.dateRange.start}
                      onChange={(e) => handleDateRangeChange('start', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                    <input
                      type="date"
                      value={exportOptions.dateRange.end}
                      onChange={(e) => handleDateRangeChange('end', e.target.value)}
                      className="flex-1 px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Options */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Export Options</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeAttachments}
                    onChange={(e) => handleOptionChange('includeAttachments', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-slate-700">Include attachments (ZIP format only)</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeSummary}
                    onChange={(e) => handleOptionChange('includeSummary', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-slate-700">Include summary sheet (Excel format only)</span>
                </label>
              </div>
            </div>

            {/* Statistics */}
            {stats && (
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Export Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalEmails}</div>
                    <div className="text-sm text-blue-800">Total Emails</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl">
                    <div className="text-2xl font-bold text-green-600">{stats.byReadStatus.read}</div>
                    <div className="text-sm text-green-800">Read</div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-xl">
                    <div className="text-2xl font-bold text-orange-600">{stats.byReadStatus.unread}</div>
                    <div className="text-sm text-orange-800">Unread</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-xl">
                    <div className="text-2xl font-bold text-purple-600">{stats.withAttachments}</div>
                    <div className="text-sm text-purple-800">With Attachments</div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            {showPreview && preview && (
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Preview</h3>
                <div className="bg-slate-50 rounded-xl p-4 max-h-64 overflow-y-auto">
                  <div className="text-sm text-slate-600 mb-2">
                    Showing {preview.preview.length} of {preview.totalCount} records
                  </div>
                  <div className="space-y-2">
                    {preview.preview.slice(0, 5).map((email, index) => (
                      <div key={index} className="p-2 bg-white rounded border text-xs">
                        <div className="font-medium">{email.subject}</div>
                        <div className="text-slate-600">{email.from} • {email.category}</div>
                      </div>
                    ))}
                    {preview.preview.length > 5 && (
                      <div className="text-slate-500 text-center">... and {preview.preview.length - 5} more</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/30 bg-gradient-to-r from-white/60 to-white/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePreview}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-200/60 text-slate-700 rounded-xl font-semibold hover:bg-slate-300/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Preview
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-slate-200/60 text-slate-700 rounded-xl font-semibold hover:bg-slate-300/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={loading}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <ModernIcon type="download" size={16} color="#ffffff" />
                      Export
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ExportModal