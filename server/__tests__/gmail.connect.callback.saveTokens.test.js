import app from '../src/server.js'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import User from '../src/models/User.js'

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn(),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expiry_date: Date.now() + 3600000
          }
        }),
        setCredentials: jest.fn()
      }))
    },
    oauth2: jest.fn().mockReturnValue({
      userinfo: {
        get: jest.fn().mockResolvedValue({
          data: {
            email: 'test@gmail.com',
            name: 'Test User'
          }
        })
      }
    })
  }
}))

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
  await mongoose.connection.db.dropDatabase()
})

describe('Gmail connect callback saves tokens', () => {
  it('saves tokens and sets gmailConnected to true', async () => {
    // Create a test user first
    const user = new User({
      name: 'Test User',
      email: 'test@gmail.com',
      password: 'hashedpassword'
    })
    await user.save()

    // Simulate OAuth callback
    const res = await request(app)
      .get('/api/auth/gmail/callback')
      .query({
        code: 'test-code',
        state: 'gmail_connect'
      })

    expect(res.status).toBe(302) // Redirect

    // Check user was updated
    const updatedUser = await User.findById(user._id)
    expect(updatedUser.gmailConnected).toBe(true)
    expect(updatedUser.gmailAccessToken).toBe('test-access-token')
    expect(updatedUser.gmailRefreshToken).toBe('test-refresh-token')
    expect(updatedUser.gmailTokenExpiry).toBeDefined()
  })
})
