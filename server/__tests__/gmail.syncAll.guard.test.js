import request from 'supertest'
import app from '../src/server.js'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { createTestUserWithoutGmail } from './helpers.js'

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

describe('Gmail sync-all guard', () => {
  it('returns 400 when gmail not connected', async () => {
    const { token } = await createTestUserWithoutGmail()
    
    const res = await request(app)
      .post('/api/emails/gmail/sync-all')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Gmail not connected/i)
  })
})
