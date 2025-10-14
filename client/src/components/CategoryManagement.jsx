import React, { useState, useEffect } from 'react'
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
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [editName, setEditName] = useState('')

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
          setCategories(prev => [...prev, category])
          break
        case 'category_updated':
          setCategories(prev => 
            prev.map(cat => cat.id === category.id ? category : cat)
          )
          break
        case 'category_deleted':
          setCategories(prev => prev.filter(cat => cat.id !== category.id))
          break
        default:
          break
      }
    }
  }, [lastMessage])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      console.log('🏷️ Fetching categories...')
      const response = await api.get('/api/realtime/categories')
      if (response.data && response.data.categories) {
        setCategories(response.data.categories)
        console.log('✅ Categories loaded:', response.data.categories.length)
      } else {
        console.warn('⚠️ No categories data received, using fallback')
        setCategories([
          { id: '1', name: 'Academic', count: 0, description: 'Educational and academic emails' },
          { id: '2', name: 'Promotions', count: 0, description: 'Marketing and promotional emails' },
          { id: '3', name: 'Placement', count: 0, description: 'Job and career related emails' },
          { id: '4', name: 'Spam', count: 0, description: 'Spam and unwanted emails' },
          { id: '5', name: 'Other', count: 0, description: 'Miscellaneous emails' }
        ])
      }
    } catch (error) {
      console.error('❌ Error fetching categories:', error)
      // Use fallback categories instead of showing error
      setCategories([
        { id: '1', name: 'Academic', count: 0, description: 'Educational and academic emails' },
        { id: '2', name: 'Promotions', count: 0, description: 'Marketing and promotional emails' },
        { id: '3', name: 'Placement', count: 0, description: 'Job and career related emails' },
        { id: '4', name: 'Spam', count: 0, description: 'Spam and unwanted emails' },
        { id: '5', name: 'Other', count: 0, description: 'Miscellaneous emails' }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!newCategory.trim()) return

    try {
      const response = await api.post('/api/realtime/categories', {
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
    }
  }

  const handleEditCategory = async (categoryId, newName) => {
    if (!newName.trim()) return

    try {
      const response = await api.put(`/api/realtime/categories/${categoryId}`, {
        name: newName.trim()
      })

      setCategories(prev => 
        prev.map(cat => 
          cat.id === categoryId 
            ? { ...cat, name: newName.trim() }
            : cat
        )
      )
      setEditingCategory(null)
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

  const handleDeleteCategory = async (categoryId, categoryName) => {
    if (!window.confirm(`Are you sure you want to delete the category "${categoryName}"?`)) {
      return
    }

    try {
      await api.delete(`/api/realtime/categories/${categoryId}`)
      setCategories(prev => prev.filter(cat => cat.id !== categoryId))
      toast.success(`Category "${categoryName}" deleted successfully!`)
      
      if (onCategoryUpdate) {
        onCategoryUpdate()
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error(error.response?.data?.message || 'Failed to delete category')
    }
  }

  const startEditing = (category) => {
    setEditingCategory(category.id)
    setEditName(category.name)
  }

  const cancelEditing = () => {
    setEditingCategory(null)
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
            className="absolute top-full right-0 mt-2 w-80 bg-white/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl shadow-purple-100/20 z-[9999]"
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Add new category..."
                    className="flex-1 px-3 py-2 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/70 text-slate-800 placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!newCategory.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
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
                      className="flex items-center justify-between p-3 bg-white/40 border border-white/30 rounded-xl hover:bg-white/60 transition-colors"
                    >
                      {editingCategory === category.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 px-2 py-1 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-800"
                            autoFocus
                          />
                          <button
                            onClick={() => handleEditCategory(category.id, editName)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-1">
                            <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"></div>
                            <span className="text-slate-800 font-medium">{category.name}</span>
                            {category.count && (
                              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                {category.count}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditing(category)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category.id, category.name)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
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
    </div>
  )
}

export default CategoryManagement
