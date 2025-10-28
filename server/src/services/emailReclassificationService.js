/**
 * Email Reclassification Service
 * Background job system for reclassifying ALL emails when new categories are added
 */

import mongoose from 'mongoose'
import Email from '../models/Email.js'
import Category from '../models/Category.js'
import ReclassificationJob from '../models/ReclassificationJob.js'
import { classifyEmail } from './classificationService.js'
import { sendEmailSyncUpdate } from './websocketService.js'
import { updateCategoryAnalytics } from './categoryAnalyticsService.js'
import { estimateReclassificationTime } from './categoryFeatureService.js'
import { clearAnalyticsCache } from '../routes/analytics.js'

// Store active jobs to prevent duplicates
const activeJobs = new Map()
const BATCH_SIZE = 1000

/**
 * Start a reclassification job for all emails when a new category is added
 * @param {string} userId - User ID
 * @param {string} categoryName - New category name
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object>} Job object
 */
export const startReclassificationJob = async (userId, categoryName, categoryId) => {
  try {
    // Check if there's already an active job for this category
    const existingJob = await ReclassificationJob.getLatestForCategory(userId, categoryName)
    if (existingJob && ['pending', 'processing'].includes(existingJob.status)) {
      console.log(`⏳ Reclassification job already exists for category "${categoryName}"`)
      return existingJob
    }

    // Get total email count for this user
    const totalEmails = await Email.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false
    })

    console.log(`🔄 Starting reclassification job for "${categoryName}" - ${totalEmails} emails to process`)

    // Create new job
    const job = new ReclassificationJob({
      userId: new mongoose.Types.ObjectId(userId),
      categoryName,
      categoryId: new mongoose.Types.ObjectId(categoryId),
      totalEmails,
      totalBatches: Math.ceil(totalEmails / BATCH_SIZE),
      status: 'pending'
    })

    const savedJob = await job.save()

    // Start processing asynchronously
    processReclassificationJob(savedJob._id.toString())

    // Send initial WebSocket update
    sendEmailSyncUpdate(userId.toString(), {
      type: 'reclassification_started',
      jobId: savedJob._id.toString(),
      categoryName,
      totalEmails,
      message: `Started reclassifying ${totalEmails} emails for new category "${categoryName}"`
    })

    return savedJob

  } catch (error) {
    console.error('❌ Error starting reclassification job:', error)
    throw error
  }
}

/**
 * Process a reclassification job in batches
 * @param {string} jobId - Job ID
 */
