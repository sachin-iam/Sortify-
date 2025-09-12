import request from 'supertest'
import { app } from '../server.js'
import { connectDB, disconnectDB } from '../config/database.js'
import { User } from '../models/User.js'
import { Email } from '../models/Email.js'
import jwt from 'jsonwebtoken'

describe('Email Routes', () => {
  let authToken
  let testUser
  let testEmails

  beforeAll(async () => {
    await connectDB()
    
    // Create test user
    testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      gmailConnected: true
    })
    await testUser.save()

    // Create auth token
    authToken = jwt.sign(
      { userId: testUser._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    )

    // Create test emails
    testEmails = [
      {
        userId: testUser._id,
        provider: 'gmail',
        subject: 'Test Email 1',
        sender: 'sender1@example.com',
        body: 'Test body 1',
        category: 'Academic',
        date: new Date()
      },
      {
        userId: testUser._id,
        provider: 'gmail',
        subject: 'Test Email 2',
        sender: 'sender2@example.com',
        body: 'Test body 2',
        category: 'Promotions',
        date: new Date()
      }
    ]
    await Email.insertMany(testEmails)
  })

  afterAll(async () => {
    await User.deleteMany({})
    await Email.deleteMany({})
    await disconnectDB()
  })

  describe('GET /emails', () => {
    test('should get emails for authenticated user', async () => {
      const response = await request(app)
        .get('/api/emails')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.emails).toHaveLength(2)
      expect(response.body.pagination).toBeDefined()
    })

    test('should filter emails by category', async () => {
      const response = await request(app)
        .get('/api/emails?category=Academic')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.emails).toHaveLength(1)
      expect(response.body.emails[0].category).toBe('Academic')
    })

    test('should search emails by subject', async () => {
      const response = await request(app)
        .get('/api/emails?q=Test Email 1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.emails).toHaveLength(1)
      expect(response.body.emails[0].subject).toBe('Test Email 1')
    })

    test('should require authentication', async () => {
      await request(app)
        .get('/api/emails')
        .expect(401)
    })
  })

  describe('POST /emails/sync', () => {
    test('should sync emails for authenticated user', async () => {
      const response = await request(app)
        .post('/api/emails/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ provider: 'gmail' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('sync')
    })

    test('should require authentication', async () => {
      await request(app)
        .post('/api/emails/sync')
        .send({ provider: 'gmail' })
        .expect(401)
    })
  })

  describe('POST /emails/classify', () => {
    test('should classify emails', async () => {
      const response = await request(app)
        .post('/api/emails/classify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ emailIds: [testEmails[0]._id] })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.classified).toBeDefined()
    })

    test('should require authentication', async () => {
      await request(app)
        .post('/api/emails/classify')
        .send({ emailIds: ['test-id'] })
        .expect(401)
    })
  })
})
