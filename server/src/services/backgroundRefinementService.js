/**
 * Background Refinement Service (Phase 2)
 * Continuously refines email classifications with comprehensive multi-layered analysis
 * Aims for 95%+ accuracy through deep analysis
 */

import mongoose from 'mongoose'
import Email from '../models/Email.js'
import Category from '../models/Category.js'
import { classifyEmail } from './classificationService.js'
import { sendEmailSyncUpdate } from './websocketService.js'
import notificationService from './notificationService.js'

// Refinement configuration
const REFINEMENT_CONFIG = {
  BATCH_SIZE: 10, // Small batches to avoid overwhelming system
  PROCESSING_DELAY: 1000, // 1 second delay between batches
  SUMMARY_INTERVAL: 3600000, // 1 hour in milliseconds
  MIN_CONFIDENCE_IMPROVEMENT: 0.15, // Minimum 15% improvement to reclassify
  EMAILS_PER_SUMMARY: 50 // Send summary after 50 emails reclassified
}

// Track active refinement jobs
const activeRefinementJobs = new Map()
const refinementStats = new Map()

/**
 * Start background refinement for a user
 * @param {string} userId - User ID
 * @returns {string} Refinement job ID
 */
export const startBackgroundRefinement = async (userId) => {
  try {
    // Check if already running
    if (activeRefinementJobs.has(userId)) {
      console.log(`⏳ Background refinement already running for user ${userId}`)
      return activeRefinementJobs.get(userId)
    }

    const jobId = `refinement_${userId}_${Date.now()}`
    
    // Initialize stats
    refinementStats.set(userId, {
      totalProcessed: 0,
      reclassified: 0,
      confidenceImprovement: 0,
      categoryChanges: {},
      startedAt: new Date(),
      lastSummaryAt: new Date(),
      phase: 'Phase 2: Comprehensive Refinement'
    })

    activeRefinementJobs.set(userId, jobId)

    console.log(`🚀 Starting background refinement for user ${userId}`)
    
    // Start refinement process asynchronously
    processBackgroundRefinement(userId, jobId)

    return jobId

  } catch (error) {
    console.error(`❌ Error starting background refinement:`, error)
    throw error
  }
}

/**
 * Process background refinement continuously
 * @param {string} userId - User ID
 * @param {string} jobId - Job ID
 */
const processBackgroundRefinement = async (userId, jobId) => {
  try {
    console.log(`📊 Processing background refinement for user ${userId}`)

    let hasMoreEmails = true
    let processedCount = 0

    while (hasMoreEmails && activeRefinementJobs.get(userId) === jobId) {
      // Get batch of emails that need refinement (basic analysis only)
      const emails = await Email.find({
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
        analysisDepth: 'basic', // Only refine emails with basic analysis
        refinementStatus: { $ne: 'refined' }
      })
      .limit(REFINEMENT_CONFIG.BATCH_SIZE)
      .select('_id subject snippet body text category classification from to date attachments enhancedMetadata')

      if (emails.length === 0) {
        hasMoreEmails = false
        break
      }

      console.log(`🔍 Refining batch of ${emails.length} emails for user ${userId}`)

      // Process each email in the batch
      const batchResults = await Promise.allSettled(
        emails.map(email => refineEmailClassification(userId, email))
      )

      // Update stats
      const stats = refinementStats.get(userId)
      const batchReclassified = batchResults.filter(
        r => r.status === 'fulfilled' && r.value.reclassified
      ).length

      stats.totalProcessed += emails.length
      stats.reclassified += batchReclassified

      refinementStats.set(userId, stats)

      processedCount += emails.length

      // Check if we should send a periodic summary
      const shouldSendSummary = 
        stats.reclassified >= REFINEMENT_CONFIG.EMAILS_PER_SUMMARY ||
        (Date.now() - stats.lastSummaryAt.getTime()) >= REFINEMENT_CONFIG.SUMMARY_INTERVAL

      if (shouldSendSummary && stats.reclassified > 0) {
        await sendPeriodicSummary(userId, stats)
        stats.lastSummaryAt = new Date()
        stats.reclassified = 0 // Reset counter
        stats.categoryChanges = {} // Reset category changes
      }

      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, REFINEMENT_CONFIG.PROCESSING_DELAY))
    }

    // Send final summary
    const finalStats = refinementStats.get(userId)
    if (finalStats && finalStats.reclassified > 0) {
      await sendPeriodicSummary(userId, finalStats)
    }

    // Cleanup
    activeRefinementJobs.delete(userId)
    console.log(`✅ Background refinement completed for user ${userId}. Total processed: ${processedCount}`)

  } catch (error) {
    console.error(`❌ Error in background refinement process:`, error)
    activeRefinementJobs.delete(userId)
  }
}