const processReclassificationJob = async (jobId) => {
  try {
    const job = await ReclassificationJob.findById(jobId)
    if (!job) {
      console.error(`❌ Job ${jobId} not found`)
      return
    }

    // Mark job as processing
    job.status = 'processing'
    job.startedAt = new Date()
    
    // Add timing estimates
    const estimatedTime = await estimateReclassificationTime(job.userId.toString())
    job.estimatedCompletionTime = new Date(Date.now() + estimatedTime.estimatedSeconds * 1000)
    job.estimatedTotalSeconds = estimatedTime.estimatedSeconds
    await job.save()

    // Mark as active to prevent duplicates
    activeJobs.set(jobId, true)

    console.log(`🚀 Processing reclassification job ${jobId} for category "${job.categoryName}"`)

    let offset = 0
    let processedCount = 0
    let successCount = 0
    let errorCount = 0
    let lastProgressUpdate = Date.now()
    const PROGRESS_UPDATE_INTERVAL = 5000 // 5 seconds

    while (offset < job.totalEmails) {
      try {
        // Get batch of emails
        const emails = await Email.find({
          userId: job.userId,
          isDeleted: false
        })
        .skip(offset)
        .limit(BATCH_SIZE)
        .select('_id subject snippet body text category from')

        if (emails.length === 0) {
          break
        }

        console.log(`📧 Processing batch ${job.currentBatch + 1}/${job.totalBatches} (${emails.length} emails)`)

        // Classify emails in batch
        const classificationResults = await Promise.allSettled(
          emails.map(async (email) => {
            try {
              console.log(`🔍 Reclassifying email: "${email.subject}" for category "${job.categoryName}"`)
              
              const classification = await classifyEmail(
                email.subject || '',
                email.snippet || '',
                email.body || email.text || '',
                job.userId.toString()
              )

              console.log(`📊 Classification result for "${email.subject}": ${classification.label} (${classification.confidence})`)

              // Update email with new classification (comprehensive analysis is now handled in ML service)
              await Email.findByIdAndUpdate(email._id, {
                category: classification.label,
                classification: {
                  label: classification.label,
                  confidence: classification.confidence,
                  modelVersion: '3.0.0',
                  classifiedAt: new Date(),
                  reason: 'Reclassified with comprehensive multi-layered analysis',
                  model: classification.model || 'enhanced-comprehensive'
                },
                updatedAt: new Date()
              })

              console.log(`✅ Updated email "${email.subject}" to category: ${classification.label}`)
              return { success: true, newCategory: classification.label }
            } catch (error) {
              console.error(`❌ Error classifying email ${email._id}:`, error.message)
              return { success: false, error: error.message }
            }
          })
        )

        // Update job progress
        const batchSuccessCount = classificationResults.filter(r => r.status === 'fulfilled' && r.value.success).length
        const batchErrorCount = classificationResults.length - batchSuccessCount

        successCount += batchSuccessCount
        errorCount += batchErrorCount
        processedCount += emails.length

        // Calculate processing rate and remaining time
        const currentTime = Date.now()
        const elapsedSeconds = Math.floor((currentTime - job.startedAt) / 1000)
        const timeSinceLastUpdate = (currentTime - lastProgressUpdate) / 1000
        const currentRate = timeSinceLastUpdate > 0 ? emails.length / timeSinceLastUpdate : 0
        
        // Update job with new progress tracking
        job.processedEmails = processedCount
        job.successfulClassifications = successCount
        job.failedClassifications = errorCount
        job.currentBatch = job.currentBatch + 1
        job.processingRate = currentRate
        job.lastProgressUpdate = new Date()
        job.elapsedSeconds = elapsedSeconds
        
        // Calculate estimated remaining time based on current rate
        if (currentRate > 0 && job.totalEmails > processedCount) {
          const remainingEmails = job.totalEmails - processedCount
          job.estimatedSecondsRemaining = Math.ceil(remainingEmails / currentRate)
        } else {
          job.estimatedSecondsRemaining = 0
        }
        
        job.updatedAt = new Date()
        await job.save()

        // Send progress update via WebSocket every 5 seconds or at completion
        const progressPercentage = Math.round((processedCount / job.totalEmails) * 100)
        const shouldSendUpdate = (currentTime - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL) || 
                                (processedCount === job.totalEmails) ||
                                (progressPercentage % 10 === 0)
        
        if (shouldSendUpdate) {
          sendEmailSyncUpdate(job.userId.toString(), {
            type: 'reclassification_progress',
            jobId: jobId,
            categoryName: job.categoryName,
            progress: progressPercentage,
            processedEmails: processedCount,
            totalEmails: job.totalEmails,
            estimatedSecondsRemaining: job.estimatedSecondsRemaining,
            currentRate: job.processingRate,
            successfulClassifications: successCount,
            failedClassifications: errorCount,
            remainingSeconds: job.estimatedSecondsRemaining,
            elapsedSeconds: elapsedSeconds,
            estimatedCompletionTime: new Date(Date.now() + job.estimatedSecondsRemaining * 1000),
            message: `Reclassified ${processedCount}/${job.totalEmails} emails (${progressPercentage}%) - ${job.estimatedSecondsRemaining}s remaining`
          })
          lastProgressUpdate = currentTime
        }

        offset += BATCH_SIZE

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (batchError) {
        console.error(`❌ Error processing batch at offset ${offset}:`, batchError)
        errorCount += BATCH_SIZE
      }
    }

    // Mark job as completed
    job.status = 'completed'
    job.completedAt = new Date()
    job.progressPercentage = 100
    await job.save()

    // Update category email counts
    await updateCategoryCounts(job.userId)

    // Update category analytics
    try {
      await updateCategoryAnalytics(job.userId.toString(), job.categoryName, successCount)
    } catch (analyticsError) {
      console.error('❌ Error updating category analytics:', analyticsError)
    }

    // Clear analytics cache to reflect updated category counts
    clearAnalyticsCache(job.userId.toString())

    // Send completion update
    sendEmailSyncUpdate(job.userId.toString(), {
      type: 'reclassification_complete',
      jobId: jobId,
      categoryName: job.categoryName,
      totalEmails: job.totalEmails,
      successfulClassifications: successCount,
      failedClassifications: errorCount,
      message: `Reclassification completed: ${successCount}/${job.totalEmails} emails successfully reclassified`
    })

    console.log(`✅ Reclassification job ${jobId} completed successfully`)

  } catch (error) {
    console.error(`❌ Error processing reclassification job ${jobId}:`, error)
    
    try {
      const job = await ReclassificationJob.findById(jobId)
      if (job) {
        job.status = 'failed'
        job.errorMessage = error.message
        job.completedAt = new Date()
        await job.save()

        // Send error update
        sendEmailSyncUpdate(job.userId.toString(), {
          type: 'reclassification_failed',
          jobId: jobId,
          categoryName: job.categoryName,
          error: error.message,
          message: `Reclassification failed: ${error.message}`
        })
      }
    } catch (updateError) {
      console.error('❌ Error updating failed job:', updateError)
    }
  } finally {
    // Remove from active jobs
    activeJobs.delete(jobId)
  }
}

/**
 * Update email counts for all categories after reclassification
 */
const updateCategoryCounts = async (userId) => {
  try {
    const categories = await Category.find({ userId })
    
    for (const category of categories) {
      const count = await Email.countDocuments({
        userId,
        category: category.name,
        isDeleted: false
      })
      
      await Category.findByIdAndUpdate(category._id, { emailCount: count })
    }
    
    console.log('✅ Updated category email counts after reclassification')
  } catch (error) {
    console.error('❌ Error updating category counts:', error)
  }
}

/**
 * Get active reclassification jobs for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Active jobs
 */
export const getActiveReclassificationJobs = async (userId) => {
  try {
    return await ReclassificationJob.getActiveJobs(userId)
  } catch (error) {
    console.error('❌ Error getting active jobs:', error)
    return []
  }
}

/**
 * Get job status and progress
 * @param {string} jobId - Job ID
 * @returns {Promise<Object|null>} Job object
 */
export const getJobStatus = async (jobId) => {
  try {
    return await ReclassificationJob.findById(jobId)
  } catch (error) {
    console.error('❌ Error getting job status:', error)
    return null
  }
}

/**
 * Cancel a reclassification job
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>} Success status
 */
export const cancelReclassificationJob = async (jobId) => {
  try {
    const job = await ReclassificationJob.findById(jobId)
    if (!job) {
      return false
    }

    if (job.status === 'completed') {
      return false // Cannot cancel completed job
    }

    job.status = 'failed'
    job.errorMessage = 'Cancelled by user'
    job.completedAt = new Date()
    await job.save()

    // Remove from active jobs if it was processing
    activeJobs.delete(jobId)

    sendEmailSyncUpdate(job.userId.toString(), {
      type: 'reclassification_cancelled',
      jobId: jobId,
      categoryName: job.categoryName,
      message: `Reclassification job for "${job.categoryName}" has been cancelled`
    })

    return true
  } catch (error) {
    console.error('❌ Error cancelling job:', error)
    return false
  }
}

/**
 * Reclassify all emails for a user (general function)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Summary statistics
 */
export const reclassifyAllEmails = async (userId) => {
  try {
    // Get total email count first
    const totalEmails = await Email.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false
    })

    console.log(`🔄 Starting complete reclassification for user ${userId} - ${totalEmails} emails`)

    let processedCount = 0
    let changedCount = 0
    let errorCount = 0
    const batchSize = 100

    // Process in smaller batches to avoid memory issues
    let offset = 0
    
    while (offset < totalEmails) {
      const emails = await Email.find({
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false
      })
      .skip(offset)
      .limit(batchSize)
      .select('_id subject snippet body text category')

      if (emails.length === 0) break

      for (const email of emails) {
        try {
          const oldCategory = email.category
          const classification = await classifyEmail(
            email.subject || '',
            email.snippet || '',
            email.body || email.text || '',
            userId
          )

          // Update if category changed
          if (classification.label !== oldCategory) {
            await Email.findByIdAndUpdate(email._id, {
              category: classification.label,
              classification: {
                label: classification.label,
                confidence: classification.confidence,
                modelVersion: '3.0.0',
                classifiedAt: new Date(),
                reason: 'Complete reclassification with dynamic ML'
              },
              updatedAt: new Date()
            })
            changedCount++
          }
          
          processedCount++
        } catch (error) {
          console.error(`❌ Error reclassifying email ${email._id}:`, error)
          errorCount++
          processedCount++
        }
      }

      offset += batchSize
      
      // Send progress update
      const progressPercent = Math.round((processedCount / totalEmails) * 100)
      if (progressPercent % 20 === 0) {
        console.log(`📊 Reclassification progress: ${progressPercent}% (${processedCount}/${totalEmails})`)
      }
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    return {
      totalEmails,
      processedCount,
      changedCount,
      errorCount,
      success: true
    }
  } catch (error) {
    console.error('❌ Error in reclassifyAllEmails:', error)
    throw error
  }
}

