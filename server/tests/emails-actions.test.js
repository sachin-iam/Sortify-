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

describe('Email Actions', () => {
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

    // Create test email
    email = new Email({
      userId: user._id,
      provider: 'gmail',
      gmailId: 'test-gmail-id',
      subject: 'Test Email',
      from: 'sender@example.com',
      to: 'test@example.com',
      snippet: 'Test email',
      body: 'Test body',
      date: new Date(),
      labels: ['INBOX'],
      isArchived: false,
      isDeleted: false
    })
    await email.save()
  })

  describe('Archive Email', () => {
    test('should archive email successfully', async () => {
      const response = await request(app)
        .put(`/api/emails/${email._id}/archive`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Email archived successfully')

      // Check database
      const updatedEmail = await Email.findById(email._id)
      expect(updatedEmail.isArchived).toBe(true)
      expect(updatedEmail.archivedAt).toBeDefined()
      expect(updatedEmail.labels).not.toContain('INBOX')
      expect(updatedEmail.labels).toContain('ARCHIVE')
    })

    test('should return 404 for non-existent email', async () => {
      const fakeId = new mongoose.Types.ObjectId()
      const response = await request(app)
        .put(`/api/emails/${fakeId}/archive`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })

    test('should handle Gmail API errors gracefully', async () => {
      // Mock Gmail API to throw error
      jest.doMock('googleapis', () => ({
        google: {
          gmail: jest.fn().mockReturnValue({
            users: {
              messages: {
                modify: jest.fn().mockRejectedValue(new Error('Gmail API Error'))
              }
            }
          })
        }
      }))

      const response = await request(app)
        .put(`/api/emails/${email._id}/archive`)
        .set('Authorization', `Bearer ${token}`)

      // Should still succeed locally even if Gmail fails
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('Delete Email', () => {
    test('should delete email successfully', async () => {
      const response = await request(app)
        .delete(`/api/emails/${email._id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Email deleted successfully')

      // Check database
      const deletedEmail = await Email.findById(email._id)
      expect(deletedEmail).toBeNull()
    })

    test('should return 404 for non-existent email', async () => {
      const fakeId = new mongoose.Types.ObjectId()
      const response = await request(app)
        .delete(`/api/emails/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })

    test('should handle Gmail API errors gracefully', async () => {
      // Mock Gmail API to throw error
      jest.doMock('googleapis', () => ({
        google: {
          gmail: jest.fn().mockReturnValue({
            users: {
              messages: {
                trash: jest.fn().mockRejectedValue(new Error('Gmail API Error'))
              }
            }
          })
        }
      }))

      const response = await request(app)
        .delete(`/api/emails/${email._id}`)
        .set('Authorization', `Bearer ${token}`)

      // Should still succeed locally even if Gmail fails
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('Export CSV', () => {
    test('should export emails to CSV', async () => {
      // Create more test emails
      const emails = []
      for (let i = 0; i < 5; i++) {
        emails.push({
          userId: user._id,
          provider: 'gmail',
          gmailId: `gmail_${i}`,
          subject: `Test Email ${i}`,
          from: `sender${i}@example.com`,
          to: 'test@example.com',
          snippet: `Test snippet ${i}`,
          body: `Test body ${i}`,
          date: new Date(),
          category: 'Academic',
          classification: {
            label: 'Academic',
            confidence: 0.8
          }
        })
      }
      await Email.insertMany(emails)

      const emailIds = emails.map(e => e._id)
      const response = await request(app)
        .post('/api/emails/export/csv')
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds })

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe('text/csv')
      expect(response.headers['content-disposition']).toContain('emails-export')
      
      const csvContent = response.text
      expect(csvContent).toContain('Subject,From,To,Date,Category,Confidence,Snippet')
      expect(csvContent).toContain('Test Email 0')
    })

    test('should return 400 for missing email IDs', async () => {
      const response = await request(app)
        .post('/api/emails/export/csv')
        .set('Authorization', `Bearer ${token}`)
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    test('should return 404 for no emails found', async () => {
      const fakeIds = [new mongoose.Types.ObjectId()]
      const response = await request(app)
        .post('/api/emails/export/csv')
        .set('Authorization', `Bearer ${token}`)
        .send({ emailIds: fakeIds })

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })
})
