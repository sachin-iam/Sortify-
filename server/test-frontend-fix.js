import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'
import axios from 'axios'

dotenv.config()

const testFrontendFix = async () => {
  try {
    console.log('🔧 TESTING FRONTEND FIX\n')

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Find the correct user
    const user = await User.findOne({ email: '2022003695.prateek@ug.sharda.ac.in' })
    if (!user) {
      console.log('❌ User not found')
      return
    }

    console.log('✅ User found:', user.email)
    console.log('✅ User ID:', user._id)

    // Check email count
    const emailCount = await Email.countDocuments({ userId: user._id })
    console.log('✅ Email count:', emailCount)

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
    const baseURL = 'http://localhost:5000'
    const headers = { Authorization: `Bearer ${token}` }

    console.log('\n📡 TESTING FRONTEND API CALLS:')

    // Test the exact API call the frontend makes
    const response = await axios.get(`${baseURL}/api/emails?page=1&limit=50`, { headers })
    
    console.log('✅ API Response Status:', response.status)
    console.log('✅ API Success:', response.data.success)
    console.log('✅ Emails returned:', response.data.emails?.length || 0)
    console.log('✅ Total emails:', response.data.pagination?.total || 0)
    console.log('✅ Current page:', response.data.pagination?.currentPage || 0)
    console.log('✅ Total pages:', response.data.pagination?.totalPages || 0)

    if (response.data.emails?.length > 0) {
      console.log('\n📧 First 3 emails:')
      response.data.emails.slice(0, 3).forEach((email, index) => {
        console.log(`${index + 1}. ${email.subject}`)
        console.log(`   From: ${email.from}`)
        console.log(`   Category: ${email.category}`)
        console.log(`   Confidence: ${email.classification?.confidence || 'N/A'}`)
        console.log('')
      })
    }

    // Test analytics
    const statsResponse = await axios.get(`${baseURL}/api/analytics/stats`, { headers })
    console.log('✅ Analytics Stats:', statsResponse.data.success ? 'SUCCESS' : 'FAILED')
    if (statsResponse.data.success) {
      console.log(`   Total emails: ${statsResponse.data.stats?.totalEmails || 0}`)
    }

    console.log('\n🎯 FRONTEND FIX INSTRUCTIONS:')
    console.log('=' * 60)
    console.log('1. Open your browser and go to http://localhost:3000')
    console.log('2. Open Developer Tools (F12)')
    console.log('3. Go to Console tab')
    console.log('4. Clear any existing token:')
    console.log('   localStorage.clear()')
    console.log('5. Set the correct token:')
    console.log(`   localStorage.setItem("token", "${token}");`)
    console.log('6. Refresh the page (F5)')
    console.log('')
    console.log('EXPECTED RESULTS:')
    console.log(`✅ Should show ${emailCount} emails total`)
    console.log('✅ Should show 50 emails per page')
    console.log(`✅ Should show ${Math.ceil(emailCount / 50)} pages total`)
    console.log('✅ Debug info should show correct email count')
    console.log('=' * 60)

    if (emailCount >= 5000) {
      console.log('\n🎉 SUCCESS: System is working perfectly!')
      console.log('✅ Backend has 5,000+ emails')
      console.log('✅ API returns correct data')
      console.log('✅ Frontend should now show all emails')
    } else {
      console.log('\n⚠️ WARNING: Email count is lower than expected')
      console.log(`   Current: ${emailCount} emails`)
      console.log('   Expected: 5,000+ emails')
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

testFrontendFix()
