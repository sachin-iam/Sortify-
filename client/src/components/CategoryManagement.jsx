import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import { api } from '../services/api'
import ModernIcon from './ModernIcon'

const CategoryManagement = ({ onCategoryUpdate }) => {
  const { isConnected, lastMessage } = useWebSocketContext()
  const [isOpen, setIsOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [editName, setEditName] = useState('')
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, category: null })
  const [editModal, setEditModal] = useState({ isOpen: false, category: null })

  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories()
  }, [])

  // Handle real-time category updates
  useEffect(() => {
    if (lastMessage?.type === 'category_updated') {
      const { type, category } = lastMessage.data
      
      switch (type) {
        case 'category_added':
          // Don't add "All" category to management panel
          if (category.name !== 'All') {
            setCategories(prev => [...prev, category])
          }
          break
        case 'category_updated':
          // Don't update "All" category in management panel
          if (category.name !== 'All') {
            setCategories(prev => 
              prev.map(cat => cat.id === category.id ? category : cat)
            )
          }
          break
        case 'category_deleted':
          setCategories(prev => prev.filter(cat => cat.id !== category.id))
          break
        default:
          break
      }
    }
  }, [lastMessage])

  // Handle body scroll locking when modals are open
  useEffect(() => {
    if (deleteModal.isOpen || editModal.isOpen) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [deleteModal.isOpen, editModal.isOpen])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      console.log('🏷️ Fetching categories...')
      const response = await api.get('/realtime/categories')
      if (response.data && response.data.categories) {
        // Filter out "All" category as it's virtual and shouldn't appear in management
        const realCategories = response.data.categories.filter(cat => cat.name !== 'All')
        setCategories(realCategories)
        console.log('✅ Categories loaded:', realCategories.length)
      } else {
        console.warn('⚠️ No categories data received, using fallback')
        setCategories([
          { id: '1', name: 'Other', count: 0, description: 'Miscellaneous emails', isDefault: true }
        ])
      }
    } catch (error) {
      console.error('❌ Error fetching categories:', error)
      // Use fallback categories instead of showing error
      setCategories([
        { id: '1', name: 'Other', count: 0, description: 'Miscellaneous emails', isDefault: true }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!newCategory.trim() || addingCategory) return

    // Check if category already exists in local state (case insensitive)
    const exists = categories.some(cat => 
      cat.name.toLowerCase().trim() === newCategory.toLowerCase().trim()
    )
    
    if (exists) {
      toast.error('Category already exists')
      return
    }

    try {
      setAddingCategory(true)
      const response = await api.post('/realtime/categories', {
        name: newCategory.trim(),
        description: `Auto-generated category: ${newCategory.trim()}`
      })

      setCategories(prev => [...prev, response.data.category])
      setNewCategory('')
      toast.success(`Category "${newCategory}" added successfully!`)
      
      if (onCategoryUpdate) {
        onCategoryUpdate()
      }
    } catch (error) {
      console.error('Error adding category:', error)
      toast.error(error.response?.data?.message || 'Failed to add category')
      
      // Refresh categories list to ensure frontend and backend are in sync
      fetchCategories()
    } finally {
      setAddingCategory(false)
    }
  }

  const handleEditCategory = async (categoryId, newName) => {
    if (!newName.trim()) return

    try {
      const response = await api.put(`/realtime/categories/${categoryId}`, {
        name: newName.trim()
      })

      setCategories(prev => 
        prev.map(cat => 
          cat.id === categoryId 
            ? { ...cat, name: newName.trim() }
            : cat
        )
      )
      setEditName('')
      toast.success(`Category updated to "${newName}"!`)
      
      if (onCategoryUpdate) {
        onCategoryUpdate()
      }
    } catch (error) {
      console.error('Error updating category:', error)
      toast.error(error.response?.data?.message || 'Failed to update category')
    }
  }

  const handleDeleteCategory = (categoryId, categoryName) => {
    const category = categories.find(cat => cat.id === categoryId)
    setDeleteModal({ isOpen: true, category })
  }

  const confirmDeleteCategory = async () => {
    if (!deleteModal.category) return

    try {
      await api.delete(`/realtime/categories/${deleteModal.category.id}`)
      setCategories(prev => prev.filter(cat => cat.id !== deleteModal.category.id))
      toast.success(`Category "${deleteModal.category.name}" deleted successfully!`)
      setDeleteModal({ isOpen: false, category: null })
      
      if (onCategoryUpdate) {
        onCategoryUpdate()
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error(error.response?.data?.message || 'Failed to delete category')
      setDeleteModal({ isOpen: false, category: null })
    }
  }

  const cancelDelete = () => {
    setDeleteModal({ isOpen: false, category: null })
  }

  const openEditModal = (category) => {
    setEditModal({ isOpen: true, category })
    setEditName(category.name)
  }

  const confirmEditCategory = async () => {
    if (!editModal.category || !editName.trim()) return

    try {
      const response = await api.put(`/realtime/categories/${editModal.category.id}`, {
        name: editName.trim()
      })

      setCategories(prev => 
        prev.map(cat => 
          cat.id === editModal.category.id 
            ? { ...cat, name: editName.trim() }
            : cat
        )
      )
      setEditModal({ isOpen: false, category: null })
      setEditName('')
      toast.success(`Category updated to "${editName}"!`)
      
      if (onCategoryUpdate) {
        onCategoryUpdate()
      }
    } catch (error) {
      console.error('Error updating category:', error)
      toast.error(error.response?.data?.message || 'Failed to update category')
      setEditModal({ isOpen: false, category: null })
    }
  }

  const cancelEdit = () => {
    setEditModal({ isOpen: false, category: null })
    setEditName('')
  }


  return (
    <div className="relative z-[100]">
      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="flex items-center gap-2">
          <ModernIcon type="settings" size={16} color="white" />
          <span>Categories</span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </motion.button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-96 bg-white/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl shadow-purple-100/20 z-[9999] overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ModernIcon type="settings" size={18} color="#7c3aed" />
                  Manage Categories
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Add New Category Form */}
              <form onSubmit={handleAddCategory} className="mb-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Add new category..."
                    className="flex-1 px-3 py-2 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/70 text-slate-800 placeholder-slate-500 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={!newCategory.trim() || addingCategory}
                    className="px-3 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap min-w-[80px] justify-center"
                  >
                    {addingCategory ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                        <span className="text-sm">Adding...</span>
                      </>
                    ) : (
                      <span className="text-sm">Add</span>
                    )}
                  </button>
                </div>
              </form>

              {/* Categories List */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                  </div>
                ) : (
                  categories.map((category) => (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-start justify-between p-3 bg-white/40 border border-white/30 rounded-xl hover:bg-white/60 transition-colors min-h-[70px] w-full"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex-shrink-0 mt-1"></div>
                        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                          <span className="text-slate-800 font-medium truncate">{category.name}</span>
                          {category.count !== undefined && category.count !== null && (
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full inline-block w-fit">
                              {typeof category.count === 'number' && category.count > 999 ? 
                                `${Math.floor(category.count / 1000)}K emails` : 
                                `${category.count} emails`
                              }
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-1 flex-shrink-0 pt-1">
                        <button
                          onClick={() => openEditModal(category)}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Edit category"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => category.name !== 'Other' && handleDeleteCategory(category.id, category.name)}
                          disabled={category.name === 'Other'}
                          className={`p-1 rounded-lg transition-colors ${
                            category.name === 'Other' 
                              ? 'text-gray-400 cursor-not-allowed' 
                              : 'text-red-600 hover:bg-red-100'
                          }`}
                          title={category.name === 'Other' ? 'Cannot delete the "Other" category' : 'Delete category'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {categories.length === 0 && !loading && (
                <div className="text-center py-4 text-slate-500">
                  <ModernIcon type="settings" size={32} color="#94a3b8" />
                  <p className="mt-2">No categories yet</p>
                  <p className="text-sm">Add your first category above</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="relative w-full max-w-md mx-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                zIndex: 10001
              }}
            >
              {/* Header with gradient */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full backdrop-blur-sm">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-center">Delete Category</h3>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <p className="text-slate-600 text-center mb-2">
                  Are you sure you want to delete the category
                </p>
                <p className="text-center mb-6">
                  <span className="font-semibold text-lg text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">
                    "{deleteModal.category?.name}"
                  </span>
                </p>
                <p className="text-sm text-red-500 text-center mb-6">
                  This action cannot be undone and will permanently remove this category.
                </p>
                
                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all duration-200 transform hover:scale-105"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteCategory}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Edit Category Modal */}
      {editModal.isOpen && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={cancelEdit}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="relative w-full max-w-md mx-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                zIndex: 10001
              }}
            >
              {/* Header with gradient */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full backdrop-blur-sm">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-center">Edit Category</h3>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <p className="text-slate-600 text-center mb-6">
                  Enter the new name for your category
                </p>
                
                {/* Input */}
                <div className="mb-6">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/80 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-slate-800 placeholder-slate-500 backdrop-blur-sm"
                    placeholder="Category name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        confirmEditCategory()
                      } else if (e.key === 'Escape') {
                        cancelEdit()
                      }
                    }}
                  />
                </div>
                
                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={cancelEdit}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all duration-200 transform hover:scale-105"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmEditCategory}
                    disabled={!editName.trim()}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

export default CategoryManagement

