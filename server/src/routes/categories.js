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
import Category from '../models/Category.js'
import { classifyEmail } from '../services/classificationService.js'
import notificationService from '../services/notificationService.js'
import { extractPatternsForCategory } from '../services/patternExtractionService.js'
import { startReclassificationJob } from '../services/emailReclassificationService.js'
import mlCategorySync, { syncCategoryToML, trainCategoryInML, removeCategoryFromML } from '../services/mlCategorySync.js'
import { processNewCategoryWithFeatures, estimateReclassificationTime } from '../services/categoryFeatureService.js'
import { schedulePhase2AfterPhase1 } from '../services/backgroundJobScheduler.js'
import { clearAnalyticsCache } from './analytics.js'

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
    
    // Check if category already exists
    const existingCategory = await findCategoryByName(userId, categoryName)
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      })
    }

    console.log(`🚀 Creating category "${categoryName}"`)

    // Create the category first (this is the critical path)
    let savedCategory = await serviceAddCategory(userId, {
      name: categoryName,
      description: description || `Custom category: ${categoryName}`,
      trainingStatus: 'pending'
    })

    console.log(`✅ Category "${categoryName}" created successfully`)

    // Try ML feature extraction (optional, non-blocking)
    let mlEnhanced = false
    let mlSyncSuccess = false
    try {
      console.log(`🤖 Attempting ML feature extraction for "${categoryName}"...`)
      const result = await processNewCategoryWithFeatures(userId, {
        name: categoryName,
        description,
        userId
      })

      if (result.success && result.patterns) {
        // Update category with ML features
        const updatedCategory = await serviceUpdateCategory(userId, savedCategory.id, {
          classificationStrategy: result.patterns.classificationStrategy,
          patterns: result.patterns.patterns,
          trainingStatus: 'completed'
        })
        
        if (updatedCategory) {
          savedCategory = updatedCategory
          mlEnhanced = true
          mlSyncSuccess = true
          console.log(`✅ ML features added to "${categoryName}"`)
        }
      }
    } catch (mlError) {
      console.warn(`⚠️ ML feature extraction failed for "${categoryName}":`, mlError.message)
      // Try basic ML sync instead
      try {
        console.log(`🔄 Attempting basic ML sync for "${categoryName}"...`)
        mlSyncSuccess = await syncCategoryToML(savedCategory)
        if (mlSyncSuccess) {
          console.log(`✅ Basic ML sync successful for "${categoryName}"`)
        }
      } catch (syncError) {
        console.warn(`⚠️ Basic ML sync also failed for "${categoryName}":`, syncError.message)
      }
    }

    // Wait a moment for ML service to fully process the category
    if (mlSyncSuccess) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Start two-phase reclassification for all emails with new category
    let reclassificationResult = null
    let timeEstimate = { emailCount: 0, estimatedSeconds: 0, estimatedMinutes: 0 }
    
    try {
      timeEstimate = await estimateReclassificationTime(userId.toString())
      
      console.log(`🔄 Starting two-phase reclassification for new category "${categoryName}"`)
      
      // Import two-phase orchestrator
      const { reclassifyAllEmailsTwoPhase } = await import('../services/twoPhaseReclassificationService.js')
      
      // Start two-phase reclassification asynchronously
      reclassifyAllEmailsTwoPhase(userId.toString(), categoryName)
        .then(result => {
          console.log(`✅ Two-phase reclassification completed for category "${categoryName}":`, result)
          
          // Clear analytics cache
          clearAnalyticsCache(userId.toString())
          
          // Send WebSocket update about completion
          sendCategoryUpdate(userId.toString(), {
            type: 'category_reclassification_complete',
            categoryName: categoryName,
            phase1Results: result.phase1,
            phase2Queued: result.phase2.queued,
            message: `Category "${categoryName}" created. Phase 1: ${result.phase1.updated} emails classified. Phase 2: ${result.phase2.queued} queued for refinement.`
          })
        })
        .catch(error => {
          console.error(`❌ Two-phase reclassification failed for "${categoryName}":`, error)
        })
      
      console.log(`✅ Two-phase reclassification initiated for "${categoryName}"`)
      
    } catch (reclassifyError) {
      console.warn(`⚠️ Reclassification failed to start:`, reclassifyError.message)
      // Continue - category is created, reclassification can be done manually
    }

    // Send WebSocket update
    try {
      sendCategoryUpdate(req.user._id.toString(), {
        type: 'category_created',
        category: savedCategory,
        estimatedTime: timeEstimate,
        mlEnhanced,
        message: mlEnhanced 
          ? `Category "${categoryName}" created with ML features. Two-phase reclassification started.`
          : `Category "${categoryName}" created. Two-phase reclassification started.`
      })
    } catch (wsError) {
      console.warn(`⚠️ WebSocket notification failed:`, wsError.message)
    }

    // Send notification (non-critical)
    try {
      await notificationService.sendCategoryNotification(req.user._id.toString(), {
        operation: 'added',
        message: mlEnhanced
          ? `New category "${savedCategory.name}" has been added with ML features. Two-phase reclassification started.`
          : `New category "${savedCategory.name}" has been added. Two-phase reclassification started.`,
        categoryName: savedCategory.name,
        categoryId: savedCategory.id
      })
    } catch (notifError) {
      console.warn('⚠️ Notification failed:', notifError.message)
    }

    // Clear analytics cache to ensure dashboard updates
    clearAnalyticsCache(userId.toString())

    // Return success response
    const responseData = {
      success: true,
      message: mlEnhanced 
        ? 'Category created with ML features. Two-phase reclassification started.'
        : 'Category created successfully. Two-phase reclassification started.',
      category: savedCategory,
      reclassification: {
        started: true,
        estimatedSeconds: timeEstimate.estimatedSeconds,
        estimatedMinutes: timeEstimate.estimatedMinutes,
        totalEmails: timeEstimate.emailCount,
        message: 'Phase 1 results will appear immediately, Phase 2 refines in background'
      }
    }

    res.status(201).json(responseData)

  } catch (error) {
    console.error(`❌ Category creation error:`, error)
    console.error(`❌ Error stack:`, error.stack)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create category',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}))

// @desc    Update category
// @route   PUT /api/realtime/categories/:id
// @access  Private
router.put('/categories/:id', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, keywords, classificationStrategy } = req.body

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

    // Prepare update data
    const updateData = {
      name: name.trim(),
      description: description || existingCategoryById.description
    }
    
    // Add optional parameters if provided
    if (keywords !== undefined) {
      updateData.keywords = keywords
    }
    if (classificationStrategy !== undefined) {
      updateData.classificationStrategy = classificationStrategy
    }

    // Update category using service
    const updatedCategory = await serviceUpdateCategory(userId, id, updateData)

    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    // Add ML rebuild trigger after successful category update
    if (keywords || classificationStrategy) {
      console.log(`🔄 Category strategy updated, triggering ML rebuild...`)
      
      // Trigger ML service rebuild
      try {
        const rebuildResult = await processNewCategoryWithFeatures(
          userId,
          { ...existingCategoryById, ...updateData }
        )
        
        // Start reclassification
        await startReclassificationJob(
          userId.toString(),
          updatedCategory.name,
          updatedCategory.id
        )
        
        console.log(`✅ ML rebuild triggered for "${updatedCategory.name}"`)
      } catch (rebuildError) {
        console.error(`⚠️ ML rebuild failed:`, rebuildError)
        // Don't fail the update, just log it
      }
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

    // Clear analytics cache to ensure dashboard updates
    clearAnalyticsCache(userId.toString())

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

    // Remove category from ML service first
    try {
      console.log(`🔄 Removing category "${existingCategory.name}" from ML service...`)
      await removeCategoryFromML(existingCategory.name)
      console.log(`✅ Category "${existingCategory.name}" removed from ML service`)
    } catch (mlError) {
      console.warn(`⚠️ Failed to remove category "${existingCategory.name}" from ML service:`, mlError.message)
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

    // Clear analytics cache to ensure dashboard updates
    clearAnalyticsCache(userId.toString())

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

// @desc    Get category templates
// @route   GET /api/realtime/categories/templates
// @access  Private
router.get('/categories/templates', protect, asyncHandler(async (req, res) => {
  try {
    // Fetch templates from ML service
    const ML_SERVICE_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'
    const response = await fetch(`${ML_SERVICE_BASE_URL}/categories/templates`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch templates from ML service')
    }
    
    const templates = await response.json()
    
    res.json({
      success: true,
      templates: templates.templates || {},
      metadata: templates.metadata || {}
    })
  } catch (error) {
    console.error('Get templates error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get category templates',
      error: error.message
    })
  }
}))

// @desc    Create category from template
// @route   POST /api/realtime/categories/from-template/:templateName
// @access  Private
router.post('/categories/from-template/:templateName', protect, asyncHandler(async (req, res) => {
  try {
    const { templateName } = req.params
    const userId = req.user._id

    // Fetch template from ML service
    const ML_SERVICE_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'
    const response = await fetch(`${ML_SERVICE_BASE_URL}/categories/templates`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch templates from ML service')
    }
    
    const templatesData = await response.json()
    const template = templatesData.templates[templateName]
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      })
    }

    // Check if category already exists
    const existingCategory = await findCategoryByName(userId, template.name)
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      })
    }

    // Create category from template
    const category = await Category.createFromTemplate(userId, templateName, template)

    // Sync to ML service
    try {
      await mlCategorySync.syncCategoryToML(category)
    } catch (mlError) {
      console.warn('Failed to sync category to ML service:', mlError.message)
    }

    // Start reclassification job
    const reclassificationJob = await startReclassificationJob(
      userId.toString(),
      category.name,
      category._id.toString()
    )

    // Send WebSocket update
    sendCategoryUpdate(req.user._id.toString(), {
      type: 'category_created',
      category: category,
      reclassificationJobId: reclassificationJob._id,
      message: `Category "${category.name}" created from template. Reclassification started.`
    })

    res.status(201).json({
      success: true,
      message: 'Category created from template',
      category: category,
      reclassificationJob: {
        id: reclassificationJob._id,
        status: reclassificationJob.status
      }
    })

  } catch (error) {
    console.error('Create category from template error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create category from template',
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

// @desc    Debug: Test classification for category
// @route   POST /api/realtime/categories/debug/classify
// @access  Private
router.post('/categories/debug/classify', protect, asyncHandler(async (req, res) => {
  try {
    const { subject, snippet, body } = req.body
    const userId = req.user._id

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required for testing'
      })
    }

    console.log(`🔍 DEBUG: Testing classification for user ${userId}`)
    console.log(`📧 Subject: "${subject}"`)

    // Test classification
    const classification = await classifyEmail(
      subject || '',
      snippet || '',
      body || '',
      userId.toString()
    )

    console.log(`📊 DEBUG Result: ${classification.label} (${classification.confidence})`)

    // Get user's categories for comparison
    const userCategories = await getCategories(userId)
    const categoryNames = userCategories.map(cat => cat.name)

    res.json({
      success: true,
      test: {
        input: { subject, snippet, body },
        result: classification,
        userCategories: categoryNames,
        hasNPTEL: categoryNames.includes('NPTEL')
      }
    })

  } catch (error) {
    console.error('Debug classification error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to test classification',
      error: error.message
    })
  }
}))

