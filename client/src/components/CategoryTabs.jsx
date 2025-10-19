import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import ModernIcon from './ModernIcon'
import { api } from '../services/api'
import { useWebSocketContext } from '../contexts/WebSocketContext'

const CategoryTabs = ({ value, onChange, refreshTrigger }) => {
  const [categories, setCategories] = useState([{ id: 'All', label: 'All', color: '#64748b' }])
  const [loading, setLoading] = useState(true)
  const { lastMessage } = useWebSocketContext()

  // Helper function to assign colors to categories
  const getCategoryColor = (categoryName) => {
    const colorMap = {
      'Academic': '#8fa4c7',
      'Promotions': '#c09999',
      'Placement': '#a8b5a0',
      'Spam': '#d4b5b5',
      'Newsletter': '#c9a58b',
      'Other': '#64748b'
    }
    return colorMap[categoryName] || '#64748b'
  }

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/realtime/categories')
      
      if (response.data && response.data.categories) {
        const serverCategories = response.data.categories.map(category => ({
          id: category.name,
          label: category.name,
          color: getCategoryColor(category.name)
        }))
        
        // Always include "All" at the beginning and "Other" at the end
        const allCategory = { id: 'All', label: 'All', color: '#64748b' }
        
        // Find "Other" category and ensure it's always at the end
        const otherIndex = serverCategories.findIndex(cat => cat.id === 'Other')
        let otherCategory
        let filteredServerCategories = serverCategories
        
        if (otherIndex >= 0) {
          otherCategory = serverCategories[otherIndex]
          filteredServerCategories = serverCategories.filter(cat => cat.id !== 'Other')
        } else {
          // Create "Other" category if it doesn't exist (fallback)
          otherCategory = { id: 'Other', label: 'Other', color: '#64748b' }
        }
        
        setCategories([allCategory, ...filteredServerCategories, otherCategory])
        console.log('✅ Categories loaded dynamically:', [allCategory, ...filteredServerCategories, otherCategory])
      } else {
        console.warn('⚠️ No categories data received, using fallback')
        setCategories([
          { id: 'All', label: 'All', color: '#64748b' },
          { id: 'Academic', label: 'Academic', color: '#8fa4c7' },
          { id: 'Promotions', label: 'Promotions', color: '#c09999' },
          { id: 'Placement', label: 'Placement', color: '#a8b5a0' },
          { id: 'Spam', label: 'Spam', color: '#d4b5b5' },
          { id: 'Other', label: 'Other', color: '#64748b' }
        ])
      }
    } catch (error) {
      console.error('❌ Error fetching categories:', error)
      // Use fallback categories
      setCategories([
        { id: 'All', label: 'All', color: '#64748b' },
        { id: 'Academic', label: 'Academic', color: '#8fa4c7' },
        { id: 'Promotions', label: 'Promotions', color: '#c09999' },
        { id: 'Placement', label: 'Placement', color: '#a8b5a0' },
        { id: 'Spam', label: 'Spam', color: '#d4b5b5' },
        { id: 'Other', label: 'Other', color: '#64748b' }
      ])
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Refresh categories when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger) {
      console.log('🔄 CategoryTabs: Refreshing categories due to trigger')
      fetchCategories()
    }
  }, [refreshTrigger, fetchCategories])

  // Handle real-time category updates from WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'category_updated') {
      console.log('🔄 CategoryTabs: Received WebSocket category update:', lastMessage.data)
      const { type, category } = lastMessage.data
      
      switch (type) {
        case 'category_added':
          console.log('➕ Adding category via WebSocket:', category.name)
          setCategories(prev => {
            const newCategory = {
              id: category.name,
              label: category.name,
              color: getCategoryColor(category.name)
            }
            // Add new category before "Other" if it exists
            const otherIndex = prev.findIndex(cat => cat.id === 'Other')
            if (otherIndex >= 0) {
              return [...prev.slice(0, otherIndex), newCategory, ...prev.slice(otherIndex)]
            }
            return [...prev, newCategory]
          })
          break
        case 'category_updated':
          console.log('✏️ Updating category via WebSocket:', category.name)
          setCategories(prev => 
            prev.map(cat => 
              cat.id === category.name || cat.label === category.name
                ? { ...cat, label: category.name, id: category.name }
                : cat
            )
          )
          break
        case 'category_deleted':
          console.log('❌ Deleting category via WebSocket:', category.name)
          setCategories(prev => prev.filter(cat => cat.id !== category.name && cat.label !== category.name))
          break
        default:
          // Fallback: if we get any category update, refresh the entire list
          console.log('🔄 CategoryTabs: Fallback refresh due to category update')
          fetchCategories()
          break
      }
    }
  }, [lastMessage, fetchCategories])

  if (loading) {
    return (
      <div className="flex flex-wrap gap-3 mb-8 relative z-15">
        <div className="animate-pulse">
          <div className="h-8 w-16 bg-slate-200 rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-3 mb-8 relative z-15">
      {categories.map((category) => (
        <motion.button
          key={category.id}
          onClick={() => onChange(category.id)}
          className={`
            px-3 py-1.5 text-xs font-normal transition-all duration-200
            border border-slate-200 rounded-full
            ${
              value === category.id
                ? 'text-slate-800 border-slate-400 bg-slate-50'
                : 'text-slate-600 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50/50'
            }
          `}
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
        >
          {category.label}
        </motion.button>
      ))}
    </div>
  )
}

export default CategoryTabs
