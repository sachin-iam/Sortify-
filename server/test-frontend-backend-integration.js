import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'
import axios from 'axios'

dotenv.config()

const testFrontendBackendIntegration = async () => {
  try {
    console.log('🧪 FRONTEND-BACKEND INTEGRATION TEST\n')

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Find all users and their email counts
    const users = await User.find({})
    console.log('\n📊 ALL USERS IN DATABASE:')
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (ID: ${user._id})`)
    })

    // Check email counts for each user
    console.log('\n📧 EMAIL COUNTS BY USER:')
    for (const user of users) {
      const emailCount = await Email.countDocuments({ userId: user._id })
      console.log(`${user.email}: ${emailCount} emails`)
      
      if (emailCount > 0) {
        const sampleEmails = await Email.find({ userId: user._id }).limit(3).lean()
        console.log(`   Sample subjects:`)
        sampleEmails.forEach((email, index) => {
          console.log(`     ${index + 1}. ${email.subject}`)
        })
      }
    }

    // Find the user with the most emails (should be our test user)
    const userWithMostEmails = await User.aggregate([
      {
        $lookup: {
          from: 'emails',
          localField: '_id',
          foreignField: 'userId',
          as: 'emails'
        }
      },
      {
        $addFields: {
          emailCount: { $size: '$emails' }
        }
      },
      {
        $sort: { emailCount: -1 }
      },
      {
        $limit: 1
      }
    ])

    if (userWithMostEmails.length > 0) {
      const targetUser = userWithMostEmails[0]
      console.log(`\n🎯 TARGET USER (Most Emails):`)
      console.log(`   Email: ${targetUser.email}`)
      console.log(`   ID: ${targetUser._id}`)
      console.log(`   Email Count: ${targetUser.emailCount}`)
      console.log(`   Gmail Connected: ${targetUser.gmailConnected}`)

      // Generate correct JWT token
      const correctToken = jwt.sign({ id: targetUser._id }, process.env.JWT_SECRET)
      console.log(`\n🔑 CORRECT JWT TOKEN:`)
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
        console.log('Copy this command and run it in your browser console:')
        console.log(`localStorage.setItem("token", "${correctToken}");`)
        console.log('Then refresh the page (F5)')

      } catch (error) {
        console.log('❌ API Error:', error.response?.data?.message || error.message)
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

testFrontendBackendIntegration()