// @desc    Debug: Trigger manual reclassification for testing
// @route   POST /api/realtime/categories/debug/reclassify
// @access  Private
router.post('/categories/debug/reclassify', protect, asyncHandler(async (req, res) => {
  try {
    const { categoryName } = req.body
    const userId = req.user._id

    if (!categoryName) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      })
    }

    // Find the category
    const category = await Category.findOne({
      userId,
      name: categoryName
    })

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    console.log(`🔍 DEBUG: Starting manual reclassification for category "${categoryName}"`)

    // Start reclassification job
    const reclassificationJob = await startReclassificationJob(
      userId.toString(),
      categoryName,
      category._id.toString()
    )

    res.json({
      success: true,
      message: `Manual reclassification started for category "${categoryName}"`,
      jobId: reclassificationJob._id
    })

  } catch (error) {
    console.error('Debug reclassification error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to start reclassification',
      error: error.message
    })
  }
}))

// @desc    Get refinement status (Phase 2)
// @route   GET /api/realtime/categories/refinement-status
// @access  Private
router.get('/categories/refinement-status', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    
    // Import dynamically to avoid circular dependency
    const { getRefinementStatus } = await import('../services/backgroundRefinementService.js')
    
    const status = await getRefinementStatus(userId.toString())

    res.json({
      success: true,
      status
    })

  } catch (error) {
    console.error('Get refinement status error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get refinement status',
      error: error.message
    })
  }
}))

