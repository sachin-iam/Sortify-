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

/**
 * Convert extracted patterns to Phase 1 compatible format
 */
const convertToPhase1Format = (extractedPatterns, categoryName) => {
  const headerAnalysis = extractedPatterns.classificationStrategy?.headerAnalysis || {}
  const bodyAnalysis = extractedPatterns.classificationStrategy?.bodyAnalysis || {}
  
  // Extract top sender domains (domains that appear frequently)
  const senderDomains = (headerAnalysis.senderDomains || [])
    .slice(0, 10)
    .map(domain => {
      // Handle both string and object formats
      if (typeof domain === 'string') return domain
      return domain.domain || domain.value || domain
    })
    .filter(d => d && d.length > 0)
  
  // Extract sender name patterns
  const senderNames = (headerAnalysis.senderPatterns || [])
    .slice(0, 10)
    .map(pattern => {
      if (typeof pattern === 'string') return pattern
      return pattern.name || pattern.pattern || pattern.value || pattern
    })
    .filter(n => n && n.length > 0)
  
  // Extract keywords from body analysis
  const keywords = bodyAnalysis.keywords || [categoryName.toLowerCase()]
  
  // Build Phase 1 compatible patterns object
  return {
    senderDomains: senderDomains.length > 0 ? senderDomains : [],
    senderNames: senderNames.length > 0 ? senderNames : [],
    keywords: keywords.length > 0 ? keywords : [categoryName.toLowerCase()],
    extractedAt: new Date(),
    source: 'direct_extraction'
  }
}

/**
 * Generate basic patterns when extraction fails
 */
