import request from 'supertest'
import express from 'express'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import authRouter from '../routes/auth.js'
import User from '../models/User.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)

describe('Auth API', () => {
  let testUser

  beforeAll(async () => {
    // Clean up any existing test data
    await User.deleteMany({ email: { $in: ['test@example.com', 'test2@example.com'] } })
  })

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await User.deleteOne({ _id: testUser._id })
    }
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.token).toBeDefined()
      expect(response.body.user).toHaveProperty('id')
      expect(response.body.user.name).toBe(userData.name)
      expect(response.body.user.email).toBe(userData.email)
      expect(response.body.user.password).toBeUndefined()

      // Store user for cleanup
      testUser = await User.findById(response.body.user.id)
    })

    it('should not register user with existing email', async () => {
      const userData = {
        name: 'Another User',
        email: 'test@example.com', // Same email as above
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('already exists')
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User'
          // Missing email and password
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.errors).toBeDefined()
    })

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.errors).toBeDefined()
    })

    it('should validate password length', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test2@example.com',
          password: '123' // Too short
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.errors).toBeDefined()
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.token).toBeDefined()
      expect(response.body.user).toHaveProperty('id')
      expect(response.body.user.email).toBe('test@example.com')
    })

    it('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Invalid credentials')
    })

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Invalid credentials')
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
          // Missing password
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.errors).toBeDefined()
    })
  })

  describe('GET /api/auth/me', () => {
    let authToken

    beforeAll(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
      
      authToken = response.body.token
    })

    it('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.user).toHaveProperty('id')
      expect(response.body.user.email).toBe('test@example.com')
      expect(response.body.user.gmailConnected).toBe(false)
      expect(response.body.user.outlookConnected).toBe(false)
    })

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body.success).toBe(false)
    })

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/auth/logout', () => {
    let authToken

    beforeAll(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
      
      authToken = response.body.token
    })

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('logged out')
    })
  })

  describe('Gmail Connection', () => {
    let authToken

    beforeAll(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
      
      authToken = response.body.token
    })

    it('should get Gmail OAuth URL', async () => {
      const response = await request(app)
        .get('/api/auth/gmail/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.authUrl).toBeDefined()
      expect(response.body.authUrl).toContain('accounts.google.com')
    })

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/gmail/connect')
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('Microsoft Connection', () => {
    let authToken

    beforeAll(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
      
      authToken = response.body.token
    })

    it('should return not implemented for Microsoft connection', async () => {
      const response = await request(app)
        .post('/api/auth/microsoft/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(501)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('not yet implemented')
    })
  })
})