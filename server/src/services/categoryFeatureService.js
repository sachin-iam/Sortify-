/**
 * Category Feature Service
 * Complete workflow for adding/updating category with feature extraction
 */

import axios from 'axios'
import { extractPatternsForCategory } from './patternExtractionService.js'
import { syncCategoryToML, trainCategoryInML } from './mlCategorySync.js'
import Email from '../models/Email.js'

const ML_SERVICE_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'

/**
 * Complete workflow for adding/updating category with feature extraction
 */
export const processNewCategoryWithFeatures = async (userId, category, sampleEmails = null) => {
  const startTime = Date.now()
  
  try {
    console.log(`🚀 Starting complete feature extraction for "${category.name}"`)
    
    // Step 1: Extract patterns from existing emails (Node.js side)
    console.log(`📊 Step 1/6: Analyzing email patterns...`)
    const patterns = await extractPatternsForCategory(userId, category.name, 1000, sampleEmails)
    
    // Step 2: Enhance category with extracted patterns
    console.log(`🔧 Step 2/6: Building classification strategy...`)
    const enhancedCategory = {
      ...category,
      classificationStrategy: patterns.classificationStrategy,
      patterns: patterns.patterns
    }
    
    // Step 3: Sync to ML service (creates category in Python)
    console.log(`🔄 Step 3/6: Syncing to ML service...`)
    await syncCategoryToML(enhancedCategory)
    
    // Step 4: Get sample emails for training
    console.log(`📧 Step 4/6: Preparing training samples...`)
    if (!sampleEmails) {
      sampleEmails = await Email.find({ userId })
        .select('subject body text snippet from to')
        .limit(100)
        .sort({ date: -1 })
    }
    
    // Step 5: Train ML model with enhanced features
    console.log(`🤖 Step 5/6: Training ML model...`)
    await trainCategoryInML(enhancedCategory, sampleEmails)
    
    // Step 6: Trigger full ML rebuild to extract features
    console.log(`🔨 Step 6/6: Triggering ML feature rebuild...`)
    const rebuildResponse = await axios.post(`${ML_SERVICE_BASE_URL}/categories/rebuild-all`, {}, {
      timeout: 60000
    })
    
    const totalTime = Date.now() - startTime
    
    console.log(`✅ Feature extraction completed in ${totalTime}ms`)
    
    return {
      success: true,
      category: enhancedCategory,
      patterns,
      estimatedReclassificationTime: rebuildResponse.data?.estimated_time_seconds || 60,
      processTime: totalTime
    }
    
  } catch (error) {
    console.error(`❌ Feature extraction failed:`, error)
    throw error
  }
}

/**
 * Estimate reclassification time based on email count
 */
export const estimateReclassificationTime = async (userId) => {
  try {
    const emailCount = await Email.countDocuments({ 
      userId, 
      isDeleted: false 
    })
    
    // Rough estimate: 100 emails per second
    const estimatedSeconds = Math.ceil(emailCount / 100)
    
    return {
      emailCount,
      estimatedSeconds,
      estimatedMinutes: Math.ceil(estimatedSeconds / 60)
    }
  } catch (error) {
    console.error('Error estimating time:', error)
    return {
      emailCount: 0,
      estimatedSeconds: 60,
      estimatedMinutes: 1
    }
  }
}
