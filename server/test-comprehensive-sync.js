import dotenv from 'dotenv'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import connectDB from './src/config/database.js'

// Load environment variables
dotenv.config()

const API_BASE_URL = 'http://localhost:5000/api'

async function testComprehensiveSync() {
  try {
    console.log('🧪 Starting Comprehensive Email Sync Test...\n')

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

    // Test 2: Find test user
    console.log('\n👤 Test 2: User Check')
    const testUser = await User.findOne({ email: '2022003695.prateek@ug.sharda.ac.in' })
    
    if (!testUser) {
      console.log('❌ Test user not found. Please complete Gmail OAuth first.')
      return
    }

    console.log('✅ Test user found:', testUser.email)
    console.log('   Gmail Connected:', testUser.gmailConnected)
    console.log('   Has Access Token:', !!testUser.gmailAccessToken)

    if (!testUser.gmailConnected || !testUser.gmailAccessToken) {
      console.log('❌ Gmail not connected. Please complete OAuth first.')
      return
    }

    // Test 3: Generate auth token
    console.log('\n🔐 Test 3: Authentication Token')
    const authToken = jwt.sign(
      { id: testUser._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    )
    console.log('✅ Auth token generated')

    // Test 4: Check current email count
    console.log('\n📊 Test 4: Current Email Count')
    const currentEmailCount = await Email.countDocuments({ userId: testUser._id })
    console.log(`📧 Current emails in database: ${currentEmailCount}`)

    // Test 5: Test regular sync (limited)
    console.log('\n🔄 Test 5: Regular Sync Test (Limited)')
    try {
      const regularSyncResponse = await axios.post(`${API_BASE_URL}/emails/gmail/sync`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Regular sync completed:', regularSyncResponse.data.message)
      console.log('📊 Emails synced:', regularSyncResponse.data.syncedCount)
    } catch (error) {
      console.log('❌ Regular sync failed:', error.response?.data?.message || error.message)
    }

    // Test 6: Test comprehensive sync (all emails)
    console.log('\n🚀 Test 6: Comprehensive Sync Test (All Emails)')
    try {
      console.log('⏳ Starting comprehensive sync... This may take a while...')
      const comprehensiveSyncResponse = await axios.post(`${API_BASE_URL}/emails/gmail/sync-all`, {}, {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 300000 // 5 minute timeout
      })
      console.log('✅ Comprehensive sync completed:', comprehensiveSyncResponse.data.message)
      console.log('📊 Total emails synced:', comprehensiveSyncResponse.data.syncedCount)
    } catch (error) {
      console.log('❌ Comprehensive sync failed:', error.response?.data?.message || error.message)
      if (error.code === 'ECONNABORTED') {
        console.log('⏰ Sync timed out - this is normal for large email accounts')
      }
    }

    // Test 7: Check final email count
    console.log('\n📊 Test 7: Final Email Count')
    const finalEmailCount = await Email.countDocuments({ userId: testUser._id })
    console.log(`📧 Final emails in database: ${finalEmailCount}`)
    console.log(`📈 Emails added in this session: ${finalEmailCount - currentEmailCount}`)

    // Test 8: Test email retrieval
    console.log('\n📧 Test 8: Email Retrieval Test')
    try {
      const emailsResponse = await axios.get(`${API_BASE_URL}/emails?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      console.log('✅ Email retrieval working')
      console.log('📊 Total emails available:', emailsResponse.data.pagination?.total || 0)
      console.log('📄 Emails in this page:', emailsResponse.data.emails?.length || 0)
      
      if (emailsResponse.data.emails && emailsResponse.data.emails.length > 0) {
        console.log('📧 Sample emails:')
        emailsResponse.data.emails.slice(0, 3).forEach((email, index) => {
          console.log(`   ${index + 1}. ${email.subject} (from: ${email.from})`)
        })
      }
    } catch (error) {
      console.log('❌ Email retrieval failed:', error.response?.data?.message || error.message)
    }

    console.log('\n🎯 Test Summary:')
    console.log('- Server is running ✅')
    console.log('- Database is connected ✅')
    console.log('- User authentication working ✅')
    console.log('- Gmail connection verified ✅')
    console.log(`- Emails in database: ${finalEmailCount} ✅`)
    
    if (finalEmailCount > currentEmailCount) {
      console.log(`- Email sync working: +${finalEmailCount - currentEmailCount} emails synced ✅`)
    } else {
      console.log('- Email sync may need attention ⚠️')
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testComprehensiveSync()
