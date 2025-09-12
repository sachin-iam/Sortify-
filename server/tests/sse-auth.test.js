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

describe('SSE Authentication', () => {
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

  test('should authenticate SSE with valid token in query', async () => {
    const response = await request(app)
      .get(`/api/analytics/realtime?token=${token}`)
      .expect(200)

    expect(response.headers['content-type']).toContain('text/event-stream')
  })

  test('should authenticate SSE with valid token in Authorization header', async () => {
    const response = await request(app)
      .get('/api/analytics/realtime')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.headers['content-type']).toContain('text/event-stream')
  })

  test('should return 401 for missing token', async () => {
    const response = await request(app)
      .get('/api/analytics/realtime')
      .expect(401)

    expect(response.body.success).toBe(false)
    expect(response.body.message).toBe('Missing token')
  })

  test('should return 401 for invalid token', async () => {
    const response = await request(app)
      .get('/api/analytics/realtime?token=invalid-token')
      .expect(401)

    expect(response.body.success).toBe(false)
    expect(response.body.message).toBe('Unauthorized')
  })

  test('should return 401 for non-existent user', async () => {
    const fakeToken = jwt.sign({ id: new mongoose.Types.ObjectId() }, process.env.JWT_SECRET || 'test-secret')
    
    const response = await request(app)
      .get(`/api/analytics/realtime?token=${fakeToken}`)
      .expect(401)

    expect(response.body.success).toBe(false)
    expect(response.body.message).toBe('Invalid user')
  })
})
