// Phase 2: Background ML-based email classification refinement
import Email from '../models/Email.js'
import { CLASSIFICATION_CONFIG } from '../config/classification.js'
import { classifyEmailWithDynamicML } from './classificationService.js'
import { sendPhase2CategoryChanged } from './websocketService.js'
import { clearAnalyticsCache } from '../routes/analytics.js'

/**
 * Refine email classification using Phase 2 ML analysis
 * @param {string} emailId - Email ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Refinement result
 */
export const refineEmailClassificationPhase2 = async (emailId, userId) => {
  try {
    // Fetch email from database
    const email = await Email.findOne({ _id: emailId, userId })
    
    if (!email) {
      console.log(`⚠️ Phase 2: Email ${emailId} not found, skipping`)
      return { success: false, reason: 'email_not_found' }
    }

    // Skip if Phase 2 already completed
    if (email.classification?.phase2?.isComplete) {
      console.log(`⚠️ Phase 2: Email ${emailId} already processed, skipping`)
      return { success: false, reason: 'already_processed' }
    }

    // Get current Phase 1 classification
    const phase1Label = email.category || email.classification?.label
    const phase1Confidence = email.classification?.confidence || 0

    console.log(`\n${'='.repeat(60)}`)
    console.log(`⚙️ Phase 2: Processing email ${emailId}`)
    console.log(`   Subject: "${email.subject}"`)
    console.log(`   Phase 1: ${phase1Label} (${phase1Confidence})`)

    // Perform full ML classification with body analysis, headers, metadata
    let phase2Result
    try {
      phase2Result = await classifyEmailWithDynamicML(
        email.subject || '',
        email.snippet || '',
        email.body || email.text || '',
        userId
      )
    } catch (mlError) {
      console.error(`❌ Phase 2: ML classification failed for ${emailId}:`, mlError.message)
      
      // Mark as attempted even if failed
      email.classification = email.classification || {}
      email.classification.phase2 = {
        isComplete: true,
        classifiedAt: new Date(),
        error: mlError.message,
        result: 'failed'
      }
      await email.save()
      
      return { success: false, reason: 'ml_failed', error: mlError.message }
    }

    const phase2Label = phase2Result.label
    const phase2Confidence = phase2Result.confidence

    console.log(`   Phase 2: ${phase2Label} (${phase2Confidence})`)

    // Calculate confidence improvement
    const improvement = phase2Confidence - phase1Confidence
    const threshold = CLASSIFICATION_CONFIG.phase2.confidenceImprovementThreshold

    console.log(`   Improvement: ${improvement > 0 ? '+' : ''}${(improvement * 100).toFixed(1)}%`)
    console.log(`   Threshold: ${(threshold * 100).toFixed(1)}%`)

    // Determine if Phase 2 result should be used
    let shouldUpdate = false
    let updateReason = ''

    if (phase2Label !== phase1Label && phase2Confidence >= CLASSIFICATION_CONFIG.phase1.confidenceThreshold) {
      // Different category with high confidence
      shouldUpdate = true
      updateReason = 'category_change_high_confidence'
    } else if (phase2Label === phase1Label && improvement >= threshold) {
      // Same category but significantly higher confidence
      shouldUpdate = true
      updateReason = 'confidence_improvement'
    } else if (phase1Confidence < CLASSIFICATION_CONFIG.phase1.confidenceThreshold && phase2Confidence > phase1Confidence) {
      // Phase 1 had low confidence, any improvement is good
      shouldUpdate = true
      updateReason = 'low_confidence_improvement'
    }

    // Update email classification if Phase 2 is better
    if (shouldUpdate) {
      console.log(`   ✅ Updating to Phase 2 result (reason: ${updateReason})`)
      
      email.category = phase2Label
      email.classification = {
        label: phase2Label,
        confidence: phase2Confidence,
        phase: 2,
        phase1: {
          label: phase1Label,
          confidence: phase1Confidence,
          classifiedAt: email.classification?.phase1?.classifiedAt || email.createdAt,
          method: email.classification?.method || 'unknown'
        },
        phase2: {
          label: phase2Label,
          confidence: phase2Confidence,
          classifiedAt: new Date(),
          method: 'ml-dynamic',
          model: phase2Result.model || 'unknown',
          isComplete: true,
          updateReason
        },
        modelVersion: '2.0.0-phase2',
        classifiedAt: new Date()
      }
      
      await email.save()
      
      // Send WebSocket notification for category change
      try {
        sendPhase2CategoryChanged(userId.toString(), {
          emailId: emailId,
          emailSubject: email.subject,
          oldCategory: phase1Label,
          newCategory: phase2Label,
          confidence: phase2Confidence,
          improvement: improvement,
          reason: updateReason
        })
      } catch (wsError) {
        console.warn('⚠️ Failed to send WebSocket update:', wsError.message)
      }
      
      // Clear analytics cache to trigger frontend refresh
      try {
        clearAnalyticsCache(userId.toString())
      } catch (cacheError) {
        console.warn('⚠️ Failed to clear analytics cache:', cacheError.message)
      }
      
      console.log(`   ✅ Phase 2: Updated ${emailId} - ${phase1Label} → ${phase2Label}`)
      console.log(`${'='.repeat(60)}\n`)
      
      return {
        success: true,
        updated: true,
        phase1: { label: phase1Label, confidence: phase1Confidence },
        phase2: { label: phase2Label, confidence: phase2Confidence },
        improvement,
        updateReason
      }
    } else {
      // Keep Phase 1 result but mark Phase 2 as complete
      console.log(`   ⚠️ Keeping Phase 1 result (Phase 2 not significantly better)`)
      
      email.classification = email.classification || {}
      email.classification.phase2 = {
        label: phase2Label,
        confidence: phase2Confidence,
        classifiedAt: new Date(),
        method: 'ml-dynamic',
        model: phase2Result.model || 'unknown',
        isComplete: true,
        result: 'not_better',
        improvement
      }
      
      await email.save()
      
      console.log(`   ⚠️ Phase 2: Kept Phase 1 for ${emailId}`)
      console.log(`${'='.repeat(60)}\n`)
      
      return {
        success: true,
        updated: false,
        phase1: { label: phase1Label, confidence: phase1Confidence },
        phase2: { label: phase2Label, confidence: phase2Confidence },
        improvement,
        reason: 'phase1_better'
      }
    }

  } catch (error) {
    console.error(`❌ Phase 2: Error refining ${emailId}:`, error)
    console.log(`${'='.repeat(60)}\n`)
    return { success: false, reason: 'error', error: error.message }
  }
}

/**
 * Trigger Phase 2 refinement for all emails (or filtered by category)
 * @param {string} userId - User ID
 * @param {string} categoryName - Optional category name to filter
 * @returns {Promise<Object>} - Result with count of queued emails
 */
export const triggerPhase2ForAllEmails = async (userId, categoryName = null) => {
  try {
    console.log(`\n🔄 Phase 2: Triggering refinement for user ${userId}${categoryName ? ` (category: ${categoryName})` : ''}`)
    
    const query = { userId }
    if (categoryName) {
      query.category = categoryName
    }
    
    // Find emails that haven't completed Phase 2
    query['classification.phase2.isComplete'] = { $ne: true }
    
    const emails = await Email.find(query).select('_id').lean()
    
    if (emails.length === 0) {
      console.log('⚠️ Phase 2: No emails found to refine')
      return { success: true, count: 0 }
    }
    
    console.log(`📋 Phase 2: Found ${emails.length} emails to refine`)
    
    // Queue all emails for Phase 2 processing
    const { queuePhase2Batch } = await import('./classificationJobQueue.js')
    
    const emailJobs = emails.map(email => ({
      emailId: email._id.toString(),
      userId: userId.toString()
    }))
    
    await queuePhase2Batch(emailJobs)
    
    console.log(`✅ Phase 2: Queued ${emails.length} emails for refinement`)
    
    return {
      success: true,
      count: emails.length,
      category: categoryName
    }
    
  } catch (error) {
    console.error('❌ Phase 2: Error triggering refinement:', error)
    return { success: false, error: error.message }
  }
}

export default refineEmailClassificationPhase2

