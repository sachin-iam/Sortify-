import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../services/api'
import BulkActions from './BulkActions'
import { formatRelativeTime, truncateText } from '../utils'

const EmailList = () => {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedEmails, setSelectedEmails] = useState([])
  const [classifying, setClassifying] = useState(false)
  const [pagination, setPagination] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const currentProvider = searchParams.get('provider') || ''
  const currentLabel = searchParams.get('label') || ''
  const currentPage = parseInt(searchParams.get('page')) || 1
  const currentLimit = parseInt(searchParams.get('limit')) || 50

  useEffect(() => {
    fetchEmails()

    // Set up real-time refresh for email list
    const refreshInterval = setInterval(() => {
      fetchEmails()
    }, 60000) // Refresh every minute

    return () => clearInterval(refreshInterval)
  }, [currentProvider, currentLabel, currentPage, currentLimit])

  const fetchEmails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams()
      if (currentProvider) params.set('provider', currentProvider)
      if (currentLabel) params.set('label', currentLabel)
      if (searchQuery) params.set('q', searchQuery)
      params.set('page', currentPage.toString())
      params.set('limit', currentLimit.toString())
      
      const response = await api.get(`/api/emails?${params.toString()}`)
      setEmails(response.data.emails || [])
      setPagination(response.data.pagination || null)
    } catch (err) {
      setError('Failed to fetch emails')
      console.error('Error fetching emails:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('q', searchQuery.trim())
      newSearchParams.delete('page')
      setSearchParams(newSearchParams)
    }
  }

  const handlePageChange = (page) => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('page', page.toString())
    setSearchParams(newSearchParams)
  }

  const handleLimitChange = (limit) => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('limit', limit.toString())
    newSearchParams.delete('page')
    setSearchParams(newSearchParams)
  }

  const clearSearch = () => {
    setSearchQuery('')
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.delete('q')
    newSearchParams.delete('page')
    setSearchParams(newSearchParams)
  }

  const handleEmailSelect = (emailId) => {
    setSelectedEmails(prev => 
      prev.includes(emailId) 
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    )
  }

  const handleSelectAll = () => {
    if (selectedEmails.length === emails.length) {
      setSelectedEmails([])
    } else {
      setSelectedEmails(emails.map(email => email._id))
    }
  }

  const classifyEmail = async (emailId) => {
    try {
      setClassifying(true)
      await api.post(`/api/emails/classify/${emailId}`)
      fetchEmails()
    } catch (err) {
      console.error('Error classifying email:', err)
      setError('Failed to classify email')
    } finally {
      setClassifying(false)
    }
  }

  const classifyBatch = async () => {
    if (selectedEmails.length === 0) {
      setError('Please select emails to classify')
      return
    }

    try {
      setClassifying(true)
      await api.post('/api/emails/classify/batch', { emailIds: selectedEmails })
      setSelectedEmails([])
      fetchEmails()
    } catch (err) {
      console.error('Error batch classifying emails:', err)
      setError('Failed to classify emails in batch')
    } finally {
      setClassifying(false)
    }
  }

  const handleBulkClassify = async (emailIds, category) => {
    setBulkProcessing(true)
    try {
      const response = await api.post('/api/emails/classify', {
        emailIds,
        category
      })
      
      if (response.data.success) {
        setSelectedEmails([])
        fetchEmails()
        return { success: true }
      }
      throw new Error('Classification failed')
    } catch (error) {
      throw error
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkExport = async (emailIds) => {
    setBulkProcessing(true)
    try {
      const response = await api.post('/api/emails/export', {
        emailIds,
        format: 'csv'
      }, {
        responseType: 'blob'
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `emails-export-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      setSelectedEmails([])
    } catch (error) {
      throw error
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkDelete = async (emailIds) => {
    setBulkProcessing(true)
    try {
      const response = await api.delete('/api/emails/bulk', {
        data: { emailIds }
      })
      
      if (response.data.success) {
        setSelectedEmails([])
        fetchEmails()
        return { success: true }
      }
      throw new Error('Deletion failed')
    } catch (error) {
      throw error
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkArchive = async (emailIds) => {
    setBulkProcessing(true)
    try {
      const response = await api.post('/api/emails/archive', {
        emailIds
      })
      
      if (response.data.success) {
        setSelectedEmails([])
        fetchEmails()
        return { success: true }
      }
      throw new Error('Archive failed')
    } catch (error) {
      throw error
    } finally {
      setBulkProcessing(false)
    }
  }

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-400'
    if (confidence >= 0.6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getConfidenceText = (confidence) => {
    if (confidence >= 0.8) return 'High'
    if (confidence >= 0.6) return 'Medium'
    return 'Low'
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="card-glass">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-white/20 rounded w-1/4 mb-4"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-white/10 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card-glass">
        <div className="p-6">
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-red-400 mr-3">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-red-400">{error}</h3>
                <button
                  onClick={fetchEmails}
                  className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="card-glass"
    >
      {/* Header with Search */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-white">Email List</h3>
            <p className="text-white/70">
              {pagination ? `${pagination.total} emails` : '0 emails'} • {selectedEmails.length} selected
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 text-sm font-medium text-white/70 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors"
            >
              {selectedEmails.length === emails.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={classifyBatch}
              disabled={selectedEmails.length === 0 || classifying}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500/20 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {classifying ? 'Classifying...' : `Classify ${selectedEmails.length} Email${selectedEmails.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in subject and body..."
              className="input-glass w-full pl-10"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <button
            type="submit"
            className="btn-glass"
          >
            Search
          </button>
          {(searchQuery || currentProvider || currentLabel) && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-4 py-2 text-sm font-medium text-white/70 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Email List */}
      <div className="divide-y divide-white/10">
        {emails.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📧</div>
            <h3 className="text-lg font-medium text-white mb-2">No emails found</h3>
            <p className="text-white/70">
              {searchQuery || currentProvider || currentLabel 
                ? 'Try adjusting your search criteria or filters.'
                : 'Get started by syncing your email accounts.'
              }
            </p>
          </div>
        ) : (
          emails.map((email, index) => (
            <motion.div
              key={email._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-6 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-start space-x-4">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedEmails.includes(email._id)}
                  onChange={() => handleEmailSelect(email._id)}
                  className="mt-1 h-4 w-4 text-blue-500 focus:ring-blue-400 border-white/20 rounded bg-transparent"
                />
                
                {/* Email Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-white">
                        {email.from}
                      </span>
                      <span className="text-white/40">•</span>
                      <span className="text-sm text-white/60">
                        {formatDate(email.date)}
                      </span>
                    </div>
                    
                    {/* Classification Badge */}
                    {email.classification?.label ? (
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          email.classification.confidence >= 0.8 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : email.classification.confidence >= 0.6 
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {email.classification.label}
                        </span>
                        <span className={`text-xs ${getConfidenceColor(email.classification.confidence)}`}>
                          {Math.round(email.classification.confidence * 100)}%
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => classifyEmail(email._id)}
                        disabled={classifying}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20 transition-colors disabled:opacity-50"
                      >
                        {classifying ? 'Classifying...' : 'Classify'}
                      </button>
                    )}
                  </div>
                  
                  <h4 className="text-sm font-medium text-white mt-1">
                    {email.subject}
                  </h4>
                  
                  <p className="text-sm text-white/60 mt-1 line-clamp-2">
                    {email.snippet}
                  </p>
                  
                  {/* Classification Details */}
                  {email.classification?.label && (
                    <div className="mt-2 text-xs text-white/50">
                      <span>Model: {email.classification.modelVersion || '1.0.0'}</span>
                      <span className="mx-2">•</span>
                      <span>Classified: {formatDate(email.classification.classifiedAt)}</span>
                      <span className="mx-2">•</span>
                      <span>Confidence: {getConfidenceText(email.classification.confidence)}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="p-6 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <label htmlFor="limit" className="text-sm text-white/70">Show:</label>
              <select
                id="limit"
                value={currentLimit}
                onChange={(e) => handleLimitChange(e.target.value)}
                className="px-2 py-1 text-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-white/10 text-white"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span className="text-sm text-white/70">per page</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-white/70">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              
              <nav className="flex space-x-1">
                <button
                  onClick={() => handlePageChange(pagination.prevPage)}
                  disabled={!pagination.hasPrevPage}
                  className="px-3 py-1 text-sm font-medium text-white/70 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <button
                  onClick={() => handlePageChange(pagination.nextPage)}
                  disabled={!pagination.hasNextPage}
                  className="px-3 py-1 text-sm font-medium text-white/70 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      <BulkActions
        selectedEmails={selectedEmails}
        onClearSelection={() => setSelectedEmails([])}
        onBulkClassify={handleBulkClassify}
        onBulkExport={handleBulkExport}
        onBulkDelete={handleBulkDelete}
        onBulkArchive={handleBulkArchive}
        isProcessing={bulkProcessing}
      />
    </motion.div>
  )
}

export default EmailList