const generateBasicPatterns = (categoryName) => {
  const name = categoryName.toLowerCase()
  const patterns = {
    senderDomains: [],
    senderNames: [],
    keywords: []
  }
  
  // Generate domain patterns based on category name
  if (name.includes('zone') || name.includes('e-zone') || name.includes('ezone')) {
    patterns.senderDomains.push('ezone@shardauniversity.com', 'e-zone', 'shardauniversity.com')
    patterns.senderNames.push('E-Zone', 'e-zone', 'E-Zone Online Portal')
    patterns.keywords.push('ezone', 'e-zone', 'portal', 'otp', 'login')
  }
  
  if (name.includes('nptel')) {
    patterns.senderDomains.push('nptel.ac.in', 'nptel.iitm.ac.in')
    patterns.senderNames.push('NPTEL', 'nptel', 'IIT Madras')
    patterns.keywords.push('nptel', 'course', 'assignment', 'lecture', 'certificate', 'exam')
  }
  
  if (name.includes('placement')) {
    patterns.senderDomains.push('placement', 'career', 'jobs')
    patterns.senderNames.push('Placement', 'Career', 'Placement Cell', 'Training and Placement')
    patterns.keywords.push('placement', 'job', 'interview', 'career', 'company', 'recruitment', 'hiring')
  }
  
  if (name.includes('hod')) {
    patterns.senderNames.push('HOD', 'Head of Department', 'Department Head')
    patterns.keywords.push('hod', 'department', 'head')
  }
  
  if (name.includes('promotion')) {
    patterns.senderDomains.push('promo', 'offer', 'deal')
    patterns.keywords.push('promo', 'promotion', 'offer', 'discount', 'sale', 'deal')
  }
  
  if (name.includes('happening') || name.includes('what')) {
    patterns.senderNames.push("What's Happening", "Whats Happening", "What's Happening' via")
    patterns.senderDomains.push('shardaevents.com', 'sgei.org')
    patterns.keywords.push('happening', 'events', 'announcement', 'semester', 'university')
  }
  
  // Always include the category name as a keyword
  patterns.keywords.push(categoryName.toLowerCase())
  
  return patterns
}

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
          keywords: result.patterns.classificationStrategy?.bodyAnalysis?.keywords || [],
          trainingStatus: 'completed'
        })
        
        if (updatedCategory) {
          savedCategory = updatedCategory
          mlEnhanced = true
          mlSyncSuccess = true
          console.log(`✅ ML features added to "${categoryName}"`)
        }
      } else {
        // ML succeeded but no patterns - use direct extraction
        throw new Error('ML extraction returned no patterns')
      }
    } catch (mlError) {
      console.warn(`⚠️ ML feature extraction failed for "${categoryName}":`, mlError.message)
      
      // FALLBACK: Direct pattern extraction from existing emails
      try {
        console.log(`🔄 Falling back to direct pattern extraction from existing emails...`)
        
        // Extract patterns from existing emails (analyze up to 1000 emails)
        const extractedPatterns = await extractPatternsForCategory(
          userId.toString(),
          categoryName,
          1000  // Sample size
        )
        
        if (extractedPatterns && extractedPatterns.patterns) {
          // Convert extracted patterns to Phase 1 compatible format
          const phase1Patterns = convertToPhase1Format(
            extractedPatterns,
            categoryName
          )
          
          // Update category with extracted patterns
          const updatedCategory = await serviceUpdateCategory(userId, savedCategory.id, {
            classificationStrategy: extractedPatterns.classificationStrategy,
            patterns: phase1Patterns,
            keywords: extractedPatterns.classificationStrategy?.bodyAnalysis?.keywords || 
                      [categoryName.toLowerCase()],
            trainingStatus: 'completed'
          })
          
          if (updatedCategory) {
            savedCategory = updatedCategory
            console.log(`✅ Pattern extraction successful for "${categoryName}"`)
            console.log(`   - Sender domains: ${phase1Patterns.senderDomains?.length || 0}`)
            console.log(`   - Sender names: ${phase1Patterns.senderNames?.length || 0}`)
            console.log(`   - Keywords: ${phase1Patterns.keywords?.length || 0}`)
          }
        } else {
          // Last resort: Basic patterns from category name
          const basicPatterns = generateBasicPatterns(categoryName)
          await serviceUpdateCategory(userId, savedCategory.id, {
            patterns: basicPatterns,
            keywords: [categoryName.toLowerCase(), ...basicPatterns.keywords],
            trainingStatus: 'basic'
          })
          console.log(`✅ Basic patterns created for "${categoryName}"`)
          console.log(`   - Sender domains: ${basicPatterns.senderDomains?.length || 0}`)
          console.log(`   - Sender names: ${basicPatterns.senderNames?.length || 0}`)
          console.log(`   - Keywords: ${basicPatterns.keywords?.length || 0}`)
        }
      } catch (extractError) {
        console.error(`❌ Pattern extraction also failed:`, extractError.message)
        // Category still saved, just without patterns - user can manually add patterns later
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

// @desc    Fix all existing categories by adding patterns
// @route   POST /api/realtime/categories/fix-all-patterns
// @access  Private
router.post('/categories/fix-all-patterns', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    
    console.log(`🔧 Fixing patterns for all categories for user: ${userId}`)
    
    // Get all categories without proper patterns
    const categories = await Category.find({
      userId: userId,
      isActive: true,
      $or: [
        { patterns: null },
        { patterns: { $exists: false } },
        { 'patterns.senderDomains': { $size: 0 } }
      ]
    })
    
    console.log(`📋 Found ${categories.length} categories to fix`)
    
    const results = []
    
    for (const category of categories) {
      try {
        console.log(`\n🔧 Fixing category: "${category.name}"`)
        
        // Try pattern extraction first
        let updatedData = null
        try {
          const extractedPatterns = await extractPatternsForCategory(
            userId.toString(),
            category.name,
            1000
          )
          
          if (extractedPatterns && extractedPatterns.patterns) {
            const phase1Patterns = convertToPhase1Format(extractedPatterns, category.name)
            
            updatedData = {
              patterns: phase1Patterns,
              keywords: extractedPatterns.classificationStrategy?.bodyAnalysis?.keywords || 
                        [category.name.toLowerCase()],
              classificationStrategy: extractedPatterns.classificationStrategy,
              trainingStatus: 'completed'
            }
            
            console.log(`✅ Extracted patterns: domains=${phase1Patterns.senderDomains?.length}, names=${phase1Patterns.senderNames?.length}, keywords=${phase1Patterns.keywords?.length}`)
          }
        } catch (extractError) {
          console.warn(`⚠️ Pattern extraction failed, using basic patterns`)
        }
        
        // If extraction failed, use basic patterns
        if (!updatedData) {
          const basicPatterns = generateBasicPatterns(category.name)
          updatedData = {
            patterns: basicPatterns,
            keywords: [category.name.toLowerCase(), ...basicPatterns.keywords],
            trainingStatus: 'basic'
          }
          console.log(`✅ Generated basic patterns: domains=${basicPatterns.senderDomains?.length}, names=${basicPatterns.senderNames?.length}, keywords=${basicPatterns.keywords?.length}`)
        }
        
        // Update category
        await Category.findByIdAndUpdate(category._id, updatedData)
        
        results.push({
          categoryName: category.name,
          success: true,
          patternsAdded: true,
          hasPatterns: true
        })
        
        console.log(`✅ Fixed "${category.name}"`)
        
      } catch (error) {
        console.error(`❌ Error fixing "${category.name}":`, error)
        results.push({
          categoryName: category.name,
          success: false,
          error: error.message
        })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    
    console.log(`\n✅ Pattern fix complete: ${successCount}/${categories.length} categories fixed`)
    
    // Clear analytics cache
    clearAnalyticsCache(userId.toString())
    
    res.json({
      success: true,
      message: `Fixed ${successCount} categories. Now click "Reclassify All Emails" to reclassify.`,
      categoriesFixed: successCount,
      totalCategories: categories.length,
      results: results
    })
    
  } catch (error) {
    console.error('Fix categories error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fix categories',
      error: error.message
    })
  }
}))

// @desc    Debug: Check category patterns
// @route   GET /api/realtime/categories/:id/patterns
// @access  Private
router.get('/categories/:id/patterns', protect, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id
    
    const category = await findCategoryById(userId, id)
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }
    
    res.json({
      success: true,
      category: {
        name: category.name,
        patterns: category.patterns,
        keywords: category.keywords,
        classificationStrategy: category.classificationStrategy,
        trainingStatus: category.trainingStatus
      },
      diagnostic: {
        hasPatterns: !!(category.patterns),
        hasSenderDomains: !!(category.patterns?.senderDomains?.length > 0),
        hasSenderNames: !!(category.patterns?.senderNames?.length > 0),
        hasKeywords: !!(category.keywords?.length > 0 || category.patterns?.keywords?.length > 0),
        canMatchInPhase1: !!(
          (category.patterns?.senderDomains?.length > 0) ||
          (category.patterns?.senderNames?.length > 0) ||
          (category.keywords?.length > 0)
        )
      }
    })
  } catch (error) {
    console.error('Get category patterns error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get category patterns',
      error: error.message
    })
  }
}))

export default router
