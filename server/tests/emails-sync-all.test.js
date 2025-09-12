import { jest } from '@jest/globals'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import app from '../src/server.js'
import User from '../src/models/User.js'
import Email from '../src/models/Email.js'
import jwt from 'jsonwebtoken'

// Mock Gmail API
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(() => ({
        setCredentials: jest.fn()
      }))
    },
    gmail: jest.fn(() => ({
      users: {
        messages: {
          list: jest.fn(),
          get: jest.fn()
        }
      }
    }))
  }
}))

describe('Emails Sync All Integration Tests', () => {
  let mongoServer
  let authToken
  let testUser

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    
    await mongoose.connect(mongoUri)
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({})
    await Email.deleteMany({})

    // Create test user
    testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      gmailConnected: true,
      gmailAccessToken: 'mock-access-token',
      gmailRefreshToken: 'mock-refresh-token'
    })
    await testUser.save()

    // Generate JWT token
    authToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET || 'test-secret')
  })

  afterEach(async () => {
    await User.deleteMany({})
    await Email.deleteMany({})
  })

  describe('POST /api/emails/gmail/sync-all', () => {
    it('should sync all Gmail emails successfully', async () => {
      // Mock Gmail API responses
      const { google } = require('googleapis')
      const mockGmail = google.gmail()
      
      mockGmail.users.messages.list.mockResolvedValueOnce({
        data: {
          messages: [
            { id: 'msg1' },
            { id: 'msg2' }
          ],
          nextPageToken: null
        }
      })

      const mockMessage1 = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'Job opportunity',
        internalDate: '1757702258000',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'Subject', value: 'Job Opportunity' },
            { name: 'From', value: 'hr@company.com' },
            { name: 'To', value: 'test@example.com' }
          ],
          body: { data: Buffer.from('Apply now for this position').toString('base64') }
        }
      }

      const mockMessage2 = {
        id: 'msg2',
        threadId: 'thread2',
        snippet: 'Academic update',
        internalDate: '1757702259000',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'Subject', value: 'Academic Update' },
            { name: 'From', value: 'university@edu.com' },
            { name: 'To', value: 'test@example.com' }
          ],
          body: { data: Buffer.from('Course update information').toString('base64') }
        }
      }

      mockGmail.users.messages.get
        .mockResolvedValueOnce({ data: mockMessage1 })
        .mockResolvedValueOnce({ data: mockMessage2 })

      const response = await request(app)
        .post('/api/emails/gmail/sync-all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.syncedCount).toBe(2)
      expect(response.body.total).toBe(2)
      expect(response.body.classified).toBe(2)

      // Verify emails were saved to database
      const savedEmails = await Email.find({ userId: testUser._id })
      expect(savedEmails).toHaveLength(2)

      // Verify email content
      const email1 = savedEmails.find(e => e.messageId === 'msg1')
      expect(email1.subject).toBe('Job Opportunity')
      expect(email1.from).toBe('hr@company.com')
      expect(email1.category).toBe('Placement')

      const email2 = savedEmails.find(e => e.messageId === 'msg2')
      expect(email2.subject).toBe('Academic Update')
      expect(email2.from).toBe('university@edu.com')
      expect(email2.category).toBe('Academic')
    })

    it('should handle Gmail not connected', async () => {
      // Update user to not have Gmail connected
      await User.findByIdAndUpdate(testUser._id, { gmailConnected: false })

      const response = await request(app)
        .post('/api/emails/gmail/sync-all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Gmail account not connected')
    })

    it('should handle empty inbox', async () => {
      // Mock empty Gmail response
      const { google } = require('googleapis')
      const mockGmail = google.gmail()
      
      mockGmail.users.messages.list.mockResolvedValueOnce({
        data: {
          messages: [],
          nextPageToken: null
        }
      })

      const response = await request(app)
        .post('/api/emails/gmail/sync-all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.syncedCount).toBe(0)
      expect(response.body.total).toBe(0)

      // Verify no emails were saved
      const savedEmails = await Email.find({ userId: testUser._id })
      expect(savedEmails).toHaveLength(0)
    })

    it('should handle Gmail API errors', async () => {
      // Mock Gmail API error
      const { google } = require('googleapis')
      const mockGmail = google.gmail()
      
      mockGmail.users.messages.list.mockRejectedValueOnce(new Error('Gmail API Error'))

      const response = await request(app)
        .post('/api/emails/gmail/sync-all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Failed to sync Gmail emails')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/emails/gmail/sync-all')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Not authorized, no token')
    })
  })

  describe('GET /api/emails', () => {
    it('should return paginated emails after sync', async () => {
      // Create some test emails
      const testEmails = [
        {
          userId: testUser._id,
          gmailId: 'msg1',
          messageId: 'msg1',
          subject: 'Test Email 1',
          from: 'test1@example.com',
          to: 'test@example.com',
          date: new Date(),
          snippet: 'Test snippet 1',
          body: 'Test body 1',
          isRead: false,
          labels: ['INBOX'],
          category: 'Placement',
          classification: {
            label: 'Placement',
            confidence: 0.8
          }
        },
        {
          userId: testUser._id,
          gmailId: 'msg2',
          messageId: 'msg2',
          subject: 'Test Email 2',
          from: 'test2@example.com',
          to: 'test@example.com',
          date: new Date(),
          snippet: 'Test snippet 2',
          body: 'Test body 2',
          isRead: true,
          labels: ['INBOX'],
          category: 'Academic',
          classification: {
            label: 'Academic',
            confidence: 0.9
          }
        }
      ]

      await Email.insertMany(testEmails)

      const response = await request(app)
        .get('/api/emails?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.emails).toHaveLength(2)
      expect(response.body.pagination.total).toBe(2)
      expect(response.body.pagination.currentPage).toBe(1)
      expect(response.body.pagination.totalPages).toBe(1)

      // Verify email content
      const email1 = response.body.emails.find(e => e.messageId === 'msg1')
      expect(email1.subject).toBe('Test Email 1')
      expect(email1.category).toBe('Placement')
      expect(email1.classification.confidence).toBe(0.8)
    })
  })
})
