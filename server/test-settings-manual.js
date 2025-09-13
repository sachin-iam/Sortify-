import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'

async function testSettingsEndpoints() {
  console.log('🧪 Testing Settings API Endpoints...\n')

  try {
    // Test 1: Health check
    console.log('1. Testing health check...')
    const healthResponse = await axios.get('http://localhost:5000/health')
    console.log('✅ Health check:', healthResponse.data.status)

    // Test 2: Register a test user
    console.log('\n2. Creating test user...')
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      name: 'Settings Test User',
      email: 'settingstest@example.com',
      password: 'password123'
    })
    console.log('✅ User created:', registerResponse.data.user.email)

    const token = registerResponse.data.token

    // Test 3: Get connections
    console.log('\n3. Testing get connections...')
    const connectionsResponse = await axios.get(`${API_BASE}/auth/connections`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    console.log('✅ Connections:', connectionsResponse.data.connections)

    // Test 4: Update profile
    console.log('\n4. Testing profile update...')
    const profileResponse = await axios.put(`${API_BASE}/auth/profile`, {
      name: 'Updated Settings User',
      emailPreferences: {
        notifications: false,
        marketing: true
      }
    }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    console.log('✅ Profile updated:', profileResponse.data.user.name)

    // Test 5: Update email preferences
    console.log('\n5. Testing email preferences update...')
    const preferencesResponse = await axios.put(`${API_BASE}/auth/email-preferences`, {
      notifications: true,
      marketing: false
    }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    console.log('✅ Email preferences updated:', preferencesResponse.data.emailPreferences)

    // Test 6: Change password
    console.log('\n6. Testing password change...')
    const passwordResponse = await axios.put(`${API_BASE}/auth/change-password`, {
      currentPassword: 'password123',
      newPassword: 'newpassword123'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    console.log('✅ Password changed:', passwordResponse.data.message)

    // Test 7: Login with new password
    console.log('\n7. Testing login with new password...')
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'settingstest@example.com',
      password: 'newpassword123'
    })
    console.log('✅ Login successful with new password')

    const newToken = loginResponse.data.token

    // Test 8: Delete account
    console.log('\n8. Testing account deletion...')
    const deleteResponse = await axios.delete(`${API_BASE}/auth/account`, {
      headers: { Authorization: `Bearer ${newToken}` }
    })
    console.log('✅ Account deleted:', deleteResponse.data.message)

    console.log('\n🎉 All settings tests passed!')

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message)
  }
}

testSettingsEndpoints()
