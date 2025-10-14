import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ModernIcon from './ModernIcon'
import QuickReply from './QuickReply'
import emailService from '../services/emailService'

const EmailReader = ({ email, onArchive, onDelete, onExport, onClose, loading = false }) => {
  const [showQuickReply, setShowQuickReply] = useState(false)
  const [fullEmail, setFullEmail] = useState(null)
  const [loadingFullContent, setLoadingFullContent] = useState(false)
  const [loadError, setLoadError] = useState(null)

  // Load full content when email changes
  useEffect(() => {
    if (email) {
      // Reset states
      setFullEmail(null)
      setLoadError(null)
      
      // Check if email has full content loaded
      if (email.isFullContentLoaded && (email.html || email.body)) {
        setFullEmail(email)
        return
      }
      
      // Load full content if not already loaded
      setLoadingFullContent(true)
      
      emailService.getFullEmailContent(email._id)
        .then(response => {
          if (response.success) {
            setFullEmail(response.email)
            console.log('✅ Full email content loaded:', email.subject)
          } else {
            setLoadError('Failed to load email content')
          }
        })
        .catch(error => {
          console.error('Error loading full email content:', error)
          setLoadError('Failed to load email content')
        })
        .finally(() => {
          setLoadingFullContent(false)
        })
    }
  }, [email])

  const handleQuickReply = async (replyData) => {
    // Here you would typically send the reply via your email service
    console.log('Sending reply:', replyData)
    // For now, we'll just close the quick reply modal
    setShowQuickReply(false)
  }

  if (loading || loadingFullContent) {
    return (
      <div className="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/20 rounded mb-4"></div>
          <div className="h-4 bg-white/20 rounded mb-2"></div>
          <div className="h-4 bg-white/20 rounded mb-2 w-3/4"></div>
          <div className="h-32 bg-white/20 rounded"></div>
          {loadingFullContent && (
            <div className="text-center text-sm text-slate-600 mt-4">
              Loading full email content...
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

  const getCategoryColor = (category) => {
    const colors = {
      Academic: 'bg-blue-100 text-blue-800',
      Promotions: 'bg-purple-100 text-purple-800',
      Placement: 'bg-green-100 text-green-800',
      Spam: 'bg-red-100 text-red-800',
      Other: 'bg-gray-100 text-gray-800'
    }
    return colors[category] || colors.Other
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const renderEmailBody = () => {
    // Use fullEmail if available, otherwise fall back to email
    const currentEmail = fullEmail || email
    
    if (loadError) {
      return (
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">Failed to load email content</div>
          <button 
            onClick={() => {
              setLoadError(null)
              setLoadingFullContent(true)
              emailService.getFullEmailContent(email._id)
                .then(response => {
                  if (response.success) {
                    setFullEmail(response.email)
                  } else {
                    setLoadError('Failed to load email content')
                  }
                })
                .catch(error => {
                  setLoadError('Failed to load email content')
                })
                .finally(() => {
                  setLoadingFullContent(false)
                })
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      )
    }
    
    if (currentEmail.html) {
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: currentEmail.html }}
        />
      )
    } else if (currentEmail.body) {
      return (
        <div className="whitespace-pre-wrap text-slate-700">
          {currentEmail.body}
        </div>
      )
    } else {
      return (
        <div className="text-slate-600 italic">
          {currentEmail.snippet}
        </div>
      )
    }
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
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${getCategoryColor(
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

        {/* Email Body Section */}
        <div className="p-8">
          <div className="prose prose-slate max-w-none break-words leading-relaxed">
            <div className="text-slate-900 text-sm leading-6">
              {renderEmailBody()}
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        {(fullEmail?.attachments || email.attachments) && (fullEmail?.attachments?.length > 0 || email.attachments?.length > 0) && (
          <div className="border-t border-white/30 bg-gradient-to-r from-slate-50/50 to-blue-50/30">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                  <ModernIcon type="attachment" size={3} color="#2563eb" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Attachments ({(fullEmail?.attachments || email.attachments).length})
                </h3>
              </div>
              <div className="space-y-3">
                {(fullEmail?.attachments || email.attachments).map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/30 hover:bg-white/80 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                        <ModernIcon type="attachment" size={4} color="#2563eb" />
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
                        // Handle attachment download
                        window.open(`/api/emails/${email._id}/attachments/${attachment.attachmentId}/download`)
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md hover:scale-105"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Quick Reply Modal */}
      {showQuickReply && (
        <QuickReply
          email={email}
          onReply={handleQuickReply}
          onClose={() => setShowQuickReply(false)}
        />
      )}

    </div>
  )
}

export default EmailReader
