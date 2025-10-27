/**
 * Test script to verify Gmail archive functionality
 * Run with: node test-gmail-archive.js <emailId>
 */

import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { google } from 'googleapis'
import User from './src/models/User.js'
import Email from './src/models/Email.js'

dotenv.config()

const testGmailArchive = async (emailId) => {
  try {
    console.log('🔍 Testing Gmail archive functionality...')
    console.log('📧 Email ID:', emailId)
    
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to database')
    
    // Find the email
    const email = await Email.findById(emailId).populate('userId')
    if (!email) {
      console.error('❌ Email not found')
      process.exit(1)
    }
    
    console.log('📧 Email found:', {
      subject: email.subject,
      gmailId: email.gmailId,
      currentLabels: email.labels,
      isArchived: email.isArchived
    })
    
    // Get user
    const user = await User.findById(email.userId)
    if (!user) {
      console.error('❌ User not found')
      process.exit(1)
    }
    
    console.log('👤 User found:', {
      email: user.email,
      gmailConnected: user.gmailConnected,
      hasAccessToken: !!user.gmailAccessToken,
      hasRefreshToken: !!user.gmailRefreshToken
    })
    
    if (!user.gmailConnected || !user.gmailAccessToken) {
      console.error('❌ Gmail not connected or no access token')
      process.exit(1)
    }
    
    if (!email.gmailId) {
      console.error('❌ Email has no Gmail ID')
      process.exit(1)
    }
    
    // Set up OAuth2
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    
    oauth2Client.setCredentials({
      access_token: user.gmailAccessToken,
      refresh_token: user.gmailRefreshToken,
      expiry_date: user.gmailTokenExpiry?.getTime()
    })
    
    // Set up refresh handler
    oauth2Client.on('tokens', (tokens) => {
      console.log('🔄 Token refreshed:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token
      })
    })
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    
    // First, get the current state of the email in Gmail
    console.log('\n📥 Fetching current email state from Gmail...')
    const currentEmail = await gmail.users.messages.get({
      userId: 'me',
      id: email.gmailId,
      format: 'minimal'
    })
    
    console.log('📧 Current Gmail state:', {
      id: currentEmail.data.id,
      labelIds: currentEmail.data.labelIds,
      hasInbox: currentEmail.data.labelIds?.includes('INBOX')
    })
    
    // Try to archive by removing INBOX label
    console.log('\n📤 Attempting to remove INBOX label...')
    const modifyResponse = await gmail.users.messages.modify({
      userId: 'me',
      id: email.gmailId,
      requestBody: {
        removeLabelIds: ['INBOX']
      }
    })
    
    console.log('✅ Gmail API modify response:', {
      id: modifyResponse.data.id,
      labelIds: modifyResponse.data.labelIds,
      hasInbox: modifyResponse.data.labelIds?.includes('INBOX'),
      removedInbox: !modifyResponse.data.labelIds?.includes('INBOX')
    })
    
    // Wait a second and check again
    console.log('\n⏳ Waiting 2 seconds...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('📥 Fetching email state again from Gmail...')
    const updatedEmail = await gmail.users.messages.get({
      userId: 'me',
      id: email.gmailId,
      format: 'minimal'
    })
    
    console.log('📧 Updated Gmail state:', {
      id: updatedEmail.data.id,
      labelIds: updatedEmail.data.labelIds,
      hasInbox: updatedEmail.data.labelIds?.includes('INBOX'),
      archived: !updatedEmail.data.labelIds?.includes('INBOX')
    })
    
    if (!updatedEmail.data.labelIds?.includes('INBOX')) {
      console.log('\n✅ SUCCESS! Email has been archived in Gmail')
    } else {
      console.log('\n❌ FAILED! Email still has INBOX label')
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    if (error.code) console.error('   Code:', error.code)
    if (error.errors) console.error('   Errors:', error.errors)
    if (error.response) {
      console.error('   Response:', error.response.data)
    }
  } finally {
    await mongoose.connection.close()
    console.log('\n✅ Database connection closed')
  }
}

// Get email ID from command line
const emailId = process.argv[2]
if (!emailId) {
  console.error('❌ Please provide an email ID')
  console.error('Usage: node test-gmail-archive.js <emailId>')
  process.exit(1)
}

testGmailArchive(emailId)