/**
 * Refine email classification with comprehensive analysis
 * @param {string} userId - User ID
 * @param {Object} email - Email document
 * @returns {Promise<Object>} Refinement result
 */
const refineEmailClassification = async (userId, email) => {
  try {
    const oldCategory = email.category
    const oldConfidence = email.classification?.confidence || 0.5

    // Get comprehensive classification using ML service
    // The ML service already has comprehensive analysis built-in
    const classification = await classifyEmail(
      email.subject || '',
      email.snippet || '',
      email.body || email.text || '',
      userId
    )

    const newCategory = classification.label
    const newConfidence = classification.confidence

    // Calculate confidence improvement
    const confidenceImprovement = newConfidence - oldConfidence

    // Determine if we should reclassify
    const shouldReclassify = 
      (newCategory !== oldCategory && newConfidence > oldConfidence + REFINEMENT_CONFIG.MIN_CONFIDENCE_IMPROVEMENT) ||
      (newCategory === oldCategory && confidenceImprovement >= REFINEMENT_CONFIG.MIN_CONFIDENCE_IMPROVEMENT)

    if (shouldReclassify) {
      // Update email with refined classification
      await Email.findByIdAndUpdate(email._id, {
        category: newCategory,
        previousCategory: oldCategory,
        classification: {
          label: newCategory,
          confidence: newConfidence,
          modelVersion: '3.1.0',
          classifiedAt: new Date(),
          reason: 'Refined with comprehensive multi-layered analysis',
          model: classification.model || 'comprehensive-refinement'
        },
        refinementStatus: 'refined',
        refinedAt: new Date(),
        refinementConfidence: newConfidence,
        analysisDepth: 'comprehensive',
        updatedAt: new Date()
      })

      // Track category change
      const stats = refinementStats.get(userId)
      if (stats) {
        const changeKey = `${oldCategory} → ${newCategory}`
        stats.categoryChanges[changeKey] = (stats.categoryChanges[changeKey] || 0) + 1
        stats.confidenceImprovement += confidenceImprovement
      }

      console.log(`✨ Refined email "${email.subject?.substring(0, 50)}...": ${oldCategory} (${oldConfidence.toFixed(3)}) → ${newCategory} (${newConfidence.toFixed(3)})`)

      return {
        reclassified: true,
        oldCategory,
        newCategory,
        oldConfidence,
        newConfidence,
        confidenceImprovement
      }
    } else {
      // Mark as refined even if no change (analysis complete)
      await Email.findByIdAndUpdate(email._id, {
        refinementStatus: 'refined',
        refinedAt: new Date(),
        refinementConfidence: newConfidence,
        analysisDepth: 'comprehensive'
      })

      return {
        reclassified: false,
        category: oldCategory,
        confidence: newConfidence
      }
    }

  } catch (error) {
    console.error(`❌ Error refining email ${email._id}:`, error)
    return {
      reclassified: false,
      error: error.message
    }
  }
}

/**
 * Send periodic summary notification
 * @param {string} userId - User ID
 * @param {Object} stats - Refinement statistics
 */
