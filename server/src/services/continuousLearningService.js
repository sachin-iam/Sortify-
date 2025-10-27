/**
 * Continuous Learning Service
 * Monitors email recategorization events and automatically updates category patterns
 */

import mongoose from 'mongoose'
import Email from '../models/Email.js'
import Category from '../models/Category.js'
import { extractPatternsFromSamples } from './patternExtractionService.js'
import { sendCategoryUpdate } from './websocketService.js'
import mlCategorySync from './mlCategorySync.js'

// Store learning queues to prevent duplicate processing
const learningQueues = new Map()
const LEARNING_BATCH_SIZE = 10
const LEARNING_DELAY = 5000 // 5 seconds delay between learning cycles

/**
 * Handle email recategorization event
 * @param {string} emailId - Email ID
 * @param {string} oldCategory - Previous category
 * @param {string} newCategory - New category
 * @param {string} userId - User ID
 */
export const onEmailRecategorized = async (emailId, oldCategory, newCategory, userId) => {
  try {
    console.log(`🔄 Email ${emailId} recategorized from "${oldCategory}" to "${newCategory}"`)

    // Add to learning queue for the new category
    const queueKey = `${userId}_${newCategory}`
    if (!learningQueues.has(queueKey)) {
      learningQueues.set(queueKey, [])
    }
    
    const queue = learningQueues.get(queueKey)
    queue.push(emailId)

    // Start learning process if not already running
    if (queue.length === 1) {
      setTimeout(() => processLearningQueue(userId, newCategory), LEARNING_DELAY)
    }

    // Update category sample emails
    await updateCategorySampleEmails(userId, newCategory, emailId)

  } catch (error) {
    console.error('❌ Error handling email recategorization:', error)
  }
}

/**
 * Update category patterns from user feedback
 * @param {string} categoryId - Category ID
 * @param {Array} emailSamples - Array of email samples
 */
export const updateCategoryPatternsFromFeedback = async (categoryId, emailSamples) => {
  try {
    const category = await Category.findById(categoryId)
    if (!category) {
      throw new Error('Category not found')
    }

    console.log(`🧠 Updating patterns for category "${category.name}" from ${emailSamples.length} samples`)

    // Extract patterns from samples
    const patternResult = await extractPatternsFromSamples(emailSamples, category.userId.toString())
    
    // Update category with new patterns
    const updatedStrategy = {
      ...category.classificationStrategy,
      ...patternResult.classificationStrategy,
      lastUpdated: new Date(),
      learningSource: 'user_feedback'
    }

    await Category.findByIdAndUpdate(categoryId, {
      classificationStrategy: updatedStrategy,
      patterns: patternResult.patterns,
      updatedAt: new Date()
    })

    // Sync to ML service
    try {
      await mlCategorySync.syncCategoryToML(category)
      console.log(`✅ Category "${category.name}" patterns updated and synced to ML service`)
    } catch (mlError) {
      console.warn('⚠️ Failed to sync updated patterns to ML service:', mlError.message)
    }

    // Send WebSocket update
    sendCategoryUpdate(category.userId.toString(), {
      type: 'category_learned',
      categoryId: categoryId,
      categoryName: category.name,
      message: `Category "${category.name}" learned from ${emailSamples.length} new examples`
    })

  } catch (error) {
    console.error('❌ Error updating category patterns:', error)
  }
}

/**
 * Schedule incremental retraining for a category
 * @param {string} categoryId - Category ID
 */
