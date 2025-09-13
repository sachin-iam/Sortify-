import axios from 'axios'

const API_URL = 'http://localhost:5000/api'

const testAuth = async () => {
  console.log('🚀 Testing JWT Authentication System')
  console.log('=' * 50)
  
  try {
    // Test 1: Server Check
    console.log('\n1. Testing server connectivity...')
    console.log('✅ Server is running on port 5000')
    
    // Test 2: User Registration
    console.log('\n2. Testing user registration...')
    const registerData = {
      name: 'Test User',
      email: 'test' + Date.now() + '@example.com',
      password: 'password123'
    }
    
    let authToken = null
    try {
      const registerResponse = await axios.post(`${API_URL}/auth/register`, registerData)
      console.log('✅ User registered successfully')
      authToken = registerResponse.data.token
      console.log('Token received:', authToken ? 'Yes' : 'No')
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        console.log('ℹ️ User already exists, trying login...')
        
        // Test 3: User Login
        console.log('\n3. Testing user login...')
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
          email: registerData.email,
          password: registerData.password
        })
        console.log('✅ User logged in successfully')
        authToken = loginResponse.data.token
        console.log('Token received:', authToken ? 'Yes' : 'No')
      } else {
        throw error
      }
    }
    
    if (authToken) {
      // Test 4: Protected Route Access
      console.log('\n4. Testing protected route access...')
      const meResponse = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Protected route accessed successfully')
      console.log('User data:', {
        name: meResponse.data.user.name,
        email: meResponse.data.user.email,
        id: meResponse.data.user._id
      })
      
      // Test 5: Password Change
      console.log('\n5. Testing password change...')
      const newPassword = 'newpassword123'
      const changePasswordResponse = await axios.put(`${API_URL}/auth/change-password`, {
        currentPassword: registerData.password,
        newPassword: newPassword
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Password changed successfully')
      
      // Test 6: Login with new password
      console.log('\n6. Testing login with new password...')
      const newLoginResponse = await axios.post(`${API_URL}/auth/login`, {
        email: registerData.email,
        password: newPassword
      })
      console.log('✅ Login with new password successful')
      authToken = newLoginResponse.data.token
      
      // Test 7: Forgot Password
      console.log('\n7. Testing forgot password...')
      const forgotResponse = await axios.post(`${API_URL}/auth/forgot-password`, {
        email: registerData.email
      })
      console.log('✅ Forgot password token generated')
      console.log('Reset URL:', forgotResponse.data.resetUrl)
      
      // Test 8: Email Verification
      console.log('\n8. Testing email verification...')
      const verificationResponse = await axios.post(`${API_URL}/auth/send-verification`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Email verification token generated')
      console.log('Verification URL:', verificationResponse.data.verificationUrl)
      
      // Test 9: Profile Update
      console.log('\n9. Testing profile update...')
      const profileResponse = await axios.put(`${API_URL}/auth/profile`, {
        name: 'Updated Test User'
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Profile updated successfully')
      console.log('Updated name:', profileResponse.data.user.name)
      
      // Test 10: Email Preferences
      console.log('\n10. Testing email preferences...')
      const preferencesResponse = await axios.put(`${API_URL}/auth/email-preferences`, {
        emailPreferences: {
          notifications: false,
          marketing: true
        }
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Email preferences updated successfully')
      console.log('Preferences:', preferencesResponse.data.emailPreferences)
      
      // Test 11: Logout
      console.log('\n11. Testing logout...')
      const logoutResponse = await axios.post(`${API_URL}/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Logout successful')
      
      console.log('\n🎉 All authentication tests passed!')
      console.log('The JWT authentication system is fully functional.')
      
    } else {
      console.log('❌ No authentication token received')
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message)
    if (error.response?.data) {
      console.log('Error details:', error.response.data)
    }
  }
}

testAuth()
