import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const DevTools = () => {
  const { user, token, logout } = useAuth()
  const [tokenInput, setTokenInput] = useState('')
  const [tokenInfo, setTokenInfo] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (token) {
      try {
        const { jwtDecode } = require('jwt-decode')
        const decoded = jwtDecode(token)
        setTokenInfo({
          id: decoded.id,
          exp: decoded.exp,
          iat: decoded.iat,
          expiryDate: new Date(decoded.exp * 1000),
          issuedDate: new Date(decoded.iat * 1000),
          isValid: decoded.exp > Date.now() / 1000
        })
      } catch (error) {
        console.error('Error decoding token:', error)
        setTokenInfo(null)
      }
    } else {
      setTokenInfo(null)
    }
  }, [token])

  const handleSetToken = () => {
    if (tokenInput.trim()) {
      localStorage.setItem('token', tokenInput.trim())
      window.location.reload()
    }
  }

  const handleClearToken = () => {
    localStorage.clear()
    logout()
    window.location.reload()
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const formatDate = (date) => {
    return date.toLocaleString()
  }

  const getTimeUntilExpiry = (expiryDate) => {
    const now = new Date()
    const diff = expiryDate - now
    
    if (diff <= 0) return 'Expired'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-gray-400">Development tools are not available in production.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🔧 Development Tools</h1>
          <p className="text-gray-400">JWT Token Management for Local Development</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Current Token Status */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="mr-2">🔐</span>
              Current Token Status
            </h2>
            
            {token ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${tokenInfo?.isValid ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={tokenInfo?.isValid ? 'text-green-400' : 'text-red-400'}>
                    {tokenInfo?.isValid ? 'Valid' : 'Expired'}
                  </span>
                </div>
                
                {tokenInfo && (
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-400">User ID:</span>
                      <span className="ml-2 font-mono">{tokenInfo.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Issued:</span>
                      <span className="ml-2">{formatDate(tokenInfo.issuedDate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Expires:</span>
                      <span className="ml-2">{formatDate(tokenInfo.expiryDate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Time until expiry:</span>
                      <span className="ml-2 text-yellow-400">{getTimeUntilExpiry(tokenInfo.expiryDate)}</span>
                    </div>
                  </div>
                )}
                
                <div className="pt-4">
                  <button
                    onClick={() => copyToClipboard(token)}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {copied ? '✅ Copied!' : '📋 Copy Token'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-400">
                <p>No token found in localStorage</p>
              </div>
            )}
          </div>

          {/* Token Management */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="mr-2">⚙️</span>
              Token Management
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Paste JWT Token:</label>
                <textarea
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste your JWT token here..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm font-mono"
                  rows={4}
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleSetToken}
                  disabled={!tokenInput.trim()}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  ✅ Set Token
                </button>
                
                <button
                  onClick={handleClearToken}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  🗑️ Clear All
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Commands */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="mr-2">💡</span>
            Quick Commands
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2">Generate New Token:</h3>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm">
                <div className="text-green-400"># Server directory</div>
                <div className="text-white">npm run dev:token</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Get Token via API:</h3>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm">
                <div className="text-green-400"># With curl</div>
                <div className="text-white">curl -X POST http://localhost:5000/api/auth/login \</div>
                <div className="text-white ml-4">-H "Content-Type: application/json" \</div>
                <div className="text-white ml-4">-d '{"email":"dev@sortify.local","password":"devpassword123"}'</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Clear localStorage:</h3>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm">
                <div className="text-yellow-400">localStorage.clear()</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Set Token:</h3>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm">
                <div className="text-yellow-400">localStorage.setItem("token", "YOUR_TOKEN")</div>
              </div>
            </div>
          </div>
        </div>

        {/* Current User Info */}
        {user && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="mr-2">👤</span>
              Current User
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-gray-400">Name:</span>
                <span className="ml-2">{user.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Email:</span>
                <span className="ml-2">{user.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">User ID:</span>
                <span className="ml-2 font-mono">{user.id || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400">Email Verified:</span>
                <span className={`ml-2 ${user.isEmailVerified ? 'text-green-400' : 'text-red-400'}`}>
                  {user.isEmailVerified ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DevTools
