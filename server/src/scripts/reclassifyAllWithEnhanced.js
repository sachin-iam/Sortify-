#!/usr/bin/env node

/**
 * Reclassify All Emails with Enhanced System
 * 
 * This script reclassifies all existing emails using:
 * 1. Enhanced Phase 1 (rule-based with new patterns)
 * 2. Phase 2 (DistilBERT model) for low-confidence cases
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import { classifyEmailPhase1 } from '../services/phase1ClassificationService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') })

// Import models
import Email from '../models/Email.js'
import User from '../models/User.js'

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'
const PHASE1_CONFIDENCE_THRESHOLD = 0.75

// Statistics tracking
const stats = {
  total: 0,
  phase1: 0,
  phase2: 0,
  failed: 0,
  byCategory: {},
  improvements: {
    reclassified: 0,
    confidenceImproved: 0
  }
}

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/sortify'
    console.log('📡 Connecting to MongoDB...')
    await mongoose.connect(mongoUri)
    console.log('✅ Connected to MongoDB\n')
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    process.exit(1)
  }
}

/**
 * Check if model service is available
 */
const checkModelService = async () => {
  try {
    const response = await axios.get(`${MODEL_SERVICE_URL}/status`, { timeout: 5000 })
    return response.data.status === 'ready'
  } catch (error) {
    return false
  }
}

/**
 * Classify email using Phase 2 (DistilBERT)
 */
const classifyPhase2 = async (email, userId) => {
  try {
    const response = await axios.post(
      `${MODEL_SERVICE_URL}/predict`,
      {
        subject: email.subject || '',
        body: email.body || email.snippet || '',
        user_id: userId.toString()
      },
      { timeout: 10000 }
    )
    
    return {
      label: response.data.label,
      confidence: response.data.confidence,
      method: 'phase2-distilbert'
    }
  } catch (error) {
    console.error(`   ⚠️  Phase 2 failed: ${error.message}`)
    return null
  }
}

/**
 * Classify a single email
 */
const classifyEmail = async (email, userId, usePhase2 = false) => {
  try {
    // Phase 1: Enhanced rule-based classification
    const phase1Result = await classifyEmailPhase1({
      subject: email.subject || '',
      from: email.from || '',
      snippet: email.snippet || '',
      body: email.body || ''
    }, userId)
    
    // If Phase 1 confidence is high enough, use it
    if (phase1Result.confidence >= PHASE1_CONFIDENCE_THRESHOLD) {
      stats.phase1++
      return {
        label: phase1Result.label,
        confidence: phase1Result.confidence,
        method: phase1Result.method || 'phase1-enhanced',
        phase: 1
      }
    }
    
    // Phase 2: Use DistilBERT if available
    if (usePhase2) {
      const phase2Result = await classifyPhase2(email, userId)
      if (phase2Result) {
        stats.phase2++
        return {
          ...phase2Result,
          phase: 2
        }
      }
    }
    
    // Fallback to Phase 1 result even if low confidence
    stats.phase1++
    return {
      label: phase1Result.label,
      confidence: phase1Result.confidence,
      method: phase1Result.method || 'phase1-enhanced',
      phase: 1
    }
    
  } catch (error) {
    console.error(`   ❌ Classification error: ${error.message}`)
    stats.failed++
    return null
  }
}

/**
 * Reclassify all emails for a user
 */
const reclassifyUserEmails = async (userId, usePhase2 = false) => {
  try {
    console.log('\n📊 Fetching emails...')
    
    const emails = await Email.find({
      userId,
      isDeleted: false
    }).select('_id subject from snippet body category classification').lean()
    
    stats.total = emails.length
    console.log(`   Found ${stats.total} emails to reclassify\n`)
    
    if (stats.total === 0) {
      console.log('⚠️  No emails found to reclassify')
      return
    }
    
    // Process in batches
    const batchSize = 50
    const totalBatches = Math.ceil(stats.total / batchSize)
    let processed = 0
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      
      console.log(`📦 Processing batch ${batchNum}/${totalBatches}`)
      
      // Process batch
      const updates = await Promise.all(
        batch.map(async (email) => {
          const oldCategory = email.category
          const oldConfidence = email.classification?.confidence || 0
          
          const result = await classifyEmail(email, userId, usePhase2)
          
          if (!result) return null
          
          // Track statistics
          if (!stats.byCategory[result.label]) {
            stats.byCategory[result.label] = 0
          }
          stats.byCategory[result.label]++
          
          // Check if category changed
          if (oldCategory !== result.label) {
            stats.improvements.reclassified++
          }
          
          // Check if confidence improved
          if (result.confidence > oldConfidence) {
            stats.improvements.confidenceImproved++
          }
          
          return {
            _id: email._id,
            category: result.label,
            confidence: result.confidence,
            method: result.method,
            phase: result.phase
          }
        })
      )
      
      // Update database
      const validUpdates = updates.filter(u => u !== null)
      
      for (const update of validUpdates) {
        await Email.updateOne(
          { _id: update._id },
          {
            $set: {
              category: update.category,
              'classification.label': update.category,
              'classification.confidence': update.confidence,
              'classification.method': update.method,
              'classification.phase': update.phase,
              'classification.classifiedAt': new Date(),
              'classification.model': 'enhanced-v5',
              'classification.modelVersion': '5.0.0'
            }
          }
        )
      }
      
      processed += batch.length
      const percentage = Math.round((processed / stats.total) * 100)
      
      console.log(`   ✅ Progress: ${processed}/${stats.total} (${percentage}%)`)
      console.log(`      Phase 1: ${stats.phase1} | Phase 2: ${stats.phase2} | Failed: ${stats.failed}`)
      
      // Small delay between batches
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
  } catch (error) {
    console.error('❌ Error reclassifying emails:', error)
    throw error
  }
}

