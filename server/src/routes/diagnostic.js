// Diagnostic routes for troubleshooting issues
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import Email from '../models/Email.js'
import Category from '../models/Category.js'

const router = express.Router()

// @desc    Diagnose "What's Happening" email classification issue
// @route   GET /api/diagnostic/whats-happening
// @access  Private
router.get('/whats-happening', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id

    // Step 1: Find all emails from "What's Happening" senders
    const whatsHappeningEmails = await Email.find({
      userId,
      from: { $regex: 'what.*s.?happening', $options: 'i' }
    }).select('from category subject date').lean()

    // Step 2: Analyze category distribution
    const categoryCounts = {}
    whatsHappeningEmails.forEach(email => {
      const category = email.category || 'Uncategorized'
      categoryCounts[category] = (categoryCounts[category] || 0) + 1
    })

    // Step 3: Check if "Whats happening" category exists
    const allCategories = await Category.find({ 
      userId, 
      isActive: true 
    }).select('name').lean()

    const whatsHappeningVariations = [
      'Whats happening', 
      "What's happening", 
      'Whats Happening', 
      "What's Happening", 
      'whats happening'
    ]
    
    const matchingCategories = allCategories.filter(cat => 
      whatsHappeningVariations.some(variant => 
        cat.name.toLowerCase() === variant.toLowerCase()
      )
    )

    // Step 4: Get sample emails
    const sampleEmails = whatsHappeningEmails.slice(0, 10).map(email => ({
      from: email.from,
      subject: email.subject,
      category: email.category || 'Uncategorized',
      date: email.date
    }))

    // Step 5: Determine issue and provide recommendations
    let issue = null
    let recommendations = []

    if (whatsHappeningEmails.length === 0) {
      issue = 'No emails found from "What\'s Happening" senders'
    } else if (matchingCategories.length === 0) {
      issue = 'Category "Whats happening" does not exist'
      recommendations = [
        'Create a new category called "Whats happening"',
        'Add classification patterns to match these sender domains',
        'Reclassify existing emails'
      ]
    } else if (!Object.keys(categoryCounts).some(cat => 
      whatsHappeningVariations.some(variant => cat.toLowerCase() === variant.toLowerCase())
    )) {
      issue = 'Category exists but emails are not being classified into it'
      recommendations = [
        'Update the category with better classification patterns',
        'Add sender domain patterns for batch2022-2023@ug.sharda.ac.in and ug.group@ug.sharda.ac.in',
        'Reclassify existing emails using the fix endpoint'
      ]
    }

    res.json({
      success: true,
      diagnosis: {
        totalWhatsHappeningEmails: whatsHappeningEmails.length,
        categoryCounts,
        categoryExists: matchingCategories.length > 0,
        matchingCategories: matchingCategories.map(c => c.name),
        allCategories: allCategories.map(c => c.name),
        sampleEmails,
        issue,
        recommendations
      }
    })

  } catch (error) {
    console.error('Diagnostic error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to run diagnostic',
      error: error.message
    })
  }
}))

