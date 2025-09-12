import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'
import axios from 'axios'

dotenv.config()

const debugUserMismatch = async () => {
  try {
    console.log('🔍 DEBUGGING USER MISMATCH\n')

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Find all users
    const users = await User.find({})
    console.log(`📊 Total users in database: ${users.length}`)
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (ID: ${user._id})`)
    })

    // Check emails for each user
    for (const user of users) {
      const emailCount = await Email.countDocuments({ userId: user._id })
      console.log(`\n📧 User ${user.email}:`)
      console.log(`   ID: ${user._id}`)
      console.log(`   Emails: ${emailCount}`)
      
      if (emailCount > 0) {
        const sampleEmails = await Email.find({ userId: user._id }).limit(3).lean()
        console.log(`   Sample subjects:`)
        sampleEmails.forEach((email, index) => {
          console.log(`     ${index + 1}. ${email.subject}`)
        })
      }
    }

    // Test with the specific user from our tests
    const testUser = await User.findOne({ email: '2022003695.prateek@ug.sharda.ac.in' })
    if (testUser) {
      console.log(`\n🎯 Test User Details:`)
      console.log(`   Email: ${testUser.email}`)
      console.log(`   ID: ${testUser._id}`)
      console.log(`   Gmail Connected: ${testUser.gmailConnected}`)
      
      const testUserEmails = await Email.countDocuments({ userId: testUser._id })
      console.log(`   Email Count: ${testUserEmails}`)
      
      // Generate token and test API
      const token = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET)
      console.log(`\n🔑 Generated Token: ${token.substring(0, 50)}...`)
      
      // Test API call
      try {
        const response = await axios.get('http://localhost:5000/api/emails?page=1&limit=50', {
          headers: { Authorization: `Bearer ${token}` }
        })
        console.log(`\n📡 API Response:`)
        console.log(`   Success: ${response.data.success}`)
        console.log(`   Emails returned: ${response.data.emails?.length || 0}`)
        console.log(`   Total: ${response.data.pagination?.total || 0}`)
        console.log(`   User ID in response: ${response.data.userId || 'Not found'}`)
      } catch (error) {
        console.log(`\n❌ API Error: ${error.response?.data?.message || error.message}`)
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

debugUserMismatch()
