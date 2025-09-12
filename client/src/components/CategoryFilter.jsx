import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../services/api'

const CategoryFilter = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)

  const currentProvider = searchParams.get('provider') || ''
  const currentLabel = searchParams.get('label') || ''

  useEffect(() => {
    fetchLabels()
  }, [])

  const fetchLabels = async () => {
    try {
      const response = await api.get('/api/emails/labels')
      setLabels(response.data.labels || [])
    } catch (error) {
      console.error('Error fetching labels:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProviderChange = (provider) => {
    const newSearchParams = new URLSearchParams(searchParams)
    if (provider) {
      newSearchParams.set('provider', provider)
    } else {
      newSearchParams.delete('provider')
    }
    newSearchParams.delete('page') // Reset to page 1
    setSearchParams(newSearchParams)
  }

  const handleLabelChange = (label) => {
    const newSearchParams = new URLSearchParams(searchParams)
    if (label) {
      newSearchParams.set('label', label)
    } else {
      newSearchParams.delete('label')
    }
    newSearchParams.delete('page') // Reset to page 1
    setSearchParams(newSearchParams)
  }

  const clearFilters = () => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.delete('provider')
    newSearchParams.delete('label')
    newSearchParams.delete('page')
    setSearchParams(newSearchParams)
  }

  if (loading) {
    return (
      <div className="card-glass p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/20 rounded w-1/4 mb-4"></div>
          <div className="flex space-x-2">
            <div className="h-8 bg-white/20 rounded w-20"></div>
            <div className="h-8 bg-white/20 rounded w-20"></div>
            <div className="h-8 bg-white/20 rounded w-20"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="card-glass p-6"
    >
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Filters</h3>
      
      <div className="space-y-4">
        {/* Provider Filter */}
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-2">
            Email Provider
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleProviderChange('')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                !currentProvider
                  ? 'bg-slate-200/50 text-slate-800'
                  : 'bg-slate-100/50 text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              All Providers
            </button>
            <button
              onClick={() => handleProviderChange('gmail')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                currentProvider === 'gmail'
                  ? 'bg-red-500/20 text-red-600 border border-red-500/30'
                  : 'bg-slate-100/50 text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              📧 Gmail
            </button>
            <button
              onClick={() => handleProviderChange('outlook')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                currentProvider === 'outlook'
                  ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30'
                  : 'bg-slate-100/50 text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              📬 Outlook
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-2">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleLabelChange('')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                !currentLabel
                  ? 'bg-slate-200/50 text-slate-800'
                  : 'bg-slate-100/50 text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              All Categories
            </button>
            {labels.map((label) => (
              <button
                key={label}
                onClick={() => handleLabelChange(label)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  currentLabel === label
                    ? 'bg-purple-500/20 text-purple-600 border border-purple-500/30'
                    : 'bg-slate-100/50 text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Clear Filters */}
        {(currentProvider || currentLabel) && (
          <div className="pt-2">
            <button
              onClick={clearFilters}
              className="text-slate-600 hover:text-slate-800 text-sm underline transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default CategoryFilter
