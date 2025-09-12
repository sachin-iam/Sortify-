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
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token)
        const currentTime = Date.now() / 1000
        
        if (decoded.exp > currentTime) {
          setUser(decoded)
        } else {
          logout()
        }
      } catch (error) {
        console.error('Invalid token:', error)
        logout()
      }
    }
    setLoading(false)
  }, [token])

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password })
      if (response.data.success) {
        const newToken = response.data.token
        const decoded = jwtDecode(newToken)
        setToken(newToken)
        setUser(decoded)
        localStorage.setItem('token', newToken)
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
        const newToken = response.data.token
        const decoded = jwtDecode(newToken)
        setToken(newToken)
        setUser(decoded)
        localStorage.setItem('token', newToken)
        return { success: true }
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
        client_id: '948082154353-negb3bcn21s4p0qlqllt0mvbr5mvpfec.apps.googleusercontent.com',
        scope: 'openid email profile',
        callback: async (response) => {
          try {
            const res = await api.post('/api/auth/google', { 
              code: response.code,
              redirectUri: window.location.origin 
            })
            
            if (res.data.success) {
              const newToken = res.data.token
              const decoded = jwtDecode(newToken)
              setToken(newToken)
              setUser(decoded)
              localStorage.setItem('token', newToken)
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
    localStorage.removeItem('token')
  }

  const connectGmailAccount = async () => {
    try {
      const response = await api.post('/api/auth/gmail/connect')
      if (response.data.success) {
        return { success: true, message: response.data.message }
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

  const value = {
    user,
    token,
    loading,
    login,
    register,
    googleLogin,
    logout,
    connectGmailAccount,
    connectMicrosoftAccount,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