const sendPeriodicSummary = async (userId, stats) => {
  try {
    console.log(`📊 Sending periodic refinement summary to user ${userId}`)

    // Calculate averages
    const avgConfidenceImprovement = stats.reclassified > 0 
      ? (stats.confidenceImprovement / stats.reclassified * 100).toFixed(1)
      : 0

    // Format category changes
    const categoryChangesSummary = Object.entries(stats.categoryChanges)
      .filter(([_, count]) => count > 0)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5) // Top 5 changes
      .map(([change, count]) => `${change}: ${count} email${count > 1 ? 's' : ''}`)
      .join('\n')

    // Build summary message
    const message = `
🔄 Email Reclassification Summary

${stats.reclassified} email${stats.reclassified > 1 ? 's' : ''} reclassified with improved accuracy
Average confidence improvement: ${avgConfidenceImprovement}%

${categoryChangesSummary ? `Top category changes:\n${categoryChangesSummary}` : 'No significant category changes'}

✨ Your emails are now categorized with higher accuracy!
    `.trim()

    // Send notification
    await notificationService.sendPushNotification(userId, {
      type: 'refinement_summary',
      title: '✨ Email Classification Refined',
      message,
      data: {
        totalProcessed: stats.totalProcessed,
        reclassified: stats.reclassified,
        avgConfidenceImprovement,
        categoryChanges: stats.categoryChanges,
        phase: stats.phase
      }
    })

    // Send WebSocket update for real-time UI update
    sendEmailSyncUpdate(userId, {
      type: 'refinement_summary',
      stats: {
        totalProcessed: stats.totalProcessed,
        reclassified: stats.reclassified,
        avgConfidenceImprovement,
        categoryChanges: stats.categoryChanges
      }
    })

    console.log(`✅ Periodic summary sent to user ${userId}`)

  } catch (error) {
    console.error(`❌ Error sending periodic summary:`, error)
  }
}

/**
 * Stop background refinement for a user
 * @param {string} userId - User ID
 * @returns {boolean} Success status
 */
export const stopBackgroundRefinement = (userId) => {
  if (activeRefinementJobs.has(userId)) {
    activeRefinementJobs.delete(userId)
    console.log(`⏸️ Stopped background refinement for user ${userId}`)
    return true
  }
  return false
}

/**
 * Get refinement status for a user
 * @param {string} userId - User ID
 * @returns {Object|null} Refinement status
 */
export const getRefinementStatus = async (userId) => {
  try {
    const stats = refinementStats.get(userId)
    const isActive = activeRefinementJobs.has(userId)

    // Get email counts
    const totalEmails = await Email.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false
    })

    const refinedEmails = await Email.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
      refinementStatus: 'refined'
    })

    const pendingEmails = totalEmails - refinedEmails

    return {
      isActive,
      stats: stats || null,
      progress: {
        totalEmails,
        refinedEmails,
        pendingEmails,
        percentComplete: totalEmails > 0 ? ((refinedEmails / totalEmails) * 100).toFixed(1) : 0
      }
    }
  } catch (error) {
    console.error(`❌ Error getting refinement status:`, error)
    return null
  }
}

/**
 * Get refinement statistics for a user
 * @param {string} userId - User ID
 * @returns {Object} Statistics
 */
export const getRefinementStats = async (userId) => {
  try {
    // Get overall statistics
    const totalEmails = await Email.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false
    })

    const refinedEmails = await Email.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
      refinementStatus: 'refined'
    })

    const avgConfidence = await Email.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
          refinementStatus: 'refined'
        }
      },
      {
        $group: {
          _id: null,
          avgConfidence: { $avg: '$refinementConfidence' }
        }
      }
    ])

    // Get category distribution
    const categoryDistribution = await Email.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
          refinementStatus: 'refined'
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$refinementConfidence' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ])

    return {
      totalEmails,
      refinedEmails,
      pendingEmails: totalEmails - refinedEmails,
      percentComplete: totalEmails > 0 ? ((refinedEmails / totalEmails) * 100).toFixed(1) : 0,
      avgConfidence: avgConfidence.length > 0 ? avgConfidence[0].avgConfidence.toFixed(3) : 0,
      categoryDistribution,
      estimatedAccuracy: avgConfidence.length > 0 ? (avgConfidence[0].avgConfidence * 100).toFixed(1) : 0
    }

  } catch (error) {
    console.error(`❌ Error getting refinement stats:`, error)
    throw error
  }
}

/**
 * Reset refinement status for all emails (for testing/debugging)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of emails reset
 */
export const resetRefinementStatus = async (userId) => {
  try {
    const result = await Email.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false
      },
      {
        $set: {
          refinementStatus: 'pending',
          refinedAt: null,
          refinementConfidence: 0.0,
          analysisDepth: 'basic'
        }
      }
    )

    console.log(`🔄 Reset refinement status for ${result.modifiedCount} emails`)
    return result.modifiedCount

  } catch (error) {
    console.error(`❌ Error resetting refinement status:`, error)
    throw error
  }
}

export default {
  startBackgroundRefinement,
  stopBackgroundRefinement,
  getRefinementStatus,
  getRefinementStats,
  resetRefinementStatus
}

