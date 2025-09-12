import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'
import axios from 'axios'

dotenv.config()

const fixFrontendTokenFinal = async () => {
  try {
    console.log('🔧 FINAL FRONTEND TOKEN FIX\n')

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Find the correct user with most emails
    const users = await User.find({})
    let correctUser = null
    let maxEmails = 0

    for (const user of users) {
      const emailCount = await Email.countDocuments({ userId: user._id })
      if (emailCount > maxEmails) {
        maxEmails = emailCount
        correctUser = user
      }
    }

    if (!correctUser) {
      console.log('❌ No user found')
      return
    }

    console.log('✅ Correct user found:', correctUser.email)
    console.log('✅ User ID:', correctUser._id)
    console.log('✅ Email count:', maxEmails)

    // Generate JWT token
    const token = jwt.sign({ id: correctUser._id }, process.env.JWT_SECRET)
    
    // Test API with correct token
    const baseURL = 'http://localhost:5000'
    const headers = { Authorization: `Bearer ${token}` }

    console.log('\n📡 TESTING API WITH CORRECT TOKEN:')
    
    try {
      const emailsResponse = await axios.get(`${baseURL}/api/emails?page=1&limit=50`, { headers })
      console.log('✅ Emails API:', emailsResponse.data.success ? 'SUCCESS' : 'FAILED')
      if (emailsResponse.data.success) {
        console.log(`   Emails returned: ${emailsResponse.data.emails?.length || 0}`)
        console.log(`   Total emails: ${emailsResponse.data.pagination?.total || 0}`)
        console.log(`   Current page: ${emailsResponse.data.pagination?.currentPage || 0}`)
        console.log(`   Total pages: ${emailsResponse.data.pagination?.totalPages || 0}`)
      }
    } catch (error) {
      console.log('❌ API Error:', error.response?.data?.message || error.message)
    }

    console.log('\n🎯 FRONTEND TOKEN FIX:')
    console.log('=' * 80)
    console.log('STEP 1: Open your browser and go to http://localhost:3000')
    console.log('STEP 2: Open Developer Tools (F12)')
    console.log('STEP 3: Go to Console tab')
    console.log('STEP 4: Clear any existing token:')
    console.log('   localStorage.clear()')
    console.log('STEP 5: Set the correct token:')
    console.log(`   localStorage.setItem("token", "${token}");`)
    console.log('STEP 6: Refresh the page (F5)')
    console.log('')
    console.log('EXPECTED RESULTS:')
    console.log(`✅ Should show ${maxEmails} emails total`)
    console.log('✅ Should show 50 emails per page')
    console.log(`✅ Should show ${Math.ceil(maxEmails / 50)} pages total`)
    console.log('✅ Debug info should show correct email count')
    console.log('=' * 80)

  } catch (error) {
    console.error('❌ Fix failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

fixFrontendTokenFinal()
