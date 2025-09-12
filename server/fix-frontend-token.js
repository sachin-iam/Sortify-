import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'
import axios from 'axios'

dotenv.config()

const fixFrontendToken = async () => {
  try {
    console.log('🔧 FIXING FRONTEND TOKEN ISSUE\n')

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Find the user with 5,713 emails
    const correctUser = await User.findOne({ email: '2022003695.prateek@ug.sharda.ac.in' })
    if (!correctUser) {
      console.log('❌ Correct user not found')
      return
    }

    console.log('✅ Correct user found:', correctUser.email)
    console.log('✅ User ID:', correctUser._id)

    // Check email count
    const emailCount = await Email.countDocuments({ userId: correctUser._id })
    console.log('✅ Email count:', emailCount)

    // Generate correct JWT token
    const correctToken = jwt.sign({ id: correctUser._id }, process.env.JWT_SECRET)
    console.log('\n🔑 CORRECT JWT TOKEN:')
    console.log(correctToken)

    // Test API with correct token
    console.log('\n📡 TESTING API WITH CORRECT TOKEN:')
    const baseURL = 'http://localhost:5000'
    const headers = { Authorization: `Bearer ${correctToken}` }

    try {
      // Test auth endpoint
      const authResponse = await axios.get(`${baseURL}/api/auth/me`, { headers })
      console.log('✅ Auth API:', authResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (authResponse.data.success) {
        console.log(`   User: ${authResponse.data.user.email}`)
        console.log(`   User ID: ${authResponse.data.user.id}`)
      }

      // Test emails endpoint
      const emailsResponse = await axios.get(`${baseURL}/api/emails?page=1&limit=50`, { headers })
      console.log('✅ Emails API:', emailsResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (emailsResponse.data.success) {
        console.log(`   Emails returned: ${emailsResponse.data.emails?.length || 0}`)
        console.log(`   Total emails: ${emailsResponse.data.pagination?.total || 0}`)
        console.log(`   Current page: ${emailsResponse.data.pagination?.currentPage || 0}`)
        console.log(`   Total pages: ${emailsResponse.data.pagination?.totalPages || 0}`)
      }

      // Test analytics endpoint
      const statsResponse = await axios.get(`${baseURL}/api/analytics/stats`, { headers })
      console.log('✅ Stats API:', statsResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (statsResponse.data.success) {
        console.log(`   Total emails: ${statsResponse.data.stats?.totalEmails || 0}`)
      }

      console.log('\n🎯 FRONTEND TOKEN FIX:')
      console.log('=' * 60)
      console.log('STEP 1: Open your browser and go to http://localhost:3000')
      console.log('STEP 2: Open Developer Tools (F12)')
      console.log('STEP 3: Go to Console tab')
      console.log('STEP 4: Paste this command:')
      console.log('')
      console.log(`localStorage.setItem("token", "${correctToken}");`)
      console.log('')
      console.log('STEP 5: Press Enter')
      console.log('STEP 6: Refresh the page (F5)')
      console.log('')
      console.log('EXPECTED RESULT:')
      console.log('✅ Should show 5,713 emails total')
      console.log('✅ Should show 50 emails per page')
      console.log('✅ Should show 115 pages total')
      console.log('✅ Debug info should show "5713 emails returned (Total: 5713)"')
      console.log('=' * 60)

    } catch (error) {
      console.log('❌ API Error:', error.response?.data?.message || error.message)
    }

  } catch (error) {
    console.error('❌ Fix failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

fixFrontendToken()
