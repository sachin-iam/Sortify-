import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import { fullSync } from './src/services/gmailSyncService.js'

dotenv.config()

const testGmailSyncService = async () => {
  try {
    console.log('🧪 TESTING GMAIL SYNC SERVICE\n')

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
    console.log('✅ Gmail connected:', user.gmailConnected)

    // Check current email count
    const beforeCount = await Email.countDocuments({ userId: user._id })
    console.log(`📧 Emails before sync: ${beforeCount}`)

    // Test the full sync service
    console.log('\n🚀 Starting full Gmail sync...')
    const result = await fullSync(user)
    
    console.log('\n📊 SYNC RESULTS:')
    console.log(`✅ Success: ${result.success}`)
    console.log(`📧 Total emails found: ${result.total}`)
    console.log(`📥 Emails synced: ${result.synced}`)
    console.log(`🤖 Emails classified: ${result.classified}`)
    console.log(`⏭️ Emails skipped: ${result.skipped}`)
    
    if (result.categoryBreakdown) {
      console.log('\n📊 Category Breakdown:')
      Object.entries(result.categoryBreakdown).forEach(([category, count]) => {
        console.log(`   ${category}: ${count} emails`)
      })
    }

    // Check final email count
    const afterCount = await Email.countDocuments({ userId: user._id })
    console.log(`\n📧 Emails after sync: ${afterCount}`)
    console.log(`📈 New emails added: ${afterCount - beforeCount}`)

    if (result.success) {
      console.log('\n🎉 Gmail sync service test PASSED!')
    } else {
      console.log('\n❌ Gmail sync service test FAILED!')
      console.log('Error:', result.error)
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

testGmailSyncService()
