import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'
import axios from 'axios'

dotenv.config()

const testFrontendAPI = async () => {
  try {
    console.log('🌐 FRONTEND API TEST\n')

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Find test user
    const user = await User.findOne({ email: '2022003695.prateek@ug.sharda.ac.in' })
    if (!user) {
      console.log('❌ Test user not found')
      return
    }

    console.log('✅ Test user found:', user.email)

    // Generate JWT token (same as frontend would use)
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
    const baseURL = 'http://localhost:5000'
    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    console.log('\n📡 Testing Frontend API Calls...')

    // Test 1: Auth check (like frontend does)
    try {
      const authResponse = await axios.get(`${baseURL}/api/auth/me`, { headers })
      console.log('✅ Auth check:', authResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (authResponse.data.success) {
        console.log(`   User: ${authResponse.data.user.email}`)
        console.log(`   Gmail Connected: ${authResponse.data.user.gmailConnected}`)
      }
    } catch (error) {
      console.log('❌ Auth check failed:', error.response?.data?.message || error.message)
    }

    // Test 2: Get emails (like frontend does)
    try {
      const emailsResponse = await axios.get(`${baseURL}/api/emails?page=1&limit=50`, { headers })
      console.log('✅ Get emails:', emailsResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (emailsResponse.data.success) {
        console.log(`   Emails returned: ${emailsResponse.data.emails?.length || 0}`)
        console.log(`   Total emails: ${emailsResponse.data.pagination?.total || 0}`)
        console.log(`   Current page: ${emailsResponse.data.pagination?.currentPage || 0}`)
        console.log(`   Total pages: ${emailsResponse.data.pagination?.totalPages || 0}`)
      }
    } catch (error) {
      console.log('❌ Get emails failed:', error.response?.data?.message || error.message)
    }

    // Test 3: Get analytics (like frontend does)
    try {
      const statsResponse = await axios.get(`${baseURL}/api/analytics/stats`, { headers })
      console.log('✅ Get analytics:', statsResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (statsResponse.data.success) {
        console.log(`   Total emails: ${statsResponse.data.stats?.totalEmails || 0}`)
        console.log(`   Categories: ${statsResponse.data.stats?.categories || 0}`)
      }
    } catch (error) {
      console.log('❌ Get analytics failed:', error.response?.data?.message || error.message)
    }

    // Test 4: Get categories (like frontend does)
    try {
      const categoriesResponse = await axios.get(`${baseURL}/api/analytics/categories`, { headers })
      console.log('✅ Get categories:', categoriesResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (categoriesResponse.data.success) {
        console.log(`   Categories: ${categoriesResponse.data.data?.length || 0}`)
      }
    } catch (error) {
      console.log('❌ Get categories failed:', error.response?.data?.message || error.message)
    }

    // Test 5: Test Gmail sync (like frontend does)
    try {
      const syncResponse = await axios.post(`${baseURL}/api/emails/gmail/sync`, {}, { headers })
      console.log('✅ Gmail sync:', syncResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (syncResponse.data.success) {
        console.log(`   Synced: ${syncResponse.data.syncedCount || 0} emails`)
      }
    } catch (error) {
      console.log('❌ Gmail sync failed:', error.response?.data?.message || error.message)
    }

    console.log('\n🎯 FRONTEND API TEST COMPLETE')
    console.log('If all tests pass, the frontend should work correctly!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

testFrontendAPI()
