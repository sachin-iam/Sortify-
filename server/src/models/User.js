import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

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

export default mongoose.model('User', userSchema)
