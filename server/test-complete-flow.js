import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'
import axios from 'axios'

dotenv.config()

const testCompleteFlow = async () => {
  try {
    console.log('🧪 Testing Complete Email Flow...\n')

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

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
    console.log('🔑 JWT Token generated')

    // Test API endpoints
    const baseURL = 'http://localhost:5000'
    const headers = { Authorization: `Bearer ${token}` }

    console.log('\n📡 Testing API Endpoints...')

    // Test 1: Get user info
    try {
      const userResponse = await axios.get(`${baseURL}/api/auth/me`, { headers })
      console.log('✅ GET /api/auth/me:', userResponse.data.success ? 'SUCCESS' : 'FAILED')
    } catch (error) {
      console.log('❌ GET /api/auth/me:', error.response?.data?.message || error.message)
    }

    // Test 2: Get analytics stats
    try {
      const statsResponse = await axios.get(`${baseURL}/api/analytics/stats`, { headers })
      console.log('✅ GET /api/analytics/stats:', statsResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (statsResponse.data.success) {
        console.log(`   Total Emails: ${statsResponse.data.stats.totalEmails}`)
        console.log(`   Categories: ${statsResponse.data.stats.categories}`)
      }
    } catch (error) {
      console.log('❌ GET /api/analytics/stats:', error.response?.data?.message || error.message)
    }

    // Test 3: Get emails with pagination
    try {
      const emailsResponse = await axios.get(`${baseURL}/api/emails?page=1&limit=50`, { headers })
      console.log('✅ GET /api/emails:', emailsResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (emailsResponse.data.success) {
        console.log(`   Emails returned: ${emailsResponse.data.emails?.length || 0}`)
        console.log(`   Total emails: ${emailsResponse.data.pagination?.total || 0}`)
        console.log(`   Current page: ${emailsResponse.data.pagination?.currentPage || 0}`)
        console.log(`   Total pages: ${emailsResponse.data.pagination?.totalPages || 0}`)
      }
    } catch (error) {
      console.log('❌ GET /api/emails:', error.response?.data?.message || error.message)
    }

    // Test 4: Get categories
    try {
      const categoriesResponse = await axios.get(`${baseURL}/api/analytics/categories`, { headers })
      console.log('✅ GET /api/analytics/categories:', categoriesResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (categoriesResponse.data.success) {
        console.log(`   Categories: ${categoriesResponse.data.data?.length || 0}`)
      }
    } catch (error) {
      console.log('❌ GET /api/analytics/categories:', error.response?.data?.message || error.message)
    }

    // Test 5: Test Gmail sync
    try {
      const syncResponse = await axios.post(`${baseURL}/api/emails/gmail/sync`, {}, { headers })
      console.log('✅ POST /api/emails/gmail/sync:', syncResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (syncResponse.data.success) {
        console.log(`   Synced: ${syncResponse.data.syncedCount || 0} emails`)
      }
    } catch (error) {
      console.log('❌ POST /api/emails/gmail/sync:', error.response?.data?.message || error.message)
    }

    // Check final email count
    const finalCount = await Email.countDocuments({ userId: user._id })
    console.log(`\n📊 Final email count in database: ${finalCount}`)

    // Show classification breakdown
    const emails = await Email.find({ userId: user._id }).lean()
    const classificationBreakdown = {}
    emails.forEach(email => {
      const category = email.category || 'Other'
      classificationBreakdown[category] = (classificationBreakdown[category] || 0) + 1
    })

    console.log('\n📊 Final Classification Breakdown:')
    Object.entries(classificationBreakdown).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} emails`)
    })

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Disconnected from MongoDB')
  }
}

testCompleteFlow()
