import mongoose from 'mongoose'

const emailTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },
  subject: {
    type: String,
    required: [true, 'Template subject is required'],
    trim: true,
    maxlength: [200, 'Template subject cannot exceed 200 characters']
  },
  body: {
    type: String,
    required: [true, 'Template body is required'],
    trim: true,
    maxlength: [10000, 'Template body cannot exceed 10000 characters']
  },
  category: {
    type: String,
    required: true,
    enum: ['General', 'Academic', 'Promotions', 'Placement', 'Spam', 'Other'],
    default: 'General'
  },
  type: {
    type: String,
    required: true,
    enum: ['reply', 'forward', 'compose', 'auto'],
    default: 'reply'
  },
  variables: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    defaultValue: {
      type: String,
      default: ''
    }
  }],
  isDefault: {
    type: Boolean,
    default: false
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUsedAt: {
    type: Date
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  }
}, {
  timestamps: true
})

// Indexes for better performance
emailTemplateSchema.index({ userId: 1, category: 1 })
emailTemplateSchema.index({ userId: 1, type: 1 })
emailTemplateSchema.index({ userId: 1, usageCount: -1 })
emailTemplateSchema.index({ userId: 1, lastUsedAt: -1 })
emailTemplateSchema.index({ userId: 1, name: 1 })

// Ensure unique template names per user
emailTemplateSchema.index({ userId: 1, name: 1 }, { unique: true })

// Virtual for template preview (first 100 characters of body)
emailTemplateSchema.virtual('preview').get(function() {
  return this.body.length > 100 ? this.body.substring(0, 100) + '...' : this.body
})

// Method to process template with variables
emailTemplateSchema.methods.processTemplate = function(variables = {}) {
  let processedSubject = this.subject
  let processedBody = this.body

  Object.keys(variables).forEach(key => {
    const placeholder = `{{${key}}}`
    const value = variables[key] || ''
    processedSubject = processedSubject.replace(new RegExp(placeholder, 'g'), value)
    processedBody = processedBody.replace(new RegExp(placeholder, 'g'), value)
  })

  return {
    subject: processedSubject,
    body: processedBody
  }
}

// Method to extract variables from template
emailTemplateSchema.methods.extractVariables = function() {
  const subjectVars = (this.subject.match(/\{\{(\w+)\}\}/g) || [])
    .map(match => match.replace(/\{\{|\}\}/g, ''))
  
  const bodyVars = (this.body.match(/\{\{(\w+)\}\}/g) || [])
    .map(match => match.replace(/\{\{|\}\}/g, ''))
  
  return [...new Set([...subjectVars, ...bodyVars])]
}

// Static method to get popular templates
emailTemplateSchema.statics.getPopularTemplates = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ usageCount: -1, lastUsedAt: -1 })
    .limit(limit)
}

// Static method to get templates by category
emailTemplateSchema.statics.getTemplatesByCategory = function(userId, category) {
  return this.find({ userId, category })
    .sort({ usageCount: -1, name: 1 })
}

// Static method to search templates
emailTemplateSchema.statics.searchTemplates = function(userId, query) {
  const searchRegex = new RegExp(query, 'i')
  return this.find({
    userId,
    $or: [
      { name: searchRegex },
      { subject: searchRegex },
      { body: searchRegex },
      { tags: { $in: [searchRegex] } }
    ]
  }).sort({ usageCount: -1, name: 1 })
}

// Pre-save middleware to update variables array
emailTemplateSchema.pre('save', function(next) {
  if (this.isModified('subject') || this.isModified('body')) {
    const extractedVars = this.extractVariables()
    const existingVars = this.variables.map(v => v.name)
    
    // Add new variables
    extractedVars.forEach(varName => {
      if (!existingVars.includes(varName)) {
        this.variables.push({
          name: varName,
          description: `Variable: ${varName}`,
          defaultValue: ''
        })
      }
    })
  }
  next()
})

// Transform JSON output
emailTemplateSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id
    delete ret.__v
    return ret
  }
})

const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema)

export default EmailTemplate
