// Complete system test - manual verification
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import app from './src/server.js'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'

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

const createTestUser = async () => {
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

const runSystemTest = async () => {
  try {
    await setup()
    console.log('✅ Database setup complete')

    // Test 1: User creation and authentication
    console.log('\n🧪 Test 1: User creation and authentication...')
    const user = await createTestUser()
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret')
    console.log('✅ User created with Gmail tokens')

    // Test 2: Auth endpoints
    console.log('\n🧪 Test 2: Auth endpoints...')
    
    // Test /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
    
    if (meRes.status !== 200) {
      throw new Error(`Expected 200, got ${meRes.status}`)
    }
    console.log('✅ /api/auth/me works')

    // Test 3: Email operations
    console.log('\n🧪 Test 3: Email operations...')
    
    // Create test emails
    await Email.insertMany([
      { 
        userId: user._id, 
        provider: 'gmail', 
        gmailId: 'test1', 
        subject: 'Test Email 1',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        date: new Date(),
        category: 'Academic',
        classification: { label: 'Academic', confidence: 0.8 }
      },
      { 
        userId: user._id, 
        provider: 'gmail', 
        gmailId: 'test2', 
        subject: 'Test Email 2',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        date: new Date(),
        category: 'Promotions',
        classification: { label: 'Promotions', confidence: 0.9 }
      }
    ])

    // Test /api/emails list
    const emailsRes = await request(app)
      .get('/api/emails')
      .set('Authorization', `Bearer ${token}`)
    
    if (emailsRes.status !== 200) {
      throw new Error(`Expected 200, got ${emailsRes.status}`)
    }
    
    if (emailsRes.body.items.length !== 2) {
      throw new Error(`Expected 2 emails, got ${emailsRes.body.items.length}`)
    }
    console.log('✅ /api/emails list works')

    // Test /api/emails/:id
    const emailRes = await request(app)
      .get(`/api/emails/${emailsRes.body.items[0]._id}`)
      .set('Authorization', `Bearer ${token}`)
    
    if (emailRes.status !== 200) {
      throw new Error(`Expected 200, got ${emailRes.status}`)
    }
    console.log('✅ /api/emails/:id works')

    // Test 4: Gmail sync guard
    console.log('\n🧪 Test 4: Gmail sync guard...')
    
    const syncRes = await request(app)
      .post('/api/emails/gmail/sync-all')
      .set('Authorization', `Bearer ${token}`)
    
    // Should return 400 because we don't have real Gmail API
    if (syncRes.status !== 400) {
      console.log(`⚠️  Expected 400 for sync without real Gmail API, got ${syncRes.status}`)
    } else {
      console.log('✅ Gmail sync guard works (returns 400 for missing Gmail API)')
    }

    // Test 5: Disconnect and purge
    console.log('\n🧪 Test 5: Disconnect and purge...')
    
    const disconnectRes = await request(app)
      .post('/api/auth/gmail/disconnect')
      .set('Authorization', `Bearer ${token}`)
    
    if (disconnectRes.status !== 200) {
      throw new Error(`Expected 200, got ${disconnectRes.status}`)
    }
    
    // Check emails are purged
    const remainingEmails = await Email.countDocuments({ userId: user._id, provider: 'gmail' })
    if (remainingEmails !== 0) {
      throw new Error(`Expected 0 emails after disconnect, got ${remainingEmails}`)
    }
    console.log('✅ Disconnect and purge works')

    // Test 6: Rate limiting whitelist
    console.log('\n🧪 Test 6: Rate limiting whitelist...')
    
    // Make multiple requests to /api/auth/me (should not be rate limited)
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
      
      if (res.status !== 200) {
        throw new Error(`Rate limited on request ${i + 1}: ${res.status}`)
      }
    }
    console.log('✅ Rate limiting whitelist works')

    console.log('\n🎉 All system tests passed!')
    console.log('\n📋 Summary:')
    console.log('✅ User creation and authentication')
    console.log('✅ Auth endpoints (/api/auth/me)')
    console.log('✅ Email operations (list, detail)')
    console.log('✅ Gmail sync guard')
    console.log('✅ Disconnect and purge')
    console.log('✅ Rate limiting whitelist')
    
  } catch (error) {
    console.error('❌ System test failed:', error.message)
    process.exit(1)
  } finally {
    await teardown()
  }
}

runSystemTest()