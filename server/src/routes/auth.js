import express from 'express'
import { body, validationResult } from 'express-validator'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { google } from 'googleapis'
import User from '../models/User.js'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { cleanupOnLogout } from '../services/emailCleanupService.js'

const router = express.Router()

// Google OAuth configuration - moved to function to ensure env vars are loaded
const getOAuth2Client = () => {
  console.log('OAuth Config:', {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? '***' : 'MISSING',
    redirectUri: process.env.GOOGLE_REDIRECT_URI
  })

  // Check if OAuth credentials are available
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file.')
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/gmail/callback'
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

    // Return success without token - user needs to login separately
    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please login to continue.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified
      }
    })
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

    // Auto-connect Gmail if not already connected
    if (!user.gmailConnected && tokens.access_token) {
      try {
        user.gmailConnected = true
        user.gmailAccessToken = tokens.access_token
        if (tokens.refresh_token) user.gmailRefreshToken = tokens.refresh_token
        user.gmailTokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null
        user.gmailEmail = data.email
        user.gmailName = data.name || data.email
        await user.save()
        console.log('✅ Auto-connected Gmail for Google OAuth user:', data.email)
      } catch (error) {
        console.error('❌ Failed to auto-connect Gmail:', error)
        // Continue with login even if Gmail connection fails
      }
    }

    sendTokenResponse(user, 200, res)
  } catch (error) {
    console.error('Google OAuth error:', error)
    return res.status(401).json({
      success: false,
      message: 'Google authentication failed'
    })
  }
}))

// @desc    Generate Google OAuth URL for complete login with email connection
// @route   GET /api/auth/google/login
// @access  Public
router.get('/google/login', asyncHandler(async (req, res) => {
  try {
    console.log('🔧 Generating Google OAuth URL for login...')
    
    // Check if environment variables are available
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('❌ Missing Google OAuth credentials')
      return res.status(500).json({
        success: false,
        message: 'Google OAuth is not configured properly. Missing client credentials.'
      })
    }
    
    const oauth2Client = getOAuth2Client()
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/gmail/callback'
    
    console.log('🔧 OAuth config:', {
      clientId: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING',
      redirectUri: redirectUri
    })
    
    // Generate Google OAuth URL for complete login with Gmail connection
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'openid',
        'email', 
        'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.labels',
        'https://www.googleapis.com/auth/gmail.settings.basic'
      ],
      state: 'complete_login', // Complete login with email connection
      redirect_uri: redirectUri
    })

    console.log('✅ Generated OAuth URL:', authUrl.substring(0, 100) + '...')

    res.json({
      success: true,
      authUrl
    })
  } catch (error) {
    console.error('❌ Google OAuth URL generation error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to generate Google OAuth URL',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}))

// @desc    Generate Google OAuth URL for Gmail connection only
// @route   GET /api/auth/google/connect
// @access  Private
router.get('/google/connect', protect, asyncHandler(async (req, res) => {
  try {
    const oauth2Client = getOAuth2Client()
    
    // Generate Google OAuth URL for Gmail connection only
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.labels',
        'https://www.googleapis.com/auth/gmail.settings.basic'
      ],
      state: 'gmail_connect', // Gmail connection only
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/gmail/callback'
    })

    res.json({
      success: true,
      authUrl
    })
  } catch (error) {
    console.error('Google OAuth URL generation error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to generate Google OAuth URL'
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
      gmailName: user.gmailName,
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
router.post('/logout', protect, asyncHandler(async (req, res) => {
  try {
    // Cleanup full content on logout (keep thumbnails)
    const cleanupResult = await cleanupOnLogout(req.user._id)
    console.log(`✅ Logout cleanup for user ${req.user._id}:`, cleanupResult.cleanedCount, 'emails cleaned')
  } catch (error) {
    console.error('❌ Logout cleanup error:', error)
    // Continue with logout even if cleanup fails
  }

  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000), // 10 seconds
    httpOnly: true
  })

  res.json({
    success: true,
    message: 'User logged out successfully'
  })
}))

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

// @desc    Clear blocked IPs (for testing)
// @route   POST /api/auth/clear-blocks
// @access  Public
router.post('/clear-blocks', asyncHandler(async (req, res) => {
  // Clear all blocked IPs and failed attempts
  if (global.securityService) {
    global.securityService.blockedIPs.clear()
    global.securityService.failedAttempts.clear()
    global.securityService.suspiciousActivities.clear()
  }
  
  res.json({
    success: true,
    message: 'All blocked IPs and failed attempts cleared'
  })
}))

