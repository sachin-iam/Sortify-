// Comprehensive Gmail Sync Test - Ensures all emails are synced
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import app from './src/server.js'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'
import nock from 'nock'

let mongoServer

const setup = async () => {
  mongoServer = await MongoMemoryServer.create()
  const mongoUri = mongoServer.getUri()
  await mongoose.connect(mongoUri)
}

const teardown = async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
}

const createTestUserWithGmail = async () => {
  const user = new User({
    name: 'Test User',
    email: 'test@gmail.com',
    password: 'hashedpassword',
    gmailConnected: true,
    gmailAccessToken: 'test-access-token',
    gmailRefreshToken: 'test-refresh-token',
    gmailTokenExpiry: new Date(Date.now() + 3600000)
  })
  await user.save()
  return user
}

const mockGmailAPI = (messageCount = 5000) => {
  // Create mock messages
  const messages = []
  for (let i = 1; i <= messageCount; i++) {
    messages.push({ id: `msg_${i}` })
  }

  // Mock Gmail list API with pagination
  const pageSize = 500
  const totalPages = Math.ceil(messageCount / pageSize)
  
  for (let page = 0; page < totalPages; page++) {
    const startIdx = page * pageSize
    const endIdx = Math.min(startIdx + pageSize, messageCount)
    const pageMessages = messages.slice(startIdx, endIdx)
    
    const query = page === 0 
      ? { maxResults: pageSize, q: 'in:inbox' }
      : { maxResults: pageSize, q: 'in:inbox', pageToken: `page_${page}` }
    
    const response = {
      messages: pageMessages,
      nextPageToken: page < totalPages - 1 ? `page_${page + 1}` : undefined
    }
    
    nock('https://gmail.googleapis.com')
      .get('/gmail/v1/users/me/messages')
      .query(query)
      .reply(200, response)
  }

  // Mock individual message fetch
  for (let i = 1; i <= messageCount; i++) {
    const message = {
      id: `msg_${i}`,
      threadId: `thread_${i}`,
      snippet: `This is email snippet ${i}`,
      payload: {
        headers: [
          { name: 'Subject', value: `Test Email ${i}` },
          { name: 'From', value: `sender${i}@example.com` },
          { name: 'To', value: 'test@gmail.com' },
          { name: 'Date', value: new Date(Date.now() - i * 60000).toISOString() }
        ],
        body: {
          data: Buffer.from(`<p>HTML body for email ${i}</p>`).toString('base64')
        },
        parts: [
          {
            mimeType: 'text/html',
            body: {
              data: Buffer.from(`<p>HTML body for email ${i}</p>`).toString('base64')
            }
          },
          {
            mimeType: 'text/plain',
            body: {
              data: Buffer.from(`Text body for email ${i}`).toString('base64')
            }
          }
        ]
      },
      labelIds: ['INBOX']
    }
    
    nock('https://gmail.googleapis.com')
      .get(`/gmail/v1/users/me/messages/msg_${i}`)
      .reply(200, message)
  }

  // Mock ML categorization
  const categories = ['Academic', 'Promotions', 'Placement', 'Spam', 'Other']
  for (let i = 1; i <= messageCount; i++) {
    const category = categories[i % categories.length]
    nock(process.env.MODEL_SERVICE_URL || 'http://localhost:8000')
      .post('/categorize')
      .reply(200, { 
        label: category, 
        confidence: 0.7 + (Math.random() * 0.3) 
      })
  }
}

