import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ModernIcon from './ModernIcon'

const DeleteConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Delete Email",
  message = "Are you sure you want to delete this email?",
  isGmailEmail = false,
  isThread = false,
  messageCount = 1
}) => {
  const [deleteFromGmail, setDeleteFromGmail] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
 
  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm(deleteFromGmail)
    } finally {
      setIsDeleting(false)
      setDeleteFromGmail(false) // Reset for next time
    }
  }

  const handleCancel = () => {
    setDeleteFromGmail(false) // Reset checkbox
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <ModernIcon type="delete" size={20} color="#ffffff" />
                </div>
                <h2 className="text-xl font-bold text-white flex-1">{title}</h2>
                <button
                  onClick={handleCancel}
                  disabled={isDeleting}
                  className="text-white/80 hover:text-white transition-colors disabled:opacity-50"
                >
                  <ModernIcon type="close" size={20} color="#ffffff" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Warning Icon and Message */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-900 font-medium mb-2">
                      {isThread 
                        ? `Delete entire thread (${messageCount} message${messageCount > 1 ? 's' : ''})?`
                        : 'Delete this email?'
                      }
                    </p>
                    <p className="text-slate-600 text-sm">
                      {message}
                    </p>
                  </div>
                </div>

                {/* Gmail Delete Option - ALWAYS SHOW */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={deleteFromGmail}
                        onChange={(e) => setDeleteFromGmail(e.target.checked)}
                        disabled={isDeleting}
                        className="w-5 h-5 rounded border-2 border-blue-400 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-slate-900 font-medium block mb-1">
                        Also delete from Gmail
                      </span>
                      <span className="text-slate-600 text-sm">
                        {deleteFromGmail 
                          ? "The email will be moved to Gmail's trash bin and deleted from Sortify"
                          : "The email will be moved to Gmail's trash bin and deleted from Sortify"
                        }
                      </span>
                    </div>
                  </label>
                </div>

                {/* Warning Notice */}
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-amber-800 text-sm font-medium">
                    This action cannot be undone
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <ModernIcon type="delete" size={18} color="#ffffff" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default DeleteConfirmationModal

