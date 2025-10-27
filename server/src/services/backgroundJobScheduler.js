/**
 * Background Job Scheduler
 * Coordinates Phase 1 (fast classification) and Phase 2 (comprehensive refinement)
 * Manages job priorities and lifecycle
 */

import ReclassificationJob from '../models/ReclassificationJob.js'
import { startBackgroundRefinement, getRefinementStatus } from './backgroundRefinementService.js'
import notificationService from './notificationService.js'

// Job queue and state management
const scheduledJobs = new Map()
const jobMonitors = new Map()

// Job priorities
const JOB_PRIORITY = {
  PHASE1_RECLASSIFICATION: 1, // Highest priority
  PHASE2_REFINEMENT: 2,
  NEW_EMAIL_CLASSIFICATION: 3
}

// Polling intervals
const POLLING_INTERVAL = 5000 // Check job status every 5 seconds

/**
 * Schedule Phase 2 refinement after Phase 1 completes
 * @param {string} userId - User ID
 * @param {string} phase1JobId - Phase 1 reclassification job ID
 * @returns {string} Schedule ID
 */
export const schedulePhase2AfterPhase1 = (userId, phase1JobId) => {
  try {
    const scheduleId = `phase2_${userId}_${Date.now()}`
    
    console.log(`📅 Scheduling Phase 2 refinement for user ${userId} after Phase 1 job ${phase1JobId}`)

    // Monitor Phase 1 job completion
    const monitor = setInterval(async () => {
      try {
        const job = await ReclassificationJob.findById(phase1JobId)
        
        if (!job) {
          console.log(`⚠️ Phase 1 job ${phase1JobId} not found, stopping monitor`)
          clearInterval(monitor)
          jobMonitors.delete(scheduleId)
          return
        }

        if (job.status === 'completed') {
          console.log(`✅ Phase 1 completed for user ${userId}, starting Phase 2`)
          
          // Clear monitor
          clearInterval(monitor)
          jobMonitors.delete(scheduleId)
          
          // Start Phase 2
          await startPhase2Refinement(userId, job)
          
        } else if (job.status === 'failed') {
          console.log(`❌ Phase 1 failed for user ${userId}, not starting Phase 2`)
          clearInterval(monitor)
          jobMonitors.delete(scheduleId)
          
          // Notify user of failure
          await notificationService.sendSystemAlert(userId, {
            title: 'Classification Failed',
            message: `Phase 1 classification failed: ${job.errorMessage}. Phase 2 refinement will not start.`,
            data: { jobId: phase1JobId, error: job.errorMessage }
          })
        }

      } catch (error) {
        console.error(`❌ Error monitoring Phase 1 job:`, error)
      }
    }, POLLING_INTERVAL)

    jobMonitors.set(scheduleId, monitor)
    scheduledJobs.set(scheduleId, {
      userId,
      phase1JobId,
      type: 'phase2_refinement',
      scheduledAt: new Date(),
      status: 'monitoring'
    })

    return scheduleId

  } catch (error) {
    console.error(`❌ Error scheduling Phase 2:`, error)
    throw error
  }
}

/**
 * Start Phase 2 refinement after Phase 1 completion
 * @param {string} userId - User ID
 * @param {Object} phase1Job - Completed Phase 1 job
 */
const startPhase2Refinement = async (userId, phase1Job) => {
  try {
    console.log(`🚀 Starting Phase 2 refinement for user ${userId}`)

    // Send notification that Phase 2 is starting
    await notificationService.sendSystemAlert(userId, {
      title: '🔄 Phase 2 Started',
      message: `Initial classification complete (${phase1Job.successfulClassifications} emails). Now refining classifications for higher accuracy...`,
      data: {
        phase: 'Phase 2',
        phase1Stats: {
          totalEmails: phase1Job.totalEmails,
          successfulClassifications: phase1Job.successfulClassifications,
          failedClassifications: phase1Job.failedClassifications
        }
      }
    })

    // Start background refinement
    const refinementJobId = await startBackgroundRefinement(userId)

    console.log(`✅ Phase 2 refinement started for user ${userId}, job ID: ${refinementJobId}`)

  } catch (error) {
    console.error(`❌ Error starting Phase 2:`, error)
    
    // Notify user of error
    await notificationService.sendSystemAlert(userId, {
      title: 'Refinement Error',
      message: `Failed to start Phase 2 refinement: ${error.message}`,
      data: { error: error.message }
    })
  }
}

