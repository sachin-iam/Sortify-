import request from 'supertest'
import app from '../src/server.js'
import { connectDB, disconnectDB } from '../src/config/database.js'
import User from '../src/models/User.js'
import jwt from 'jsonwebtoken'

describe('Email Retrieval Tests', () => {
  let authToken
  let testUser

  beforeAll(async () => {
    await connectDB()
    
    // Create a test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      gmailConnected: true,
      gmailTokens: {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000
      }
    })

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    )
  })

  afterAll(async () => {
    await User.deleteMany({ email: 'test@example.com' })
    await disconnectDB()
  })

  describe('GET /api/emails', () => {
    test('Should return 401 if no token provided', async () => {
      const response = await request(app)
        .get('/api/emails')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Not authorized, no token')
    })

    test('Should return 401 if invalid token provided', async () => {
      const response = await request(app)
        .get('/api/emails')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Not authorized, token failed')
    })

    test('Should return 200 with empty emails if no emails found', async () => {
      const response = await request(app)
        .get('/api/emails')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.emails).toEqual([])
      expect(response.body.pagination).toBeDefined()
    })

    test('Should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/emails?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(10)
    })

    test('Should handle provider filter', async () => {
      const response = await request(app)
        .get('/api/emails?provider=gmail')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    test('Should handle label filter', async () => {
      const response = await request(app)
        .get('/api/emails?label=inbox')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    test('Should handle search query', async () => {
      const response = await request(app)
        .get('/api/emails?q=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('GET /api/emails/labels', () => {
    test('Should return 401 if no token provided', async () => {
      const response = await request(app)
        .get('/api/emails/labels')
        .expect(401)

      expect(response.body.success).toBe(false)
    })

    test('Should return 200 with labels', async () => {
      const response = await request(app)
        .get('/api/emails/labels')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.labels).toBeDefined()
    })
  })

  describe('Email Connection Status', () => {
    test('Should return user connection status', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.user.gmailConnected).toBe(true)
    })
  })
})
