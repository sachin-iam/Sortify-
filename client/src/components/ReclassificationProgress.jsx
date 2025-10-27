import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon, ClockIcon, ChartBarIcon, SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { api } from '../services/api'

const ReclassificationProgress = ({ 
  isVisible, 
  job, 
  onClose, 
  onViewDetails 
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [refinementStatus, setRefinementStatus] = useState(null)
  const [phase, setPhase] = useState('phase1') // 'phase1' or 'phase2'

  // Format time remaining
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${seconds}s`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      return `${minutes}m ${remainingSeconds}s`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return `${hours}h ${minutes}m`
    }
  }

  // Fetch Phase 2 refinement status
  useEffect(() => {
    if (!isVisible) return

    const fetchRefinementStatus = async () => {
      try {
        const response = await api.get('/api/realtime/categories/refinement-status')
        if (response.data?.success && response.data.status) {
          setRefinementStatus(response.data.status)
          
          // If Phase 1 is completed and Phase 2 is active, switch to Phase 2
          if (job?.status === 'completed' && response.data.status.isActive) {
            setPhase('phase2')
          }
        }
      } catch (error) {
        console.error('Error fetching refinement status:', error)
      }
    }

    // Initial fetch
    fetchRefinementStatus()

    // Poll every 10 seconds
    const interval = setInterval(fetchRefinementStatus, 10000)

    return () => clearInterval(interval)
  }, [isVisible, job?.status])

  // Update countdown timer
  useEffect(() => {
    if (!job || !isVisible) return

    setTimeRemaining(job.estimatedSecondsRemaining || 0)

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [job, isVisible])

  if (!isVisible || !job) return null

  const progressPercentage = job.progress || 0
  const isCompleted = job.status === 'completed'
  const isFailed = job.status === 'failed'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden min-w-[320px] max-w-[480px]">
          {/* Header */}
          <div className={`${
            phase === 'phase2' 
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600' 
              : 'bg-gradient-to-r from-purple-600 to-blue-600'
          } text-white p-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  {phase === 'phase2' ? (
                    <SparklesIcon className="w-5 h-5" />
                  ) : (
                    <ChartBarIcon className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">
                    {phase === 'phase2' ? 'Refining Classification' : 'Reclassifying Emails'}
                  </h3>
                  <p className="text-xs text-white/80">
                    {phase === 'phase2' ? 'Phase 2: Deep Analysis' : `Phase 1: ${job.categoryName}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            {/* Phase Indicator */}
            <div className="mt-3 flex items-center space-x-2">
              <div className="flex items-center space-x-2 flex-1">
                <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                  isCompleted ? 'bg-green-500/20' : 'bg-white/20'
                }`}>
                  {isCompleted && <CheckCircleIcon className="w-3 h-3" />}
                  <span>Phase 1</span>
                </div>
                <div className="flex-1 h-0.5 bg-white/20"></div>
                <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                  phase === 'phase2' ? 'bg-white/20' : 'bg-white/10'
                }`}>
                  {refinementStatus?.isActive && <SparklesIcon className="w-3 h-3 animate-pulse" />}
                  <span>Phase 2</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Content */}
          <div className="p-4">
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Progress
                </span>
                <span className="text-sm text-gray-500">
                  {progressPercentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div
                  className={`h-2 rounded-full ${
                    isCompleted 
                      ? 'bg-green-500' 
                      : isFailed 
                        ? 'bg-red-500' 
                        : 'bg-gradient-to-r from-purple-500 to-blue-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Stats */}
            {phase === 'phase2' && refinementStatus?.progress ? (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {refinementStatus.progress.refinedEmails || 0}
                  </div>
                  <div className="text-xs text-gray-500">Refined</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {refinementStatus.progress.pendingEmails || 0}
                  </div>
                  <div className="text-xs text-gray-500">Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-600">
                    {refinementStatus.progress.percentComplete}%
                  </div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {job.processedEmails || 0}
                  </div>
                  <div className="text-xs text-gray-500">Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {job.totalEmails || 0}
                  </div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
              </div>
            )}

            {/* Countdown Timer */}
            {!isCompleted && !isFailed && timeRemaining > 0 && (
              <div className="flex items-center justify-center space-x-2 mb-4 p-3 bg-gray-50 rounded-lg">
                <ClockIcon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  {formatTime(timeRemaining)} remaining
                </span>
              </div>
            )}

            {/* Processing Rate */}
            {job.currentRate > 0 && (
              <div className="text-center text-xs text-gray-500 mb-4">
                Processing at {job.currentRate.toFixed(1)} emails/sec
              </div>
            )}

            {/* Status Message */}
            <div className="text-center">
              {phase === 'phase2' && refinementStatus?.isActive ? (
                <div className="text-indigo-600 font-medium text-sm">
                  ✨ Refining with comprehensive analysis...
                </div>
              ) : isCompleted ? (
                <div className="text-green-600 font-medium">
                  {phase === 'phase2' ? '✨ Refinement completed!' : '✅ Phase 1 completed!'}
                </div>
              ) : isFailed ? (
                <div className="text-red-600 font-medium">
                  ❌ Reclassification failed
                </div>
              ) : (
                <div className="text-gray-600 text-sm">
                  {job.message || 'Reclassifying emails...'}
                </div>
              )}
            </div>

            {/* Expandable Details */}
            <div className="mt-4">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full text-left text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {isExpanded ? 'Hide Details' : 'View Details'} ↓
              </button>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 space-y-2 text-xs text-gray-600"
                  >
                    <div className="flex justify-between">
                      <span>Successful:</span>
                      <span className="font-medium">{job.successfulClassifications || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed:</span>
                      <span className="font-medium">{job.failedClassifications || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Elapsed Time:</span>
                      <span className="font-medium">
                        {job.elapsedSeconds ? `${Math.floor(job.elapsedSeconds / 60)}m ${job.elapsedSeconds % 60}s` : '0s'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Job ID:</span>
                      <span className="font-mono text-xs">{job.jobId?.slice(-8)}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Action Buttons */}
          {isCompleted && (
            <div className="px-4 pb-4">
              <button
                onClick={onViewDetails}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                View Results
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ReclassificationProgress
