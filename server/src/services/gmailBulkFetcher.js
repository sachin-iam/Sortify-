/**
 * Gmail Bulk Fetcher Service
 * Fetches full email bodies from Gmail API for all existing emails in database
 * Used for training data collection
 */

import { google } from 'googleapis'
import Email from '../models/Email.js'
import User from '../models/User.js'
import { getOAuthForUser } from './gmailSyncService.js'
import pLimit from 'p-limit'

// Concurrency limit for Gmail API calls
const GMAIL_API_CONCURRENCY = 5

/**
 * Fetch full email body from Gmail API
 * @param {Object} oauth2Client - Gmail OAuth2 client
 * @param {string} gmailId - Gmail message ID
 * @returns {Promise<Object>} Email body content (html, text)
 */
export const fetchFullEmailBody = async (oauth2Client, gmailId) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: gmailId,
      format: 'full'
    })

    const message = response.data
    const payload = message.payload
    
    let html = ''
    let text = ''
    
    // Extract body content
    const extractContent = (part) => {
      if (part.mimeType === 'text/html' && part.body?.data) {
        html = Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        text = Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.mimeType?.startsWith('multipart/') && part.parts) {
        for (const subPart of part.parts) {
          extractContent(subPart)
        }
      }
    }

    if (payload?.body?.data) {
      // Simple message
      if (payload.mimeType === 'text/html') {
        html = Buffer.from(payload.body.data, 'base64').toString('utf-8')
      } else if (payload.mimeType === 'text/plain') {
        text = Buffer.from(payload.body.data, 'base64').toString('utf-8')
      }
    } else if (payload?.parts) {
      // Multipart message
      for (const part of payload.parts) {
        extractContent(part)
      }
    }

    // Return the full body (prefer text, fallback to html, then snippet)
    const fullBody = text || html || message.snippet || ''
    
    return {
      html,
      text,
      fullBody,
      snippet: message.snippet || ''
    }
  } catch (error) {
    console.error(`❌ Error fetching email ${gmailId}:`, error.message)
    throw error
  }
}

/**
 * Fetch full bodies for all emails in database
 * @param {Object} user - User object
 * @param {Object} options - Options
 * @param {number} options.batchSize - Batch size for processing
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} Results with statistics
 */
export const fetchAllEmailBodies = async (user, options = {}) => {
  const {
    batchSize = 100,
    onProgress = null
  } = options

  try {
    console.log(`\n🚀 Starting bulk email body fetch for user: ${user.email}`)

    if (!user.gmailConnected || !user.gmailAccessToken) {
      throw new Error('Gmail account not connected')
    }

    // Initialize OAuth2 client
    const oauth2Client = getOAuthForUser(user)

    // Get all emails that don't have full bodies yet
    const emails = await Email.find({
      userId: user._id,
      provider: 'gmail',
      isDeleted: false,
      gmailId: { $exists: true, $ne: null }
    })
    .select('_id gmailId subject from date html text body')
    .lean()

    if (emails.length === 0) {
      console.log('⚠️  No emails found to fetch')
      return {
        success: true,
        total: 0,
        fetched: 0,
        failed: 0,
        skipped: 0
      }
    }

    console.log(`📧 Found ${emails.length} emails to fetch full bodies`)

    // Initialize statistics
    const stats = {
      total: emails.length,
      fetched: 0,
      failed: 0,
      skipped: 0,
      errors: []
    }

    // Create concurrency limiter
    const limit = pLimit(GMAIL_API_CONCURRENCY)

    // Process emails in batches
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(emails.length / batchSize)

      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} emails)`)

      // Process batch with concurrency control
      const results = await Promise.all(
        batch.map(email => limit(async () => {
          try {
            // Skip if already has full body
            if (email.text || email.html || (email.body && email.body.length > 100)) {
              stats.skipped++
              return { success: true, skipped: true }
            }

            // Fetch full body from Gmail
            const bodyContent = await fetchFullEmailBody(oauth2Client, email.gmailId)

            // Update email in database with full body
            await Email.updateOne(
              { _id: email._id },
              {
                $set: {
                  html: bodyContent.html,
                  text: bodyContent.text,
                  body: bodyContent.fullBody,
                  fullBody: bodyContent.fullBody,
                  isFullContentLoaded: true,
                  fullContentLoadedAt: new Date(),
                  isTrainingData: true
                }
              }
            )

            stats.fetched++
            return { success: true, emailId: email._id }
          } catch (error) {
            stats.failed++
            stats.errors.push({
              emailId: email._id,
              gmailId: email.gmailId,
              subject: email.subject,
              error: error.message
            })
            return { success: false, error: error.message }
          }
        }))
      )

      // Call progress callback
      if (onProgress) {
        const progress = {
          current: Math.min(i + batchSize, emails.length),
          total: emails.length,
          percentage: Math.round((Math.min(i + batchSize, emails.length) / emails.length) * 100),
          fetched: stats.fetched,
          failed: stats.failed,
          skipped: stats.skipped
        }
        onProgress(progress)
      }

      // Progress logging
      console.log(`✅ Batch complete - Fetched: ${stats.fetched}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`)

      // Rate limiting - wait between batches
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`\n✅ Bulk fetch complete!`)
    console.log(`   Total: ${stats.total}`)
    console.log(`   Fetched: ${stats.fetched}`)
    console.log(`   Skipped: ${stats.skipped}`)
    console.log(`   Failed: ${stats.failed}`)

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`)
      stats.errors.slice(0, 10).forEach(err => {
        console.log(`   - ${err.subject}: ${err.error}`)
      })
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more`)
      }
    }

    return {
      success: true,
      ...stats
    }
  } catch (error) {
    console.error('❌ Bulk fetch failed:', error)
    throw error
  }
}

/**
 * Cleanup full bodies from database (after training)
 * Removes fullBody field and isTrainingData flag
 * Keeps only essential fields: subject, from, snippet, classification
 */
export const cleanupFullBodies = async (userId) => {
  try {
    console.log('\n🧹 Cleaning up full email bodies from database...')

    const result = await Email.updateMany(
      { 
        userId,
        isTrainingData: true
      },
      {
        $unset: {
          fullBody: '',
          html: '',
          text: '',
          body: ''
        },
        $set: {
          isTrainingData: false,
          isFullContentLoaded: false
        }
      }
    )

    console.log(`✅ Cleaned up ${result.modifiedCount} emails`)
    console.log(`   Removed: fullBody, html, text, body fields`)
    console.log(`   Kept: subject, from, snippet, classification`)

    return {
      success: true,
      cleaned: result.modifiedCount
    }
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    throw error
  }
}

export default {
  fetchFullEmailBody,
  fetchAllEmailBodies,
  cleanupFullBodies
}