// @desc    Fix "What's Happening" email classification issue
// @route   POST /api/diagnostic/fix-whats-happening
// @access  Private
router.post('/fix-whats-happening', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id

    console.log(`\n${'='.repeat(80)}`)
    console.log(`🔧 FIXING "WHAT'S HAPPENING" CLASSIFICATION`)
    console.log(`   User ID: ${userId}`)
    console.log(`${'='.repeat(80)}\n`)

    // Classification patterns for "What's Happening" category
    const WHATS_HAPPENING_PATTERNS = {
      senderDomains: [
        'batch2022-2023@ug.sharda.ac.in',
        'ug.group@ug.sharda.ac.in'
      ],
      senderNames: [
        "What's Happening",
        'Whats Happening'
      ],
      keywords: [
        'happening',
        'announcement',
        'campus',
        'event',
        'notice',
        'circular'
      ]
    }

    // Step 1: Create or update the "Whats happening" category
    let category = await Category.findOne({
      userId,
      name: { $regex: '^whats.?happening$', $options: 'i' }
    })

    if (category) {
      console.log(`✓ Found existing category: "${category.name}"`)
      console.log(`  Updating category with better patterns...`)
      
      category.classificationStrategy = 'enhanced-rule-based'
      category.patterns = {
        senderDomains: WHATS_HAPPENING_PATTERNS.senderDomains,
        senderNames: WHATS_HAPPENING_PATTERNS.senderNames,
        keywords: WHATS_HAPPENING_PATTERNS.keywords
      }
      category.keywords = WHATS_HAPPENING_PATTERNS.keywords
      category.description = 'University announcements, events, and campus happenings'
      
      await category.save()
      console.log(`✅ Category updated successfully`)
    } else {
      console.log(`  Creating new "Whats happening" category...`)
      
      category = await Category.create({
        userId,
        name: 'Whats happening',
        description: 'University announcements, events, and campus happenings',
        classificationStrategy: 'enhanced-rule-based',
        patterns: {
          senderDomains: WHATS_HAPPENING_PATTERNS.senderDomains,
          senderNames: WHATS_HAPPENING_PATTERNS.senderNames,
          keywords: WHATS_HAPPENING_PATTERNS.keywords
        },
        keywords: WHATS_HAPPENING_PATTERNS.keywords,
        isActive: true,
        isSystem: false,
        trainingStatus: 'completed'
      })
      
      console.log(`✅ Category created successfully`)
    }

    // Step 2: Reclassify emails from "What's Happening" senders
    console.log(`\n📝 Reclassifying emails...`)
    
    const emailsToReclassify = await Email.find({
      userId,
      from: { $regex: 'what.*s.?happening', $options: 'i' }
    })

    console.log(`   Found ${emailsToReclassify.length} emails to reclassify`)

    let reclassifiedCount = 0
    const categoryChanges = {}

    for (const email of emailsToReclassify) {
      const oldCategory = email.category || 'Uncategorized'
      
      if (!categoryChanges[oldCategory]) {
        categoryChanges[oldCategory] = 0
      }
      categoryChanges[oldCategory]++
      
      // Update email category
      email.category = 'Whats happening'
      email.classification = {
        label: 'Whats happening',
        confidence: 0.95,
        modelVersion: '2.0.0',
        classifiedAt: new Date(),
        reason: 'Manual reclassification - sender pattern match'
      }
      
      await email.save()
      reclassifiedCount++
      
      if (reclassifiedCount % 100 === 0) {
        console.log(`   Progress: ${reclassifiedCount}/${emailsToReclassify.length} emails...`)
      }
    }

    console.log(`\n✅ Reclassification complete:`)
    console.log(`   - Total reclassified: ${reclassifiedCount} emails`)
    console.log(`   - Category changes:`)
    Object.entries(categoryChanges).forEach(([cat, count]) => {
      console.log(`      ${cat} → Whats happening: ${count} emails`)
    })

    // Step 3: Clear analytics cache
    const { clearAnalyticsCache } = await import('./analytics.js')
    clearAnalyticsCache(userId.toString())

    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ FIX COMPLETE`)
    console.log(`${'='.repeat(80)}\n`)

    res.json({
      success: true,
      message: 'Successfully fixed classification issue',
      results: {
        categoryCreated: !category,
        categoryName: category.name,
        emailsReclassified: reclassifiedCount,
        categoryChanges
      }
    })

  } catch (error) {
    console.error('Fix error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fix classification issue',
      error: error.message
    })
  }
}))

// @desc    Get classification phase statistics
// @route   GET /api/diagnostic/classification-status
// @access  Private
router.get('/classification-status', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id

    // Get email phase statistics
    const stats = await Email.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalEmails: { $sum: 1 },
          phase1Only: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$classification.phase', 1] },
                    { $eq: ['$classification.phase2.isComplete', false] },
                    { $not: ['$classification.phase2.isComplete'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          phase2Complete: {
            $sum: {
              $cond: [{ $eq: ['$classification.phase2.isComplete', true] }, 1, 0]
            }
          },
          phase2Updated: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$classification.phase2.isComplete', true] },
                    { $eq: ['$classification.phase', 2] }
                  ]
                },
                1,
                0
              ]
            }
          },
          phase2NotBetter: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$classification.phase2.isComplete', true] },
                    { $eq: ['$classification.phase', 1] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ])

    const result = stats[0] || {
      totalEmails: 0,
      phase1Only: 0,
      phase2Complete: 0,
      phase2Updated: 0,
      phase2NotBetter: 0
    }

    // Get queue statistics
    const { getQueueStats } = await import('../services/classificationJobQueue.js')
    const queueStats = getQueueStats()

    // Calculate percentages
    const totalEmails = result.totalEmails
    const phase1Percentage = totalEmails > 0 ? (result.phase1Only / totalEmails) * 100 : 0
    const phase2Percentage = totalEmails > 0 ? (result.phase2Complete / totalEmails) * 100 : 0
    const improvementRate = result.phase2Complete > 0 
      ? (result.phase2Updated / result.phase2Complete) * 100 
      : 0

    res.json({
      success: true,
      stats: {
        totalEmails: result.totalEmails,
        phase1: {
          count: result.phase1Only,
          percentage: Math.round(phase1Percentage * 100) / 100
        },
        phase2: {
          completed: result.phase2Complete,
          percentage: Math.round(phase2Percentage * 100) / 100,
          updated: result.phase2Updated,
          keptPhase1: result.phase2NotBetter,
          improvementRate: Math.round(improvementRate * 100) / 100
        },
        queue: {
          pending: queueStats.currentQueueSize,
          totalQueued: queueStats.totalQueued,
          totalProcessed: queueStats.totalProcessed,
          totalFailed: queueStats.totalFailed,
          isProcessing: queueStats.isProcessing,
          oldestJobAge: queueStats.oldestJobAge
        }
      }
    })

  } catch (error) {
    console.error('Get classification status error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get classification status',
      error: error.message
    })
  }
}))

export default router

