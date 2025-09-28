import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const OAuthCallback = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { updateTokenFromOAuth } = useAuth()

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get token from URL query parameters
        const token = searchParams.get('token')
        
        if (!token) {
          console.error('❌ OAuthCallback: No token found in URL')
          navigate('/login?error=no_token')
          return
        }

        console.log('🔧 OAuthCallback: Token received, storing in localStorage')
        
        // Store token in localStorage
        localStorage.setItem('token', token)
        
        // Update auth context with the token
        const result = await updateTokenFromOAuth(token)
        
        if (result.success) {
          console.log('✅ OAuthCallback: Token stored successfully, redirecting to dashboard')
          navigate('/dashboard')
        } else {
          console.error('❌ OAuthCallback: Failed to update auth context')
          navigate('/login?error=auth_update_failed')
        }
      } catch (error) {
        console.error('❌ OAuthCallback: Error handling OAuth callback:', error)
        navigate('/login?error=callback_error')
      }
    }

    handleOAuthCallback()
  }, [searchParams, navigate, updateTokenFromOAuth])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Processing OAuth callback...</p>
      </div>
    </div>
  )
}

export default OAuthCallback