// @desc    Get refinement statistics (Phase 2)
// @route   GET /api/realtime/categories/refinement-stats
// @access  Private
router.get('/categories/refinement-stats', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    
    // Import dynamically to avoid circular dependency
    const { getRefinementStats } = await import('../services/backgroundRefinementService.js')
    
    const stats = await getRefinementStats(userId.toString())

    res.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Get refinement stats error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get refinement statistics',
      error: error.message
    })
  }
}))

// @desc    Trigger Phase 2 refinement manually
// @route   POST /api/realtime/categories/trigger-refinement
// @access  Private
router.post('/categories/trigger-refinement', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    
    // Import dynamically to avoid circular dependency
    const { startBackgroundRefinement } = await import('../services/backgroundRefinementService.js')
    
    const jobId = await startBackgroundRefinement(userId.toString())

    res.json({
      success: true,
      message: 'Phase 2 refinement started',
      jobId
    })

  } catch (error) {
    console.error('Trigger refinement error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to start refinement',
      error: error.message
    })
  }
}))

// @desc    Stop Phase 2 refinement
// @route   POST /api/realtime/categories/stop-refinement
// @access  Private
router.post('/categories/stop-refinement', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    
    // Import dynamically to avoid circular dependency
    const { stopBackgroundRefinement } = await import('../services/backgroundRefinementService.js')
    
    const success = stopBackgroundRefinement(userId.toString())

    res.json({
      success,
      message: success ? 'Refinement stopped' : 'No active refinement found'
    })

  } catch (error) {
    console.error('Stop refinement error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to stop refinement',
      error: error.message
    })
  }
}))

// @desc    Reset refinement status (for testing)
// @route   POST /api/realtime/categories/reset-refinement
// @access  Private
router.post('/categories/reset-refinement', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    
    // Import dynamically to avoid circular dependency
    const { resetRefinementStatus } = await import('../services/backgroundRefinementService.js')
    
    const count = await resetRefinementStatus(userId.toString())

    res.json({
      success: true,
      message: `Reset refinement status for ${count} emails`,
      count
    })

  } catch (error) {
    console.error('Reset refinement error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to reset refinement status',
      error: error.message
    })
  }
}))

export default router