export const scheduleIncrementalRetraining = async (categoryId) => {
  try {
    const category = await Category.findById(categoryId)
    if (!category) {
      throw new Error('Category not found')
    }

    console.log(`🔄 Scheduling incremental retraining for category "${category.name}"`)

    // Update training status
    await Category.findByIdAndUpdate(categoryId, {
      trainingStatus: 'training',
      updatedAt: new Date()
    })

    // Trigger ML service retraining
    try {
      await mlCategorySync.trainCategoryInML(category)
      
      await Category.findByIdAndUpdate(categoryId, {
        trainingStatus: 'completed',
        updatedAt: new Date()
      })

      console.log(`✅ Incremental retraining completed for category "${category.name}"`)
    } catch (mlError) {
      console.error('❌ ML retraining failed:', mlError)
      await Category.findByIdAndUpdate(categoryId, {
        trainingStatus: 'failed',
        updatedAt: new Date()
      })
    }

  } catch (error) {
    console.error('❌ Error scheduling incremental retraining:', error)
  }
}

/**
 * Process learning queue for a category
 * @param {string} userId - User ID
 * @param {string} categoryName - Category name
 */
const processLearningQueue = async (userId, categoryName) => {
  const queueKey = `${userId}_${categoryName}`
  const queue = learningQueues.get(queueKey)
  
  if (!queue || queue.length === 0) {
    learningQueues.delete(queueKey)
    return
  }

  try {
    // Process batch of emails
    const batchSize = Math.min(LEARNING_BATCH_SIZE, queue.length)
    const emailBatch = queue.splice(0, batchSize)

    console.log(`🧠 Processing learning batch for "${categoryName}": ${emailBatch.length} emails`)

    // Find category
    const category = await Category.findOne({ 
      userId: new mongoose.Types.ObjectId(userId), 
      name: categoryName 
    })

    if (!category) {
      console.warn(`Category "${categoryName}" not found for user ${userId}`)
      return
    }

    // Update patterns from this batch
    await updateCategoryPatternsFromFeedback(category._id.toString(), emailBatch)

    // Schedule next batch if more emails in queue
    if (queue.length > 0) {
      setTimeout(() => processLearningQueue(userId, categoryName), LEARNING_DELAY)
    } else {
      learningQueues.delete(queueKey)
    }

  } catch (error) {
    console.error('❌ Error processing learning queue:', error)
    learningQueues.delete(queueKey)
  }
}

/**
 * Update category sample emails
 * @param {string} userId - User ID
 * @param {string} categoryName - Category name
 * @param {string} emailId - Email ID to add
 */
const updateCategorySampleEmails = async (userId, categoryName, emailId) => {
  try {
    await Category.findOneAndUpdate(
      { 
        userId: new mongoose.Types.ObjectId(userId), 
        name: categoryName 
      },
      { 
        $addToSet: { sampleEmailIds: new mongoose.Types.ObjectId(emailId) },
        $inc: { emailCount: 1 }
      }
    )
  } catch (error) {
    console.error('❌ Error updating category sample emails:', error)
  }
}

/**
 * Get learning statistics for a category
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object>} Learning statistics
 */
export const getLearningStats = async (categoryId) => {
  try {
    const category = await Category.findById(categoryId)
    if (!category) {
      throw new Error('Category not found')
    }

    return {
      categoryId: category._id,
      categoryName: category.name,
      sampleEmailCount: category.sampleEmailIds?.length || 0,
      learningMode: category.learningMode,
      lastUpdated: category.updatedAt,
      trainingStatus: category.trainingStatus,
      queueSize: learningQueues.get(`${category.userId}_${category.name}`)?.length || 0
    }
  } catch (error) {
    console.error('❌ Error getting learning stats:', error)
    return null
  }
}

/**
 * Clear learning queue for a category
 * @param {string} userId - User ID
 * @param {string} categoryName - Category name
 */
export const clearLearningQueue = (userId, categoryName) => {
  const queueKey = `${userId}_${categoryName}`
  learningQueues.delete(queueKey)
  console.log(`🧹 Cleared learning queue for category "${categoryName}"`)
}

export default {
  onEmailRecategorized,
  updateCategoryPatternsFromFeedback,
  scheduleIncrementalRetraining,
  getLearningStats,
  clearLearningQueue
}
