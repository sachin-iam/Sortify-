import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRouteNew = ({ children }) => {
  const { token, loading, isAuthenticated } = useAuth()
  const [isChecking, setIsChecking] = useState(true)
  const [shouldRedirect, setShouldRedirect] = useState(false)

  useEffect(() => {
    const checkAuth = () => {
      // Check localStorage directly
      const storedToken = localStorage.getItem('token')
      
      // If we have a token in localStorage OR in state, we're authenticated
      const hasToken = storedToken || token
      const isAuth = hasToken && isAuthenticated
      
      console.log('🔍 ProtectedRouteNew Check:', { 
        hasToken: !!token, 
        hasStoredToken: !!storedToken,
        loading, 
        isAuthenticated,
        shouldAllow: !loading && (isAuth || hasToken)
      })

      if (loading) {
        // Still loading, wait
        setIsChecking(true)
        setShouldRedirect(false)
        return
      }

      // If we have any token (stored or in state) and we're not loading, allow access
      if (hasToken) {
        console.log('✅ ProtectedRouteNew: Token found, allowing access')
        setIsChecking(false)
        setShouldRedirect(false)
        return
      }

      // No token found and not loading, redirect to login
      if (!loading && !hasToken) {
        console.log('❌ ProtectedRouteNew: No token found, redirecting to login')
        setIsChecking(false)
        setShouldRedirect(true)
        return
      }
    }

    // Initial check
    checkAuth()

    // Set up a small delay to handle race conditions
    const timeoutId = setTimeout(() => {
      checkAuth()
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [token, loading, isAuthenticated])

  // Show loading while checking
  if (isChecking || loading) {
    console.log('⏳ ProtectedRouteNew: Loading...')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-slate-800">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect if no authentication
  if (shouldRedirect) {
    console.log('❌ ProtectedRouteNew: Redirecting to login')
    return <Navigate to="/login" replace />
  }

  // Allow access
  console.log('✅ ProtectedRouteNew: Authentication verified, allowing access')
  return children
}

export default ProtectedRouteNew