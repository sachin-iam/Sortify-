import React from 'react'
import { motion } from 'framer-motion'
import ModernIcon from './ModernIcon'

const CategoryTabs = ({ value, onChange }) => {
  const categories = [
    { id: 'All', label: 'All', icon: 'folder', color: '#6b7280' },
    { id: 'Academic', label: 'Academic', icon: 'academic', color: '#3b82f6' },
    { id: 'Promotions', label: 'Promotions', icon: 'promotions', color: '#8b5cf6' },
    { id: 'Placement', label: 'Placement', icon: 'placement', color: '#10b981' },
    { id: 'Spam', label: 'Spam', icon: 'spam', color: '#ef4444' },
    { id: 'Newsletter', label: 'Newsletter', icon: 'newsletter', color: '#f59e0b' },
    { id: 'WebSocketTestCategory', label: 'Test Category', icon: 'test', color: '#8b5cf6' },
    { id: 'Other', label: 'Other', icon: 'other', color: '#6b7280' }
  ]

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {categories.map((category) => (
        <motion.button
          key={category.id}
          onClick={() => onChange(category.id)}
          className={`
            px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
            border backdrop-blur-sm shadow-lg
            ${
              value === category.id
                ? 'bg-white/60 text-slate-800 border-white/40 shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
                : 'bg-white/40 text-slate-600 border-white/30 hover:bg-white/60 hover:text-slate-800'
            }
          `}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {category.label}
        </motion.button>
      ))}
    </div>
  )
}

export default CategoryTabs
