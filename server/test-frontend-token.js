import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import jwt from 'jsonwebtoken'
import axios from 'axios'

dotenv.config()

const testFrontendToken = async () => {
  try {
    console.log('🔑 TESTING FRONTEND TOKEN\n')

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
    console.log('✅ User ID:', user._id)

    // Generate fresh JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    console.log('✅ Fresh JWT token generated')
    console.log('🔑 Token (first 50 chars):', token.substring(0, 50) + '...')

    const baseURL = 'http://localhost:5000'
    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    // Test the exact API call the frontend makes
    console.log('\n📡 Testing frontend API call...')
    const response = await axios.get(`${baseURL}/api/emails?page=1&limit=50`, { headers })
    
    console.log('✅ Response status:', response.status)
    console.log('✅ Success:', response.data.success)
    console.log('✅ Emails returned:', response.data.emails?.length || 0)
    console.log('✅ Total emails:', response.data.pagination?.total || 0)
    console.log('✅ Current page:', response.data.pagination?.currentPage || 0)
    console.log('✅ Total pages:', response.data.pagination?.totalPages || 0)

    if (response.data.emails?.length > 0) {
      console.log('\n📧 First 3 emails:')
      response.data.emails.slice(0, 3).forEach((email, index) => {
        console.log(`   ${index + 1}. ${email.subject}`)
        console.log(`      From: ${email.from}`)
        console.log(`      Category: ${email.category}`)
        console.log(`      Date: ${email.date}`)
        console.log('')
      })
    }

    // Generate a token that the frontend can use
    console.log('\n🔑 FRONTEND TOKEN:')
    console.log('Copy this token and use it in the frontend localStorage:')
    console.log(token)

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

testFrontendToken()
