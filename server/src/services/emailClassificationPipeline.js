/**
 * Email Classification Pipeline
 * Handles automatic classification of new emails with full body content
 * Workflow: Classify with Model → Cache Result → Remove Full Body
 */

import axios from 'axios'
import Email from '../models/Email.js'
import pLimit from 'p-limit'

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'
const CLASSIFICATION_CONCURRENCY = 3

// Rate limiter for classification requests
const limit = pLimit(CLASSIFICATION_CONCURRENCY)

/**
 * Classify a single email and cache the result
 * @param {Object} email - Email document
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Classification result
 */
export const classifyAndCache = async (email, userId) => {
  try {
    // Use full body if available, fallback to snippet
    const body = email.fullBody || email.text || email.html || email.body || email.snippet || ''
    
    // Call model service for classification
    const response = await axios.post(
      `${MODEL_SERVICE_URL}/predict`,
      {
        subject: email.subject || '',
        body: body,
        user_id: userId
      },
      { timeout: 15000 }
    )

    if (!response.data || !response.data.label) {
      throw new Error('Invalid classification response')
    }

    const classification = {
      label: response.data.label,
      confidence: response.data.confidence || 0.5,
      scores: response.data.scores || {},
      model: 'distilbert-trained',
      modelVersion: '3.0.0',
      classifiedAt: new Date(),
      cachedAt: new Date()
    }

    // Update email with classification and remove full body
    await Email.updateOne(
      { _id: email._id },
      {
        $set: {
          category: classification.label,
          'classification.label': classification.label,
          'classification.confidence': classification.confidence,
          'classification.classifiedAt': classification.classifiedAt,
          'classification.model': classification.model,
          'classification.modelVersion': classification.modelVersion,
          needsClassification: false,
          isFullContentLoaded: false
        },
        $unset: {
          fullBody: '',
          html: '',
          text: '',
          body: ''
        }
      }
    )

    console.log(`✅ Classified and cached: "${email.subject}" → ${classification.label} (${classification.confidence.toFixed(2)})`)

    return {
      success: true,
      emailId: email._id,
      classification
    }
  } catch (error) {
    console.error(`❌ Failed to classify email ${email._id}:`, error.message)
    
    // Mark as failed but don't leave full body
    await Email.updateOne(
      { _id: email._id },
      {
        $set: {
          needsClassification: false,
          'classification.label': 'Other',
          'classification.confidence': 0.3,
          'classification.error': error.message
        },
        $unset: {
          fullBody: '',
          html: '',
          text: '',
          body: ''
        }
      }
    )

    return {
      success: false,
      emailId: email._id,
      error: error.message
    }
  }
}

/**
 * Process pending emails that need classification
 * @param {string} userId - User ID
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing results
 */
export const processPendingClassifications = async (userId, options = {}) => {
  const {
    batchSize = 50,
    maxEmails = null
  } = options

  try {
    // Find emails that need classification
    const query = {
      userId,
      needsClassification: true,
      isDeleted: false
    }

    const total = await Email.countDocuments(query)

    if (total === 0) {
      return {
        success: true,
        total: 0,
        processed: 0,
        failed: 0
      }
    }

    console.log(`\n🤖 Processing ${total} pending classifications...`)

    const limit_emails = maxEmails ? Math.min(total, maxEmails) : total
    let processed = 0
    let failed = 0

    // Process in batches
    for (let skip = 0; skip < limit_emails; skip += batchSize) {
      const emails = await Email.find(query)
        .select('_id subject from snippet fullBody text html body')
        .skip(skip)
        .limit(batchSize)
        .lean()

      if (emails.length === 0) break

      console.log(`📦 Processing batch ${Math.floor(skip / batchSize) + 1} (${emails.length} emails)`)

      // Classify emails in parallel with concurrency limit
      const results = await Promise.all(
        emails.map(email => limit(() => classifyAndCache(email, userId)))
      )

      processed += results.filter(r => r.success).length
      failed += results.filter(r => !r.success).length

      console.log(`   Processed: ${processed}, Failed: ${failed}`)

      // Small delay between batches
      if (skip + batchSize < limit_emails) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log(`\n✅ Pending classifications complete!`)
    console.log(`   Total: ${total}`)
    console.log(`   Processed: ${processed}`)
    console.log(`   Failed: ${failed}`)

    return {
      success: true,
      total,
      processed,
      failed
    }
  } catch (error) {
    console.error('❌ Failed to process pending classifications:', error)
    throw error
  }
}

/**
 * Start background worker to process classifications
 * Runs every 30 seconds to check for pending classifications
 * @param {string} userId - User ID
 * @returns {Object} Worker control object
 */
export const startClassificationWorker = (userId) => {
  const INTERVAL = 30000 // 30 seconds

  let isRunning = false
  let intervalId = null

  const worker = async () => {
    if (isRunning) {
      console.log('⏳ Classification worker already running, skipping...')
      return
    }

    isRunning = true
    try {
      await processPendingClassifications(userId, {
        batchSize: 20,
        maxEmails: 100
      })
    } catch (error) {
      console.error('❌ Classification worker error:', error)
    } finally {
      isRunning = false
    }
  }

  // Start the interval
  intervalId = setInterval(worker, INTERVAL)

  console.log('🚀 Classification worker started (checks every 30s)')

  return {
    stop: () => {
      if (intervalId) {
        clearInterval(intervalId)
        console.log('🛑 Classification worker stopped')
      }
    },
    isRunning: () => isRunning
  }
}

/**
 * Classify a single email immediately (for manual triggering)
 * @param {string} emailId - Email ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Classification result
 */
export const classifyEmailById = async (emailId, userId) => {
  try {
    const email = await Email.findOne({
      _id: emailId,
      userId
    })
    .select('_id subject from snippet fullBody text html body')
    .lean()

    if (!email) {
      throw new Error('Email not found')
    }

    return await classifyAndCache(email, userId)
  } catch (error) {
    console.error(`❌ Failed to classify email ${emailId}:`, error)
    throw error
  }
}

export default {
  classifyAndCache,
  processPendingClassifications,
  startClassificationWorker,
  classifyEmailById
}

