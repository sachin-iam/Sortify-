import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import ModernIcon from './ModernIcon'

const BulkOperations = ({ selectedEmails, onOperationComplete, onClose }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [operations, setOperations] = useState([])
  const [selectedOperation, setSelectedOperation] = useState(null)
  const [operationInput, setOperationInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [operationProgress, setOperationProgress] = useState(0)

  useEffect(() => {
    if (selectedEmails.length > 0) {
      setIsOpen(true)
      fetchOperations()
    } else {
      setIsOpen(false)
    }
  }, [selectedEmails])

  const fetchOperations = async () => {
    try {
      const response = await api.get('/bulk/operations')
      setOperations(response.data.operations)
    } catch (error) {
      console.error('Error fetching operations:', error)
      toast.error('Failed to load bulk operations')
    }
  }

  const handleOperationSelect = (operation) => {
    setSelectedOperation(operation)
    setOperationInput('')
  }

  const executeOperation = async () => {
    if (!selectedOperation || selectedEmails.length === 0) return

    setLoading(true)
    setOperationProgress(0)

    try {
      const emailIds = selectedEmails.map(email => email._id)
      let requestData = { emailIds }

      // Prepare request data based on operation type
      switch (selectedOperation.id) {
        case 'categorize':
          requestData.category = operationInput
          requestData.reason = 'Manual bulk categorization'
          break
        case 'delete':
          requestData.permanent = operationInput === 'Permanent deletion'
          break
        case 'mark-read':
          requestData.read = operationInput === 'Mark as Read'
          break
        case 'move':
          requestData.folder = operationInput
          break
        case 'reclassify':
          // No additional input needed
          break
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setOperationProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 100)

      const response = await api.post(`/api/bulk/${selectedOperation.id}`, requestData)

      clearInterval(progressInterval)
      setOperationProgress(100)

      // Show success message
      toast.success(response.data.message, {
        duration: 4000,
        style: {
          background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          color: '#065f46',
          fontSize: '16px',
          fontWeight: '600',
          padding: '20px 24px',
          maxWidth: '500px'
        }
      })

      // Reset and close
      setTimeout(() => {
        setSelectedOperation(null)
        setOperationInput('')
        setOperationProgress(0)
        setIsOpen(false)
        if (onOperationComplete) {
          onOperationComplete()
        }
      }, 1000)

    } catch (error) {
      console.error('Bulk operation error:', error)
      toast.error(error.response?.data?.message || 'Operation failed')
      setOperationProgress(0)
    } finally {
      setLoading(false)
    }
  }

  const getOperationIcon = (operationId) => {
    const icons = {
      'categorize': '🏷️',
      'delete': '🗑️',
      'mark-read': '👁️',
      'move': '📁',
      'reclassify': '🤖'
    }
    return icons[operationId] || '⚙️'
  }

  const getOperationColor = (operationId) => {
    const colors = {
      'categorize': 'from-purple-500 to-purple-600',
      'delete': 'from-red-500 to-red-600',
      'mark-read': 'from-blue-500 to-blue-600',
      'move': 'from-green-500 to-green-600',
      'reclassify': 'from-orange-500 to-orange-600'
    }
    return colors[operationId] || 'from-gray-500 to-gray-600'
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
          className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl shadow-blue-100/20 max-w-2xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/30 bg-gradient-to-r from-white/60 to-white/40">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <ModernIcon type="settings" size={24} color="#3b82f6" />
                Bulk Operations
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-slate-600 mt-2">
              {selectedEmails.length} email{selectedEmails.length !== 1 ? 's' : ''} selected
            </p>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {!selectedOperation ? (
              /* Operation Selection */
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Choose an operation:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {operations.map((operation) => (
                    <motion.button
                      key={operation.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleOperationSelect(operation)}
                      className="p-4 bg-white/60 border border-white/50 rounded-2xl hover:bg-white/80 transition-all duration-300 text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 bg-gradient-to-r ${getOperationColor(operation.id)} rounded-xl flex items-center justify-center text-2xl`}>
                          {getOperationIcon(operation.id)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-800 group-hover:text-slate-900">
                            {operation.name}
                          </h4>
                          <p className="text-sm text-slate-600 group-hover:text-slate-700">
                            {operation.description}
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              /* Operation Configuration */
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-r ${getOperationColor(selectedOperation.id)} rounded-xl flex items-center justify-center text-2xl`}>
                    {getOperationIcon(selectedOperation.id)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-800">{selectedOperation.name}</h3>
                    <p className="text-slate-600">{selectedOperation.description}</p>
                  </div>
                </div>

                {/* Operation Input */}
                {selectedOperation.requiresInput && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">
                      {selectedOperation.inputType === 'select' ? 'Select option:' : 
                       selectedOperation.inputType === 'checkbox' ? 'Options:' :
                       'Enter value:'}
                    </label>
                    
                    {selectedOperation.inputType === 'select' && (
                      <select
                        value={operationInput}
                        onChange={(e) => setOperationInput(e.target.value)}
                        className="w-full px-4 py-3 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800"
                      >
                        <option value="">Choose an option...</option>
                        {selectedOperation.options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    )}

                    {selectedOperation.inputType === 'checkbox' && (
                      <div className="space-y-2">
                        {selectedOperation.options.map((option) => (
                          <label key={option} className="flex items-center gap-3 p-3 bg-white/40 rounded-xl hover:bg-white/60 transition-colors cursor-pointer">
                            <input
                              type="checkbox"
                              checked={operationInput === option}
                              onChange={(e) => setOperationInput(e.target.checked ? option : '')}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-slate-800">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {selectedOperation.inputType === 'text' && (
                      <input
                        type="text"
                        value={operationInput}
                        onChange={(e) => setOperationInput(e.target.value)}
                        placeholder={selectedOperation.placeholder || 'Enter value...'}
                        className="w-full px-4 py-3 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800"
                      />
                    )}
                  </div>
                )}

                {/* Progress Bar */}
                {loading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Processing...</span>
                      <span>{operationProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <motion.div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${operationProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedOperation(null)}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-slate-200/60 text-slate-700 rounded-xl font-semibold hover:bg-slate-300/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Back
                  </button>
                  <button
                    onClick={executeOperation}
                    disabled={loading || (selectedOperation.requiresInput && !operationInput)}
                    className={`flex-1 px-6 py-3 bg-gradient-to-r ${getOperationColor(selectedOperation.id)} text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loading ? 'Processing...' : `Execute ${selectedOperation.name}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default BulkOperations
