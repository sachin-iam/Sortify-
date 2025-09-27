// Email templates routes for quick replies and template management
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import EmailTemplate from '../models/EmailTemplate.js'

const router = express.Router()

// @desc    Get all email templates for user
// @route   GET /api/templates
// @access  Private
router.get('/', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const { category, type } = req.query

    let filter = { userId }
    
    if (category && category !== 'All') {
      filter.category = category
    }
    
    if (type) {
      filter.type = type
    }

    const templates = await EmailTemplate.find(filter)
      .sort({ createdAt: -1 })
      .select('-userId')

    res.json({
      success: true,
      templates,
      count: templates.length
    })

  } catch (error) {
    console.error('Get templates error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email templates',
      error: error.message
    })
  }
}))

// @desc    Get single email template
// @route   GET /api/templates/:id
// @access  Private
router.get('/:id', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id

    const template = await EmailTemplate.findOne({ _id: id, userId })

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      })
    }

    res.json({
      success: true,
      template
    })

  } catch (error) {
    console.error('Get template error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template',
      error: error.message
    })
  }
}))

// @desc    Create new email template
// @route   POST /api/templates
// @access  Private
router.post('/', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const { name, subject, body, category, type, variables, isDefault } = req.body

    // Validate required fields
    if (!name || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'Name, subject, and body are required'
      })
    }

    // Check for duplicate name
    const existingTemplate = await EmailTemplate.findOne({ 
      name, 
      userId 
    })

    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Template with this name already exists'
      })
    }

    const template = await EmailTemplate.create({
      userId,
      name,
      subject,
      body,
      category: category || 'General',
      type: type || 'reply',
      variables: variables || [],
      isDefault: isDefault || false,
      usageCount: 0
    })

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      template
    })

  } catch (error) {
    console.error('Create template error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create template',
      error: error.message
    })
  }
}))

// @desc    Update email template
// @route   PUT /api/templates/:id
// @access  Private
router.put('/:id', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id
    const updateData = req.body

    // Remove fields that shouldn't be updated
    delete updateData._id
    delete updateData.userId
    delete updateData.createdAt
    delete updateData.usageCount

    const template = await EmailTemplate.findOneAndUpdate(
      { _id: id, userId },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    )

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      })
    }

    res.json({
      success: true,
      message: 'Template updated successfully',
      template
    })

  } catch (error) {
    console.error('Update template error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update template',
      error: error.message
    })
  }
}))

// @desc    Delete email template
// @route   DELETE /api/templates/:id
// @access  Private
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id

    const template = await EmailTemplate.findOneAndDelete({ _id: id, userId })

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      })
    }

    res.json({
      success: true,
      message: 'Template deleted successfully'
    })

  } catch (error) {
    console.error('Delete template error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete template',
      error: error.message
    })
  }
}))

// @desc    Use template (increment usage count)
// @route   POST /api/templates/:id/use
// @access  Private
router.post('/:id/use', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id
    const { variables } = req.body

    const template = await EmailTemplate.findOne({ _id: id, userId })

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      })
    }

    // Increment usage count
    template.usageCount += 1
    template.lastUsedAt = new Date()
    await template.save()

    // Process template with variables
    let processedSubject = template.subject
    let processedBody = template.body

    if (variables && typeof variables === 'object') {
      Object.keys(variables).forEach(key => {
        const placeholder = `{{${key}}}`
        const value = variables[key] || ''
        processedSubject = processedSubject.replace(new RegExp(placeholder, 'g'), value)
        processedBody = processedBody.replace(new RegExp(placeholder, 'g'), value)
      })
    }

    res.json({
      success: true,
      message: 'Template used successfully',
      template: {
        ...template.toObject(),
        processedSubject,
        processedBody
      }
    })

  } catch (error) {
    console.error('Use template error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to use template',
      error: error.message
    })
  }
}))

// @desc    Get template categories
// @route   GET /api/templates/categories
// @access  Private
router.get('/categories', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id

    const categories = await EmailTemplate.aggregate([
      { $match: { userId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])

    res.json({
      success: true,
      categories: categories.map(cat => ({
        name: cat._id,
        count: cat.count
      }))
    })

  } catch (error) {
    console.error('Get template categories error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template categories',
      error: error.message
    })
  }
}))

// @desc    Get template statistics
// @route   GET /api/templates/stats
// @access  Private
router.get('/stats', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id

    const stats = await EmailTemplate.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalTemplates: { $sum: 1 },
          totalUsage: { $sum: '$usageCount' },
          mostUsed: { $max: '$usageCount' },
          categories: { $addToSet: '$category' }
        }
      }
    ])

    const mostUsedTemplate = await EmailTemplate.findOne({ userId })
      .sort({ usageCount: -1 })
      .select('name usageCount')

    const result = stats[0] || {
      totalTemplates: 0,
      totalUsage: 0,
      mostUsed: 0,
      categories: []
    }

    res.json({
      success: true,
      stats: {
        ...result,
        mostUsedTemplate: mostUsedTemplate || null,
        categoryCount: result.categories.length
      }
    })

  } catch (error) {
    console.error('Get template stats error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template statistics',
      error: error.message
    })
  }
}))

// @desc    Duplicate template
// @route   POST /api/templates/:id/duplicate
// @access  Private
router.post('/:id/duplicate', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id
    const { newName } = req.body

    const originalTemplate = await EmailTemplate.findOne({ _id: id, userId })

    if (!originalTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      })
    }

    // Create duplicate with new name
    const duplicateTemplate = await EmailTemplate.create({
      userId,
      name: newName || `${originalTemplate.name} (Copy)`,
      subject: originalTemplate.subject,
      body: originalTemplate.body,
      category: originalTemplate.category,
      type: originalTemplate.type,
      variables: originalTemplate.variables,
      isDefault: false,
      usageCount: 0
    })

    res.status(201).json({
      success: true,
      message: 'Template duplicated successfully',
      template: duplicateTemplate
    })

  } catch (error) {
    console.error('Duplicate template error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate template',
      error: error.message
    })
  }
}))

export default router
