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

describe('Emails List Pagination', () => {
  let user, token

  beforeEach(async () => {
    // Create test user
    user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      gmailConnected: true
    })
    await user.save()

    // Generate JWT token
    const jwt = require('jsonwebtoken')
    token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret')

    // Seed ~5k emails
    const emails = []
    const categories = ['Academic', 'Promotions', 'Placement', 'Spam', 'Other']
    
    for (let i = 0; i < 5000; i++) {
      emails.push({
        userId: user._id,
        provider: 'gmail',
        gmailId: `gmail_${i}`,
        subject: `Test Email ${i}`,
        from: `sender${i % 100}@example.com`,
        to: 'test@example.com',
        snippet: `This is test email number ${i}`,
        body: `Full body content for email ${i}`,
        date: new Date(Date.now() - i * 1000 * 60), // Stagger dates
        category: categories[i % categories.length],
        classification: {
          label: categories[i % categories.length],
          confidence: 0.8
        },
        isRead: i % 3 === 0
      })
    }

    await Email.insertMany(emails)
  })

  test('should paginate emails correctly', async () => {
    const response = await request(app)
      .get('/api/emails')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 25 })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.items).toHaveLength(25)
    expect(response.body.total).toBe(5000)
    expect(response.body.page).toBe(1)
    expect(response.body.limit).toBe(25)
  })

  test('should handle different page sizes', async () => {
    const response = await request(app)
      .get('/api/emails')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 2, limit: 50 })

    expect(response.status).toBe(200)
    expect(response.body.items).toHaveLength(50)
    expect(response.body.page).toBe(2)
  })

  test('should filter by category', async () => {
    const response = await request(app)
      .get('/api/emails')
      .set('Authorization', `Bearer ${token}`)
      .query({ category: 'Academic' })

    expect(response.status).toBe(200)
    expect(response.body.items.every(email => email.category === 'Academic')).toBe(true)
    expect(response.body.total).toBe(1000) // 5000 / 5 categories
  })

  test('should search emails using text index', async () => {
    const response = await request(app)
      .get('/api/emails')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'Test Email 1' })

    expect(response.status).toBe(200)
    expect(response.body.items.length).toBeGreaterThan(0)
    expect(response.body.items.some(email => email.subject.includes('Test Email 1'))).toBe(true)
  })

  test('should return empty for non-existent category', async () => {
    const response = await request(app)
      .get('/api/emails')
      .set('Authorization', `Bearer ${token}`)
      .query({ category: 'NonExistent' })

    expect(response.status).toBe(200)
    expect(response.body.items).toHaveLength(0)
    expect(response.body.total).toBe(0)
  })

  test('should handle large page numbers gracefully', async () => {
    const response = await request(app)
      .get('/api/emails')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1000, limit: 25 })

    expect(response.status).toBe(200)
    expect(response.body.items).toHaveLength(0)
    expect(response.body.page).toBe(1000)
  })
})
