import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'

dotenv.config()

const testEmailsAPI = async () => {
  try {
    console.log('🧪 Testing Emails API...\n')

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

    // Check total emails in database
    const totalEmails = await Email.countDocuments({ userId: user._id })
    console.log(`📧 Total emails in database: ${totalEmails}`)

    // Get emails with pagination
    const page = 1
    const limit = 50
    const skip = (page - 1) * limit

    const emails = await Email.find({ userId: user._id })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    console.log(`📧 Emails returned for page ${page} (limit ${limit}): ${emails.length}`)

    // Show first few emails
    console.log('\n📋 First 5 emails:')
    emails.slice(0, 5).forEach((email, index) => {
      console.log(`${index + 1}. ${email.subject} - ${email.category} (${email.classification?.confidence || 'N/A'})`)
    })

    // Check classification breakdown
    const classificationBreakdown = {}
    emails.forEach(email => {
      const category = email.category || 'Other'
      classificationBreakdown[category] = (classificationBreakdown[category] || 0) + 1
    })

    console.log('\n📊 Classification Breakdown:')
    Object.entries(classificationBreakdown).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} emails`)
    })

    // Test pagination
    const totalPages = Math.ceil(totalEmails / limit)
    console.log(`\n📄 Pagination: Page ${page} of ${totalPages} (${totalEmails} total emails)`)

    // Generate JWT token for API testing
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'your-secret-key')
    console.log(`\n🔑 JWT Token: ${token.substring(0, 50)}...`)

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Disconnected from MongoDB')
  }
}

testEmailsAPI()
