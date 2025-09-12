import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import app from '../src/server.js'
import User from '../src/models/User.js'
import Email from '../src/models/Email.js'

let mongoServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  const mongoUri = mongoServer.getUri()
  await mongoose.connect(mongoUri)
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  await User.deleteMany({})
  await Email.deleteMany({})
})

describe('Gmail Disconnect and Purge', () => {
  let user, token

  beforeEach(async () => {
    // Create test user with Gmail connected
    user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      gmailConnected: true,
      gmailAccessToken: 'mock-access-token',
      gmailRefreshToken: 'mock-refresh-token',
      gmailTokenExpiry: new Date(Date.now() + 3600000),
      gmailWatchActive: true,
      gmailWatchExpiration: new Date(Date.now() + 3600000),
      gmailHistoryId: '12345'
    })
    await user.save()

    // Generate JWT token
    const jwt = require('jsonwebtoken')
    token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret')

    // Create test Gmail emails
    const emails = []
    for (let i = 0; i < 100; i++) {
      emails.push({
        userId: user._id,
        provider: 'gmail',
        gmailId: `gmail_${i}`,
        subject: `Gmail Email ${i}`,
        from: `sender${i}@gmail.com`,
        to: 'test@example.com',
        snippet: `Gmail snippet ${i}`,
        body: `Gmail body ${i}`,
        date: new Date(),
        category: 'Academic'
      })
    }
    await Email.insertMany(emails)

    // Create some Outlook emails (should not be purged)
    const outlookEmails = []
    for (let i = 0; i < 10; i++) {
      outlookEmails.push({
        userId: user._id,
        provider: 'outlook',
        subject: `Outlook Email ${i}`,
        from: `sender${i}@outlook.com`,
        to: 'test@example.com',
        snippet: `Outlook snippet ${i}`,
        body: `Outlook body ${i}`,
        date: new Date(),
        category: 'Other'
      })
    }
    await Email.insertMany(outlookEmails)
  })

  test('should disconnect Gmail and purge Gmail emails only', async () => {
    const response = await request(app)
      .post('/api/auth/gmail/disconnect')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.message).toBe('Disconnected and purged Gmail data')
    expect(response.body.deletedEmails).toBe(100)

    // Check user Gmail fields are cleared
    const updatedUser = await User.findById(user._id)
    expect(updatedUser.gmailConnected).toBe(false)
    expect(updatedUser.gmailAccessToken).toBeNull()
    expect(updatedUser.gmailRefreshToken).toBeNull()
    expect(updatedUser.gmailTokenExpiry).toBeNull()
    expect(updatedUser.gmailWatchActive).toBe(false)
    expect(updatedUser.gmailWatchExpiration).toBeNull()
    expect(updatedUser.gmailHistoryId).toBeNull()

    // Check Gmail emails are deleted
    const gmailEmails = await Email.find({ userId: user._id, provider: 'gmail' })
    expect(gmailEmails).toHaveLength(0)

    // Check Outlook emails are preserved
    const outlookEmails = await Email.find({ userId: user._id, provider: 'outlook' })
    expect(outlookEmails).toHaveLength(10)
  })

  test('should handle user with no Gmail emails', async () => {
    // Remove all Gmail emails
    await Email.deleteMany({ userId: user._id, provider: 'gmail' })

    const response = await request(app)
      .post('/api/auth/gmail/disconnect')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.deletedEmails).toBe(0)
  })

  test('should handle user with no Gmail connection', async () => {
    // Disconnect Gmail first
    user.gmailConnected = false
    await user.save()

    const response = await request(app)
      .post('/api/auth/gmail/disconnect')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.deletedEmails).toBe(100) // Still purges existing Gmail emails
  })

  test('should return 401 for unauthenticated request', async () => {
    const response = await request(app)
      .post('/api/auth/gmail/disconnect')

    expect(response.status).toBe(401)
  })

  test('should handle database errors gracefully', async () => {
    // Mock database error
    jest.spyOn(User, 'findById').mockRejectedValue(new Error('Database error'))

    const response = await request(app)
      .post('/api/auth/gmail/disconnect')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(500)
    expect(response.body.success).toBe(false)
    expect(response.body.message).toBe('Failed to disconnect Gmail account')
  })
})
