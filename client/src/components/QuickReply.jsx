import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import emailService from '../services/emailService'

const QuickReply = ({ email, onClose, onSuccess }) => {
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef(null)

  // Auto-focus textarea when opened
  useEffect(() => {
    if (email && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [email])

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply message')
      return
    }

    if (!email || !email._id) {
      toast.error('No email selected to reply to')
      return
    }

    setLoading(true)
    try {
      const result = await emailService.sendReply(email._id, replyText.trim())
      
      if (result.success) {
        toast.success('Reply sent successfully! ✉️', {
          duration: 4000,
          style: {
            background: '#10b981',
            color: '#ffffff',
            fontWeight: '600'
          }
        })
        
        // Clear reply text
        setReplyText('')
        
        // Call success callback
        if (onSuccess) {
          onSuccess()
        }
        
        // Close the reply panel
        setTimeout(() => {
          onClose()
        }, 500)
      } else {
        throw new Error(result.message || 'Failed to send reply')
      }
    } catch (error) {
      console.error('Error sending reply:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to send reply'
      toast.error(errorMessage, {
        duration: 5000
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    // Cmd/Ctrl + Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSendReply()
    }
  }

  if (!email) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-white shadow-2xl z-50 border-l border-gray-200 flex flex-col"
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Reply
              </h2>
              <div className="text-sm text-gray-600">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">To:</span>
                  <span className="truncate">{email.from}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium flex-shrink-0">Re:</span>
                  <span className="truncate">{email.subject}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Original Email Preview - Fixed */}
        <div className="flex-shrink-0 px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Original message:</div>
          <div className="text-sm text-gray-700 line-clamp-2">
            {email.snippet || email.body || 'No preview available'}
          </div>
        </div>

        {/* Reply Text Area - Flexible with scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <textarea
            ref={textareaRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your reply here..."
            className="w-full h-full min-h-[200px] resize-none border-0 focus:outline-none focus:ring-0 text-gray-900 placeholder-gray-400 text-base leading-relaxed"
          />
        </div>
        
        {/* Character Count - Fixed */}
        <div className="flex-shrink-0 px-6 py-2 text-xs text-gray-500 border-t border-gray-100">
          {replyText.length} characters
        </div>

        {/* Footer Actions - Fixed at bottom */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white">
          <div className="flex flex-col gap-3">
            {/* Keyboard shortcut hint */}
            <div className="text-xs text-gray-500 text-center">
              Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600">⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600">Enter</kbd> to send
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReplyText('')}
                disabled={loading || !replyText}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear Text
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReply}
                disabled={loading || !replyText.trim()}
                className="flex-1 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>Send Reply</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Backdrop overlay for mobile */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/30 z-40 md:hidden"
      />
    </AnimatePresence>
  )
}

export default QuickReply