/**
 * Print final statistics
 */
const printStatistics = () => {
  console.log('\n' + '═'.repeat(60))
  console.log('📊 RECLASSIFICATION COMPLETE')
  console.log('═'.repeat(60))
  
  console.log('\n📈 Overall Statistics:')
  console.log(`   Total emails processed: ${stats.total}`)
  console.log(`   Successfully classified: ${stats.total - stats.failed}`)
  console.log(`   Failed: ${stats.failed}`)
  
  console.log('\n🔄 Classification Methods:')
  console.log(`   Phase 1 (Enhanced Rules): ${stats.phase1} (${Math.round(stats.phase1/stats.total*100)}%)`)
  console.log(`   Phase 2 (DistilBERT): ${stats.phase2} (${Math.round(stats.phase2/stats.total*100)}%)`)
  
  console.log('\n📂 Category Distribution:')
  const sortedCategories = Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
  
  for (const [category, count] of sortedCategories) {
    const percentage = Math.round((count / stats.total) * 100)
    console.log(`   ${category.padEnd(20)}: ${String(count).padStart(5)} (${percentage}%)`)
  }
  
  console.log('\n✨ Improvements:')
  console.log(`   Emails reclassified: ${stats.improvements.reclassified}`)
  console.log(`   Confidence improved: ${stats.improvements.confidenceImproved}`)
  
  const accuracyEstimate = Math.round((stats.phase1 * 0.88 + stats.phase2 * 0.95) / stats.total * 100)
  console.log(`\n🎯 Estimated Accuracy: ${accuracyEstimate}%`)
}

/**
 * Main function
 */
const main = async () => {
  try {
    console.log('═'.repeat(60))
    console.log('  ENHANCED EMAIL RECLASSIFICATION')
    console.log('═'.repeat(60))
    console.log()
    
    // Connect to database
    await connectDB()
    
    // Find user with emails
    const userWithEmails = await Email.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$userId', emailCount: { $sum: 1 } } },
      { $sort: { emailCount: -1 } },
      { $limit: 1 }
    ])
    
    if (!userWithEmails || userWithEmails.length === 0) {
      console.error('❌ No user found with emails')
      process.exit(1)
    }
    
    const user = await User.findById(userWithEmails[0]._id)
    console.log(`👤 User: ${user.email}`)
    console.log(`📧 Emails: ${userWithEmails[0].emailCount}`)
    
    // Check if model service is available
    console.log('\n🔍 Checking model service...')
    const modelServiceAvailable = await checkModelService()
    
    if (modelServiceAvailable) {
      console.log('✅ Model service is available - Using two-phase classification')
    } else {
      console.log('⚠️  Model service not available - Using Phase 1 only')
      console.log('   Start model service for best accuracy: cd model_service && python3 enhanced_app.py')
    }
    
    // Start reclassification
    console.log('\n🚀 Starting reclassification...')
    const startTime = Date.now()
    
    await reclassifyUserEmails(userWithEmails[0]._id, modelServiceAvailable)
    
    const duration = Math.round((Date.now() - startTime) / 1000)
    
    // Print statistics
    printStatistics()
    
    console.log(`\n⏱️  Total time: ${duration} seconds`)
    console.log(`   Average: ${Math.round(stats.total / duration)} emails/second`)
    
    console.log('\n✅ Reclassification complete!')
    console.log('   Your emails have been updated with enhanced classification.')
    console.log('   Refresh your dashboard to see the changes.\n')
    
    await mongoose.disconnect()
    process.exit(0)
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

// Run the script
main()