/**
 * Reclassify emails in batches (utility function)
 * @param {string} userId - User ID
 * @param {number} batchSize - Batch size (default 100)
 * @returns {Promise<Object>} Progress information
 */
export const reclassifyEmailsBatch = async (userId, batchSize = 100) => {
  return await reclassifyAllEmails(userId) // Using the main function with specified batch size
}

/**
 * Reclassify emails from one category to potentially another
 * @param {string} userId - User ID
 * @param {string} oldCategory - Source category name
 * @param {string} newCategory - Target category name (optional)
 * @returns {Promise<Object>} Summary statistics
 */
export const reclassifyEmailsByCategory = async (userId, oldCategory, newCategory = null) => {
  try {
    const query = {
      userId: new mongoose.Types.ObjectId(userId),
      category: oldCategory,
      isDeleted: false
    }

    const emails = await Email.find(query).select('_id subject snippet body text category')
    
    console.log(`🔄 Reclassifying ${emails.length} emails from category "${oldCategory}"`)

    let processedCount = 0
    let changedCount = 0
    let errorCount = 0

    for (const email of emails) {
      try {
        const classification = await classifyEmail(
          email.subject || '',
          email.snippet || '',
          email.body || email.text || '',
          userId
        )

        // Update if category changed
        if (classification.label !== email.category) {
          await Email.findByIdAndUpdate(email._id, {
            category: classification.label,
            classification: {
              label: classification.label,
              confidence: classification.confidence,
              modelVersion: '3.0.0',
              classifiedAt: new Date(),
              reason: `Reclassified from ${oldCategory}`
            },
            updatedAt: new Date()
          })
          changedCount++
        }
        
        processedCount++
      } catch (error) {
        console.error(`❌ Error reclassifying email ${email._id}:`, error)
        errorCount++
        processedCount++
      }
    }

    return {
      totalEmails: emails.length,
      processedCount,
      changedCount,
      errorCount,
      success: true
    }
  } catch (error) {
    console.error('❌ Error in reclassifyEmailsByCategory:', error)
    throw error
  }
}

export default {
  startReclassificationJob,
  getActiveReclassificationJobs,
  getJobStatus,
  cancelReclassificationJob,
  reclassifyAllEmails,
  reclassifyEmailsBatch,
  reclassifyEmailsByCategory
}
