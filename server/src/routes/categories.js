// Category management routes
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { sendCategoryUpdate } from '../services/websocketService.js'

const router = express.Router()

// Mock categories data (in production, this would come from ML service)
let categories = [
  { id: '1', name: 'Academic', count: 0, description: 'Educational and academic emails' },
  { id: '2', name: 'Promotions', count: 0, description: 'Marketing and promotional emails' },
  { id: '3', name: 'Placement', count: 0, description: 'Job and career related emails' },
  { id: '4', name: 'Spam', count: 0, description: 'Spam and unwanted emails' },
  { id: '5', name: 'Other', count: 0, description: 'Miscellaneous emails' }
]

// @desc    Get all categories
// @route   GET /api/realtime/categories
// @access  Private
router.get('/categories', protect, asyncHandler(async (req, res) => {
  try {
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
    const existingCategory = categories.find(cat => 
      cat.name.toLowerCase() === name.toLowerCase().trim()
    )

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      })
    }

    // Create new category
    const newCategory = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description || `Custom category: ${name.trim()}`,
      count: 0,
      createdAt: new Date().toISOString()
    }

    categories.push(newCategory)

    // Send WebSocket update
    sendCategoryUpdate(req.user._id.toString(), {
      type: 'category_added',
      category: newCategory
    })

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

    const categoryIndex = categories.findIndex(cat => cat.id === id)
    
    if (categoryIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    // Check if new name conflicts with existing category
    const existingCategory = categories.find(cat => 
      cat.id !== id && cat.name.toLowerCase() === name.toLowerCase().trim()
    )

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category name already exists'
      })
    }

    // Update category
    const updatedCategory = {
      ...categories[categoryIndex],
      name: name.trim(),
      description: description || categories[categoryIndex].description,
      updatedAt: new Date().toISOString()
    }

    categories[categoryIndex] = updatedCategory

    // Send WebSocket update
    sendCategoryUpdate(req.user._id.toString(), {
      type: 'category_updated',
      category: updatedCategory
    })

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

    const categoryIndex = categories.findIndex(cat => cat.id === id)
    
    if (categoryIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    // Check if it's a default category (prevent deletion)
    const defaultCategories = ['Academic', 'Promotions', 'Placement', 'Spam', 'Other']
    if (defaultCategories.includes(categories[categoryIndex].name)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default categories'
      })
    }

    const deletedCategory = categories[categoryIndex]
    categories.splice(categoryIndex, 1)

    // Send WebSocket update
    sendCategoryUpdate(req.user._id.toString(), {
      type: 'category_deleted',
      category: deletedCategory
    })

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
    // In production, this would query the database for actual counts
    const stats = categories.map(category => ({
      ...category,
      count: Math.floor(Math.random() * 100) // Mock count
    }))

    res.json({
      success: true,
      stats
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
