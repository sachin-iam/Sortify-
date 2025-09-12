import nock from 'nock'
import request from 'supertest'
import app from '../src/server.js'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Email from '../src/models/Email.js'
import { createTestUserWithGmailTokens } from './helpers.js'

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
  nock.cleanAll()
  await mongoose.connection.db.dropDatabase()
})

describe('Gmail sync-all happy path', () => {
  it('paginates, saves, classifies', async () => {
    const { token, user } = await createTestUserWithGmailTokens()
    
    // Mock Gmail list (2 pages)
    nock('https://gmail.googleapis.com')
      .persist()
      .get(/users\/me\/messages/)
      .query(q => q.maxResults === 500 && !q.pageToken)
      .reply(200, {
        messages: [{ id: 'm1' }, { id: 'm2' }],
        nextPageToken: 'p2'
      })
      .get(/users\/me\/messages/)
      .query(q => q.pageToken === 'p2')
      .reply(200, {
        messages: [{ id: 'm3' }]
      })

    // Mock each message get
    nock('https://gmail.googleapis.com')
      .persist()
      .get(/users\/me\/messages\/m1/)
      .reply(200, {
        id: 'm1',
        threadId: 'thread-1',
        snippet: 'Test message 1',
        payload: {
          headers: [
            { name: 'Subject', value: 'Subject 1' },
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
            { name: 'Date', value: new Date().toISOString() }
          ],
          body: {
            data: Buffer.from('<p>HTML body 1</p>').toString('base64')
          }
        },
        labelIds: ['INBOX']
      })
      .get(/users\/me\/messages\/m2/)
      .reply(200, {
        id: 'm2',
        threadId: 'thread-2',
        snippet: 'Test message 2',
        payload: {
          headers: [
            { name: 'Subject', value: 'Subject 2' },
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
            { name: 'Date', value: new Date().toISOString() }
          ],
          body: {
            data: Buffer.from('<p>HTML body 2</p>').toString('base64')
          }
        },
        labelIds: ['INBOX']
      })
      .get(/users\/me\/messages\/m3/)
      .reply(200, {
        id: 'm3',
        threadId: 'thread-3',
        snippet: 'Test message 3',
        payload: {
          headers: [
            { name: 'Subject', value: 'Subject 3' },
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
            { name: 'Date', value: new Date().toISOString() }
          ],
          body: {
            data: Buffer.from('<p>HTML body 3</p>').toString('base64')
          }
        },
        labelIds: ['INBOX']
      })

    // Mock ML categorize
    nock(process.env.MODEL_SERVICE_URL || 'http://localhost:8000')
      .post('/categorize')
      .times(3)
      .reply(200, { label: 'Academic', confidence: 0.87 })

    const res = await request(app)
      .post('/api/emails/gmail/sync-all')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.synced).toBe(3)
    expect(res.body.classified).toBe(3)

    const count = await Email.countDocuments({ userId: user._id, provider: 'gmail' })
    expect(count).toBe(3)

    const one = await Email.findOne({ gmailId: 'm1' })
    expect(one.category).toBe('Academic')
    expect(one.classification?.confidence).toBeDefined()
  })
})