// @desc    OAuth callback for frontend token exchange
// @route   GET /api/auth/oauth/callback
// @access  Public
router.get('/oauth/callback', asyncHandler(async (req, res) => {
  console.log('🔵 Frontend OAuth callback route hit!', req.query)
  
  try {
    const { code } = req.query

    if (!code) {
      console.log('❌ Missing OAuth code')
      return res.status(400).json({
        success: false,
        message: 'OAuth authorization code is required'
      })
    }

    // Exchange code for tokens using existing OAuth flow
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    // Find or create user (same logic as existing callback)
    let user = await User.findOne({ email: userInfo.email })
    let isNewUser = false

    if (!user) {
      // Create new user with complete setup
      user = await User.create({
        name: userInfo.name || userInfo.email,
        email: userInfo.email,
        password: 'oauth-user', // Placeholder password for OAuth users
        googleId: userInfo.id,
        avatar: userInfo.picture,
        isEmailVerified: true,
        gmailConnected: true,
        gmailAccessToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token,
        gmailTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        gmailEmail: userInfo.email,
        gmailName: userInfo.name || userInfo.email
      })
      isNewUser = true
      console.log('✅ Created new user via OAuth callback:', userInfo.email)
    } else {
      // Update existing user with Google info and Gmail connection
      user.googleId = userInfo.id
      user.avatar = userInfo.picture
      user.isEmailVerified = true
      user.gmailConnected = true
      user.gmailAccessToken = tokens.access_token
      if (tokens.refresh_token) user.gmailRefreshToken = tokens.refresh_token
      user.gmailTokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null
      user.gmailEmail = userInfo.email
      user.gmailName = userInfo.name || userInfo.email
      await user.save()
      console.log('✅ Updated existing user via OAuth callback:', userInfo.email)
    }

    // Generate JWT token for the user
    const jwtToken = generateToken(user._id)

    // Return JWT to frontend
    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isNewUser
      }
    })

  } catch (error) {
    console.error('❌ OAuth callback error:', error)
    res.status(500).json({
      success: false,
      message: 'OAuth authentication failed'
    })
  }
}))

