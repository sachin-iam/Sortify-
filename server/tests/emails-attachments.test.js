import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import app from '../src/server.js'
import User from '../src/models/User.js'
import Email from '../src/models/Email.js'

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
  await Email.deleteMany({})
})

describe('Email Attachments', () => {
  let user, token, email

  beforeEach(async () => {
    // Create test user
    user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      gmailConnected: true,
      gmailAccessToken: 'mock-access-token',
      gmailRefreshToken: 'mock-refresh-token'
    })
    await user.save()

    // Generate JWT token
    const jwt = require('jsonwebtoken')
    token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret')

    // Create test email with attachments
    email = new Email({
      userId: user._id,
      provider: 'gmail',
      gmailId: 'test-gmail-id',
      subject: 'Test Email with Attachments',
      from: 'sender@example.com',
      to: 'test@example.com',
      snippet: 'Test email with attachments',
      body: 'Test body',
      date: new Date(),
      attachments: [
        {
          attachmentId: 'att1',
          filename: 'document.pdf',
          mimeType: 'application/pdf',
          size: 1024
        },
        {
          attachmentId: 'att2',
          filename: 'image.jpg',
          mimeType: 'image/jpeg',
          size: 2048
        }
      ]
    })
    await email.save()
  })

  test('should return email with attachments', async () => {
    const response = await request(app)
      .get(`/api/emails/${email._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.email.attachments).toHaveLength(2)
    expect(response.body.email.attachments[0].filename).toBe('document.pdf')
  })

  test('should download attachment', async () => {
    // Mock Gmail API response
    const mockAttachmentData = Buffer.from('Mock PDF content')
    
    // Mock the downloadAttachment function
    jest.doMock('../src/services/gmailSyncService.js', () => ({
      downloadAttachment: jest.fn().mockResolvedValue(mockAttachmentData),
      getOAuthForUser: jest.fn().mockReturnValue({})
    }))

    const response = await request(app)
      .get(`/api/emails/${email._id}/attachments/att1/download`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toBe('application/pdf')
    expect(response.headers['content-disposition']).toContain('document.pdf')
    expect(response.body).toEqual(mockAttachmentData)
  })

  test('should return 404 for non-existent attachment', async () => {
    const response = await request(app)
      .get(`/api/emails/${email._id}/attachments/non-existent/download`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(404)
    expect(response.body.success).toBe(false)
  })

  test('should return 404 for non-existent email', async () => {
    const fakeId = new mongoose.Types.ObjectId()
    const response = await request(app)
      .get(`/api/emails/${fakeId}/attachments/att1/download`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(404)
    expect(response.body.success).toBe(false)
  })

  test('should return 400 for disconnected Gmail', async () => {
    // Disconnect Gmail
    user.gmailConnected = false
    await user.save()

    const response = await request(app)
      .get(`/api/emails/${email._id}/attachments/att1/download`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.message).toBe('Gmail not connected')
  })
})
