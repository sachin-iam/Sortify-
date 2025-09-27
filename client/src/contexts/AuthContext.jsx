import React, { createContext, useContext, useState, useEffect } from 'react'
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
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'))

  useEffect(() => {
    const fetchUserData = async () => {
      // Check localStorage for token if token state is null but localStorage has it
      const storedToken = localStorage.getItem('token')
      if (!token && storedToken) {
        console.log('🔄 AuthContext: Found token in localStorage, updating state...')
        setToken(storedToken)
        setIsAuthenticated(true)
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
        return // Let the next useEffect cycle handle the rest
      }
      
      if (token) {
        try {
          const decoded = jwtDecode(token)
          const currentTime = Date.now() / 1000
          
          if (decoded.exp > currentTime) {
            // Set authenticated state immediately
            setIsAuthenticated(true)
            
            // Fetch full user data from server
            try {
              const response = await api.get('/api/auth/me')
              if (response.data.success) {
                setUser(response.data.user)
                console.log('✅ User data loaded:', response.data.user.name)
              } else {
                throw new Error('Failed to fetch user data')
              }
            } catch (error) {
              console.error('Failed to fetch user data:', error)
              // Fallback to token data if API fails
              setUser({ id: decoded.id, name: 'User', email: 'user@example.com' })
            }
            
            // Bootstrap on login
            ;(async () => {
              try {
                await api.post('/api/bootstrap/gmail')
              } catch (e) {
                console.warn('Bootstrap failed:', e?.message)
              }
            })()
          } else {
            logout()
          }
        } catch (error) {
          console.error('Invalid token:', error)
          clearStoredTokens()
        }
      }
      setLoading(false)
    }

    fetchUserData()
  }, [token])

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password })
      if (response.data.success) {
        const newToken = response.data.token
        
        // Update token state and localStorage immediately
        setToken(newToken)
        localStorage.setItem('token', newToken)
        setIsAuthenticated(true)
        
        // Set API headers immediately
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
        
        // Fetch full user data
        try {
          const userResponse = await api.get('/api/auth/me')
          if (userResponse.data.success) {
            setUser(userResponse.data.user)
            console.log('✅ User data loaded after login:', userResponse.data.user.name)
          }
        } catch (error) {
          console.error('Failed to fetch user data after login:', error)
        }
        
        return { success: true }
      }
      return { success: false, error: response.data.message }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: error.response?.data?.message || 'Login failed' }
    }
  }

  const register = async (name, email, password) => {
    try {
      const response = await api.post('/api/auth/register', { name, email, password })
      if (response.data.success) {
        // Registration successful but user needs to login separately
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

  const googleLogin = async () => {
    try {
      // Create Google OAuth client
      const client = window.google?.accounts?.oauth2?.initCodeClient({
        client_id: '376597108929-bal4s8d23vpbmmr605gm56hr1ncds6he.apps.googleusercontent.com',
        scope: 'openid email profile',
        callback: async (response) => {
          try {
            const res = await api.post('/api/auth/google', { 
              code: response.code,
              redirectUri: window.location.origin 
            })
            
            if (res.data.success) {
              const newToken = res.data.token
              setToken(newToken)
              localStorage.setItem('token', newToken)
              setIsAuthenticated(true)
              
              // Set API headers immediately
              api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
              
              // Fetch full user data
              try {
                const userResponse = await api.get('/api/auth/me')
                if (userResponse.data.success) {
                  setUser(userResponse.data.user)
                  console.log('✅ User data loaded after Google login:', userResponse.data.user.name)
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

      // Request authorization code
      client.requestCode()
      
      return { success: true }
    } catch (error) {
      console.error('Google OAuth initialization error:', error)
      return { success: false, error: 'Google OAuth not available' }
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
    localStorage.removeItem('token')
    // Clear API headers
    delete api.defaults.headers.common['Authorization']
  }

  const clearStoredTokens = () => {
    localStorage.removeItem('token')
    setUser(null)
    setToken(null)
    setIsAuthenticated(false)
    // Clear API headers
    delete api.defaults.headers.common['Authorization']
    console.log('Cleared stored tokens due to authentication errors')
  }

  const updateTokenFromOAuth = async (newToken) => {
    try {
      console.log('🔄 Updating token from OAuth callback...')
      
      // Update token state and localStorage
      setToken(newToken)
      localStorage.setItem('token', newToken)
      
      // Set authenticated state immediately
      setIsAuthenticated(true)
      
      // Update API headers immediately
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
      
      // Fetch fresh user data
      try {
        const response = await api.get('/api/auth/me')
        if (response.data.success) {
          setUser(response.data.user)
          console.log('✅ User data updated after OAuth:', response.data.user.name)
          return { success: true, user: response.data.user }
        } else {
          throw new Error('Failed to fetch user data')
        }
      } catch (error) {
        console.error('Failed to fetch user data after OAuth:', error)
        // Fallback to token data if API fails
        const decoded = jwtDecode(newToken)
        setUser({ id: decoded.id, name: 'User', email: 'user@example.com' })
        return { success: false, error: 'Failed to fetch user data' }
      }
    } catch (error) {
      console.error('Error updating token from OAuth:', error)
      return { success: false, error: error.message }
    }
  }

  const connectGmailAccount = async () => {
    try {
      const response = await api.get('/api/auth/gmail/connect')
      if (response.data.success) {
        // Redirect to Google OAuth URL
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
      const response = await api.post('/api/auth/microsoft/connect')
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
      const response = await api.post('/api/auth/forgot-password', { email })
      return { success: response.data.success, message: response.data.message, resetUrl: response.data.resetUrl }
    } catch (error) {
      console.error('Forgot password error:', error)
      return { success: false, error: error.response?.data?.message || 'Failed to send reset email' }
    }
  }

  const resetPassword = async (resetToken, password) => {
    try {
      const response = await api.put(`/api/auth/reset-password/${resetToken}`, { password })
      return { success: response.data.success, message: response.data.message }
    } catch (error) {
      console.error('Reset password error:', error)
      return { success: false, error: error.response?.data?.message || 'Failed to reset password' }
    }
  }

  const sendEmailVerification = async () => {
    try {
      const response = await api.post('/api/auth/send-verification')
      return { success: response.data.success, message: response.data.message, verificationUrl: response.data.verificationUrl }
    } catch (error) {
      console.error('Send verification error:', error)
      return { success: false, error: error.response?.data?.message || 'Failed to send verification email' }
    }
  }

  const verifyEmail = async (verificationToken) => {
    try {
      const response = await api.put(`/api/auth/verify-email/${verificationToken}`)
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
