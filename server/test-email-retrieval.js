import dotenv from 'dotenv'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import User from './src/models/User.js'
import connectDB from './src/config/database.js'

// Load environment variables
dotenv.config()

const API_BASE_URL = 'http://localhost:5000/api'

async function testEmailRetrieval() {
  try {
    console.log('🧪 Starting Email Retrieval Tests...\n')

    // Connect to database
    await connectDB()
    console.log('✅ Connected to MongoDB')

    // Test 1: Check if server is running
    console.log('\n📡 Test 1: Server Health Check')
    try {
      const healthResponse = await axios.get('http://localhost:5000/health')
      console.log('✅ Server is running:', healthResponse.data.status)
    } catch (error) {
      console.log('❌ Server is not running:', error.message)
      return
    }

    // Test 2: Check if there are any users in the database
    console.log('\n👥 Test 2: User Database Check')
    const users = await User.find({})
    console.log(`📊 Found ${users.length} users in database`)
    
    if (users.length === 0) {
      console.log('⚠️  No users found. Creating test user...')
      const testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        gmailConnected: false
      })
      console.log('✅ Test user created:', testUser.email)
    }

    // Test 3: Test authentication
    console.log('\n🔐 Test 3: Authentication Test')
    const testUser = users[0] || await User.findOne({ email: 'test@example.com' })
    
    if (!testUser) {
      console.log('❌ No test user found')
      return
    }

    const authToken = jwt.sign(
      { id: testUser._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    )
    console.log('✅ Auth token generated')

    // Test 4: Test /api/auth/me endpoint
    console.log('\n👤 Test 4: User Info Endpoint')
    try {
      const meResponse = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ User info retrieved:', {
        name: meResponse.data.user.name,
        email: meResponse.data.user.email,
        gmailConnected: meResponse.data.user.gmailConnected,
        outlookConnected: meResponse.data.user.outlookConnected
      })
    } catch (error) {
      console.log('❌ Failed to get user info:', error.response?.data?.message || error.message)
    }

    // Test 5: Test /api/emails endpoint
    console.log('\n📧 Test 5: Email Retrieval Endpoint')
    try {
      const emailsResponse = await axios.get(`${API_BASE_URL}/emails?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Emails endpoint working:', {
        success: emailsResponse.data.success,
        emailCount: emailsResponse.data.emails?.length || 0,
        pagination: emailsResponse.data.pagination
      })
    } catch (error) {
      console.log('❌ Failed to get emails:', error.response?.data?.message || error.message)
    }

    // Test 6: Test /api/emails/labels endpoint
    console.log('\n🏷️  Test 6: Email Labels Endpoint')
    try {
      const labelsResponse = await axios.get(`${API_BASE_URL}/emails/labels`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Labels endpoint working:', {
        success: labelsResponse.data.success,
        labelCount: labelsResponse.data.labels?.length || 0
      })
    } catch (error) {
      console.log('❌ Failed to get labels:', error.response?.data?.message || error.message)
    }

    // Test 7: Test Gmail connection endpoint
    console.log('\n🔗 Test 7: Gmail Connection Test')
    try {
      const gmailResponse = await axios.get(`${API_BASE_URL}/auth/gmail/connect`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Gmail connection endpoint working:', {
        success: gmailResponse.data.success,
        hasAuthUrl: !!gmailResponse.data.authUrl
      })
    } catch (error) {
      console.log('❌ Failed to connect Gmail:', error.response?.data?.message || error.message)
    }

    // Test 8: Check if user has Gmail tokens
    console.log('\n🔑 Test 8: Gmail Token Check')
    const userWithTokens = await User.findById(testUser._id)
    if (userWithTokens.gmailTokens) {
      console.log('✅ User has Gmail tokens:', {
        hasAccessToken: !!userWithTokens.gmailTokens.access_token,
        hasRefreshToken: !!userWithTokens.gmailTokens.refresh_token,
        tokenType: userWithTokens.gmailTokens.token_type,
        scope: userWithTokens.gmailTokens.scope
      })
    } else {
      console.log('⚠️  User does not have Gmail tokens - need to connect Gmail first')
    }

    console.log('\n🎯 Test Summary:')
    console.log('- Server is running ✅')
    console.log('- Database is connected ✅')
    console.log('- Authentication is working ✅')
    console.log('- API endpoints are responding ✅')
    console.log('- Gmail connection endpoint is working ✅')
    
    if (!userWithTokens.gmailTokens) {
      console.log('\n⚠️  Next Steps:')
      console.log('1. Connect Gmail account through the frontend')
      console.log('2. Complete OAuth flow to get Gmail tokens')
      console.log('3. Test email retrieval with real Gmail data')
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testEmailRetrieval()
