import request from 'supertest'
import mongoose from 'mongoose'
import app from '../src/server.js'
import User from '../src/models/User.js'

describe('Authentication System - Comprehensive Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sortify-test'
    await mongoose.connect(mongoUri)
  })

  afterAll(async () => {
    await mongoose.connection.close()
  })

  beforeEach(async () => {
    // Clear users collection before each test
    await User.deleteMany({})
  })

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.token).toBeDefined()
      expect(response.body.user.email).toBe(userData.email)
      expect(response.body.user.name).toBe(userData.name)
      expect(response.body.user.password).toBeUndefined() // Password should not be returned
    })

    it('should not register user with existing email', async () => {
      // Create first user
      await User.create({
        name: 'First User',
        email: 'test@example.com',
        password: 'password123'
      })

      const userData = {
        name: 'Second User',
        email: 'test@example.com',
        password: 'password456'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('already exists')
    })

    it('should validate registration data', async () => {
      const invalidData = {
        name: 'A', // Too short
        email: 'invalid-email',
        password: '123' // Too short
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.errors).toBeDefined()
    })
  })

  describe('User Login', () => {
    beforeEach(async () => {
      // Create a test user
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      })
    })

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.token).toBeDefined()
      expect(response.body.user.email).toBe(loginData.email)
    })

    it('should not login with invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Invalid credentials')
    })

    it('should not login with non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Invalid credentials')
    })
  })

  describe('Password Reset', () => {
    beforeEach(async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      })
    })

    it('should generate password reset token', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('Password reset token generated')
      
      // Check if user has reset token in database
      const user = await User.findOne({ email: 'test@example.com' })
      expect(user.resetPasswordToken).toBeDefined()
      expect(user.resetPasswordExpire).toBeDefined()
    })

    it('should reset password with valid token', async () => {
      // First generate reset token
      const user = await User.findOne({ email: 'test@example.com' })
      const resetToken = user.getResetPasswordToken()
      await user.save()

      const response = await request(app)
        .put(`/api/auth/reset-password/${resetToken}`)
        .send({ password: 'newpassword123' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('Password reset successfully')

      // Verify password was changed
      const updatedUser = await User.findOne({ email: 'test@example.com' }).select('+password')
      const isMatch = await updatedUser.comparePassword('newpassword123')
      expect(isMatch).toBe(true)
    })

    it('should not reset password with invalid token', async () => {
      const response = await request(app)
        .put('/api/auth/reset-password/invalidtoken')
        .send({ password: 'newpassword123' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Invalid or expired reset token')
    })
  })

  describe('Email Verification', () => {
    beforeEach(async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        isEmailVerified: false
      })
    })

    it('should generate email verification token', async () => {
      // Login first to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })

      const token = loginResponse.body.token

      const response = await request(app)
        .post('/api/auth/send-verification')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('Verification email sent')
    })

    it('should verify email with valid token', async () => {
      const user = await User.findOne({ email: 'test@example.com' })
      const verificationToken = user.getEmailVerificationToken()
      await user.save()

      const response = await request(app)
        .put(`/api/auth/verify-email/${verificationToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('Email verified successfully')

      // Verify email status was updated
      const updatedUser = await User.findOne({ email: 'test@example.com' })
      expect(updatedUser.isEmailVerified).toBe(true)
    })
  })

  describe('Protected Routes', () => {
    let authToken

    beforeEach(async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      })

      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })

      authToken = loginResponse.body.token
    })

    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.user.email).toBe('test@example.com')
    })

    it('should not access protected route without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Not authorized, no token')
    })

    it('should not access protected route with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken')
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Not authorized, token failed')
    })
  })

  describe('Password Change', () => {
    let authToken

    beforeEach(async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      })

      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })

      authToken = loginResponse.body.token
    })

    it('should change password with correct current password', async () => {
      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('Password changed successfully')

      // Verify password was changed
      const user = await User.findOne({ email: 'test@example.com' }).select('+password')
      const isMatch = await user.comparePassword('newpassword123')
      expect(isMatch).toBe(true)
    })

    it('should not change password with incorrect current password', async () => {
      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Current password is incorrect')
    })
  })

  describe('User Profile Management', () => {
    let authToken

    beforeEach(async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      })

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })

      authToken = loginResponse.body.token
    })

    it('should update user profile', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.user.name).toBe('Updated Name')
    })

    it('should update email preferences', async () => {
      const response = await request(app)
        .put('/api/auth/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          emailPreferences: {
            notifications: false,
            marketing: true
          }
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.emailPreferences.notifications).toBe(false)
      expect(response.body.emailPreferences.marketing).toBe(true)
    })
  })

  describe('Account Deletion', () => {
    let authToken

    beforeEach(async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      })

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })

      authToken = loginResponse.body.token
    })

    it('should delete user account', async () => {
      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('Account deleted successfully')

      // Verify user was deleted
      const user = await User.findOne({ email: 'test@example.com' })
      expect(user).toBeNull()
    })
  })
})
