import mongoose from 'mongoose'

const emailSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: String,
    enum: ['gmail', 'outlook'],
    default: 'gmail'
  },
  gmailId: {
    type: String,
    required: false
  },
  messageId: {
    type: String,
    required: false
  },
  threadId: String,
  subject: {
    type: String,
    required: true
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  snippet: String,
  html: String,
  text: String,
  body: String, // Keep for backward compatibility
  isRead: {
    type: Boolean,
    default: false
  },
  labels: [String],
  category: {
    type: String,
    default: 'Other',
    enum: ['Academic', 'Promotions', 'Placement', 'Spam', 'Other', 'Newsletter', 'WebSocketTestCategory']
  },
  classification: {
    label: {
      type: String,
      default: 'Other'
    },
    confidence: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1
    }
  },
  attachments: [{
    attachmentId: String,
    filename: String,
    mimeType: String,
    size: Number
  }],
  archivedAt: Date,
  isArchived: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

// Indexes for better performance
emailSchema.index({ userId: 1, provider: 1, date: -1 })
emailSchema.index({ userId: 1, provider: 1, category: 1, date: -1 })
emailSchema.index({ userId: 1, provider: 1, gmailId: 1 }, { unique: true, partialFilterExpression: { gmailId: { $exists: true } } })
emailSchema.index({ subject: 'text', snippet: 'text', body: 'text' })

// Virtual for formatted date
emailSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString()
})

// Method to mark as read
emailSchema.methods.markAsRead = function() {
  this.isRead = true
  return this.save()
}

// Method to archive
emailSchema.methods.archive = function() {
  this.isArchived = true
  return this.save()
}

// Method to delete
emailSchema.methods.softDelete = function() {
  this.isDeleted = true
  return this.save()
}

// Static method to get user's email stats
emailSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
    {
      $group: {
        _id: null,
        totalEmails: { $sum: 1 },
        unreadEmails: { $sum: { $cond: ['$isRead', 0, 1] } },
        categories: { $addToSet: '$category' }
      }
    }
  ])

  return stats[0] || { totalEmails: 0, unreadEmails: 0, categories: [] }
}

const Email = mongoose.model('Email', emailSchema)

export default Email