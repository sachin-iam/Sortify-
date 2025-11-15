import React, { useState, useEffect } from 'react'
import ModernIcon from './ModernIcon'

const Pagination = ({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }) => {
  const [previewPage, setPreviewPage] = useState(null)

  // Generate page numbers to display
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages = []
    
    // Always show first page
    pages.push(1)
    
    // Calculate range around current page
    const startPage = Math.max(2, currentPage - 1)
    const endPage = Math.min(totalPages - 1, currentPage + 1)
    
    // Add ellipsis after first page if needed
    if (startPage > 2) {
      pages.push('...')
    }
    
    // Add pages around current page
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    
    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
      pages.push('...')
    }
    
    // Always show last page if more than 1 page
    if (totalPages > 1) {
      pages.push(totalPages)
    }
    
    return pages
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle if no input/textarea is focused
      if (document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA') {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (currentPage > 1) {
          const nextPage = currentPage - 1
          setPreviewPage(nextPage)
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (currentPage < totalPages) {
          const nextPage = currentPage + 1
          setPreviewPage(nextPage)
        }
      } else if (event.key === 'Enter' && previewPage) {
        event.preventDefault()
        onPageChange(previewPage)
        setPreviewPage(null)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setPreviewPage(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages, previewPage, onPageChange])

  // Reset preview when page changes
  useEffect(() => {
    setPreviewPage(null)
  }, [currentPage])

  const pageNumbers = getPageNumbers()
  const activePage = previewPage || currentPage
  const startItem = ((currentPage - 1) * itemsPerPage) + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="border-t border-white/30 bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-xl py-2.5 px-4">
      {/* Items counter */}
      <div className="text-center text-xs text-slate-600 font-medium mb-2">
        Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of {totalItems.toLocaleString()} emails
      </div>
      
      {/* Pagination controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-6 h-6 rounded-full bg-gray-200 border border-gray-300 text-gray-800 hover:bg-gray-300 hover:border-gray-400 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center shadow-sm"
          title="Previous page (←)"
        >
          <ModernIcon type="chevron-left" size={10} color="#1f2937" />
        </button>
        
        {/* Page numbers */}
        <div className="flex gap-1.5 items-center">
          {pageNumbers.map((pageNum, index) => {
            if (pageNum === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="w-5 h-5 flex items-center justify-center text-xs font-medium text-slate-500"
                >
                  ...
                </span>
              )
            }
            
            const isActive = activePage === pageNum
            const isCurrent = currentPage === pageNum
            const isPreview = previewPage === pageNum
            
            return (
              <button
                key={pageNum}
                onClick={() => {
                  onPageChange(pageNum)
                  setPreviewPage(null)
                }}
                className={`
                  min-w-[20px] h-5 px-1.5 rounded-md transition-all duration-150 
                  flex items-center justify-center text-[11px] font-semibold
                  ${isCurrent
                    ? 'bg-blue-500 text-white shadow-md scale-105'
                    : isPreview
                    ? 'bg-blue-300 text-white shadow-sm scale-102'
                    : 'bg-white/40 text-slate-700 hover:bg-white/60 hover:shadow-sm'
                  }
                `}
                title={`Go to page ${pageNum}`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>
        
        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-6 h-6 rounded-full bg-gray-200 border border-gray-300 text-gray-800 hover:bg-gray-300 hover:border-gray-400 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center shadow-sm"
          title="Next page (→)"
        >
          <ModernIcon type="chevron-right" size={10} color="#1f2937" />
        </button>
      </div>
      
      {/* Keyboard hint */}
      {previewPage && (
        <div className="text-center mt-2 text-[10px] text-blue-600 font-medium animate-pulse">
          Press Enter to go to page {previewPage} or Esc to cancel
        </div>
      )}
    </div>
  )
}

export default Pagination

