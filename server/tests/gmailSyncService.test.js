import { jest } from '@jest/globals'
import { fullSync, listAllMessageIds, fetchMessage, upsertEmail, classifyAndSave } from '../src/services/gmailSyncService.js'
import Email from '../src/models/Email.js'
import User from '../src/models/User.js'

// Mock dependencies
jest.mock('../src/models/Email.js')
jest.mock('../src/models/User.js')

describe('Gmail Sync Service', () => {
  let mockUser
  let mockOAuth2Client
  let mockGmailClient

  beforeEach(() => {
    mockUser = {
      _id: '68c433f5cec2b0f257e9693b',
      email: '2022003695.prateek@ug.sharda.ac.in',
      gmailConnected: true,
      gmailAccessToken: 'mock-access-token',
      gmailRefreshToken: 'mock-refresh-token'
    }

    mockOAuth2Client = {
      setCredentials: jest.fn()
    }

    mockGmailClient = {
      users: {
        messages: {
          list: jest.fn(),
          get: jest.fn()
        }
      }
    }

    // Mock google.gmail
    jest.doMock('googleapis', () => ({
      google: {
        auth: {
          OAuth2: jest.fn(() => mockOAuth2Client)
        },
        gmail: jest.fn(() => mockGmailClient)
      }
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('listAllMessageIds', () => {
    it('should list all message IDs with pagination', async () => {
      // Mock Gmail API responses
      mockGmailClient.users.messages.list
        .mockResolvedValueOnce({
          data: {
            messages: [
              { id: 'msg1' },
              { id: 'msg2' }
            ],
            nextPageToken: 'token1'
          }
        })
        .mockResolvedValueOnce({
          data: {
            messages: [
              { id: 'msg3' },
              { id: 'msg4' }
            ],
            nextPageToken: null
          }
        })

      const messageIds = await listAllMessageIds(mockOAuth2Client, 'in:inbox')

      expect(messageIds).toEqual(['msg1', 'msg2', 'msg3', 'msg4'])
      expect(mockGmailClient.users.messages.list).toHaveBeenCalledTimes(2)
    })

    it('should handle empty results', async () => {
      mockGmailClient.users.messages.list.mockResolvedValueOnce({
        data: {
          messages: [],
          nextPageToken: null
        }
      })

      const messageIds = await listAllMessageIds(mockOAuth2Client)

      expect(messageIds).toEqual([])
      expect(mockGmailClient.users.messages.list).toHaveBeenCalledTimes(1)
    })
  })

  describe('fetchMessage', () => {
    it('should fetch full message details', async () => {
      const mockMessage = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'Test email snippet',
        internalDate: '1757702258000',
        labelIds: ['INBOX', 'UNREAD'],
        payload: {
          headers: [
            { name: 'Subject', value: 'Test Subject' },
            { name: 'From', value: 'test@example.com' },
            { name: 'To', value: 'user@example.com' }
          ],
          body: {
            data: Buffer.from('Test email body').toString('base64')
          }
        }
      }

      mockGmailClient.users.messages.get.mockResolvedValueOnce({
        data: mockMessage
      })

      const result = await fetchMessage(mockOAuth2Client, 'msg1')

      expect(result).toEqual(mockMessage)
      expect(mockGmailClient.users.messages.get).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg1',
        format: 'full'
      })
    })
  })

  describe('upsertEmail', () => {
    it('should upsert email successfully', async () => {
      const mockEmailData = {
        gmailId: 'msg1',
        messageId: 'msg1',
        subject: 'Test Subject',
        from: 'test@example.com',
        to: 'user@example.com',
        date: new Date(),
        snippet: 'Test snippet',
        body: 'Test body',
        isRead: false,
        labels: ['INBOX'],
        provider: 'gmail'
      }

      const mockSavedEmail = {
        _id: 'email1',
        ...mockEmailData
      }

      Email.findOneAndUpdate.mockResolvedValueOnce(mockSavedEmail)

      const result = await upsertEmail(mockUser, mockEmailData)

      expect(result).toEqual(mockSavedEmail)
      expect(Email.findOneAndUpdate).toHaveBeenCalledWith(
        { messageId: 'msg1', userId: mockUser._id },
        { userId: mockUser._id, ...mockEmailData },
        { upsert: true, new: true }
      )
    })
  })

  describe('classifyAndSave', () => {
    it('should classify and save email', async () => {
      const mockEmailDoc = {
        _id: 'email1',
        subject: 'Job opportunity',
        snippet: 'Apply now for this position',
        body: 'We have a great job opportunity for you'
      }

      const mockClassifiedEmail = {
        ...mockEmailDoc,
        category: 'Placement',
        classification: {
          label: 'Placement',
          confidence: 0.8,
          modelVersion: '1.0.0',
          classifiedAt: expect.any(Date)
        }
      }

      Email.findByIdAndUpdate.mockResolvedValueOnce(mockClassifiedEmail)

      const result = await classifyAndSave(mockEmailDoc)

      expect(result).toEqual(mockClassifiedEmail)
      expect(Email.findByIdAndUpdate).toHaveBeenCalledWith(
        'email1',
        {
          category: 'Placement',
          classification: {
            label: 'Placement',
            confidence: 0.8,
            modelVersion: '1.0.0',
            classifiedAt: expect.any(Date)
          }
        },
        { new: true }
      )
    })
  })

  describe('fullSync', () => {
    it('should perform full sync successfully', async () => {
      // Mock Gmail API responses
      mockGmailClient.users.messages.list.mockResolvedValueOnce({
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
            { name: 'From', value: 'hr@company.com' }
          ],
          body: { data: Buffer.from('Apply now').toString('base64') }
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
            { name: 'From', value: 'university@edu.com' }
          ],
          body: { data: Buffer.from('Course update').toString('base64') }
        }
      }

      mockGmailClient.users.messages.get
        .mockResolvedValueOnce({ data: mockMessage1 })
        .mockResolvedValueOnce({ data: mockMessage2 })

      const mockSavedEmail1 = {
        _id: 'email1',
        subject: 'Job Opportunity',
        category: 'Placement'
      }

      const mockSavedEmail2 = {
        _id: 'email2',
        subject: 'Academic Update',
        category: 'Academic'
      }

      Email.findOneAndUpdate
        .mockResolvedValueOnce(mockSavedEmail1)
        .mockResolvedValueOnce(mockSavedEmail2)

      Email.findByIdAndUpdate
        .mockResolvedValueOnce({ ...mockSavedEmail1, category: 'Placement' })
        .mockResolvedValueOnce({ ...mockSavedEmail2, category: 'Academic' })

      const result = await fullSync(mockUser)

      expect(result.success).toBe(true)
      expect(result.total).toBe(2)
      expect(result.synced).toBe(2)
      expect(result.classified).toBe(2)
      expect(result.skipped).toBe(0)
    })

    it('should handle Gmail not connected', async () => {
      const userWithoutGmail = { ...mockUser, gmailConnected: false }

      const result = await fullSync(userWithoutGmail)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Gmail account not connected')
    })

    it('should handle empty inbox', async () => {
      mockGmailClient.users.messages.list.mockResolvedValueOnce({
        data: {
          messages: [],
          nextPageToken: null
        }
      })

      const result = await fullSync(mockUser)

      expect(result.success).toBe(true)
      expect(result.total).toBe(0)
      expect(result.synced).toBe(0)
      expect(result.message).toBe('No emails found in inbox')
    })
  })
})
