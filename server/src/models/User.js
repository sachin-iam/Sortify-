import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  avatar: {
    type: String,
    default: null
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailPreferences: {
    notifications: {
      type: Boolean,
      default: true
    },
    marketing: {
      type: Boolean,
      default: false
    }
  },
  // Google OAuth
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  gmailConnected: {
    type: Boolean,
    default: false
  },
  gmailAccessToken: {
    type: String,
    default: null
  },
  gmailRefreshToken: {
    type: String,
    default: null
  },
  gmailTokenExpiry: {
    type: Date,
    default: null
  },
  gmailName: {
    type: String,
    default: null
  },
  // Microsoft OAuth
  microsoftId: {
    type: String,
    sparse: true,
    unique: true
  },
  outlookConnected: {
    type: Boolean,
    default: false
  },
  outlookAccessToken: {
    type: String,
    default: null
  },
  outlookRefreshToken: {
    type: String,
    default: null
  },
  outlookTokenExpiry: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  // Password reset
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpire: {
    type: Date,
    default: null
  },
  // Email verification
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpire: {
    type: Date,
    default: null
  },
  feedbackStats: {
    correctionsCount: {
      type: Number,
      default: 0
    },
    lastFeedbackAt: {
      type: Date,
      default: null
    },
    averageConfidence: {
      type: Number,
      default: 0.0
    },
    openCount: {
      type: Number,
      default: 0
    },
    replyCount: {
      type: Number,
      default: 0
    },
    deleteCount: {
      type: Number,
      default: 0
    },
    archiveCount: {
      type: Number,
      default: 0
    },
    unsubscribeCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
})

// Index for better performance
userSchema.index({ email: 1 })
userSchema.index({ googleId: 1 })
userSchema.index({ microsoftId: 1 })

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next()
  }

  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

// Create user from Google OAuth
userSchema.statics.createFromGoogle = function(googleData) {
  return this.create({
    name: googleData.name,
    email: googleData.email,
    avatar: googleData.picture,
    googleId: googleData.id,
    isEmailVerified: true,
    password: 'google-oauth-user' // Dummy password for OAuth users
  })
}

// Create user from Microsoft OAuth
userSchema.statics.createFromMicrosoft = function(microsoftData) {
  return this.create({
    name: microsoftData.displayName,
    email: microsoftData.mail || microsoftData.userPrincipalName,
    avatar: microsoftData.photo,
    microsoftId: microsoftData.id,
    isEmailVerified: true,
    password: 'microsoft-oauth-user' // Dummy password for OAuth users
  })
}

// Update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date()
  return this.save()
}

// Generate password reset token
userSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex')

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex')

  // Set expire (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000

  return resetToken
}

// Generate email verification token
userSchema.methods.getEmailVerificationToken = function() {
  // Generate token
  const verificationToken = crypto.randomBytes(20).toString('hex')

  // Hash token and set to emailVerificationToken field
  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex')

  // Set expire (24 hours)
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000

  return verificationToken
}

export default mongoose.model('User', userSchema)
