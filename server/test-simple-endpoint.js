import axios from 'axios'

const testSimpleEndpoint = async () => {
  try {
    console.log('🔍 Testing simple endpoint...')
    
    // Test a simple endpoint first
    const response = await axios.get('http://localhost:5000/api/auth/gmail/connect')
    console.log('✅ Response:', response.data)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.response) {
      console.error('Status:', error.response.status)
      console.error('Data:', error.response.data)
    }
  }
}

testSimpleEndpoint()
