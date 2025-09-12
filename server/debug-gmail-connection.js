import axios from 'axios'

const testGmailConnection = async () => {
  try {
    console.log('🔍 Testing Gmail Connection...')
    
    // Test server health
    const healthResponse = await axios.get('http://localhost:5000/api/auth/me')
    console.log('✅ Server health check:', healthResponse.status)
    
    // Test Gmail connect endpoint
    const gmailResponse = await axios.get('http://localhost:5000/api/auth/gmail/connect')
    console.log('✅ Gmail connect response:', gmailResponse.data)
    
  } catch (error) {
    console.error('❌ Error testing Gmail connection:', error.message)
    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', error.response.data)
    }
  }
}

testGmailConnection()
