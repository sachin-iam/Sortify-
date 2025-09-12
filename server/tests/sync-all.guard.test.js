import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import app from '../src/server.js'
import User from '../src/models/User.js'
import jwt from 'jsonwebtoken'

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
})

describe('Sync All Guard Tests', () => {
  let user, token

  beforeEach(async () => {
    // Create test user
    user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword'
    })
    await user.save()

    // Generate JWT token
    token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret')
  })

  test('should return 400 for user without Gmail tokens', async () => {
    const response = await request(app)
      .post('/api/emails/gmail/sync-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)

    expect(response.body.success).toBe(false)
    expect(response.body.message).toContain('Gmail not connected')
  })

  test('should return 400 for user with gmailConnected false', async () => {
    user.gmailConnected = false
    await user.save()

    const response = await request(app)
      .post('/api/emails/gmail/sync-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)

    expect(response.body.success).toBe(false)
    expect(response.body.message).toContain('Gmail not connected')
  })

  test('should return 400 for user with missing access token', async () => {
    user.gmailConnected = true
    user.gmailRefreshToken = 'refresh-token'
    // Missing gmailAccessToken
    await user.save()

    const response = await request(app)
      .post('/api/emails/gmail/sync-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)

    expect(response.body.success).toBe(false)
    expect(response.body.message).toContain('Gmail not connected')
  })

  test('should return 401 for unauthenticated request', async () => {
    const response = await request(app)
      .post('/api/emails/gmail/sync-all')
      .expect(401)

    expect(response.body.success).toBe(false)
  })
})