/**
 * Cancel a scheduled job
 * @param {string} scheduleId - Schedule ID
 * @returns {boolean} Success status
 */
export const cancelScheduledJob = (scheduleId) => {
  try {
    const monitor = jobMonitors.get(scheduleId)
    if (monitor) {
      clearInterval(monitor)
      jobMonitors.delete(scheduleId)
    }

    const job = scheduledJobs.get(scheduleId)
    if (job) {
      scheduledJobs.delete(scheduleId)
      console.log(`⏸️ Cancelled scheduled job: ${scheduleId}`)
      return true
    }

    return false
  } catch (error) {
    console.error(`❌ Error cancelling scheduled job:`, error)
    return false
  }
}

/**
 * Get all scheduled jobs
 * @returns {Array} Scheduled jobs
 */
export const getScheduledJobs = () => {
  const jobs = []
  scheduledJobs.forEach((job, scheduleId) => {
    jobs.push({
      scheduleId,
      ...job
    })
  })
  return jobs
}

/**
 * Get scheduled jobs for a specific user
 * @param {string} userId - User ID
 * @returns {Array} User's scheduled jobs
 */
export const getUserScheduledJobs = (userId) => {
  const jobs = []
  scheduledJobs.forEach((job, scheduleId) => {
    if (job.userId === userId) {
      jobs.push({
        scheduleId,
        ...job
      })
    }
  })
  return jobs
}

/**
 * Monitor and auto-schedule Phase 2 for active Phase 1 jobs
 * This runs on service startup to catch any jobs that completed while server was down
 */
export const initializeJobScheduler = async () => {
  try {
    console.log('🚀 Initializing background job scheduler...')

    // Find all recently completed Phase 1 jobs that might need Phase 2
    const completedJobs = await ReclassificationJob.find({
      status: 'completed',
      completedAt: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    }).sort({ completedAt: -1 })

    for (const job of completedJobs) {
      // Check if Phase 2 is already running or completed
      const refinementStatus = await getRefinementStatus(job.userId.toString())
      
      if (refinementStatus && !refinementStatus.isActive && refinementStatus.progress.pendingEmails > 0) {
        console.log(`🔄 Auto-starting Phase 2 for user ${job.userId} (found completed Phase 1)`)
        await startPhase2Refinement(job.userId.toString(), job)
      }
    }

    // Monitor active Phase 1 jobs
    const activeJobs = await ReclassificationJob.find({
      status: { $in: ['pending', 'processing'] }
    })

    for (const job of activeJobs) {
      schedulePhase2AfterPhase1(job.userId.toString(), job._id.toString())
    }

    console.log(`✅ Job scheduler initialized. Monitoring ${activeJobs.length} active jobs`)

  } catch (error) {
    console.error(`❌ Error initializing job scheduler:`, error)
  }
}

/**
 * Cleanup old scheduled jobs (maintenance)
 */
export const cleanupOldJobs = () => {
  const now = Date.now()
  const MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

  let cleaned = 0
  scheduledJobs.forEach((job, scheduleId) => {
    const age = now - job.scheduledAt.getTime()
    if (age > MAX_AGE) {
      cancelScheduledJob(scheduleId)
      cleaned++
    }
  })

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} old scheduled jobs`)
  }
}

/**
 * Get scheduler statistics
 * @returns {Object} Scheduler stats
 */
export const getSchedulerStats = () => {
  return {
    totalScheduledJobs: scheduledJobs.size,
    activeMonitors: jobMonitors.size,
    jobs: Array.from(scheduledJobs.entries()).map(([id, job]) => ({
      scheduleId: id,
      userId: job.userId,
      type: job.type,
      status: job.status,
      scheduledAt: job.scheduledAt
    }))
  }
}

// Schedule periodic cleanup
setInterval(() => {
  cleanupOldJobs()
}, 60 * 60 * 1000) // Run every hour

export default {
  schedulePhase2AfterPhase1,
  cancelScheduledJob,
  getScheduledJobs,
  getUserScheduledJobs,
  initializeJobScheduler,
  cleanupOldJobs,
  getSchedulerStats
}

