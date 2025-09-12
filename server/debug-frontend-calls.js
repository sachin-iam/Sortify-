import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'
import axios from 'axios'

dotenv.config()

const debugFrontendCalls = async () => {
  try {
    console.log('🔍 DEBUGGING FRONTEND API CALLS\n')

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

    console.log('\n📡 Testing exact frontend API calls...')

    // Test 1: Auth check
    console.log('\n1️⃣ Testing /api/auth/me')
    try {
      const authResponse = await axios.get(`${baseURL}/api/auth/me`, { headers })
      console.log('✅ Status:', authResponse.status)
      console.log('✅ Response:', JSON.stringify(authResponse.data, null, 2))
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message)
    }

    // Test 2: Get emails with different parameters
    console.log('\n2️⃣ Testing /api/emails with different parameters')
    
    const testParams = [
      '?page=1&limit=50',
      '?page=1&limit=20',
      '?page=1&limit=100',
      '?page=1&limit=50&provider=gmail',
      '?page=1&limit=50&category=all'
    ]

    for (const params of testParams) {
      try {
        console.log(`\n📧 Testing: /api/emails${params}`)
        const emailsResponse = await axios.get(`${baseURL}/api/emails${params}`, { headers })
        console.log('✅ Status:', emailsResponse.status)
        console.log('✅ Emails returned:', emailsResponse.data.emails?.length || 0)
        console.log('✅ Total emails:', emailsResponse.data.pagination?.total || 0)
        console.log('✅ Current page:', emailsResponse.data.pagination?.currentPage || 0)
        console.log('✅ Total pages:', emailsResponse.data.pagination?.totalPages || 0)
        
        if (emailsResponse.data.emails?.length > 0) {
          console.log('✅ First email subject:', emailsResponse.data.emails[0].subject)
        }
      } catch (error) {
        console.log('❌ Error:', error.response?.data || error.message)
      }
    }

    // Test 3: Check if there are any filters applied
    console.log('\n3️⃣ Testing with different filters')
    
    const filterTests = [
      { name: 'No filters', params: '?page=1&limit=50' },
      { name: 'Gmail only', params: '?page=1&limit=50&provider=gmail' },
      { name: 'All categories', params: '?page=1&limit=50&category=all' },
      { name: 'Placement category', params: '?page=1&limit=50&category=Placement' }
    ]

    for (const test of filterTests) {
      try {
        console.log(`\n🔍 ${test.name}:`)
        const response = await axios.get(`${baseURL}/api/emails${test.params}`, { headers })
        console.log(`   Emails: ${response.data.emails?.length || 0}`)
        console.log(`   Total: ${response.data.pagination?.total || 0}`)
      } catch (error) {
        console.log(`   Error: ${error.response?.data?.message || error.message}`)
      }
    }

    // Test 4: Check database directly
    console.log('\n4️⃣ Checking database directly')
    const totalEmails = await Email.countDocuments({ userId: user._id })
    console.log('✅ Total emails in database:', totalEmails)
    
    const emails = await Email.find({ userId: user._id })
      .sort({ date: -1 })
      .limit(50)
      .lean()
    
    console.log('✅ Emails from database (first 50):', emails.length)
    console.log('✅ First 5 email subjects:')
    emails.slice(0, 5).forEach((email, index) => {
      console.log(`   ${index + 1}. ${email.subject}`)
    })

    // Test 5: Check if there's a user-specific issue
    console.log('\n5️⃣ Checking user-specific data')
    const userEmails = await Email.find({ userId: user._id }).lean()
    console.log('✅ User emails count:', userEmails.length)
    
    const categories = [...new Set(userEmails.map(email => email.category))]
    console.log('✅ Categories found:', categories)
    
    const providers = [...new Set(userEmails.map(email => email.provider))]
    console.log('✅ Providers found:', providers)

  } catch (error) {
    console.error('❌ Debug failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

debugFrontendCalls()
