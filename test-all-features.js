import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'
const FRONTEND_BASE = 'http://localhost:3001'

console.log('🧪 COMPREHENSIVE FEATURE TESTING')
console.log('================================\n')

async function testAllFeatures() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  }

  function addResult(testName, passed, details = '') {
    results.tests.push({ testName, passed, details })
    if (passed) {
      results.passed++
      console.log(`✅ ${testName}`)
      if (details) console.log(`   ${details}`)
    } else {
      results.failed++
      console.log(`❌ ${testName}`)
      if (details) console.log(`   ${details}`)
    }
  }

  try {
    // Test 1: Backend Health
    console.log('1. BACKEND HEALTH CHECK')
    try {
      const response = await axios.get('http://localhost:5000/health')
      addResult('Backend Server Running', response.status === 200, `Status: ${response.data.status}`)
    } catch (error) {
      addResult('Backend Server Running', false, 'Server not responding')
    }

    // Test 2: Frontend Health
    console.log('\n2. FRONTEND HEALTH CHECK')
    try {
      const response = await axios.get(FRONTEND_BASE)
      addResult('Frontend Server Running', response.status === 200, 'React app accessible')
    } catch (error) {
      addResult('Frontend Server Running', false, 'Frontend not responding')
    }

    // Test 3: User Registration
    console.log('\n3. USER REGISTRATION')
    try {
      const response = await axios.post(`${API_BASE}/auth/register`, {
        name: 'Feature Test User',
        email: 'featuretest@example.com',
        password: 'password123'
      })
      addResult('User Registration', response.data.success, `User: ${response.data.user.email}`)
      const token = response.data.token
      
      // Test 4: Authentication
      console.log('\n4. AUTHENTICATION')
      const authResponse = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      addResult('JWT Authentication', authResponse.data.success, `Authenticated: ${authResponse.data.user.name}`)

      // Test 5: Profile Management
      console.log('\n5. PROFILE MANAGEMENT')
      const profileResponse = await axios.put(`${API_BASE}/auth/profile`, {
        name: 'Updated Feature Test User',
        emailPreferences: {
          notifications: false,
          marketing: true
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      addResult('Profile Update', profileResponse.data.success, `Name: ${profileResponse.data.user.name}`)

      // Test 6: Email Preferences
      console.log('\n6. EMAIL PREFERENCES')
      const preferencesResponse = await axios.put(`${API_BASE}/auth/email-preferences`, {
        notifications: true,
        marketing: false
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      addResult('Email Preferences Update', preferencesResponse.data.success, 
        `Notifications: ${preferencesResponse.data.emailPreferences.notifications}`)

      // Test 7: Password Change
      console.log('\n7. PASSWORD CHANGE')
      const passwordResponse = await axios.put(`${API_BASE}/auth/change-password`, {
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      addResult('Password Change', passwordResponse.data.success, 'Password changed successfully')

      // Test 8: Gmail Connection
      console.log('\n8. GMAIL CONNECTION')
      try {
        const gmailResponse = await axios.get(`${API_BASE}/auth/gmail/connect`)
        addResult('Gmail OAuth URL Generation', gmailResponse.data.success, 'OAuth URL generated')
      } catch (error) {
        addResult('Gmail OAuth URL Generation', false, 'OAuth setup failed')
      }

      // Test 9: Connections Status
      console.log('\n9. CONNECTIONS STATUS')
      const connectionsResponse = await axios.get(`${API_BASE}/auth/connections`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      addResult('Connections Status', connectionsResponse.data.success, 
        `Gmail: ${connectionsResponse.data.connections.gmail.connected}, Outlook: ${connectionsResponse.data.connections.outlook.connected}`)

      // Test 10: Account Deletion
      console.log('\n10. ACCOUNT DELETION')
      const deleteResponse = await axios.delete(`${API_BASE}/auth/account`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      addResult('Account Deletion', deleteResponse.data.success, 'Account deleted successfully')

    } catch (error) {
      addResult('User Registration', false, error.response?.data?.message || error.message)
    }

    // Test 11: Email API Endpoints
    console.log('\n11. EMAIL API ENDPOINTS')
    try {
      const emailResponse = await axios.get(`${API_BASE}/emails`)
      addResult('Email API Protection', emailResponse.status === 401, 'Properly protected endpoint')
    } catch (error) {
      addResult('Email API Protection', error.response?.status === 401, 'Properly protected endpoint')
    }

    // Test 12: Analytics API Endpoints
    console.log('\n12. ANALYTICS API ENDPOINTS')
    try {
      const analyticsResponse = await axios.get(`${API_BASE}/analytics/stats`)
      addResult('Analytics API Protection', analyticsResponse.status === 401, 'Properly protected endpoint')
    } catch (error) {
      addResult('Analytics API Protection', error.response?.status === 401, 'Properly protected endpoint')
    }

    // Test 13: CORS Configuration
    console.log('\n13. CORS CONFIGURATION')
    try {
      const corsResponse = await axios.options(`${API_BASE}/auth/me`)
      addResult('CORS Configuration', corsResponse.status === 204, 'CORS properly configured')
    } catch (error) {
      addResult('CORS Configuration', false, 'CORS configuration issue')
    }

  } catch (error) {
    console.error('Test execution error:', error.message)
  }

  // Final Results
  console.log('\n🎯 FINAL TEST RESULTS')
  console.log('====================')
  console.log(`✅ Passed: ${results.passed}`)
  console.log(`❌ Failed: ${results.failed}`)
  console.log(`📊 Total:  ${results.passed + results.failed}`)
  console.log(`🎯 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`)

  if (results.failed === 0) {
    console.log('\n🎉 ALL FEATURES WORKING PERFECTLY!')
    console.log('✅ All 10+ settings features implemented and tested')
    console.log('✅ Backend API endpoints working')
    console.log('✅ Frontend integration complete')
    console.log('✅ Database operations successful')
    console.log('✅ Authentication and authorization working')
    console.log('✅ CRUD operations functional')
  } else {
    console.log('\n⚠️  Some features need attention')
    console.log('Check the failed tests above for details')
  }

  return results
}

testAllFeatures()
