// Job queue manager for Phase 2 email classification
import { CLASSIFICATION_CONFIG } from '../config/classification.js'
import { sendPhase2BatchComplete } from './websocketService.js'
import { clearAnalyticsCache } from '../routes/analytics.js'

// In-memory job queue
class ClassificationJobQueue {
  constructor() {
    this.queue = []
    this.processing = false
    this.stats = {
      totalQueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      currentQueueSize: 0,
      isProcessing: false
    }
  }

  /**
   * Add email to Phase 2 processing queue
   * @param {string} emailId - Email ID
   * @param {string} userId - User ID
   * @param {number} delay - Delay before processing (ms)
   */
  async queueEmail(emailId, userId, delay = CLASSIFICATION_CONFIG.phase2.delay) {
    // Check if already queued
    const exists = this.queue.some(job => job.emailId === emailId)
    if (exists) {
      console.log(`📋 Phase 2: Email ${emailId} already in queue, skipping`)
      return
    }

    const job = {
      emailId,
      userId,
      queuedAt: Date.now(),
      processAfter: Date.now() + delay,
      retries: 0
    }

    this.queue.push(job)
    this.stats.totalQueued++
    this.stats.currentQueueSize = this.queue.length

    console.log(`📋 Phase 2: Queued email ${emailId} for processing in ${delay}ms (queue size: ${this.queue.length})`)

    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing()
    }
  }

  /**
   * Batch queue multiple emails
   * @param {Array<Object>} emails - Array of {emailId, userId}
   */
  async queueBatch(emails) {
    console.log(`📋 Phase 2: Batch queueing ${emails.length} emails`)
    
    for (const { emailId, userId } of emails) {
      await this.queueEmail(emailId, userId)
    }
  }

  /**
   * Start processing queue
   */
  async startProcessing() {
    if (this.processing) {
      return
    }

    this.processing = true
    this.stats.isProcessing = true
    console.log('🚀 Phase 2: Started queue processing')

    while (this.queue.length > 0) {
      const now = Date.now()
      
      // Get jobs that are ready to process
      const readyJobs = this.queue.filter(job => job.processAfter <= now)
      
      if (readyJobs.length === 0) {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }

      // Process in batches
      const batch = readyJobs.slice(0, CLASSIFICATION_CONFIG.phase2.batchSize)
      
      // Remove batch from queue
      this.queue = this.queue.filter(job => !batch.includes(job))
      this.stats.currentQueueSize = this.queue.length

      // Process batch with concurrency limit
      await this.processBatch(batch)

      // Small delay between batches
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, CLASSIFICATION_CONFIG.phase2.batchDelayMs))
      }
    }

    this.processing = false
    this.stats.isProcessing = false
    console.log('✅ Phase 2: Queue processing completed')
  }

  /**
   * Process a batch of jobs with concurrency control
   * @param {Array<Object>} batch - Jobs to process
   */
  async processBatch(batch) {
    console.log(`⚙️ Phase 2: Processing batch of ${batch.length} emails`)

    // Import Phase 2 service dynamically to avoid circular dependencies
    const { refineEmailClassificationPhase2 } = await import('./phase2RefinementService.js')

    // Process with concurrency limit
    const concurrency = CLASSIFICATION_CONFIG.phase2.concurrency
    const results = []
    const categoryChanges = new Map() // Track category changes
    let categoriesChangedCount = 0
    
    // Track batch number for progress reporting
    const currentBatchNumber = Math.floor(this.stats.totalProcessed / batch.length) + 1

    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency)
      
      const chunkPromises = chunk.map(async (job) => {
        try {
          const result = await refineEmailClassificationPhase2(job.emailId, job.userId)
          this.stats.totalProcessed++
          
          // Track category changes
          if (result.updated && result.phase1 && result.phase2) {
            categoriesChangedCount++
            const changeKey = `${result.phase1.label}->${result.phase2.label}`
            categoryChanges.set(changeKey, (categoryChanges.get(changeKey) || 0) + 1)
          }
          
          return { 
            success: true, 
            emailId: job.emailId, 
            updated: result.updated,
            userId: job.userId 
          }
        } catch (error) {
          console.error(`❌ Phase 2: Failed to process ${job.emailId}:`, error.message)
          
          // Retry logic
          if (job.retries < CLASSIFICATION_CONFIG.phase2.maxRetries) {
            job.retries++
            job.processAfter = Date.now() + (job.retries * 5000) // Exponential backoff
            this.queue.push(job)
            console.log(`🔄 Phase 2: Retrying ${job.emailId} (attempt ${job.retries}/${CLASSIFICATION_CONFIG.phase2.maxRetries})`)
          } else {
            this.stats.totalFailed++
            console.error(`❌ Phase 2: Max retries reached for ${job.emailId}`)
          }
          
          return { success: false, emailId: job.emailId, error: error.message, userId: job.userId }
        }
      })

      const chunkResults = await Promise.all(chunkPromises)
      results.push(...chunkResults)
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    console.log(`✅ Phase 2: Batch complete - ${successCount} success, ${failCount} failed, ${categoriesChangedCount} category changes`)

    // Send batch complete notification via WebSocket (per user)
    if (batch.length > 0 && batch[0].userId) {
      const userId = batch[0].userId
      const totalQueued = this.stats.totalQueued
      const progress = totalQueued > 0 ? Math.round((this.stats.totalProcessed / totalQueued) * 100) : 0
      
      try {
        // Convert category changes map to object for WebSocket
        const categoryChangesObj = {}
        categoryChanges.forEach((count, changeKey) => {
          categoryChangesObj[changeKey] = count
        })
        
        sendPhase2BatchComplete(userId, {
          batchNumber: currentBatchNumber,
          emailsProcessed: batch.length,
          categoriesChanged: categoriesChangedCount,
          categoryChanges: categoryChangesObj,
          totalProcessed: this.stats.totalProcessed,
          totalQueued: totalQueued,
          progress: progress,
          message: `Phase 2: Processed batch ${currentBatchNumber} (${categoriesChangedCount} categories updated)`
        })
        
        // Clear analytics cache if any categories changed
        if (categoriesChangedCount > 0) {
          clearAnalyticsCache(userId)
        }
      } catch (notifyError) {
        console.warn('⚠️ Failed to send batch complete notification:', notifyError.message)
      }
    }

    return results
  }

  /**
   * Get queue statistics
   * @returns {Object} - Queue stats
   */
  getStats() {
    return {
      ...this.stats,
      currentQueueSize: this.queue.length,
      oldestJobAge: this.queue.length > 0 
        ? Date.now() - Math.min(...this.queue.map(j => j.queuedAt))
        : 0
    }
  }

  /**
   * Clear the queue (for testing/maintenance)
   */
  clear() {
    this.queue = []
    this.stats.currentQueueSize = 0
    console.log('🧹 Phase 2: Queue cleared')
  }

  /**
   * Pause processing
   */
  pause() {
    this.processing = false
    this.stats.isProcessing = false
    console.log('⏸️ Phase 2: Queue processing paused')
  }

  /**
   * Resume processing
   */
  resume() {
    if (!this.processing && this.queue.length > 0) {
      this.startProcessing()
      console.log('▶️ Phase 2: Queue processing resumed')
    }
  }
}

// Singleton instance
const jobQueue = new ClassificationJobQueue()

/**
 * Queue email for Phase 2 processing
 * @param {string} emailId - Email ID
 * @param {string} userId - User ID
 */
export const queuePhase2Classification = (emailId, userId) => {
  jobQueue.queueEmail(emailId, userId)
}

/**
 * Queue multiple emails for Phase 2 processing
 * @param {Array<Object>} emails - Array of {emailId, userId}
 */
export const queuePhase2Batch = (emails) => {
  jobQueue.queueBatch(emails)
}

/**
 * Get queue statistics
 * @returns {Object} - Queue stats
 */
export const getQueueStats = () => {
  return jobQueue.getStats()
}

/**
 * Clear the queue
 */
export const clearQueue = () => {
  jobQueue.clear()
}

/**
 * Pause queue processing
 */
export const pauseQueue = () => {
  jobQueue.pause()
}

/**
 * Resume queue processing
 */
export const resumeQueue = () => {
  jobQueue.resume()
}

export default jobQueue

