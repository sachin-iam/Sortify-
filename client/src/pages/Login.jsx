import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'

const Login = () => {
  const { login, register, googleLogin, isAuthenticated, clearStoredTokens } = useAuth()
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      let result
      if (isLogin) {
        result = await login(formData.email, formData.password)
      } else {
        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match')
          setLoading(false)
          return
        }
        result = await register(formData.name, formData.email, formData.password)
      }

      if (result.success) {
        if (isLogin) {
          toast.success('Login successful!')
          // Redirect will happen automatically due to useEffect
        } else {
          toast.success(result.message || 'Registration successful! Please login to continue.')
          // Switch to login mode after successful registration
          setIsLogin(true)
          setFormData({
            name: '',
            email: formData.email, // Keep the email for convenience
            password: '',
            confirmPassword: ''
          })
        }
      } else {
        toast.error(result.error || 'Authentication failed')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      console.log('🚀 Starting Google login process...')
      
      // Use the new Google OAuth login endpoint
      console.log('📡 Making API request to /api/auth/google/connect')
      const response = await api.get('/api/auth/google/connect')
      
      console.log('✅ API response received:', response.status, response.data)
      
      if (response.data.success) {
        console.log('Redirecting to Google OAuth for login:', response.data.authUrl)
        // Redirect to Google OAuth in the same tab
        window.location.href = response.data.authUrl
      } else {
        console.error('❌ API returned success: false')
        toast.error('Failed to initiate Google login')
        setLoading(false)
      }
    } catch (error) {
      console.error('❌ Google login error:', error)
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      })
      toast.error('Google login failed')
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    })
  }

  const handleClearCache = () => {
    clearStoredTokens()
    localStorage.clear()
    toast.success('Cache cleared! Please try logging in again.')
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Enhanced Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{ 
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        ></motion.div>
        <motion.div 
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"
          animate={{ 
            scale: [1.2, 1, 1.2],
            rotate: [360, 180, 0],
          }}
          transition={{ 
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        ></motion.div>
        <motion.div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-emerald-400/10 to-cyan-400/10 rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ 
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        ></motion.div>
      </div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
        transition={{ 
          duration: 0.8,
          type: "spring",
          stiffness: 100,
          damping: 15
        }}
        className="w-full max-w-md relative z-10"
      >
        <motion.div 
          className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30"
          whileHover={{ 
            scale: 1.02,
            rotateY: 2,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.5)"
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Enhanced Header */}
      <motion.div
            initial={{ y: -30, opacity: 0, rotateX: -90 }}
            animate={{ y: 0, opacity: 1, rotateX: 0 }}
            transition={{ 
              delay: 0.2,
              duration: 0.8,
              type: "spring",
              stiffness: 120
            }}
            className="text-center mb-8"
          >
          <motion.div 
              className="w-20 h-20 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl"
              whileHover={{ 
                scale: 1.1,
                rotate: [0, -10, 10, 0],
                boxShadow: "0 20px 40px rgba(147, 51, 234, 0.4)"
              }}
              animate={{ 
                rotate: [0, 5, -5, 0],
                scale: [1, 1.05, 1]
              }}
              transition={{ 
                rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
              }}
            >
              <span className="text-white text-3xl font-bold">S</span>
            </motion.div>
            <motion.h1 
              className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent mb-3"
              whileHover={{ 
                scale: 1.05,
                backgroundPosition: "200% center"
              }}
              animate={{
                backgroundPosition: ["0% center", "100% center", "0% center"]
              }}
              transition={{
                backgroundPosition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
              }}
              style={{
                backgroundSize: "200% auto"
              }}
            >
              Sortify
            </motion.h1>
            <motion.p 
              className="text-slate-600 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {isLogin ? 'Welcome back! 👋' : 'Create your account ✨'}
            </motion.p>
          </motion.div>

          {/* Enhanced Form */}
          <motion.form
            initial={{ y: 30, opacity: 0, rotateX: 90 }}
            animate={{ y: 0, opacity: 1, rotateX: 0 }}
            transition={{ 
              delay: 0.3,
              duration: 0.8,
              type: "spring",
              stiffness: 100
            }}
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-slate-700 text-sm font-medium mb-2">
                  Full Name
                </label>
                <motion.input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/80 border border-purple-200/50 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400 transition-all duration-300 placeholder-slate-400 shadow-sm"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required={!isLogin}
                  whileHover={{ 
                    scale: 1.02,
                    boxShadow: "0 8px 25px rgba(147, 51, 234, 0.15)"
                  }}
                  whileFocus={{ 
                    scale: 1.03,
                    boxShadow: "0 12px 30px rgba(147, 51, 234, 0.2)"
                  }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-slate-700 text-sm font-medium mb-2">
                Email
              </label>
              <motion.input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white/80 border border-purple-200/50 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400 transition-all duration-300 placeholder-slate-400 shadow-sm"
                placeholder="Enter your email"
                autoComplete="email"
                required
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 25px rgba(147, 51, 234, 0.15)"
                }}
                whileFocus={{ 
                  scale: 1.03,
                  boxShadow: "0 12px 30px rgba(147, 51, 234, 0.2)"
                }}
                transition={{ duration: 0.2 }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-slate-700 text-sm font-medium">
                  Password
                </label>
                {isLogin && (
                  <Link
                    to="/forgot-password"
                    className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <motion.input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white/80 border border-purple-200/50 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400 transition-all duration-300 placeholder-slate-400 shadow-sm"
                placeholder="Enter your password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 8px 25px rgba(147, 51, 234, 0.15)"
                }}
                whileFocus={{ 
                  scale: 1.03,
                  boxShadow: "0 12px 30px rgba(147, 51, 234, 0.2)"
                }}
                transition={{ duration: 0.2 }}
              />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="confirmPassword" className="block text-slate-700 text-sm font-medium mb-2">
                  Confirm Password
                </label>
                <motion.input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/80 border border-purple-200/50 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400 transition-all duration-300 placeholder-slate-400 shadow-sm"
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  required={!isLogin}
                  whileHover={{ 
                    scale: 1.02,
                    boxShadow: "0 8px 25px rgba(147, 51, 234, 0.15)"
                  }}
                  whileFocus={{ 
                    scale: 1.03,
                    boxShadow: "0 12px 30px rgba(147, 51, 234, 0.2)"
                  }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            )}

            <motion.button
              whileHover={{ 
                scale: 1.05,
                rotateX: 5,
                boxShadow: "0 20px 40px rgba(147, 51, 234, 0.4)"
              }}
              whileTap={{ 
                scale: 0.95,
                rotateX: -2
              }}
              animate={{
                boxShadow: [
                  "0 10px 25px rgba(147, 51, 234, 0.2)",
                  "0 15px 35px rgba(147, 51, 234, 0.3)",
                  "0 10px 25px rgba(147, 51, 234, 0.2)"
                ]
              }}
              transition={{
                boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" }
              }}
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="spinner w-5 h-5 mr-2"></div>
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </div>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </motion.button>
          </motion.form>

          {/* Enhanced Google Login */}
          <motion.div
            initial={{ y: 20, opacity: 0, rotateX: 90 }}
            animate={{ y: 0, opacity: 1, rotateX: 0 }}
            transition={{ 
              delay: 0.4,
              duration: 0.8,
              type: "spring",
              stiffness: 100
            }}
            className="mt-6"
          >
            <motion.div className="relative">
              <div className="absolute inset-0 flex items-center">
                <motion.div 
                  className="w-full border-t border-slate-300/30"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                ></motion.div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-slate-500">Or continue with</span>
              </div>
            </motion.div>

            <motion.button
              onClick={handleGoogleLogin}
              className="mt-4 w-full flex items-center justify-center px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-slate-700 shadow-sm"
              whileHover={{ 
                scale: 1.03,
                borderColor: "rgb(147, 51, 234)",
                backgroundColor: "rgb(249, 245, 255)",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)"
              }}
              whileTap={{ 
                scale: 0.97,
                rotateX: -2
              }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </motion.button>
          </motion.div>

          {/* Enhanced Toggle Mode */}
          <motion.div
            initial={{ y: 20, opacity: 0, rotateX: 90 }}
            animate={{ y: 0, opacity: 1, rotateX: 0 }}
            transition={{ 
              delay: 0.5,
              duration: 0.8,
              type: "spring",
              stiffness: 100
            }}
            className="mt-6 text-center"
          >
            <motion.button
              onClick={toggleMode}
              className="text-slate-600 transition-colors"
              whileHover={{ 
                scale: 1.05,
                color: "rgb(147, 51, 234)"
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {isLogin ? (
                <>
                  Don't have an account? <motion.span 
                    className="text-purple-600 font-semibold"
                    whileHover={{ 
                      scale: 1.1,
                      color: "rgb(124, 58, 237)"
                    }}
                    transition={{ duration: 0.2 }}
                  >Sign up</motion.span>
                </>
              ) : (
                <>
                  Already have an account? <motion.span 
                    className="text-purple-600 font-semibold"
                    whileHover={{ 
                      scale: 1.1,
                      color: "rgb(124, 58, 237)"
                    }}
                    transition={{ duration: 0.2 }}
                  >Sign in</motion.span>
                </>
              )}
            </motion.button>
          </motion.div>

          </motion.div>
      </motion.div>
    </div>
  )
}

export default Login
