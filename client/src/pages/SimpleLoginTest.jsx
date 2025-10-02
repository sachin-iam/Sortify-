import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const SimpleLoginTest = () => {
  const { login, loading, isAuthenticated, token, user } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: 'test@example.com',
    password: 'testpassword'
  })
  const [testResults, setTestResults] = useState([])

  const addResult = (test, passed, message) => {
    setTestResults(prev => [...prev, { test, passed, message, time: new Date().toLocaleTimeString() }])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    console.log('🧪 SimpleLoginTest: Starting login test...')
    setTestResults([])
    
    // Test 1: Initial State
    addResult('Initial State', !isAuthenticated && !token, 'Should start unauthenticated')
    
    try {
      // Test 2: Login API Call
      console.log('📡 Calling login API...')
      const result = await login(formData.email, formData.password)
      
      if (result.success) {
        addResult('Login API', true, 'Login API call successful')
        
        // Wait a moment for state updates
        setTimeout(() => {
          // Test 3: Token Storage
          const storedToken = localStorage.getItem('token')
          addResult('Token Storage', !!storedToken, 'Token should be in localStorage')
          
          // Test 4: Authentication State
          addResult('Auth State', isAuthenticated, 'User should be authenticated')
          
          // Test 5: User Data
          addResult('User Data', !!user, 'User data should be loaded')
          
          // Test 6: Navigation
          if (storedToken && isAuthenticated) {
            addResult('Navigation', true, 'Ready to navigate to dashboard')
            toast.success('Login successful! Navigating to dashboard...')
            setTimeout(() => {
              navigate('/')
            }, 1000)
          } else {
            addResult('Navigation', false, 'Cannot navigate - authentication issues')
          }
          
        }, 1000)
        
      } else {
        addResult('Login API', false, `Login failed: ${result.error}`)
        toast.error(`Login failed: ${result.error}`)
      }
    } catch (error) {
      addResult('Login API', false, `Login error: ${error.message}`)
      toast.error('Login error occurred')
    }
  }

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const clearResults = () => {
    setTestResults([])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-purple-600 mb-2">🧪 Simple Login Test</h1>
            <p className="text-slate-600">Test authentication without complex test runner</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Login Form */}
            <div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-700 text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/80 border border-purple-200/50 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400 transition-all duration-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-sm font-medium mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/80 border border-purple-200/50 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400 transition-all duration-300"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Testing Login...' : 'Test Login'}
                </button>
              </form>
            </div>

            {/* Test Results */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-700">Test Results</h3>
                <button
                  onClick={clearResults}
                  className="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Clear
                </button>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {testResults.length === 0 ? (
                  <p className="text-slate-500 text-sm italic">No test results yet</p>
                ) : (
                  testResults.map((result, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        result.passed 
                          ? 'bg-green-50 border-green-200 text-green-800' 
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {result.passed ? '✅' : '❌'} {result.test}
                        </span>
                        <span className="text-xs opacity-75">{result.time}</span>
                      </div>
                      <p className="text-sm mt-1">{result.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              This simple test shows step-by-step authentication flow without complex test runners.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimpleLoginTest

