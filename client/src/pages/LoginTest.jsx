import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const LoginTest = () => {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: 'test@example.com',
    password: 'testpassword'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    console.log('🧪 LoginTest: Starting test login...')
    
    try {
      const result = await login(formData.email, formData.password)
      
      if (result.success) {
        console.log('✅ LoginTest: Login successful!')
        toast.success('Login successful! Redirecting to dashboard...')
        
        // Wait a moment then navigate
        setTimeout(() => {
          navigate('/')
        }, 1000)
      } else {
        console.error('❌ LoginTest: Login failed:', result.error)
        toast.error(`Login failed: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ LoginTest: Login error:', error)
      toast.error('Login error occurred')
    }
  }

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-purple-600 mb-2">🧪 Login Test</h1>
            <p className="text-slate-600">Test the authentication system</p>
          </div>

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

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              This page tests the authentication system with detailed logging.
              Check the browser console for detailed test results.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginTest