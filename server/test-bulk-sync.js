import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import { google } from 'googleapis'
import { classifyEmail } from './src/services/classificationService.js'

dotenv.config()

const testBulkSync = async () => {
  try {
    console.log('🧪 Testing Bulk Gmail Sync (100-200 emails)...\n')

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Find test user
    const user = await User.findOne({ email: '2022003695.prateek@ug.sharda.ac.in' })
    if (!user) {
      console.log('❌ Test user not found')
      return
    }

    if (!user.gmailConnected) {
      console.log('❌ Gmail not connected for test user')
      return
    }

    console.log('✅ Test user found and Gmail connected')

    // Initialize Gmail client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      access_token: user.gmailAccessToken,
      refresh_token: user.gmailRefreshToken
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Get emails in batches
    let totalSynced = 0
    let nextPageToken = null
    const batchSize = 50
    const maxEmails = 200

    console.log('📧 Starting bulk sync...')

    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: batchSize,
        pageToken: nextPageToken,
        q: 'in:inbox'
      })

      const messages = response.data.messages || []
      nextPageToken = response.data.nextPageToken
      
      console.log(`📧 Processing batch of ${messages.length} emails...`)

      for (const message of messages) {
        try {
          if (!message.id) {
            continue
          }

          // Get full message details
          const messageData = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full'
          })

          const headers = messageData.data.payload.headers
          const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value

          // Classify the email
          const subject = getHeader('Subject') || 'No Subject'
          const snippet = messageData.data.snippet || ''
          const body = messageData.data.payload.body?.data || ''
          
          const classification = classifyEmail(subject, snippet, body)

          const emailData = {
            userId: user._id,
            gmailId: message.id,
            messageId: message.id,
            threadId: messageData.data.threadId || null,
            subject,
            from: getHeader('From') || 'Unknown Sender',
            to: getHeader('To') || user.email,
            date: new Date(parseInt(messageData.data.internalDate)),
            snippet,
            body,
            isRead: !messageData.data.labelIds?.includes('UNREAD'),
            labels: messageData.data.labelIds || [],
            category: classification.label,
            classification: {
              label: classification.label,
              confidence: classification.confidence
            }
          }

          // Use upsert to avoid duplicate key errors
          await Email.findOneAndUpdate(
            { messageId: message.id, userId: user._id },
            emailData,
            { upsert: true, new: true }
          )

          totalSynced++
          
          if (totalSynced % 10 === 0) {
            console.log(`✅ Synced ${totalSynced} emails so far...`)
          }

        } catch (error) {
          console.error(`❌ Error syncing email ${message.id}:`, error.message)
          continue
        }
      }

      console.log(`📊 Batch completed. Total synced: ${totalSynced}`)

      // Stop if we've reached the maximum
      if (totalSynced >= maxEmails) {
        console.log(`🎯 Reached maximum limit of ${maxEmails} emails`)
        break
      }

    } while (nextPageToken && totalSynced < maxEmails)

    console.log(`\n🎉 Bulk sync completed! Total synced: ${totalSynced} emails`)

    // Show classification breakdown
    const emails = await Email.find({ userId: user._id })
    const classificationBreakdown = {}
    emails.forEach(email => {
      const category = email.category || 'Other'
      classificationBreakdown[category] = (classificationBreakdown[category] || 0) + 1
    })

    console.log('\n📊 Classification Breakdown:')
    Object.entries(classificationBreakdown).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} emails`)
    })

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Disconnected from MongoDB')
  }
}

testBulkSync()
