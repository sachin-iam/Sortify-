// Category management routes
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { sendCategoryUpdate } from '../services/websocketService.js'
import { 
  getCategories, 
  getCategoryCount, 
  addCategory as serviceAddCategory, 
  updateCategory as serviceUpdateCategory, 
  deleteCategory as serviceDeleteCategory,
  findCategoryById,
  findCategoryByName
} from '../services/categoryService.js'
import Email from '../models/Email.js'
import { classifyEmail } from '../services/classificationService.js'
import notificationService from '../services/notificationService.js'

const router = express.Router()

// @desc    Get all categories
// @route   GET /api/realtime/categories
// @access  Private
router.get('/categories', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const categories = await getCategories(userId)
    res.json({
      success: true,
      categories
    })
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get categories',
      error: error.message
    })
  }
}))

// @desc    Add new category
// @route   POST /api/realtime/categories
// @access  Private
router.post('/categories', protect, asyncHandler(async (req, res) => {
  try {
    const { name, description } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      })
    }

    // Check if category already exists
    const categoryName = name.trim()
    
    // Validate category name (no special characters, reasonable length)
    if (categoryName.length < 2 || categoryName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Category name must be between 2 and 50 characters'
      })
    }
    
    // Check for invalid characters
    if (!/^[a-zA-Z0-9\s-_]+$/.test(categoryName)) {
      return res.status(400).json({
        success: false,
        message: 'Category name can only contain letters, numbers, spaces, hyphens, and underscores'
      })
    }
    
    const userId = req.user._id
    const existingCategory = await findCategoryByName(userId, categoryName)

    if (existingCategory) {
      console.log(`❌ Category "${categoryName}" already exists:`, existingCategory)
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      })
    }

    // Create new category using service
    const newCategory = await serviceAddCategory(userId, { name: name.trim(), description })

    // Reclassify all emails when a new category is added
    try {
      console.log(`🔄 Reclassifying emails for new category: ${newCategory.name}`)
      
      // Get all emails for this user that need reclassification
      const emails = await Email.find({ userId: req.user._id })
        .select('_id subject snippet body text category')
        .limit(1000) // Limit to prevent overwhelming the system
      
      let reclassifiedCount = 0
      
      for (const email of emails) {
        try {
          const classification = await classifyEmail(
            email.subject || '',
            email.snippet || '',
            email.body || email.text || ''
          )
          
          // Only update if classification is different
          if (classification.label !== email.category) {
            await Email.findByIdAndUpdate(email._id, {
              category: classification.label,
              classification: {
                label: classification.label,
                confidence: classification.confidence,
                modelVersion: '2.1.0',
                classifiedAt: new Date(),
                reason: 'Reclassified due to new category added'
              },
              updatedAt: new Date()
            })
            reclassifiedCount++
          }
        } catch (error) {
          console.error(`❌ Error reclassifying email ${email._id}:`, error.message)
        }
      }
      
      console.log(`✅ Reclassified ${reclassifiedCount} emails due to new category`)
    } catch (error) {
      console.error('❌ Error during email reclassification:', error)
      // Don't fail the category creation if reclassification fails
    }

    // Send WebSocket update
    sendCategoryUpdate(req.user._id.toString(), {
      type: 'category_added',
      category: newCategory
    })

    // Send notification
    try {
      await notificationService.sendCategoryNotification(req.user._id.toString(), {
        operation: 'added',
        message: `New category "${newCategory.name}" has been added. All emails have been reclassified.`,
        categoryName: newCategory.name,
        categoryId: newCategory.id
      })
    } catch (error) {
      console.error('Error sending category notification:', error)
    }

    res.status(201).json({
      success: true,
      message: 'Category added successfully',
      category: newCategory
    })

  } catch (error) {
    console.error('Add category error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to add category',
      error: error.message
    })
  }
}))

// @desc    Update category
// @route   PUT /api/realtime/categories/:id
// @access  Private
router.put('/categories/:id', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const { name, description } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      })
    }

    const userId = req.user._id
    const existingCategoryById = await findCategoryById(userId, id)
    
    if (!existingCategoryById) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    // Check if new name conflicts with existing category
    const existingCategoryByName = await findCategoryByName(userId, name.trim())
    if (existingCategoryByName && existingCategoryByName.id !== id) {
      return res.status(400).json({
        success: false,
        message: 'Category name already exists'
      })
    }

    // Update category using service
    const updatedCategory = await serviceUpdateCategory(userId, id, {
      name: name.trim(),
      description: description || existingCategoryById.description
    })

    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    // Send WebSocket update
    sendCategoryUpdate(req.user._id.toString(), {
      type: 'category_updated',
      category: updatedCategory
    })

    // Send notification
    try {
      await notificationService.sendCategoryNotification(req.user._id.toString(), {
        operation: 'updated',
        message: `Category "${existingCategoryById.name}" has been updated to "${updatedCategory.name}".`,
        categoryName: updatedCategory.name,
        categoryId: updatedCategory.id
      })
    } catch (error) {
      console.error('Error sending category notification:', error)
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      category: updatedCategory
    })

  } catch (error) {
    console.error('Update category error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    })
  }
}))

// @desc    Delete category
// @route   DELETE /api/realtime/categories/:id
// @access  Private
router.delete('/categories/:id', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params

    const userId = req.user._id
    const existingCategory = await findCategoryById(userId, id)
    
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    // The service will handle the deletion logic including moving emails to "Other"
    const deletedCategory = await serviceDeleteCategory(userId, id)

    // Send WebSocket update
    sendCategoryUpdate(req.user._id.toString(), {
      type: 'category_deleted',
      category: deletedCategory
    })

    // Send notification
    try {
      await notificationService.sendCategoryNotification(req.user._id.toString(), {
        operation: 'deleted',
        message: `Category "${deletedCategory.name}" has been deleted. All emails in this category have been moved to "Other".`,
        categoryName: deletedCategory.name,
        categoryId: deletedCategory.id
      })
    } catch (error) {
      console.error('Error sending category notification:', error)
    }

    res.json({
      success: true,
      message: 'Category deleted successfully',
      category: deletedCategory
    })

  } catch (error) {
    console.error('Delete category error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    })
  }
}))

// @desc    Get category statistics
// @route   GET /api/realtime/categories/stats
// @access  Private
router.get('/categories/stats', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const categories = await getCategories(userId)

    res.json({
      success: true,
      stats: categories
    })

  } catch (error) {
    console.error('Get category stats error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get category statistics',
      error: error.message
    })
  }
}))

export default router
