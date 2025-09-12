import React from 'react'
import { motion } from 'framer-motion'
import ModernIcon from './ModernIcon'

const EmailList = ({ items, selectedId, onSelect, loading = false, currentPage = 1, totalPages = 1, onPageChange, totalEmails = 0 }) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
            className="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl p-4 animate-pulse"
          >
            <div className="h-4 bg-white/20 rounded mb-2"></div>
            <div className="h-3 bg-white/20 rounded mb-2 w-3/4"></div>
            <div className="h-3 bg-white/20 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ModernIcon type="email" size={48} color="#9ca3af" />
        <h3 className="text-lg font-medium text-slate-600 mt-4">No emails found</h3>
        <p className="text-slate-500 text-sm mt-2">
          Try adjusting your filters or search terms
        </p>
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
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="space-y-2">
      {items.map((email) => (
        <motion.div
          key={email._id}
          onClick={() => onSelect(email._id)}
          className={`
            backdrop-blur-xl border rounded-2xl p-4 cursor-pointer transition-all duration-300
            ${
              selectedId === email._id
                ? 'bg-white/40 border-white/40 shadow-[0_8px_25px_rgba(0,0,0,0.1)]'
                : 'bg-white/30 border-white/20 hover:bg-white/40 hover:border-white/30'
            }
          `}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-800 truncate">
                  {email.from}
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                    email.category
                  )}`}
                >
                  {email.category}
                </span>
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1 truncate">
                {email.subject}
              </h3>
              <p className="text-slate-600 text-sm line-clamp-2">
                {email.snippet}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 ml-3">
              <span className="text-xs text-slate-500">
                {formatDate(email.date)}
              </span>
              {!email.isRead && (
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </div>
          </div>
        </motion.div>
      ))}
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 space-y-2">
          <div className="text-center text-xs text-slate-600">
            Showing {((currentPage - 1) * 25) + 1}-{Math.min(currentPage * 25, totalEmails)} of {totalEmails} emails
          </div>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-5 h-5 rounded-full bg-white/10 border border-white/30 text-slate-600 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
            >
              <ModernIcon type="chevron-left" size={6} color="#6b7280" />
            </button>
            
            <div className="flex gap-2 flex-wrap justify-center">
              {(() => {
                const pageNumbers = []
                
                if (totalPages <= 5) {
                  // Show all pages if 5 or fewer
                  for (let i = 1; i <= totalPages; i++) {
                    pageNumbers.push(i)
                  }
                } else {
                  // Show first 3 pages
                  pageNumbers.push(1, 2, 3)
                  
                  // Add ellipsis if there's a gap
                  if (totalPages > 4) {
                    pageNumbers.push('...')
                  }
                  
                  // Add last page
                  pageNumbers.push(totalPages)
                }
                
                return pageNumbers.map((pageNum, index) => {
                  if (pageNum === '...') {
                    return (
                      <span
                        key={`ellipsis-${index}`}
                        className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-medium text-slate-600"
                      >
                        ...
                      </span>
                    )
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className={`w-4 h-4 rounded-full transition-all duration-200 flex items-center justify-center text-xs font-medium ${
                        currentPage === pageNum
                          ? 'bg-blue-500 text-white shadow-lg'
                          : 'bg-white/20 border border-white/30 text-slate-600 hover:bg-white/30'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })
              })()}
            </div>
            
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-5 h-5 rounded-full bg-white/10 border border-white/30 text-slate-600 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
            >
              <ModernIcon type="chevron-right" size={6} color="#6b7280" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmailList