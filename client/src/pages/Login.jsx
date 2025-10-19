import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'

const Login = () => {
  const { login, register, googleLogin, loginWithGoogle, isAuthenticated, clearStoredTokens } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  // Handle OAuth error messages from URL parameters
  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      let errorMessage = 'Authentication failed'
      switch (error) {
        case 'oauth_error':
          errorMessage = 'OAuth authentication failed. Please try again.'
          break
        case 'auth_error':
          errorMessage = 'Authentication error occurred. Please try again.'
          break
        case 'no_token':
          errorMessage = 'No authentication token received from OAuth provider.'
          break
        case 'auth_update_failed':
          errorMessage = 'Failed to update authentication status. Please try logging in again.'
          break
        case 'callback_error':
          errorMessage = 'OAuth callback processing failed. Please try again.'
          break
        case 'auth_required':
          errorMessage = 'Authentication required for this operation.'
          break
        case 'user_not_found':
          errorMessage = 'User account not found. Please try creating a new account.'
          break
        default:
          errorMessage = `Authentication error: ${error}`
      }
      toast.error(errorMessage)
      // Clear the error from URL
      navigate('/login', { replace: true })
    }
  }, [searchParams, navigate])

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

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword)
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
      console.log('🚀 Starting complete Google login with Gmail connection...')
      
      // Use the new complete Google OAuth login endpoint
      const result = await loginWithGoogle()
      
      if (result.success) {
        console.log('✅ Redirecting to Google OAuth for complete login')
        toast.success('Redirecting to Google for login and Gmail connection...')
      } else {
        console.error('❌ Google login failed:', result.error)
        toast.error(result.error || 'Failed to initiate Google login')
        setLoading(false)
      }
    } catch (error) {
      console.error('❌ Google login error:', error)
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
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const handleClearCache = () => {
    clearStoredTokens()
    localStorage.clear()
    toast.success('Cache cleared! Please try logging in again.')
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Minimal Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-slate-200/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-slate-300/20 rounded-full blur-3xl"></div>
      </div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-slate-200/60">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-slate-700 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl font-medium">S</span>
            </div>
            <h1 className="text-2xl font-light text-slate-800 mb-2">Sortify</h1>
            <p className="text-slate-500 text-xs">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-slate-700 text-xs font-normal mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-white/80 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400/50 focus:border-slate-400 transition-all duration-200 placeholder-slate-500 text-sm font-normal"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-slate-700 text-xs font-normal mb-1.5">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white/80 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400/50 focus:border-slate-400 transition-all duration-200 placeholder-slate-500 text-sm font-normal"
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-slate-700 text-xs font-normal">
                  Password
                </label>
                {isLogin && (
                  <Link
                    to="/forgot-password"
                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 bg-white/80 border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-400/50 focus:border-slate-400 transition-all duration-200 placeholder-slate-500 text-sm font-normal"
                  placeholder="Enter your password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none flex items-center justify-center w-5 h-5"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="confirmPassword" className="block text-slate-700 text-sm font-medium mb-2">
                  Confirm Password
                </label>
                <div className="relative flex items-center">
                  <motion.input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 pr-12 bg-white/80 border border-purple-200/50 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400 transition-all duration-300 placeholder-slate-400 shadow-sm"
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
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none flex items-center justify-center w-6 h-6 hover:scale-110 active:scale-95 transition-transform duration-200"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-700 text-white font-normal py-2 px-4 rounded-lg shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </div>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

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
        </div>
      </motion.div>
    </div>
  )
}

export default Login

