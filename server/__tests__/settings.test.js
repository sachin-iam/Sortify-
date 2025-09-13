import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import app from '../src/server.js'
import User from '../src/models/User.js'

let mongoServer

describe('Settings API Tests', () => {
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

  let authToken
  let testUser

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      emailPreferences: {
        notifications: true,
        marketing: false
      }
    })

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      })

    authToken = loginResponse.body.token
  })

  describe('GET /api/auth/connections', () => {
    it('should get user connections status', async () => {
      const response = await request(app)
        .get('/api/auth/connections')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.connections).toHaveProperty('gmail')
      expect(response.body.connections).toHaveProperty('outlook')
      expect(response.body.emailPreferences).toHaveProperty('notifications')
      expect(response.body.emailPreferences).toHaveProperty('marketing')
    })

    it('should require authentication', async () => {
      await request(app)
        .get('/api/auth/connections')
        .expect(401)
    })
  })

  describe('PUT /api/auth/profile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        emailPreferences: {
          notifications: false,
          marketing: true
        }
      }

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.user.name).toBe('Updated Name')
      expect(response.body.user.emailPreferences.notifications).toBe(false)
      expect(response.body.user.emailPreferences.marketing).toBe(true)
    })

    it('should validate name length', async () => {
      const updateData = {
        name: 'A' // Too short
      }

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Validation failed')
    })

    it('should require authentication', async () => {
      await request(app)
        .put('/api/auth/profile')
        .send({ name: 'Test' })
        .expect(401)
    })
  })

  describe('PUT /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      }

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Password changed successfully')

      // Verify old password no longer works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(401)

      // Verify new password works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'newpassword123'
        })
        .expect(200)
    })

    it('should reject incorrect current password', async () => {
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      }

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Current password is incorrect')
    })

    it('should validate new password length', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: '123' // Too short
      }

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Validation failed')
    })

    it('should require authentication', async () => {
      await request(app)
        .put('/api/auth/change-password')
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        })
        .expect(401)
    })
  })

  describe('PUT /api/auth/email-preferences', () => {
    it('should update email preferences successfully', async () => {
      const preferencesData = {
        notifications: false,
        marketing: true
      }

      const response = await request(app)
        .put('/api/auth/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferencesData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.emailPreferences.notifications).toBe(false)
      expect(response.body.emailPreferences.marketing).toBe(true)
      expect(response.body.message).toBe('Email preferences updated successfully')
    })

    it('should update single preference', async () => {
      const preferencesData = {
        notifications: false
      }

      const response = await request(app)
        .put('/api/auth/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferencesData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.emailPreferences.notifications).toBe(false)
      expect(response.body.emailPreferences.marketing).toBe(false) // Should remain unchanged
    })

    it('should validate boolean values', async () => {
      const preferencesData = {
        notifications: 'not-a-boolean'
      }

      const response = await request(app)
        .put('/api/auth/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferencesData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Validation failed')
    })

    it('should require authentication', async () => {
      await request(app)
        .put('/api/auth/email-preferences')
        .send({ notifications: false })
        .expect(401)
    })
  })

  describe('DELETE /api/auth/account', () => {
    it('should delete user account successfully', async () => {
      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Account deleted successfully')

      // Verify user is deleted
      const deletedUser = await User.findById(testUser._id)
      expect(deletedUser).toBeNull()
    })

    it('should require authentication', async () => {
      await request(app)
        .delete('/api/auth/account')
        .expect(401)
    })

    it('should clear token cookie on account deletion', async () => {
      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.headers['set-cookie']).toBeDefined()
      expect(response.headers['set-cookie'][0]).toContain('token=')
    })
  })

  describe('Gmail Connection Integration', () => {
    it('should handle Gmail disconnect with data cleanup', async () => {
      // Set up user with Gmail connection
      await User.findByIdAndUpdate(testUser._id, {
        gmailConnected: true,
        gmailAccessToken: 'test-token',
        gmailRefreshToken: 'test-refresh-token'
      })

      const response = await request(app)
        .post('/api/auth/gmail/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)

      // Verify Gmail data is cleared
      const updatedUser = await User.findById(testUser._id)
      expect(updatedUser.gmailConnected).toBe(false)
      expect(updatedUser.gmailAccessToken).toBeNull()
      expect(updatedUser.gmailRefreshToken).toBeNull()
    })
  })
})