// @desc    Get Gmail OAuth URL
// @route   GET /api/auth/gmail/connect
// @access  Public
router.get('/gmail/connect', asyncHandler(async (req, res) => {
  try {
    console.log('Generating Gmail OAuth URL')
    
    const SCOPES = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'openid',
      'email',
      'profile'
    ]

    const oauth2Client = getOAuth2Client()
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: SCOPES,
      state: 'gmail_connect'
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

// @desc    Complete OAuth callback (handles login + email connection)
// @route   GET /api/auth/gmail/callback
// @access  Public
router.get('/gmail/callback', asyncHandler(async (req, res) => {
  console.log('🔵 OAuth callback route hit!', req.query)
  try {
    const { code, state } = req.query

    if (!code) {
      console.log('❌ Missing code, redirecting to login')
      return res.redirect(`http://localhost:3000/login?error=oauth_error`)
    }

    // Determine flow type based on state
    const flowType = state || 'complete_login'
    console.log('🔄 OAuth flow type:', flowType)

    // Exchange code for tokens
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    let user
    let isNewUser = false

    if (flowType === 'complete_login') {
      // Complete login flow - create or find user
      user = await User.findOne({ email: userInfo.email })
      if (!user) {
        // Create new user with complete setup
        user = await User.create({
          name: userInfo.name || userInfo.email,
          email: userInfo.email,
          password: 'oauth-user', // Placeholder password for OAuth users
          googleId: userInfo.id,
          avatar: userInfo.picture,
          isEmailVerified: true,
          gmailConnected: true,
          gmailAccessToken: tokens.access_token,
          gmailRefreshToken: tokens.refresh_token,
          gmailTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          gmailEmail: userInfo.email,
          gmailName: userInfo.name || userInfo.email
        })
        isNewUser = true
        console.log('✅ Created new user with complete Gmail setup:', userInfo.email)
      } else {
        // Update existing user with Google info and Gmail connection
        user.googleId = userInfo.id
        user.avatar = userInfo.picture
        user.isEmailVerified = true
        user.gmailConnected = true
        user.gmailAccessToken = tokens.access_token
        if (tokens.refresh_token) user.gmailRefreshToken = tokens.refresh_token
        user.gmailTokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null
        user.gmailEmail = userInfo.email
        user.gmailName = userInfo.name || userInfo.email
        await user.save()
        console.log('✅ Updated existing user with complete Gmail setup:', userInfo.email)
      }
    } else if (flowType === 'gmail_connect') {
      // Gmail connection only flow - user must be authenticated
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.redirect(`http://localhost:3000/login?error=auth_required`)
      }
      
      const token = authHeader.substring(7)
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      user = await User.findById(decoded.id)
      
      if (!user) {
        return res.redirect(`http://localhost:3000/login?error=user_not_found`)
      }

      // Connect Gmail to existing user
      user.gmailConnected = true
      user.gmailAccessToken = tokens.access_token
      if (tokens.refresh_token) user.gmailRefreshToken = tokens.refresh_token
      user.gmailTokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null
      user.gmailEmail = userInfo.email
      user.gmailName = userInfo.name || userInfo.email
      await user.save()
      console.log('✅ Connected Gmail to existing user:', userInfo.email)
    }

    // Generate JWT token for the user
    const jwtToken = generateToken(user._id)
    
    // Set cookie with token
    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    // Redirect to frontend OAuth callback with token
    res.redirect(`http://localhost:3000/oauth/callback?token=${jwtToken}`)
  } catch (error) {
    console.error('❌ OAuth callback error:', error)
    
    // Redirect back to appropriate page with error
    const errorType = error.message.includes('jwt') ? 'auth_error' : 'oauth_error'
    res.redirect(`http://localhost:3000/dashboard?error=${errorType}`)
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
// @route   POST /api/auth/gmail/disconnect
// @access  Private
router.post('/gmail/disconnect', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    
    // Stop Gmail watch if active
    if (user.gmailWatchActive) {
      try {
        const { stopWatch } = await import('../services/gmailWatchService.js')
        await stopWatch(user)
      } catch (watchError) {
        console.error('Error stopping Gmail watch:', watchError)
      }
    }

    // Clear Gmail OAuth tokens
    user.gmailConnected = false
    user.gmailAccessToken = null
    user.gmailRefreshToken = null
    user.gmailTokenExpiry = null
    user.gmailWatchExpiration = null
    user.gmailHistoryId = null
    user.gmailWatchActive = false
    user.gmailLastHistoryId = null
    user.gmailName = null
    await user.save()

    // Purge all Gmail emails for this user
    const Email = (await import('../models/Email.js')).default
    const deleteResult = await Email.deleteMany({ 
      userId: req.user._id, 
      provider: 'gmail' 
    })

    console.log(`🗑️ Purged ${deleteResult.deletedCount} Gmail emails for user ${user.email}`)

    res.json({
      success: true,
      message: 'Disconnected and purged Gmail data',
      deletedEmails: deleteResult.deletedCount
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

// @desc    Delete user account
// @route   DELETE /api/auth/account
// @access  Private
router.delete('/account', protect, asyncHandler(async (req, res) => {
  const userId = req.user._id

  try {
    // Delete user and all associated data
    await User.findByIdAndDelete(userId)
    
    // Clear the token cookie
    res.clearCookie('token')
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    })
  } catch (error) {
    console.error('Account deletion error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    })
  }
}))

// @desc    Get user connections status
// @route   GET /api/auth/connections
// @access  Private
router.get('/connections', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('gmailConnected gmailName outlookConnected emailPreferences')

  res.json({
    success: true,
    connections: {
      gmail: {
        connected: user.gmailConnected,
        email: user.gmailConnected ? user.email : null,
        name: user.gmailConnected ? user.gmailName : null
      },
      outlook: {
        connected: user.outlookConnected,
        email: user.outlookConnected ? user.email : null
      }
    },
    emailPreferences: user.emailPreferences
  })
}))

// @desc    Update email preferences
// @route   PUT /api/auth/email-preferences
// @access  Private
router.put('/email-preferences', protect, [
  body('notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications preference must be a boolean'),
  body('marketing')
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

  const { notifications, marketing } = req.body
  const updateFields = {}

  if (notifications !== undefined) updateFields['emailPreferences.notifications'] = notifications
  if (marketing !== undefined) updateFields['emailPreferences.marketing'] = marketing

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { new: true, runValidators: true }
  ).select('emailPreferences')

  res.json({
    success: true,
    emailPreferences: user.emailPreferences,
    message: 'Email preferences updated successfully'
  })
}))

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
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

  const { email } = req.body

  try {
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Generate reset token
    const resetToken = user.getResetPasswordToken()
    await user.save()

    // In a real application, you would send an email here
    // For demo purposes, we'll return the reset token
    res.json({
      success: true,
      message: 'Password reset token generated',
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
      resetUrl: `${process.env.CORS_ORIGIN}/reset-password?token=${resetToken}`
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to generate reset token'
    })
  }
}))

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resetToken
// @access  Public
router.put('/reset-password/:resetToken', [
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

  const { resetToken } = req.params
  const { password } = req.body

  try {
    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex')

    // Find user by hashed token and check if token is not expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      })
    }

    // Update password
    user.password = password
    user.resetPasswordToken = null
    user.resetPasswordExpire = null
    await user.save()

    res.json({
      success: true,
      message: 'Password reset successfully'
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    })
  }
}))

// @desc    Send email verification
// @route   POST /api/auth/send-verification
// @access  Private
router.post('/send-verification', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      })
    }

    // Generate verification token
    const verificationToken = user.getEmailVerificationToken()
    await user.save()

    // In a real application, you would send an email here
    // For demo purposes, we'll return the verification token
    res.json({
      success: true,
      message: 'Verification email sent',
      verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
      verificationUrl: `${process.env.CORS_ORIGIN}/verify-email?token=${verificationToken}`
    })
  } catch (error) {
    console.error('Send verification error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification email'
    })
  }
}))

// @desc    Verify email
// @route   PUT /api/auth/verify-email/:verificationToken
// @access  Public
router.put('/verify-email/:verificationToken', asyncHandler(async (req, res) => {
  const { verificationToken } = req.params

  try {
    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex')

    // Find user by hashed token and check if token is not expired
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: Date.now() }
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      })
    }

    // Update email verification status
    user.isEmailVerified = true
    user.emailVerificationToken = null
    user.emailVerificationExpire = null
    await user.save()

    res.json({
      success: true,
      message: 'Email verified successfully'
    })
  } catch (error) {
    console.error('Verify email error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to verify email'
    })
  }
}))

export default router
