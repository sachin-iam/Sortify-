import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckIcon, 
  XMarkIcon, 
  ArrowDownTrayIcon,
  TrashIcon,
  TagIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const BulkActions = ({ 
  selectedEmails, 
  onClearSelection, 
  onBulkClassify, 
  onBulkExport,
  onBulkDelete,
  onBulkArchive,
  isProcessing = false 
}) => {
  const [showActions, setShowActions] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')

  const categories = [
    { value: 'Academic', label: 'Academic', color: 'bg-blue-500' },
    { value: 'Promotions', label: 'Promotions', color: 'bg-green-500' },
    { value: 'Placement', label: 'Placement', color: 'bg-purple-500' },
    { value: 'Spam', label: 'Spam', color: 'bg-red-500' },
    { value: 'Other', label: 'Other', color: 'bg-gray-500' }
  ]

  const handleBulkClassify = async () => {
    if (!selectedCategory) {
      toast.error('Please select a category')
      return
    }

    try {
      await onBulkClassify(selectedEmails, selectedCategory)
      toast.success(`Classified ${selectedEmails.length} emails as ${selectedCategory}`)
      setSelectedCategory('')
    } catch (error) {
      toast.error('Failed to classify emails')
    }
  }

  const handleBulkExport = async () => {
    try {
      await onBulkExport(selectedEmails)
      toast.success(`Exported ${selectedEmails.length} emails`)
    } catch (error) {
      toast.error('Failed to export emails')
    }
  }

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedEmails.length} emails?`)) {
      try {
        await onBulkDelete(selectedEmails)
        toast.success(`Deleted ${selectedEmails.length} emails`)
      } catch (error) {
        toast.error('Failed to delete emails')
      }
    }
  }

  const handleBulkArchive = async () => {
    try {
      await onBulkArchive(selectedEmails)
      toast.success(`Archived ${selectedEmails.length} emails`)
    } catch (error) {
      toast.error('Failed to archive emails')
    }
  }

  if (selectedEmails.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="bg-white/90 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-4 min-w-[400px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <CheckIcon className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-gray-800">
                {selectedEmails.length} email{selectedEmails.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            <button
              onClick={onClearSelection}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Bulk Classify */}
            <div className="flex items-center space-x-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-white/80 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isProcessing}
              >
                <option value="">Select Category</option>
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkClassify}
                disabled={!selectedCategory || isProcessing}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <TagIcon className="w-4 h-4" />
                <span>Classify</span>
              </button>
            </div>

            {/* Bulk Export */}
            <button
              onClick={handleBulkExport}
              disabled={isProcessing}
              className="flex items-center space-x-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>Export</span>
            </button>

            {/* Bulk Archive */}
            <button
              onClick={handleBulkArchive}
              disabled={isProcessing}
              className="flex items-center space-x-1 px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <ClockIcon className="w-4 h-4" />
              <span>Archive</span>
            </button>

            {/* Bulk Delete */}
            <button
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="flex items-center space-x-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <TrashIcon className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>

          {isProcessing && (
            <div className="mt-3 flex items-center space-x-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span>Processing...</span>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default BulkActions
