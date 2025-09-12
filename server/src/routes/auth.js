import express from 'express'
import { body, validationResult } from 'express-validator'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { google } from 'googleapis'
import User from '../models/User.js'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = express.Router()

// Google OAuth configuration - moved to function to ensure env vars are loaded
const getOAuth2Client = () => {
  console.log('OAuth Config:', {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? '***' : 'MISSING',
    redirectUri: process.env.GOOGLE_REDIRECT_URI
  })

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/gmail/callback'
  )
}

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'dev-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  })
}

// Set token in cookie
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id)

  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }

  res.status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified
      }
    })
}

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    })
  }

  const { name, email, password } = req.body

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      })
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password
    })

    sendTokenResponse(user, 201, res)
  } catch (error) {
    console.error('Database operation failed:', error)
    return res.status(500).json({
      success: false,
      message: 'Database operation failed'
    })
  }
}))

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    })
  }

  const { email, password } = req.body

  try {
    // Find user by email
    const user = await User.findOne({ email }).select('+password')
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      })
    }

    // Check password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      })
    }

    // Update last login
    await user.updateLastLogin()

    sendTokenResponse(user, 200, res)
  } catch (error) {
    console.error('Database operation failed:', error)
    return res.status(500).json({
      success: false,
      message: 'Database operation failed'
    })
  }
}))

// @desc    Google OAuth login
// @route   POST /api/auth/google
// @access  Public
router.post('/google', asyncHandler(async (req, res) => {
  const { code, redirectUri } = req.body

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Authorization code is required'
    })
  }

  try {
    // Exchange authorization code for tokens
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data } = await oauth2.userinfo.get()

    // Check if user exists
    let user = await User.findOne({ googleId: data.id })

    if (!user) {
      // Check if user exists with same email
      user = await User.findOne({ email: data.email })
      
      if (user) {
        // Link Google account to existing user
        user.googleId = data.id
        user.avatar = data.picture
        user.isEmailVerified = true
        await user.save()
      } else {
        // Create new user
        user = await User.createFromGoogle(data)
      }
    }

    // Update last login
    await user.updateLastLogin()

    sendTokenResponse(user, 200, res)
  } catch (error) {
    console.error('Google OAuth error:', error)
    return res.status(401).json({
      success: false,
      message: 'Google authentication failed'
    })
  }
}))

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  
  res.json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      emailPreferences: user.emailPreferences,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      gmailConnected: user.gmailConnected,
      outlookConnected: user.outlookConnected
    }
  })
}))

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('emailPreferences.notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications preference must be a boolean'),
  body('emailPreferences.marketing')
    .optional()
    .isBoolean()
    .withMessage('Marketing preference must be a boolean')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    })
  }

  const { name, emailPreferences } = req.body
  const updateFields = {}

  if (name) updateFields.name = name
  if (emailPreferences) updateFields.emailPreferences = emailPreferences

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateFields,
    { new: true, runValidators: true }
  )

  res.json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      emailPreferences: user.emailPreferences,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    }
  })
}))

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000), // 10 seconds
    httpOnly: true
  })

  res.json({
    success: true,
    message: 'User logged out successfully'
  })
})

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', protect, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    })
  }

  const { currentPassword, newPassword } = req.body

  // Get user with password
  const user = await User.findById(req.user._id).select('+password')

  // Check current password
  const isMatch = await user.comparePassword(currentPassword)
  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    })
  }

  // Update password
  user.password = newPassword
  await user.save()

  res.json({
    success: true,
    message: 'Password changed successfully'
  })
}))

// @desc    Get Gmail OAuth URL
// @route   GET /api/auth/gmail/connect
// @access  Private
router.get('/gmail/connect', protect, asyncHandler(async (req, res) => {
  try {
    console.log('Generating Gmail OAuth URL for user:', req.user._id)
    
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]

    const oauth2Client = getOAuth2Client()
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: req.user._id.toString() // Pass user ID in state
    })

    console.log('Generated auth URL:', authUrl)

    res.json({
      success: true,
      authUrl
    })
  } catch (error) {
    console.error('Gmail OAuth URL generation error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to generate Gmail OAuth URL'
    })
  }
}))

// @desc    Gmail OAuth callback
// @route   GET /api/auth/gmail/callback
// @access  Public
router.get('/gmail/callback', asyncHandler(async (req, res) => {
  try {
    const { code, state } = req.query

    if (!code || !state) {
      return res.redirect(`${process.env.CORS_ORIGIN}/login?error=oauth_error`)
    }

    // Exchange code for tokens
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    // Find user by ID from state
    const user = await User.findById(state)
    if (!user) {
      return res.redirect(`${process.env.CORS_ORIGIN}/login?error=user_not_found`)
    }

    // Update user with Gmail tokens
    user.gmailConnected = true
    user.gmailAccessToken = tokens.access_token
    user.gmailRefreshToken = tokens.refresh_token
    user.gmailTokenExpiry = new Date(tokens.expiry_date)
    user.gmailEmail = userInfo.email
    await user.save()

    // Redirect to dashboard with success
    res.redirect(`${process.env.CORS_ORIGIN}/?gmail_connected=true`)
  } catch (error) {
    console.error('Gmail OAuth callback error:', error)
    res.redirect(`${process.env.CORS_ORIGIN}/login?error=gmail_connection_failed`)
  }
}))

// @desc    Connect Microsoft Outlook account
// @route   POST /api/auth/microsoft/connect
// @access  Private
router.post('/microsoft/connect', protect, asyncHandler(async (req, res) => {
  try {
    // Microsoft OAuth implementation would go here
    // For now, return an error indicating the feature is not implemented
    res.status(501).json({
      success: false,
      message: 'Microsoft Outlook integration is not yet implemented. Please use Gmail for now.'
    })
  } catch (error) {
    console.error('Outlook connection error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to connect Microsoft Outlook account'
    })
  }
}))

// @desc    Disconnect Gmail account
// @route   DELETE /api/auth/gmail/disconnect
// @access  Private
router.delete('/gmail/disconnect', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    user.gmailConnected = false
    user.gmailAccessToken = null
    user.gmailRefreshToken = null
    user.gmailTokenExpiry = null
    await user.save()

    res.json({
      success: true,
      message: 'Gmail account disconnected successfully'
    })
  } catch (error) {
    console.error('Gmail disconnection error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Gmail account'
    })
  }
}))

// @desc    Disconnect Microsoft Outlook account
// @route   DELETE /api/auth/microsoft/disconnect
// @access  Private
router.delete('/microsoft/disconnect', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    user.outlookConnected = false
    user.outlookAccessToken = null
    user.outlookRefreshToken = null
    user.outlookTokenExpiry = null
    await user.save()

    res.json({
      success: true,
      message: 'Microsoft Outlook account disconnected successfully'
    })
  } catch (error) {
    console.error('Outlook disconnection error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Microsoft Outlook account'
    })
  }
}))

export default router
