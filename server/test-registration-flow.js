import axios from 'axios'

const API_URL = 'http://localhost:5000/api'

const testRegistrationFlow = async () => {
  console.log('🧪 Testing Updated Registration Flow')
  console.log('=' * 50)
  
  try {
    // Test 1: User Registration (should NOT auto-login)
    console.log('\n1. Testing user registration...')
    const registerData = {
      name: 'Test User',
      email: 'test' + Date.now() + '@example.com',
      password: 'password123'
    }
    
    const registerResponse = await axios.post(`${API_URL}/auth/register`, registerData)
    console.log('✅ Registration response:', {
      success: registerResponse.data.success,
      message: registerResponse.data.message,
      hasToken: !!registerResponse.data.token,
      user: registerResponse.data.user
    })
    
    if (registerResponse.data.token) {
      console.log('❌ ERROR: Registration should NOT return a token!')
      return false
    }
    
    // Test 2: Try to access protected route without login (should fail)
    console.log('\n2. Testing protected route access without login...')
    try {
      await axios.get(`${API_URL}/auth/me`)
      console.log('❌ ERROR: Should not be able to access protected route without login!')
      return false
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly blocked from protected route (401 Unauthorized)')
      } else {
        console.log('❌ Unexpected error:', error.response?.status)
        return false
      }
    }
    
    // Test 3: Login with registered credentials
    console.log('\n3. Testing login with registered credentials...')
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: registerData.email,
      password: registerData.password
    })
    
    console.log('✅ Login response:', {
      success: loginResponse.data.success,
      hasToken: !!loginResponse.data.token,
      user: loginResponse.data.user
    })
    
    if (!loginResponse.data.token) {
      console.log('❌ ERROR: Login should return a token!')
      return false
    }
    
    // Test 4: Access protected route with token
    console.log('\n4. Testing protected route access with token...')
    const meResponse = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${loginResponse.data.token}` }
    })
    
    console.log('✅ Protected route accessed successfully:', {
      success: meResponse.data.success,
      user: meResponse.data.user
    })
    
    console.log('\n🎉 Registration flow test passed!')
    console.log('✅ Registration does NOT auto-login')
    console.log('✅ User must login separately after registration')
    console.log('✅ Protected routes are properly secured')
    
    return true
    
  } catch (error) {
    console.log('❌ Test failed:', error.message)
    if (error.response?.data) {
      console.log('Error details:', error.response.data)
    }
    return false
  }
}

testRegistrationFlow()
