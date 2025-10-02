import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { jwtDecode } from 'jwt-decode'
import { api } from '../services/api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }   
  return context
}

export const AuthProvider = ({ children }) => {
  // Initialize state with localStorage values immediately
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem('token')
    console.log('🔧 AuthContext: Initializing token from localStorage:', stored ? 'present' : 'null')
    return stored
  })
  const [loading, setLoading] = useState(false) // Start as false to avoid loading loops
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const stored = localStorage.getItem('token')
    const hasToken = !!stored
    console.log('🔧 AuthContext: Initializing isAuthenticated:', hasToken)
    return hasToken
  })

  // Helper function to update all auth state atomically
  const updateAuthState = useCallback((newToken, userData = null) => {
    console.log('🔄 AuthContext: Updating auth state atomically')
    
    if (newToken) {
      // Store token
      localStorage.setItem('token', newToken)
      setToken(newToken)
      setIsAuthenticated(true)
      
      // Set API headers
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
      
      console.log('✅ AuthContext: Auth state updated successfully')
    } else {
      // Clear everything
      localStorage.removeItem('token')
      setToken(null)
      setIsAuthenticated(false)
      delete api.defaults.headers.common['Authorization']
      
      console.log('🧹 AuthContext: Auth state cleared')
    }
    
    if (userData) {
      setUser(userData)
    }
  }, [])

  // Initialize authentication on mount
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🚀 AuthContext: Initializing authentication...')
      setLoading(true)
      
      const storedToken = localStorage.getItem('token')
      
      if (storedToken) {
        try {
          // Validate token
          const decoded = jwtDecode(storedToken)
          const currentTime = Date.now() / 1000
          
          if (decoded.exp > currentTime) {
            console.log('✅ AuthContext: Valid token found, fetching user data...')
            
            // Set auth state
            setToken(storedToken)
            setIsAuthenticated(true)
            api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
            
            // Fetch user data
            try {
              const response = await api.get('/auth/me')
              if (response.data.success) {
                setUser(response.data.user)
                console.log('✅ AuthContext: User data loaded:', response.data.user.name)
              }
            } catch (error) {
              console.error('Failed to fetch user data:', error)
              // Still authenticated, just no user data
            }
          } else {
            console.log('❌ AuthContext: Token expired, clearing auth')
            updateAuthState(null)
          }
        } catch (error) {
          console.error('❌ AuthContext: Invalid token, clearing auth:', error)
          updateAuthState(null)
        }
      } else {
        console.log('ℹ️ AuthContext: No token found')
        setIsAuthenticated(false)
      }
      
      setLoading(false)
      console.log('🏁 AuthContext: Initialization complete')
    }

    initializeAuth()
  }, []) // Remove updateAuthState dependency to prevent re-initialization

  const login = async (email, password) => {
    console.log('🚀 AuthContext: Starting login process...')
    setLoading(true)
    
    try {
      const response = await api.post('/auth/login', { email, password })
      console.log('📡 AuthContext: Login API response:', response.data)
      
      if (response.data.success && response.data.token) {
        const newToken = response.data.token
        console.log('🎯 AuthContext: Login successful, token received')
        
        // Update auth state atomically
        updateAuthState(newToken)
        
        // Fetch user data
        try {
          const userResponse = await api.get('/auth/me')
          if (userResponse.data.success) {
            setUser(userResponse.data.user)
            console.log('✅ AuthContext: User data loaded after login:', userResponse.data.user.name)
          }
        } catch (error) {
          console.error('Failed to fetch user data after login:', error)
        }
        
        setLoading(false)
        return { success: true }
      } else {
        console.error('❌ AuthContext: Login failed - no token in response')
        setLoading(false)
        return { success: false, error: response.data.message || 'Login failed' }
      }
    } catch (error) {
      console.error('❌ AuthContext: Login error:', error)
      setLoading(false)
      return { success: false, error: error.response?.data?.message || 'Login failed' }
    }
  }

  const register = async (name, email, password) => {
    try {
      const response = await api.post('/auth/register', { name, email, password })
      if (response.data.success) {
        return { 
          success: true, 
          message: response.data.message,
          user: response.data.user
        }
      }
      return { success: false, error: response.data.message }
    } catch (error) {
      console.error('Registration error:', error)
      return { success: false, error: error.response?.data?.message || 'Registration failed' }
    }
  }

  const logout = () => {
    console.log('🚪 AuthContext: Logging out...')
    updateAuthState(null)
    setUser(null)
  }

  const clearStoredTokens = () => {
    console.log('🧹 AuthContext: Clearing stored tokens...')
    updateAuthState(null)
    setUser(null)
  }

  const updateTokenFromOAuth = async (newToken) => {
    console.log('🔄 AuthContext: Updating token from OAuth...', newToken ? 'Token received' : 'No token')
    
    if (!newToken) {
      console.error('❌ AuthContext: No token provided to updateTokenFromOAuth')
      return { success: false, error: 'No token provided' }
    }
    
    // Set token in localStorage and API headers immediately
    localStorage.setItem('token', newToken)
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    console.log('🔧 AuthContext: Token set in localStorage and API headers')
    
    // Update state
    setToken(newToken)
    setIsAuthenticated(true)
    console.log('🔧 AuthContext: State updated - token and isAuthenticated set')
    
    try {
      console.log('🌐 AuthContext: Making API call to /auth/me...')
      const response = await api.get('/auth/me')
      console.log('📡 AuthContext: API response received:', response.status)
      
      if (response.data.success) {
        setUser(response.data.user)
        console.log('✅ AuthContext: User data updated after OAuth:', response.data.user.name)
        return { success: true, user: response.data.user }
      } else {
        console.warn('⚠️ AuthContext: API returned success: false')
        return { success: true, user: null }
      }
    } catch (error) {
      console.error('❌ AuthContext: Failed to fetch user data after OAuth:', error)
      // If API call fails, still consider it successful since we have the token
      return { success: true, user: null }
    }
  }

  const googleLogin = async () => {
    try {
      const client = window.google?.accounts?.oauth2?.initCodeClient({
        client_id: '376597108929-bal4s8d23vpbmmr605gm56hr1ncds6he.apps.googleusercontent.com',
        scope: 'openid email profile',
        callback: async (response) => {
          try {
            const res = await api.post('/auth/google', { 
              code: response.code,
              redirectUri: window.location.origin 
            })
            
            if (res.data.success && res.data.token) {
              updateAuthState(res.data.token)
              
              try {
                const userResponse = await api.get('/auth/me')
                if (userResponse.data.success) {
                  setUser(userResponse.data.user)
                }
              } catch (error) {
                console.error('Failed to fetch user data after Google login:', error)
              }
              
              return { success: true }
            }
            return { success: false, error: res.data.message }
          } catch (error) {
            console.error('Google login error:', error)
            return { success: false, error: error.response?.data?.message || 'Google login failed' }
          }
        }
      })

      client.requestCode()
      return { success: true }
    } catch (error) {
      console.error('Google OAuth initialization error:', error)
      return { success: false, error: 'Google OAuth not available' }
    }
  }

  const loginWithGoogle = async () => {
    try {
      const response = await api.get('/auth/google/login')
      if (response.data.success) {
        window.location.href = response.data.authUrl
        return { success: true, message: 'Redirecting to Google login...' }
      }
      return { success: false, error: response.data.message || 'Failed to login with Google' }
    } catch (error) {
      console.error('Google login error:', error)
      return { success: false, error: 'Failed to login with Google' }
    }
  }

  const connectGmailAccount = async () => {
    try {
      const response = await api.get('/auth/google/connect')
      if (response.data.success) {
        window.location.href = response.data.authUrl
        return { success: true, message: 'Redirecting to Gmail authorization...' }
      }
      return { success: false, error: response.data.message || 'Failed to connect Gmail account' }
    } catch (error) {
      console.error('Gmail connection error:', error)
      return { success: false, error: 'Failed to connect Gmail account' }
    }
  }

  const connectMicrosoftAccount = async () => {
    try {
      const response = await api.post('/auth/microsoft/connect')
      if (response.data.success) {
        return { success: true, message: response.data.message }
      }
      return { success: false, error: response.data.message || 'Failed to connect Microsoft account' }
    } catch (error) {
      console.error('Microsoft connection error:', error)
      return { success: false, error: 'Failed to connect Microsoft account' }
    }
  }

  const forgotPassword = async (email) => {
    try {
      const response = await api.post('/auth/forgot-password', { email })
      return { success: response.data.success, message: response.data.message, resetUrl: response.data.resetUrl }
    } catch (error) {
      console.error('Forgot password error:', error)
      return { success: false, error: error.response?.data?.message || 'Failed to send reset email' }
    }
  }

  const resetPassword = async (resetToken, password) => {
    try {
      const response = await api.put(`/auth/reset-password/${resetToken}`, { password })
      return { success: response.data.success, message: response.data.message }
    } catch (error) {
      console.error('Reset password error:', error)
      return { success: false, error: error.response?.data?.message || 'Failed to reset password' }
    }
  }

  const sendEmailVerification = async () => {
    try {
      const response = await api.post('/auth/send-verification')
      return { success: response.data.success, message: response.data.message, verificationUrl: response.data.verificationUrl }
    } catch (error) {
      console.error('Send verification error:', error)
      return { success: false, error: error.response?.data?.message || 'Failed to send verification email' }
    }
  }

  const verifyEmail = async (verificationToken) => {
    try {
      const response = await api.put(`/auth/verify-email/${verificationToken}`)
      return { success: response.data.success, message: response.data.message }
    } catch (error) {
      console.error('Verify email error:', error)
      return { success: false, error: error.response?.data?.message || 'Failed to verify email' }
    }
  }

  const value = {
    user,
    token,
    loading,
    login,
    register,
    googleLogin,
    loginWithGoogle,
    logout,
    clearStoredTokens,
    updateTokenFromOAuth,
    connectGmailAccount,
    connectMicrosoftAccount,
    forgotPassword,
    resetPassword,
    sendEmailVerification,
    verifyEmail,
    isAuthenticated
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}