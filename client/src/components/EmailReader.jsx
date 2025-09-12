import React from 'react'
import { motion } from 'framer-motion'
import ModernIcon from './ModernIcon'

const EmailReader = ({ email, onArchive, onDelete, onExport, loading = false }) => {
  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/20 rounded mb-4"></div>
          <div className="h-4 bg-white/20 rounded mb-2"></div>
          <div className="h-4 bg-white/20 rounded mb-2 w-3/4"></div>
          <div className="h-32 bg-white/20 rounded"></div>
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
    if (email.html) {
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: email.html }}
        />
      )
    } else if (email.body) {
      return (
        <div className="whitespace-pre-wrap text-slate-700">
          {email.body}
        </div>
      )
    } else {
      return (
        <div className="text-slate-600 italic">
          {email.snippet}
        </div>
      )
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl p-6 h-full flex flex-col"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900 pr-4">
            {email.subject}
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => onArchive(email._id)}
              className="group relative p-3 rounded-xl backdrop-blur-sm bg-gradient-to-br from-orange-400/20 to-orange-600/20 border border-orange-300/30 hover:from-orange-400/30 hover:to-orange-600/30 hover:border-orange-400/50 transition-all duration-300 shadow-lg hover:shadow-orange-200/50"
              title="Archive"
            >
              <ModernIcon 
                type="archive" 
                size={6} 
                color="#ea580c"
                className="group-hover:scale-110 transition-transform duration-200"
              />
            </button>
            <button
              onClick={() => onDelete(email._id)}
              className="group relative p-3 rounded-xl backdrop-blur-sm bg-gradient-to-br from-red-400/20 to-red-600/20 border border-red-300/30 hover:from-red-400/30 hover:to-red-600/30 hover:border-red-400/50 transition-all duration-300 shadow-lg hover:shadow-red-200/50"
              title="Delete"
            >
              <ModernIcon 
                type="delete" 
                size={6} 
                color="#dc2626"
                className="group-hover:scale-110 transition-transform duration-200"
              />
            </button>
            <button
              onClick={() => onExport(email._id)}
              className="group relative p-3 rounded-xl backdrop-blur-sm bg-gradient-to-br from-blue-400/20 to-blue-600/20 border border-blue-300/30 hover:from-blue-400/30 hover:to-blue-600/30 hover:border-blue-400/50 transition-all duration-300 shadow-lg hover:shadow-blue-200/50"
              title="Export"
            >
              <ModernIcon 
                type="export" 
                size={6} 
                color="#2563eb"
                className="group-hover:scale-110 transition-transform duration-200"
              />
            </button>
          </div>
        </div>

        {/* Email Meta */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">From:</span>
            <span className="text-slate-600">{email.from}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">To:</span>
            <span className="text-slate-600">{email.to}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Date:</span>
            <span className="text-slate-600">{formatDate(email.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Category:</span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                email.category
              )}`}
            >
              {email.category}
            </span>
            {email.classification?.confidence && (
              <span className="text-xs text-slate-500">
                ({Math.round(email.classification.confidence * 100)}% confidence)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Email Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="prose prose-sm max-w-none">
          {renderEmailBody()}
        </div>
      </div>

      {/* Attachments */}
      {email.attachments && email.attachments.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/20">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Attachments</h3>
          <div className="space-y-2">
            {email.attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <ModernIcon type="attachment" size={16} color="#6b7280" />
                  <span className="text-sm text-slate-700">
                    {attachment.filename}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({attachment.size})
                  </span>
                </div>
                <button
                  onClick={() => {
                    // Handle attachment download
                    window.open(`/api/emails/${email._id}/attachments/${attachment.attachmentId}/download`)
                  }}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default EmailReader
