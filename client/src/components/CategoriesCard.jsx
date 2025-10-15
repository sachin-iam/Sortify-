import React from 'react'
import { motion } from 'framer-motion'

const CategoriesCard = ({ categories = 7 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.3 }}
      className="group relative bg-gradient-to-br from-green-50 to-green-200/40 backdrop-blur-xl border border-green-200/30 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-500 cursor-pointer"
    >
      {/* Top Left - Folder Icon */}
      <div className="absolute top-4 left-4">
        <div className="p-2 bg-green-200/70 rounded-lg">
          <svg 
            className="w-5 h-5 text-green-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" 
            />
          </svg>
        </div>
      </div>

      {/* Bottom Left - Number and Label */}
      <div className="absolute bottom-4 left-4">
        <h3 className="text-3xl font-bold text-slate-800 mb-1">{categories}</h3>
        <p className="text-sm text-slate-600 font-medium">Categories</p>
      </div>

      {/* Top Right - Status */}
      <div className="absolute top-4 right-4 text-right">
        <div className="text-green-600 font-semibold text-sm">Auto</div>
        <div className="text-slate-600 text-sm">Classified</div>
      </div>

      {/* Hover Effect Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    </motion.div>
  )
}

export default CategoriesCard
