import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { motion } from 'framer-motion'
import ModernIcon from './ModernIcon'

const Navbar = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'analytics' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ]

  const handleLogout = () => {
    logout()
    setIsMenuOpen(false)
  }

  return (
    <motion.nav 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-gradient-to-r from-purple-900 via-violet-900 to-indigo-900 backdrop-blur-md border-b border-purple-700/30 sticky top-0 z-50 shadow-lg shadow-purple-900/20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-7 h-7 bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-sm rounded-md flex items-center justify-center border border-white/20">
              <span className="text-white font-semibold text-sm">S</span>
            </div>
            <span className="text-white font-semibold text-lg tracking-wide">Sortify</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                  location.pathname === item.path
                    ? 'text-white border-b border-white/60 bg-white/10 rounded-md'
                    : 'text-white/80 hover:text-white hover:border-b hover:border-white/40 hover:bg-white/5 rounded-md'
                }`}
              >
                <ModernIcon type={item.icon} size={14} color={location.pathname === item.path ? '#ffffff' : '#e2e8f0'} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-3">
              {user?.avatar || user?.gmailName ? (
                <img 
                  src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.gmailName || user.name)}&background=64748b&color=fff&size=28`}
                  alt={user.name}
                  className="w-7 h-7 rounded-full border border-slate-200"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
              ) : null}
              <div 
                className={`w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center ${user?.avatar || user?.gmailName ? 'hidden' : ''}`}
                style={{ display: user?.avatar || user?.gmailName ? 'none' : 'flex' }}
              >
                <span className="text-white font-medium text-xs">
                  {user?.name?.charAt(0)?.toUpperCase() || user?.gmailName?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-white font-medium text-sm">
                {user?.name || user?.gmailName || 'User'}
              </span>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-1.5 rounded-md text-white/80 hover:bg-white/10 transition-colors"
            >
              <ModernIcon type="menu" size={18} color="#e2e8f0" glassEffect={false} />
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="hidden md:block px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200 text-sm font-medium border border-white/20 hover:border-white/30"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/20 bg-gradient-to-r from-purple-800/50 to-violet-800/50 backdrop-blur-md"
          >
            <div className="py-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-2 rounded-md transition-all duration-200 ${
                    location.pathname === item.path
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ModernIcon type={item.icon} size={14} color={location.pathname === item.path ? '#ffffff' : '#e2e8f0'} />
                  <span className="text-sm font-normal">{item.label}</span>
                </Link>
              ))}
              <div className="px-4 py-3 border-t border-white/20">
                <div className="flex items-center space-x-3 mb-3">
                  {user?.avatar || user?.gmailName ? (
                    <img 
                      src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.gmailName || user.name)}&background=64748b&color=fff&size=28`}
                      alt={user.name}
                      className="w-7 h-7 rounded-full border border-slate-200"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center ${user?.avatar || user?.gmailName ? 'hidden' : ''}`}
                    style={{ display: user?.avatar || user?.gmailName ? 'none' : 'flex' }}
                  >
                    <span className="text-white font-medium text-xs">
                      {user?.name?.charAt(0)?.toUpperCase() || user?.gmailName?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="text-white font-medium text-sm">
                    {user?.name || user?.gmailName || 'User'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200 text-sm font-medium border border-white/20 hover:border-white/30"
                >
                  Logout
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  )
}

export default Navbar
