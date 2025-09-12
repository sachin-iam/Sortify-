import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon, DocumentArrowDownIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { exportService } from '../services/exportService'
import toast from 'react-hot-toast'

const ExportModal = ({ isOpen, onClose, selectedEmails = [], type = 'emails' }) => {
  const [exportFormat, setExportFormat] = useState('csv')
  const [includeFilters, setIncludeFilters] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      let result
      
      if (type === 'emails') {
        if (exportFormat === 'csv') {
          result = await exportService.exportEmailsToCSV(selectedEmails, { includeFilters })
        } else {
          result = await exportService.exportEmailsToPDF(selectedEmails, { includeFilters })
        }
      } else if (type === 'analytics') {
        if (exportFormat === 'csv') {
          result = await exportService.exportAnalyticsToCSV(timeRange)
        } else {
          result = await exportService.exportAnalyticsToPDF(timeRange)
        }
      }

      if (result.success) {
        toast.success('Export completed successfully!')
        onClose()
      }
    } catch (error) {
      toast.error('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6 w-full max-w-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-slate-800">Export {type === 'emails' ? 'Emails' : 'Analytics'}</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">Export Format</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    exportFormat === 'csv'
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                      : 'bg-slate-100/50 border-slate-300/50 text-slate-600 hover:bg-slate-200/50'
                  }`}
                >
                  <DocumentTextIcon className="w-5 h-5" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => setExportFormat('pdf')}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    exportFormat === 'pdf'
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                      : 'bg-slate-100/50 border-slate-300/50 text-slate-600 hover:bg-slate-200/50'
                  }`}
                >
                  <DocumentArrowDownIcon className="w-5 h-5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Type-specific options */}
            {type === 'emails' && (
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={includeFilters}
                    onChange={(e) => setIncludeFilters(e.target.checked)}
                    className="rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Include current filters</span>
                </label>
                {selectedEmails.length > 0 && (
                  <p className="text-sm text-slate-600 mt-2">
                    Exporting {selectedEmails.length} selected emails
                  </p>
                )}
              </div>
            )}

            {type === 'analytics' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Time Range</label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100/50 border border-slate-300/50 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                </select>
              </div>
            )}

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <DocumentArrowDownIcon className="w-5 h-5" />
                  <span>Export {exportFormat.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default ExportModal
