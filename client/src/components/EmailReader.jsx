import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ModernIcon from './ModernIcon'
import QuickReply from './QuickReply'
import emailService from '../services/emailService'
import { getCategoryLightColors } from '../utils/categoryColors'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const EmailReader = ({ email, threadContainerId, onArchive, onUnarchive, onDelete, onExport, onClose, onReplySuccess, loading = false }) => {
  const [showQuickReply, setShowQuickReply] = useState(false)
  const [threadMessages, setThreadMessages] = useState([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [isThread, setIsThread] = useState(false)

  // Load thread messages when email changes
  useEffect(() => {
    if (email) {
      // Reset states
      setThreadMessages([])
      setLoadError(null)
      setIsThread(false)
      
      // Check if this is a thread container (any thread, even with 1 message)
      const isThreadContainer = email.isThread || email.threadId
      
      if (isThreadContainer) {
        // Load thread messages (works for both multi-message and single-message threads)
        setLoadingThread(true)
        setIsThread(email.messageCount > 1)
        
        console.log('📧 Loading thread messages for container:', email._id)
        console.log('📧 Email object:', email)
        console.log('📧 Is multi-message thread:', email.messageCount > 1)
        
        emailService.getThreadMessages(email._id)
          .then(response => {
            console.log('📧 Thread response:', response)
            if (response.success) {
              setThreadMessages(response.messages || [])
              console.log('✅ Thread messages loaded:', response.messages.length)
            } else {
              const errorMsg = response.message || 'Failed to load thread messages'
              console.error('❌ Thread load failed:', errorMsg)
              setLoadError(errorMsg)
            }
          })
          .catch(error => {
            console.error('❌ Error loading thread messages:', error)
            console.error('Error response:', error.response?.data)
            const errorMsg = error.response?.data?.message || error.message || 'Failed to load thread messages'
            setLoadError(errorMsg)
          })
          .finally(() => {
            setLoadingThread(false)
          })
      } else {
        // Single email with no thread - load full content
        setLoadingThread(true)
        
        console.log('📧 Loading single email full content:', email._id)
        
        emailService.getFullEmailContent(email._id)
          .then(response => {
            if (response.success) {
              setThreadMessages([response.email])
              console.log('✅ Full email content loaded:', email.subject)
            } else {
              const errorMsg = response.message || 'Failed to load email content'
              console.error('❌ Email load failed:', errorMsg)
              setLoadError(errorMsg)
            }
          })
          .catch(error => {
            console.error('❌ Error loading full email content:', error)
            console.error('Error response:', error.response?.data)
            const errorMsg = error.response?.data?.message || error.message || 'Failed to load email content'
            setLoadError(errorMsg)
          })
          .finally(() => {
            setLoadingThread(false)
          })
      }
    }
  }, [email])

  const handleReplySuccess = async (sentEmailData) => {
    // Close the reply panel
    setShowQuickReply(false)
    
    // If we have the sent email data, add it to the thread immediately
    if (sentEmailData) {
      setThreadMessages(prev => [...prev, sentEmailData])
      console.log('✅ Sent reply added to thread messages')
      
      // Also update the email list container if handler provided
      if (onReplySuccess && threadContainerId) {
        console.log('📧 Calling parent reply success handler')
        onReplySuccess(sentEmailData, threadContainerId)
      }
      
      return
    }
    
    // Otherwise, refresh the thread to show the new reply
    if (email) {
      const isThreadContainer = email.isThread && email.messageCount > 1
      
      if (isThreadContainer) {
        // Reload thread messages
        try {
          const response = await emailService.getThreadMessages(email._id)
          if (response.success) {
            setThreadMessages(response.messages || [])
            console.log('✅ Thread refreshed after reply')
          }
        } catch (error) {
          console.error('Error refreshing thread after reply:', error)
        }
      } else {
        // For single emails, reload the email content
        try {
          const response = await emailService.getFullEmailContent(email._id)
          if (response.success) {
            setThreadMessages([response.email])
          }
        } catch (error) {
          console.error('Error refreshing email after reply:', error)
        }
      }
    }
  }

  if (loading || loadingThread) {
    return (
      <div className="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/20 rounded mb-4"></div>
          <div className="h-4 bg-white/20 rounded mb-2"></div>
          <div className="h-4 bg-white/20 rounded mb-2 w-3/4"></div>
          <div className="h-32 bg-white/20 rounded"></div>
          {loadingThread && (
            <div className="text-center text-sm text-slate-600 mt-4">
              {isThread ? 'Loading conversation...' : 'Loading email content...'}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!email) {
    return (
      <div className="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl p-6 flex items-center justify-center">
        <div className="text-center">
          <ModernIcon type="email" size={48} color="#9ca3af" />
          <h3 className="text-lg font-medium text-slate-600 mt-4">Select an email</h3>
          <p className="text-slate-500 text-sm mt-2">
            Choose an email from the list to view its contents
          </p>
        </div>
      </div>
    )
  }


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const renderMessageBody = (message) => {
    if (message.html) {
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: message.html }}
        />
      )
    } else if (message.body || message.text) {
      return (
        <div className="whitespace-pre-wrap text-slate-700">
          {message.body || message.text}
        </div>
      )
    } else {
      return (
        <div className="text-slate-600 italic">
          {message.snippet}
        </div>
      )
    }
  }

  const renderError = () => {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2">Failed to load email content</div>
        <button 
          onClick={() => {
            setLoadError(null)
            // Retry loading
            if (email.isThread && email.messageCount > 1) {
              setLoadingThread(true)
              emailService.getThreadMessages(email._id)
                .then(response => {
                  if (response.success) {
                    setThreadMessages(response.messages || [])
                  } else {
                    setLoadError('Failed to load thread messages')
                  }
                })
                .catch(() => setLoadError('Failed to load thread messages'))
                .finally(() => setLoadingThread(false))
            } else {
              setLoadingThread(true)
              emailService.getFullEmailContent(email._id)
                .then(response => {
                  if (response.success) {
                    setThreadMessages([response.email])
                  } else {
                    setLoadError('Failed to load email content')
                  }
                })
                .catch(() => setLoadError('Failed to load email content'))
                .finally(() => setLoadingThread(false))
            }
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-xl bg-white/40 border border-white/20 rounded-3xl shadow-2xl shadow-blue-100/20 min-h-[400px] max-h-[calc(100vh-120px)] overflow-y-auto"
      >
        {/* Header Section with Gradient */}
        <div className="relative bg-gradient-to-br from-blue-50/80 via-white/60 to-purple-50/80">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5"></div>
          <div className="relative p-6 pb-4">
            {/* Subject and Actions */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1 pr-6">
                <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-2">
                  {email.subject}
                </h1>
                {/* Category Badge */}
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${getCategoryLightColors(
                      email.category
                    )}`}
                  >
                    {email.category}
                  </span>
                  {email.classification?.confidence && (
                    <span className="text-xs text-slate-600 bg-slate-100/80 px-2 py-1 rounded-full">
                      {Math.round(email.classification.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowQuickReply(true)}
                  className="group relative p-3 rounded-xl backdrop-blur-sm bg-gradient-to-br from-green-400/20 to-green-600/20 border border-green-300/30 hover:from-green-400/30 hover:to-green-600/30 hover:border-green-400/50 transition-all duration-300 shadow-md hover:shadow-green-200/50 hover:scale-105 flex items-center justify-center"
                  title="Quick Reply"
                >
                  <ModernIcon 
                    type="reply" 
                    size={15} 
                    color="#16a34a"
                    className="group-hover:scale-110 transition-transform duration-200"
                  />
                </button>
                {email.isArchived ? (
                  <button
                    onClick={() => onUnarchive(email._id)}
                    className="group relative p-3 rounded-xl backdrop-blur-sm bg-gradient-to-br from-blue-400/20 to-blue-600/20 border border-blue-300/30 hover:from-blue-400/30 hover:to-blue-600/30 hover:border-blue-400/50 transition-all duration-300 shadow-md hover:shadow-blue-200/50 hover:scale-105 flex items-center justify-center"
                    title="Unarchive"
                  >
                    <svg className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => onArchive(email._id)}
                    className="group relative p-3 rounded-xl backdrop-blur-sm bg-gradient-to-br from-orange-400/20 to-orange-600/20 border border-orange-300/30 hover:from-orange-400/30 hover:to-orange-600/30 hover:border-orange-400/50 transition-all duration-300 shadow-md hover:shadow-orange-200/50 hover:scale-105 flex items-center justify-center"
                    title="Archive"
                  >
                    <ModernIcon 
                      type="archive" 
                      size={15} 
                      color="#ea580c"
                      className="group-hover:scale-110 transition-transform duration-200"
                    />
                  </button>
                )}
                <button
                  onClick={() => onDelete(email._id)}
                  className="group relative p-3 rounded-xl backdrop-blur-sm bg-gradient-to-br from-red-400/20 to-red-600/20 border border-red-300/30 hover:from-red-400/30 hover:to-red-600/30 hover:border-red-400/50 transition-all duration-300 shadow-md hover:shadow-red-200/50 hover:scale-105 flex items-center justify-center"
                  title="Delete"
                >
                  <ModernIcon 
                    type="delete" 
                    size={15} 
                    color="#dc2626"
                    className="group-hover:scale-110 transition-transform duration-200"
                  />
                </button>
                <button
                  onClick={onClose}
                  className="group relative p-3 rounded-xl backdrop-blur-sm bg-gradient-to-br from-gray-400/20 to-gray-600/20 border border-gray-300/30 hover:from-gray-400/30 hover:to-gray-600/30 hover:border-gray-400/50 transition-all duration-300 shadow-md hover:shadow-gray-200/50 hover:scale-105 flex items-center justify-center"
                  title="Close"
                >
                  <ModernIcon 
                    type="close" 
                    size={15} 
                    color="#6b7280"
                    className="group-hover:scale-110 transition-transform duration-200"
                  />
                </button>
              </div>
            </div>

            {/* Email Meta Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/30 rounded-2xl border border-white/20 backdrop-blur-sm">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ModernIcon type="user" size={3} color="#2563eb" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">From</span>
                    <span className="text-sm text-slate-900 break-words leading-relaxed">{email.from}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ModernIcon type="user" size={3} color="#059669" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">To</span>
                    <span className="text-sm text-slate-900 break-words leading-relaxed">{email.to}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ModernIcon type="calendar" size={3} color="#7c3aed" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Date</span>
                    <span className="text-sm text-slate-900">{formatDate(email.date)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Thread Messages Section */}
        <div className="p-8">
          {loadError ? (
            renderError()
          ) : threadMessages.length === 0 ? (
            <div className="text-center text-slate-600 italic">No messages to display</div>
          ) : (
            <div className="space-y-6">
              {threadMessages.map((message, index) => {
                const isLatest = index === threadMessages.length - 1
                const isFirst = index === 0
                
                return (
                  <div key={message._id || index}>
                    {/* Message Container */}
                    <div
                      className={`
                        ${!isLatest ? 'opacity-80' : ''}
                        transition-opacity duration-200
                      `}
                    >
                      {/* Message Header */}
                      <div className="flex items-start justify-between mb-4 pb-3 border-b border-slate-200/50">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isLatest ? 'bg-gradient-to-br from-blue-100 to-blue-200' : 'bg-slate-200'
                          }`}>
                            <span className="text-sm font-semibold text-slate-700">
                              {message.from?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900">
                              {message.from}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              to {message.to}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 whitespace-nowrap ml-4">
                          {formatDate(message.date)}
                        </div>
                      </div>

                      {/* Message Body */}
                      <div className={`
                        prose prose-slate max-w-none break-words leading-relaxed
                        ${!isLatest ? 'prose-sm' : ''}
                      `}>
                        <div className="text-slate-900 text-sm leading-6">
                          {renderMessageBody(message)}
                        </div>
                      </div>

                      {/* Message Attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200/50">
                          <div className="flex items-center gap-2 mb-3">
                            <ModernIcon type="attachment" size={3} color="#64748b" />
                            <span className="text-sm font-medium text-slate-700">
                              {message.attachments.length} {message.attachments.length === 1 ? 'attachment' : 'attachments'}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {message.attachments.map((attachment, attIndex) => (
                              <div
                                key={attIndex}
                                className="flex items-center justify-between p-3 bg-slate-50/60 rounded-xl border border-slate-200/50 hover:bg-slate-100/60 transition-all duration-200"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                                    <ModernIcon type="attachment" size={3} color="#2563eb" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900 text-sm">{attachment.filename}</p>
                                    <p className="text-xs text-slate-600">
                                      {Math.round(attachment.size / 1024)} KB
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    window.open(`${API_BASE_URL}/emails/${message._id}/attachments/${attachment.attachmentId}/download`)
                                  }}
                                  className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 text-xs font-medium shadow-sm hover:shadow-md"
                                >
                                  Download
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Separator between messages (not after last message) */}
                    {!isLatest && (
                      <div className="my-6 border-t-2 border-slate-200/30"></div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Reply Panel */}
      {showQuickReply && (
        <QuickReply
          email={threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : email}
          onClose={() => setShowQuickReply(false)}
          onSuccess={handleReplySuccess}
        />
      )}

    </div>
  )
}

export default EmailReader
