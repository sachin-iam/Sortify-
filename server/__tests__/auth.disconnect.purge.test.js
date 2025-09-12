import request from 'supertest'
import app from '../src/server.js'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Email from '../src/models/Email.js'
import { createTestUserWithGmailTokens, seedTestEmails } from './helpers.js'

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

describe('auth disconnect purge', () => {
  it('disconnect purges gmail data', async () => {
    const { token, user } = await createTestUserWithGmailTokens()
    
    // Seed some test emails
    await seedTestEmails(user._id, 5)
    
    const beforeCount = await Email.countDocuments({ userId: user._id, provider: 'gmail' })
    expect(beforeCount).toBe(5)
    
    const res = await request(app)
      .post('/api/auth/gmail/disconnect')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    
    const afterCount = await Email.countDocuments({ userId: user._id, provider: 'gmail' })
    expect(afterCount).toBe(0)
  })
})
