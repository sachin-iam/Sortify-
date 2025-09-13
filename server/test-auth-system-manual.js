import axios from 'axios'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const BASE_URL = process.env.CORS_ORIGIN || 'http://localhost:3000'
const API_URL = process.env.API_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Test data
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123'
}

let authToken = null

const log = (message, data = null) => {
  console.log(`\n🔍 ${message}`)
  if (data) {
    console.log(JSON.stringify(data, null, 2))
  }
}

const logSuccess = (message) => {
  console.log(`✅ ${message}`)
}

const logError = (message, error) => {
  console.log(`❌ ${message}`)
  if (error?.response?.data) {
    console.log('Error details:', error.response.data)
  } else if (error?.message) {
    console.log('Error message:', error.message)
  }
}

async function testHealthCheck() {
  try {
    log('Testing server health check...')
    const response = await api.get('/health')
    logSuccess('Server is healthy')
    return true
  } catch (error) {
    logError('Server health check failed', error)
    return false
  }
}

async function testUserRegistration() {
  try {
    log('Testing user registration...')
    const response = await api.post('/auth/register', testUser)
    
    if (response.data.success) {
      authToken = response.data.token
      logSuccess('User registered successfully')
      log('Registration response:', {
        success: response.data.success,
        token: response.data.token ? 'Present' : 'Missing',
        user: {
          name: response.data.user.name,
          email: response.data.user.email,
          id: response.data.user._id
        }
      })
      return true
    } else {
      logError('Registration failed', response.data)
      return false
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
      logSuccess('User already exists (expected for subsequent runs)')
      return true
    }
    logError('User registration failed', error)
    return false
  }
}

async function testUserLogin() {
  try {
    log('Testing user login...')
    const response = await api.post('/auth/login', {
      email: testUser.email,
      password: testUser.password
    })
    
    if (response.data.success) {
      authToken = response.data.token
      logSuccess('User logged in successfully')
      log('Login response:', {
        success: response.data.success,
        token: response.data.token ? 'Present' : 'Missing',
        user: {
          name: response.data.user.name,
          email: response.data.user.email,
          lastLogin: response.data.user.lastLogin
        }
      })
      return true
    } else {
      logError('Login failed', response.data)
      return false
    }
  } catch (error) {
    logError('User login failed', error)
    return false
  }
}

async function testProtectedRoute() {
  try {
    log('Testing protected route access...')
    const response = await api.get('/auth/me', {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })
    
    if (response.data.success) {
      logSuccess('Protected route accessed successfully')
      log('User profile:', response.data.user)
      return true
    } else {
      logError('Protected route access failed', response.data)
      return false
    }
  } catch (error) {
    logError('Protected route access failed', error)
    return false
  }
}

async function testPasswordChange() {
  try {
    log('Testing password change...')
    const newPassword = 'newpassword123'
    
    const response = await api.put('/auth/change-password', {
      currentPassword: testUser.password,
      newPassword: newPassword
    }, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })
    
    if (response.data.success) {
      logSuccess('Password changed successfully')
      
      // Test login with new password
      log('Testing login with new password...')
      const loginResponse = await api.post('/auth/login', {
        email: testUser.email,
        password: newPassword
      })
      
      if (loginResponse.data.success) {
        authToken = loginResponse.data.token
        logSuccess('Login with new password successful')
        
        // Change password back to original
        await api.put('/auth/change-password', {
          currentPassword: newPassword,
          newPassword: testUser.password
        }, {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        })
        logSuccess('Password changed back to original')
        return true
      } else {
        logError('Login with new password failed', loginResponse.data)
        return false
      }
    } else {
      logError('Password change failed', response.data)
      return false
    }
  } catch (error) {
    logError('Password change failed', error)
    return false
  }
}

async function testForgotPassword() {
  try {
    log('Testing forgot password...')
    const response = await api.post('/auth/forgot-password', {
      email: testUser.email
    })
    
    if (response.data.success) {
      logSuccess('Password reset token generated')
      log('Reset response:', {
        message: response.data.message,
        resetUrl: response.data.resetUrl,
        resetToken: response.data.resetToken ? 'Present (dev mode)' : 'Hidden (prod mode)'
      })
      return true
    } else {
      logError('Forgot password failed', response.data)
      return false
    }
  } catch (error) {
    logError('Forgot password failed', error)
    return false
  }
}

async function testEmailVerification() {
  try {
    log('Testing email verification...')
    const response = await api.post('/auth/send-verification', {}, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })
    
    if (response.data.success) {
      logSuccess('Email verification token generated')
      log('Verification response:', {
        message: response.data.message,
        verificationUrl: response.data.verificationUrl,
        verificationToken: response.data.verificationToken ? 'Present (dev mode)' : 'Hidden (prod mode)'
      })
      return true
    } else {
      logError('Email verification failed', response.data)
      return false
    }
  } catch (error) {
    logError('Email verification failed', error)
    return false
  }
}

async function testProfileUpdate() {
  try {
    log('Testing profile update...')
    const updatedName = 'Updated Test User'
    
    const response = await api.put('/auth/profile', {
      name: updatedName
    }, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })
    
    if (response.data.success) {
      logSuccess('Profile updated successfully')
      log('Updated profile:', response.data.user)
      
      // Update back to original
      await api.put('/auth/profile', {
        name: testUser.name
      }, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      })
      logSuccess('Profile updated back to original')
      return true
    } else {
      logError('Profile update failed', response.data)
      return false
    }
  } catch (error) {
    logError('Profile update failed', error)
    return false
  }
}

async function testEmailPreferences() {
  try {
    log('Testing email preferences update...')
    
    const response = await api.put('/auth/email-preferences', {
      emailPreferences: {
        notifications: false,
        marketing: true
      }
    }, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })
    
    if (response.data.success) {
      logSuccess('Email preferences updated successfully')
      log('Updated preferences:', response.data.emailPreferences)
      return true
    } else {
      logError('Email preferences update failed', response.data)
      return false
    }
  } catch (error) {
    logError('Email preferences update failed', error)
    return false
  }
}

async function testLogout() {
  try {
    log('Testing logout...')
    const response = await api.post('/auth/logout', {}, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })
    
    if (response.data.success) {
      logSuccess('Logout successful')
      authToken = null
      return true
    } else {
      logError('Logout failed', response.data)
      return false
    }
  } catch (error) {
    logError('Logout failed', error)
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive Authentication System Test')
  console.log('=' * 60)
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'User Registration', fn: testUserRegistration },
    { name: 'User Login', fn: testUserLogin },
    { name: 'Protected Route Access', fn: testProtectedRoute },
    { name: 'Password Change', fn: testPasswordChange },
    { name: 'Forgot Password', fn: testForgotPassword },
    { name: 'Email Verification', fn: testEmailVerification },
    { name: 'Profile Update', fn: testProfileUpdate },
    { name: 'Email Preferences', fn: testEmailPreferences },
    { name: 'Logout', fn: testLogout }
  ]
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    try {
      const result = await test.fn()
      if (result) {
        passed++
      } else {
        failed++
      }
    } catch (error) {
      logError(`${test.name} test crashed`, error)
      failed++
    }
  }
  
  console.log('\n' + '=' * 60)
  console.log('📊 Test Results Summary')
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)
  
  if (failed === 0) {
    console.log('\n🎉 All authentication tests passed! The JWT authentication system is fully functional.')
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.')
  }
  
  return failed === 0
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('Test runner crashed:', error)
      process.exit(1)
    })
}

export { runAllTests }
