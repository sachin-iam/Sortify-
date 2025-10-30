import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { getCategoryLightColors } from '../utils/categoryColors'
import ModernIcon from './ModernIcon'
import { highlightText } from '../utils/highlightText.jsx'

const EmailList = ({ items, selectedId, onSelect, loading = false, currentPage = 1, totalPages = 1, onPageChange, totalEmails = 0, onBulkSelect, selectedEmails = [], gmailConnected = false, isCompact = false, searchQuery = '' }) => {
  const [hoveredPage, setHoveredPage] = useState(null)
  const [hasNavigated, setHasNavigated] = useState(false)
  const [selectAll, setSelectAll] = useState(false)
  const scrollContainerRef = useRef(null)

  // Handle individual email selection
  const handleEmailSelect = (email, isSelected) => {
    if (onBulkSelect) {
      if (isSelected) {
        onBulkSelect([...selectedEmails, email])
      } else {
        onBulkSelect(selectedEmails.filter(e => e._id !== email._id))
      }
    }
  }

  // Handle select all
  const handleSelectAll = (checked) => {
    setSelectAll(checked)
    if (onBulkSelect) {
      if (checked) {
        onBulkSelect([...items])
      } else {
        onBulkSelect([])
      }
    }
  }

  // Check if email is selected
  const isEmailSelected = (email) => {
    return selectedEmails.some(e => e._id === email._id)
  }

  // Update select all state when selectedEmails changes
  useEffect(() => {
    if (selectedEmails.length === 0) {
      setSelectAll(false)
    } else if (selectedEmails.length === items.length) {
      setSelectAll(true)
    } else {
      setSelectAll(false)
    }
  }, [selectedEmails, items])

  // Keyboard navigation logic
  const getVisiblePages = () => {
    const pageNumbers = []
    
    if (totalPages <= 4) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      // If user hasn't started navigating, show default layout
      if (!hasNavigated && !hoveredPage) {
        if (currentPage === 1) {
          pageNumbers.push(1, 2, 3)
          pageNumbers.push('...')
          pageNumbers.push(totalPages)
        } else {
          pageNumbers.push(1)
          pageNumbers.push('...')
          pageNumbers.push(currentPage)
          if (currentPage + 1 <= totalPages) pageNumbers.push(currentPage + 1)
          if (currentPage + 2 <= totalPages) pageNumbers.push(currentPage + 2)
          pageNumbers.push('...')
          pageNumbers.push(totalPages)
        }
      } else {
        // Navigation mode
        if (hoveredPage && hoveredPage < currentPage) {
          // Left navigation with boundary check
          const stepsLeft = currentPage - hoveredPage
          const firstPage = Math.max(1, currentPage - 2 - stepsLeft)
          const secondPage = Math.max(1, currentPage - 1 - stepsLeft)
          
          // Stop left navigation if first page becomes 1 and second becomes 2
          if (firstPage === 1 && secondPage === 2) {
            pageNumbers.push(1, 2)
            pageNumbers.push(currentPage)
            pageNumbers.push('...')
            pageNumbers.push(totalPages - 1, totalPages)
          } else {
            pageNumbers.push(firstPage)
            if (secondPage !== firstPage && secondPage < currentPage) {
              pageNumbers.push(secondPage)
            }
            pageNumbers.push(currentPage)
            pageNumbers.push('...')
            pageNumbers.push(totalPages)
          }
        } else if (hoveredPage && hoveredPage > currentPage) {
          // Right navigation with boundary check
          pageNumbers.push(currentPage)
          
          // Stop right navigation if we reach the last two pages
          if (hoveredPage >= totalPages - 1) {
            pageNumbers.push('...')
            pageNumbers.push(totalPages - 1, totalPages)
          } else {
            pageNumbers.push(hoveredPage)
            if (hoveredPage + 1 <= totalPages) {
              pageNumbers.push(hoveredPage + 1)
            }
            pageNumbers.push('...')
            pageNumbers.push(totalPages)
          }
        } else {
          // Default navigation layout
          if (currentPage === 1) {
            pageNumbers.push(1, 2, 3)
            pageNumbers.push('...')
            pageNumbers.push(totalPages - 1, totalPages)
          } else if (currentPage === totalPages) {
            pageNumbers.push(1)
            pageNumbers.push('...')
            pageNumbers.push(totalPages - 2, totalPages - 1, totalPages)
          } else {
            pageNumbers.push(1)
            pageNumbers.push('...')
            pageNumbers.push(currentPage)
            if (currentPage + 1 <= totalPages) pageNumbers.push(currentPage + 1)
            if (currentPage + 2 <= totalPages) pageNumbers.push(currentPage + 2)
            pageNumbers.push('...')
            pageNumbers.push(totalPages)
          }
        }
      }
    }
    
    return pageNumbers
  }

  const handleKeyDown = (event) => {
    if (event.target.closest('.pagination-container')) {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setHasNavigated(true)
        const currentHovered = hoveredPage || currentPage
        const nextPage = Math.min(currentHovered + 1, totalPages)
        
        // Stop right navigation if we reach the last two pages
        if (nextPage >= totalPages - 1) {
          setHoveredPage(totalPages - 1)
        } else {
          setHoveredPage(nextPage)
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setHasNavigated(true)
        const currentHovered = hoveredPage || currentPage
        const prevPage = Math.max(currentHovered - 1, 1)
        
        // Stop left navigation if we reach pages 1 and 2
        if (prevPage <= 2) {
          setHoveredPage(2)
        } else {
          setHoveredPage(prevPage)
        }
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if (hoveredPage && hoveredPage !== currentPage) {
          onPageChange(hoveredPage)
        }
        setHoveredPage(null)
        setHasNavigated(false)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setHoveredPage(null)
        setHasNavigated(false)
      }
    }
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [hoveredPage, currentPage, totalPages])

  // Reset hover when current page changes
  useEffect(() => {
    setHoveredPage(null)
  }, [currentPage])

  // Scroll to top when page changes - SMOOTH SCROLL
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }
  }, [currentPage])

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
        {!gmailConnected ? (
          <>
            <h3 className="text-lg font-medium text-slate-600 mt-4">Gmail Not Connected</h3>
            <p className="text-slate-500 text-sm mt-2">
              Connect your Gmail account to view and manage your emails
            </p>
          </>
        ) : (
          <>
            <h3 className="text-lg font-medium text-slate-600 mt-4">No emails found</h3>
            <p className="text-slate-500 text-sm mt-2">
              Try adjusting your filters or search terms
            </p>
          </>
        )}
      </div>
    )
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
    <div className="flex flex-col h-full">
      {/* Scrollable Email List */}
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
      {/* Bulk Selection Header */}
      {onBulkSelect && (
        <div className="p-4 border-b border-white/30 bg-gradient-to-r from-white/60 to-white/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Select All ({items.length})
                </span>
              </label>
              {selectedEmails.length > 0 && (
                <span className="text-sm text-slate-600">
                  {selectedEmails.length} selected
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      
        <div className="space-y-2 p-4 pb-2">
        {items.map((email) => {
          const isThread = email.isThread && email.messageCount > 1
          
          return (
            <motion.div
              key={email._id}
          className={`
            backdrop-blur-xl border rounded-2xl p-4 transition-all duration-300
            ${
              selectedId === email._id
                ? 'bg-white/40 border-white/40 shadow-[0_8px_25px_rgba(0,0,0,0.1)]'
                : 'bg-white/30 border-white/20 hover:bg-white/40 hover:border-white/30'
            }
            ${isEmailSelected(email) ? 'ring-2 ring-blue-500/50' : ''}
            ${email.isArchived ? 'opacity-70 bg-slate-50/50' : ''}
          `}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="flex items-start gap-3 w-full min-w-0">
            {/* Bulk Selection Checkbox */}
            {onBulkSelect && (
              <div className="flex-shrink-0 pt-1">
                <input
                  type="checkbox"
                  checked={isEmailSelected(email)}
                  onChange={(e) => {
                    e.stopPropagation()
                    handleEmailSelect(email, e.target.checked)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </div>
            )}
            
            {/* Email Content */}
            <div 
              className="flex-1 min-w-0 cursor-pointer overflow-hidden"
              onClick={() => onSelect(email._id)}
            >
              <div className="flex items-start gap-3 w-full min-w-0">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1 min-w-0">
                    <span className={`font-medium truncate flex-1 min-w-0 ${email.isArchived ? 'text-slate-600 italic' : 'text-slate-800'}`}>
                      {searchQuery ? highlightText(email.from, searchQuery) : email.from}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Thread indicator */}
                      {isThread && (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100/80 text-blue-700 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {email.messageCount}
                        </span>
                      )}
                      {email.isArchived && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200/80 text-gray-700 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          Archived
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryLightColors(
                          email.category
                        )}`}
                      >
                        {email.category}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-1 truncate">
                    {searchQuery ? highlightText(email.subject, searchQuery) : email.subject}
                  </h3>
                  <p className="text-slate-600 text-sm line-clamp-2 break-words overflow-hidden">
                    {searchQuery ? highlightText(email.snippet, searchQuery) : email.snippet}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(email.date)}
                  </span>
                  {!email.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
              </div>
            </div>
          </div>
            </motion.div>
        )}
      )}
        </div>
      </div>

      {/* Fixed Pagination at Bottom - Always Visible */}
      {totalPages > 1 && (
        <div className="border-t border-white/30 bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-xl py-3 px-4 space-y-2">
          <div className="text-center text-xs text-slate-600 font-medium">
            Showing {((currentPage - 1) * 25) + 1}-{Math.min(currentPage * 25, totalEmails)} of {totalEmails} emails
          </div>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-7 h-7 rounded-full bg-gray-200 border-2 border-gray-300 text-gray-800 hover:bg-gray-300 hover:border-gray-400 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-md"
            >
              <ModernIcon type="chevron-left" size={10} color="#000000" />
            </button>
            
            <div className="flex gap-2 flex-wrap justify-center pagination-container">
              {getVisiblePages().map((pageNum, index) => {
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
                
                const isCurrentPage = currentPage === pageNum
                const isHoveredPage = hoveredPage === pageNum
                
                return (
                <button
                    key={pageNum}
                    onClick={() => {
                      onPageChange(pageNum)
                      setHoveredPage(null)
                      setHasNavigated(false)
                    }}
                    className={`w-4 h-4 rounded-full transition-all duration-200 flex items-center justify-center text-xs font-medium ${
                      isCurrentPage
                        ? 'bg-blue-500 text-white shadow-lg'
                        : isHoveredPage
                        ? 'bg-gray-300 text-slate-700 shadow-md'
                        : 'bg-white/20 text-slate-600 hover:bg-white/30'
                    }`}
                  >
                    {pageNum}
                </button>
                )
              })}
            </div>
            
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-7 h-7 rounded-full bg-gray-200 border-2 border-gray-300 text-gray-800 hover:bg-gray-300 hover:border-gray-400 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-md"
            >
              <ModernIcon type="chevron-right" size={10} color="#000000" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmailList