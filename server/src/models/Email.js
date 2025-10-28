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
  cc: String,
  bcc: String,
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
    default: 'Other'
    // Removed enum constraint to allow dynamic categories
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
    },
    phase: {
      type: Number,
      default: 1,
      enum: [1, 2]
    },
    phase1: {
      label: String,
      confidence: Number,
      classifiedAt: Date,
      method: String,
      matchedPattern: String,
      matchedValue: String,
      matchedKeywords: [String]
    },
    phase2: {
      label: String,
      confidence: Number,
      classifiedAt: Date,
      method: String,
      model: String,
      isComplete: {
        type: Boolean,
        default: false
      },
      updateReason: String,
      improvement: Number,
      result: String,
      error: String
    },
    modelVersion: {
      type: String,
      default: '2.1.0'
    },
    classifiedAt: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      default: 'Initial classification'
    },
    model: {
      type: String,
      default: 'default'
    },
    ensembleScores: {
      distilbert: {
        type: Number,
        default: 0.0
      },
      featureBased: {
        type: Number,
        default: 0.0
      },
      combined: {
        type: Number,
        default: 0.0
      }
    },
    featureContributions: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  extractedFeatures: {
    senderDomain: String,
    attachmentCount: {
      type: Number,
      default: 0
    },
    attachmentTypes: [String],
    linkCount: {
      type: Number,
      default: 0
    },
    hasExternalLinks: {
      type: Boolean,
      default: false
    },
    textLength: {
      type: Number,
      default: 0
    },
    htmlRatio: {
      type: Number,
      default: 0.0
    },
    timeOfDay: {
      type: Number,
      default: 12
    },
    recipientCount: {
      type: Number,
      default: 1
    },
    subjectLength: {
      type: Number,
      default: 0
    },
    businessKeywords: {
      type: Number,
      default: 0
    },
    academicKeywords: {
      type: Number,
      default: 0
    },
    jobKeywords: {
      type: Number,
      default: 0
    }
  },
  enhancedMetadata: {
    senderDomain: String,
    recipientCount: {
      type: Number,
      default: 0
    },
    threadMetadata: {
      inReplyTo: String,
      references: String,
      isReply: {
        type: Boolean,
        default: false
      },
      isForward: {
        type: Boolean,
        default: false
      }
    },
    headers: {
      replyTo: String,
      returnPath: String,
      messageId: String,
      userAgent: String,
      spf: String,
      dkim: String,
      dmarc: String,
      priority: String,
      importance: String,
      mimeVersion: String
    },
    urls: [String],
    urlCount: {
      type: Number,
      default: 0
    },
    hasExternalLinks: {
      type: Boolean,
      default: false
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
  },
  // Thumbnail/Lazy Loading fields
  isFullContentLoaded: {
    type: Boolean,
    default: false
  },
  fullContentLoadedAt: {
    type: Date,
    default: null
  },
  lastAccessedAt: {
    type: Date,
    default: null
  },
  // Refinement tracking fields (Phase 2)
  refinementStatus: {
    type: String,
    enum: ['pending', 'refined', 'verified'],
    default: 'pending'
  },
  refinedAt: {
    type: Date,
    default: null
  },
  refinementConfidence: {
    type: Number,
    default: 0.0,
    min: 0,
    max: 1
  },
  analysisDepth: {
    type: String,
    enum: ['basic', 'comprehensive'],
    default: 'basic'
  },
  previousCategory: {
    type: String,
    default: null
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

// Method to mark as accessed (for cleanup scheduling)
emailSchema.methods.markAsAccessed = function() {
  this.lastAccessedAt = new Date()
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