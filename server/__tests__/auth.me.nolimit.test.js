import app from '../src/server.js'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { createTestUser } from './helpers.js'

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
  // Clean up before each test
  await mongoose.connection.db.dropDatabase()
})

describe('auth /me no 429', () => {
  it('returns user repeatedly without 429', async () => {
    const { token } = await createTestUser()
    
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
      
      expect(res.status).toBe(200)
      expect(res.body?.user?.email).toBeDefined()
    }
  })
})
