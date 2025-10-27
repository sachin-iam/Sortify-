/**
 * Check if emails have Gmail IDs stored
 */

import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Email from './src/models/Email.js'

dotenv.config()

const checkGmailIds = async () => {
  try {
    console.log('🔍 Checking Gmail IDs in database...\n')
    
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to database\n')
    
    // Get total count
    const totalCount = await Email.countDocuments()
    console.log(`📊 Total emails in database: ${totalCount}\n`)
    
    // Count emails with gmailId
    const withGmailId = await Email.countDocuments({ gmailId: { $exists: true, $ne: null } })
    console.log(`✅ Emails WITH gmailId: ${withGmailId}`)
    console.log(`❌ Emails WITHOUT gmailId: ${totalCount - withGmailId}\n`)
    
    // Get a few sample emails
    console.log('📧 Sample emails:\n')
    const samples = await Email.find()
      .select('_id subject gmailId provider labels isArchived')
      .limit(5)
      .lean()
    
    samples.forEach((email, index) => {
      console.log(`${index + 1}. ${email.subject}`)
      console.log(`   ID: ${email._id}`)
      console.log(`   Gmail ID: ${email.gmailId || 'MISSING'}`)
      console.log(`   Provider: ${email.provider}`)
      console.log(`   Labels: ${email.labels?.join(', ') || 'none'}`)
      console.log(`   Archived: ${email.isArchived || false}`)
      console.log('')
    })
    
    // Check for archived emails
    const archivedCount = await Email.countDocuments({ isArchived: true })
    console.log(`📦 Archived emails in DB: ${archivedCount}`)
    
    if (archivedCount > 0) {
      console.log('\n📦 Sample archived emails:\n')
      const archivedSamples = await Email.find({ isArchived: true })
        .select('_id subject gmailId labels')
        .limit(3)
        .lean()
      
      archivedSamples.forEach((email, index) => {
        console.log(`${index + 1}. ${email.subject}`)
        console.log(`   Gmail ID: ${email.gmailId}`)
        console.log(`   Labels: ${email.labels?.join(', ')}`)
        console.log('')
      })
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
  } finally {
    await mongoose.connection.close()
    console.log('✅ Database connection closed')
  }
}

checkGmailIds()

