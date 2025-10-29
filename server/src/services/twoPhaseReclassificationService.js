/**
 * Two-Phase Email Reclassification Orchestrator
 * Phase 1: Fast rule-based classification (immediate results)
 * Phase 2: ML-based refinement (background processing)
 */

import mongoose from 'mongoose'
import Email from '../models/Email.js'
import Category from '../models/Category.js'
import { classifyEmailPhase1 } from './phase1ClassificationService.js'
import { queuePhase2Batch } from './classificationJobQueue.js'
import { sendEmailSyncUpdate } from './websocketService.js'
import { clearAnalyticsCache } from '../routes/analytics.js'
import { clearCategoryCache } from './categoryService.js'

const BATCH_SIZE = 1000

/**
 * Orchestrate two-phase reclassification for all user emails
 * @param {string} userId - User ID
 * @param {string} categoryName - Optional category name for scoped reclassification
 * @returns {Promise<Object>} Reclassification results
 */
export const reclassifyAllEmailsTwoPhase = async (userId, categoryName = null) => {
  try {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`🔄 Starting Two-Phase Reclassification for user: ${userId}`)
    if (categoryName) {
      console.log(`   Scoped to category: ${categoryName}`)
    }
    console.log(`${'='.repeat(80)}\n`)

    // Get total email count
    const query = {
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false
    }
    
    const totalEmails = await Email.countDocuments(query)
    console.log(`📊 Total emails to process: ${totalEmails}`)

    if (totalEmails === 0) {
      console.log('⚠️ No emails found to reclassify')
      return {
        success: true,
        phase1: { processed: 0, updated: 0 },
        phase2: { queued: 0 },
        message: 'No emails to reclassify'
      }
    }

    // ========================================
    // PHASE 1: Fast Rule-Based Classification
    // ========================================
    console.log('\n⚡ PHASE 1: Starting fast rule-based classification...')
    const phase1StartTime = Date.now()
    
    let phase1ProcessedCount = 0
    let phase1UpdatedCount = 0
    let phase1ErrorCount = 0
    let offset = 0
    const totalBatches = Math.ceil(totalEmails / BATCH_SIZE)
    let currentBatch = 0

    while (offset < totalEmails) {
      currentBatch++
      console.log(`\n📦 Phase 1 - Processing batch ${currentBatch}/${totalBatches}`)
      
      // Fetch batch of emails
      const emails = await Email.find(query)
        .skip(offset)
        .limit(BATCH_SIZE)
        .select('_id subject snippet body text category from')
        .lean()

      if (emails.length === 0) break

      // Classify each email with Phase 1
      const updatePromises = emails.map(async (email) => {
        try {
          const phase1Result = await classifyEmailPhase1({
            subject: email.subject || '',
            from: email.from || '',
            snippet: email.snippet || '',
            body: email.body || email.text || ''
          }, userId)

          const oldCategory = email.category
          const newCategory = phase1Result.label

          // Update email with Phase 1 classification
          await Email.findByIdAndUpdate(email._id, {
            category: newCategory,
            classification: {
              label: newCategory,
              confidence: phase1Result.confidence,
              phase: 1,
              phase1: {
                label: newCategory,
                confidence: phase1Result.confidence,
                classifiedAt: new Date(),
                method: phase1Result.method,
                matchedPattern: phase1Result.matchedPattern,
                matchedValue: phase1Result.matchedValue,
                matchedKeywords: phase1Result.matchedKeywords
              },
              modelVersion: '2.0.0-phase1',
              classifiedAt: new Date()
            },
            updatedAt: new Date()
          })

          phase1ProcessedCount++
          if (oldCategory !== newCategory) {
            phase1UpdatedCount++
          }

          return { success: true, oldCategory, newCategory }
        } catch (error) {
          console.error(`❌ Phase 1 error for email ${email._id}:`, error.message)
          phase1ErrorCount++
          return { success: false, error: error.message }
        }
      })

      await Promise.all(updatePromises)

      // Calculate progress
      const progressPercentage = Math.round((phase1ProcessedCount / totalEmails) * 100)
      
      // Send WebSocket progress update
      sendEmailSyncUpdate(userId, {
        type: 'reclassification_progress',
        phase: 1,
        progress: progressPercentage,
        processedEmails: phase1ProcessedCount,
        totalEmails: totalEmails,
        updatedEmails: phase1UpdatedCount,
        currentBatch: currentBatch,
        totalBatches: totalBatches,
        message: `Phase 1: Classified ${phase1ProcessedCount}/${totalEmails} emails (${progressPercentage}%)`
      })

      // Clear caches to trigger frontend refresh
      clearAnalyticsCache(userId)
      clearCategoryCache(userId)

      console.log(`✅ Phase 1 batch ${currentBatch} complete: ${emails.length} emails processed`)
      console.log(`   Updated: ${phase1UpdatedCount}, Errors: ${phase1ErrorCount}`)

      offset += BATCH_SIZE

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const phase1Duration = Math.round((Date.now() - phase1StartTime) / 1000)
    console.log(`\n✅ PHASE 1 COMPLETE`)
    console.log(`   Duration: ${phase1Duration}s`)
    console.log(`   Processed: ${phase1ProcessedCount}/${totalEmails}`)
    console.log(`   Updated: ${phase1UpdatedCount}`)
    console.log(`   Errors: ${phase1ErrorCount}`)

    // Send Phase 1 completion update
    sendEmailSyncUpdate(userId, {
      type: 'reclassification_phase1_complete',
      phase: 1,
      totalEmails: totalEmails,
      processedEmails: phase1ProcessedCount,
      updatedEmails: phase1UpdatedCount,
      errorCount: phase1ErrorCount,
      duration: phase1Duration,
      message: `Phase 1 complete: ${phase1UpdatedCount} emails reclassified in ${phase1Duration}s`
    })

    // Update category counts after Phase 1
    await updateCategoryCounts(userId)

    // Final cache clear for Phase 1
    clearAnalyticsCache(userId)
    clearCategoryCache(userId)

    // ========================================
    // PHASE 2: ML-Based Background Refinement
    // ========================================
    console.log('\n🤖 PHASE 2: Queueing emails for ML-based refinement...')
    
    // Get all emails again for Phase 2 queueing
    const emailsForPhase2 = await Email.find(query)
      .select('_id')
      .lean()

    const phase2Jobs = emailsForPhase2.map(email => ({
      emailId: email._id.toString(),
      userId: userId
    }))

    // Queue all emails for Phase 2 processing
    await queuePhase2Batch(phase2Jobs)

    console.log(`✅ Phase 2: Queued ${phase2Jobs.length} emails for background refinement`)

    // Send Phase 2 queued notification
    sendEmailSyncUpdate(userId, {
      type: 'reclassification_phase2_queued',
      phase: 2,
      queuedEmails: phase2Jobs.length,
      message: `Phase 2: ${phase2Jobs.length} emails queued for background refinement`
    })

    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ Two-Phase Reclassification Started Successfully`)
    console.log(`   Phase 1: ${phase1UpdatedCount} emails reclassified immediately`)
    console.log(`   Phase 2: ${phase2Jobs.length} emails queued for refinement`)
    console.log(`${'='.repeat(80)}\n`)

    return {
      success: true,
      phase1: {
        processed: phase1ProcessedCount,
        updated: phase1UpdatedCount,
        errors: phase1ErrorCount,
        duration: phase1Duration
      },
      phase2: {
        queued: phase2Jobs.length
      },
      totalEmails: totalEmails
    }

  } catch (error) {
    console.error('❌ Two-phase reclassification error:', error)
    
    // Send error notification
    sendEmailSyncUpdate(userId, {
      type: 'reclassification_failed',
      error: error.message,
      message: `Reclassification failed: ${error.message}`
    })
    
    throw error
  }
}

/**
 * Update email counts for all categories
 * @param {string} userId - User ID
 */
const updateCategoryCounts = async (userId) => {
  try {
    const categories = await Category.find({ 
      userId: new mongoose.Types.ObjectId(userId),
      isActive: true 
    })
    
    for (const category of categories) {
      const count = await Email.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        category: category.name,
        isDeleted: false
      })
      
      await Category.findByIdAndUpdate(category._id, { 
        emailCount: count,
        updatedAt: new Date()
      })
    }
    
    console.log('✅ Updated category email counts')
  } catch (error) {
    console.error('❌ Error updating category counts:', error)
  }
}

export default {
  reclassifyAllEmailsTwoPhase
}