const runGmailSyncTest = async () => {
  try {
    await setup()
    console.log('✅ Database setup complete')

    // Test 1: Create user with Gmail tokens
    console.log('\n🧪 Test 1: Create user with Gmail tokens...')
    const user = await createTestUserWithGmail()
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret')
    console.log('✅ User created with Gmail tokens')

    // Test 2: Mock Gmail API for 5000 emails
    console.log('\n🧪 Test 2: Mock Gmail API for 5000 emails...')
    mockGmailAPI(5000)
    console.log('✅ Gmail API mocked for 5000 emails')

    // Test 3: Test Gmail sync endpoint
    console.log('\n🧪 Test 3: Test Gmail sync endpoint...')
    const syncRes = await request(app)
      .post('/api/emails/gmail/sync-all')
      .set('Authorization', `Bearer ${token}`)

    if (syncRes.status !== 200) {
      throw new Error(`Sync failed with status ${syncRes.status}: ${syncRes.body.message}`)
    }
    
    console.log('✅ Gmail sync endpoint works')
    console.log(`📊 Sync result: ${JSON.stringify(syncRes.body, null, 2)}`)

    // Test 4: Verify all emails were synced
    console.log('\n🧪 Test 4: Verify all emails were synced...')
    const emailCount = await Email.countDocuments({ 
      userId: user._id, 
      provider: 'gmail' 
    })
    
    if (emailCount !== 5000) {
      throw new Error(`Expected 5000 emails, got ${emailCount}`)
    }
    console.log(`✅ All 5000 emails synced successfully`)

    // Test 5: Verify email data integrity
    console.log('\n🧪 Test 5: Verify email data integrity...')
    const sampleEmails = await Email.find({ 
      userId: user._id, 
      provider: 'gmail' 
    }).limit(10)
    
    for (const email of sampleEmails) {
      if (!email.subject || !email.from || !email.to || !email.date) {
        throw new Error(`Email missing required fields: ${email._id}`)
      }
      if (!email.category || !email.classification) {
        throw new Error(`Email missing classification: ${email._id}`)
      }
    }
    console.log('✅ Email data integrity verified')

    // Test 6: Test pagination
    console.log('\n🧪 Test 6: Test email list pagination...')
    const page1Res = await request(app)
      .get('/api/emails?page=1&limit=100')
      .set('Authorization', `Bearer ${token}`)
    
    if (page1Res.status !== 200) {
      throw new Error(`Page 1 failed: ${page1Res.status}`)
    }
    
    if (page1Res.body.items.length !== 100) {
      throw new Error(`Expected 100 items on page 1, got ${page1Res.body.items.length}`)
    }
    
    if (page1Res.body.total !== 5000) {
      throw new Error(`Expected total 5000, got ${page1Res.body.total}`)
    }
    console.log('✅ Email pagination works correctly')

    // Test 7: Test category filtering
    console.log('\n🧪 Test 7: Test category filtering...')
    const academicRes = await request(app)
      .get('/api/emails?category=Academic')
      .set('Authorization', `Bearer ${token}`)
    
    if (academicRes.status !== 200) {
      throw new Error(`Category filter failed: ${academicRes.status}`)
    }
    
    const academicCount = academicRes.body.items.length
    console.log(`✅ Found ${academicCount} Academic emails`)

    // Test 8: Test search functionality
    console.log('\n🧪 Test 8: Test search functionality...')
    const searchRes = await request(app)
      .get('/api/emails?q=Test Email')
      .set('Authorization', `Bearer ${token}`)
    
    if (searchRes.status !== 200) {
      throw new Error(`Search failed: ${searchRes.status}`)
    }
    
    console.log(`✅ Search found ${searchRes.body.items.length} emails`)

    // Test 9: Test individual email fetch
    console.log('\n🧪 Test 9: Test individual email fetch...')
    const firstEmail = sampleEmails[0]
    const emailRes = await request(app)
      .get(`/api/emails/${firstEmail._id}`)
      .set('Authorization', `Bearer ${token}`)
    
    if (emailRes.status !== 200) {
      throw new Error(`Email fetch failed: ${emailRes.status}`)
    }
    
    if (!emailRes.body.html || !emailRes.body.text) {
      throw new Error('Email missing HTML/text content')
    }
    console.log('✅ Individual email fetch works')

    // Test 10: Test disconnect and purge
    console.log('\n🧪 Test 10: Test disconnect and purge...')
    const disconnectRes = await request(app)
      .post('/api/auth/gmail/disconnect')
      .set('Authorization', `Bearer ${token}`)
    
    if (disconnectRes.status !== 200) {
      throw new Error(`Disconnect failed: ${disconnectRes.status}`)
    }
    
    const remainingCount = await Email.countDocuments({ 
      userId: user._id, 
      provider: 'gmail' 
    })
    
    if (remainingCount !== 0) {
      throw new Error(`Expected 0 emails after disconnect, got ${remainingCount}`)
    }
    console.log('✅ Disconnect and purge works correctly')

    console.log('\n🎉 All Gmail sync tests passed!')
    console.log('\n📋 Test Summary:')
    console.log('✅ User creation with Gmail tokens')
    console.log('✅ Gmail API mocking for 5000 emails')
    console.log('✅ Gmail sync endpoint functionality')
    console.log('✅ All 5000 emails synced successfully')
    console.log('✅ Email data integrity verified')
    console.log('✅ Email pagination works correctly')
    console.log('✅ Category filtering works')
    console.log('✅ Search functionality works')
    console.log('✅ Individual email fetch works')
    console.log('✅ Disconnect and purge works correctly')
    
    console.log('\n🚀 Gmail sync system is fully functional!')
    
  } catch (error) {
    console.error('❌ Gmail sync test failed:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  } finally {
    await teardown()
  }
}

runGmailSyncTest()
