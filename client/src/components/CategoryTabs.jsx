import React from 'react'
import { motion } from 'framer-motion'
import ModernIcon from './ModernIcon'

const CategoryTabs = ({ value, onChange }) => {
  const categories = [
    { id: 'All', label: 'All', color: '#64748b' },
    { id: 'Academic', label: 'Academic', color: '#8fa4c7' },
    { id: 'Promotions', label: 'Promotions', color: '#c09999' },
    { id: 'Placement', label: 'Placement', color: '#a8b5a0' },
    { id: 'Spam', label: 'Spam', color: '#d4b5b5' },
    { id: 'Newsletter', label: 'Newsletter', color: '#c9a58b' },
    { id: 'WebSocketTestCategory', label: 'Test Category', color: '#b4c7e7' },
    { id: 'Other', label: 'Other', color: '#64748b' }
  ]

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
