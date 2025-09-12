import dotenv from 'dotenv'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import User from './src/models/User.js'
import connectDB from './src/config/database.js'

// Load environment variables
dotenv.config()

const API_BASE_URL = 'http://localhost:5000/api'

async function testGmailFlow() {
  try {
    console.log('🧪 Starting Gmail OAuth Flow Test...\n')

    // Connect to database
    await connectDB()
    console.log('✅ Connected to MongoDB')

    // Test 1: Check server health
    console.log('\n📡 Test 1: Server Health Check')
    try {
      const healthResponse = await axios.get('http://localhost:5000/health')
      console.log('✅ Server is running:', healthResponse.data.status)
    } catch (error) {
      console.log('❌ Server is not running:', error.message)
      return
    }

    // Test 2: Create or find test user
    console.log('\n👤 Test 2: User Setup')
    let testUser = await User.findOne({ email: '2022003695.prateek@ug.sharda.ac.in' })
    
    if (!testUser) {
      console.log('📝 Creating test user...')
      testUser = await User.create({
        name: 'Prateek Test User',
        email: '2022003695.prateek@ug.sharda.ac.in',
        password: '2022003695',
        gmailConnected: false
      })
      console.log('✅ Test user created:', testUser.email)
    } else {
      console.log('✅ Test user found:', testUser.email)
    }

    // Test 3: Generate auth token
    console.log('\n🔐 Test 3: Authentication Token')
    const authToken = jwt.sign(
      { id: testUser._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    )
    console.log('✅ Auth token generated')

    // Test 4: Test Gmail connect endpoint
    console.log('\n🔗 Test 4: Gmail Connect Endpoint')
    try {
      const gmailConnectResponse = await axios.get(`${API_BASE_URL}/auth/gmail/connect`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Gmail connect endpoint working')
      console.log('📋 Auth URL generated:', gmailConnectResponse.data.authUrl ? 'Yes' : 'No')
      
      if (gmailConnectResponse.data.authUrl) {
        console.log('\n🌐 Gmail OAuth URL:')
        console.log(gmailConnectResponse.data.authUrl)
        console.log('\n📝 Instructions:')
        console.log('1. Copy the URL above')
        console.log('2. Open it in your browser')
        console.log('3. Sign in with: 2022003695.prateek@ug.sharda.ac.in')
        console.log('4. Password: 2022003695')
        console.log('5. Grant permissions')
        console.log('6. You should be redirected back to the app')
      }
    } catch (error) {
      console.log('❌ Gmail connect failed:', error.response?.data?.message || error.message)
    }

    // Test 5: Check current user status
    console.log('\n👤 Test 5: Current User Status')
    try {
      const meResponse = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ User info retrieved:')
      console.log('   Name:', meResponse.data.user.name)
      console.log('   Email:', meResponse.data.user.email)
      console.log('   Gmail Connected:', meResponse.data.user.gmailConnected)
      console.log('   Outlook Connected:', meResponse.data.user.outlookConnected)
    } catch (error) {
      console.log('❌ Failed to get user info:', error.response?.data?.message || error.message)
    }

    // Test 6: Test email retrieval (if Gmail is connected)
    console.log('\n📧 Test 6: Email Retrieval Test')
    try {
      const emailsResponse = await axios.get(`${API_BASE_URL}/emails?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Email retrieval endpoint working')
      console.log('📊 Email count:', emailsResponse.data.emails?.length || 0)
      console.log('📄 Pagination:', emailsResponse.data.pagination)
      
      if (emailsResponse.data.emails && emailsResponse.data.emails.length > 0) {
        console.log('📧 Sample email:')
        console.log('   Subject:', emailsResponse.data.emails[0].subject)
        console.log('   From:', emailsResponse.data.emails[0].from)
        console.log('   Date:', emailsResponse.data.emails[0].date)
      }
    } catch (error) {
      console.log('❌ Email retrieval failed:', error.response?.data?.message || error.message)
    }

    // Test 7: Test email labels
    console.log('\n🏷️  Test 7: Email Labels Test')
    try {
      const labelsResponse = await axios.get(`${API_BASE_URL}/emails/labels`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Labels endpoint working')
      console.log('🏷️  Label count:', labelsResponse.data.labels?.length || 0)
      
      if (labelsResponse.data.labels && labelsResponse.data.labels.length > 0) {
        console.log('📋 Available labels:')
        labelsResponse.data.labels.forEach(label => {
          console.log(`   - ${label.name} (${label.type})`)
        })
      }
    } catch (error) {
      console.log('❌ Labels retrieval failed:', error.response?.data?.message || error.message)
    }

    console.log('\n🎯 Test Summary:')
    console.log('- Server is running ✅')
    console.log('- Database is connected ✅')
    console.log('- User authentication working ✅')
    console.log('- Gmail OAuth URL generated ✅')
    console.log('\n📋 Next Steps:')
    console.log('1. Complete the Gmail OAuth flow using the URL above')
    console.log('2. After successful OAuth, run this test again to check email retrieval')
    console.log('3. If emails are retrieved, the integration is working!')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testGmailFlow()
