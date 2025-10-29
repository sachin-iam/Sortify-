#!/usr/bin/env node

/**
 * Complete Training and Classification Orchestrator
 * 
 * This script orchestrates the entire process:
 * 1. Fetch full email bodies from Gmail
 * 2. Extract training data
 * 3. Train DistilBERT model
 * 4. Load trained model into service
 * 5. Classify ALL existing emails
 * 6. Cleanup full bodies from DB
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import axios from 'axios'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') })

// Import models and services
import User from '../models/User.js'
import Email from '../models/Email.js'
import { fetchAllEmailBodies, cleanupFullBodies } from '../services/gmailBulkFetcher.js'

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'
const MODEL_SERVICE_PATH = path.join(__dirname, '../../../model_service')

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
 * Run a Python script in model_service directory
 */
const runPythonScript = (scriptName, args = []) => {
  return new Promise((resolve, reject) => {
    console.log(`\n🐍 Running: python3 ${scriptName} ${args.join(' ')}`)
    
    const pythonProcess = spawn('python3', [scriptName, ...args], {
      cwd: MODEL_SERVICE_PATH,
      stdio: 'inherit',
      env: { ...process.env }
    })

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptName} completed successfully`)
        resolve()
      } else {
        console.error(`❌ ${scriptName} failed with code ${code}`)
        reject(new Error(`${scriptName} failed with code ${code}`))
      }
    })

    pythonProcess.on('error', (error) => {
      console.error(`❌ Failed to start ${scriptName}:`, error)
      reject(error)
    })
  })
}

/**
 * Check if model service is running
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
 * Load trained model into model service
 */
const loadTrainedModel = async () => {
  try {
    console.log('\n📥 Loading trained model into service...')
    
    const modelPath = path.join(MODEL_SERVICE_PATH, 'distilbert_email_model')
    
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model directory not found: ${modelPath}`)
    }

    const response = await axios.post(
      `${MODEL_SERVICE_URL}/model/load`,
      { model_path: modelPath },
      { timeout: 60000 }
    )

    if (response.data.success) {
      console.log('✅ Model loaded successfully')
      return true
    } else {
      throw new Error(response.data.message || 'Failed to load model')
    }
  } catch (error) {
    console.error('❌ Failed to load model:', error.message)
    throw error
  }
}

/**
 * Classify all emails using the trained model
 */
const classifyAllEmails = async (userId) => {
  try {
    console.log('\n🤖 Classifying ALL emails...')

    const totalEmails = await Email.countDocuments({
      userId,
      isDeleted: false
    })

    if (totalEmails === 0) {
      console.log('⚠️  No emails found to classify')
      return { total: 0, classified: 0, failed: 0 }
    }

    console.log(`📧 Found ${totalEmails} emails to classify`)

    const batchSize = 100
    let classified = 0
    let failed = 0

    // Process in batches
    for (let skip = 0; skip < totalEmails; skip += batchSize) {
      const emails = await Email.find({
        userId,
        isDeleted: false
      })
      .select('_id subject from snippet fullBody text html body')
      .skip(skip)
      .limit(batchSize)
      .lean()

      console.log(`\n📦 Processing batch ${Math.floor(skip / batchSize) + 1}/${Math.ceil(totalEmails / batchSize)}`)

      // Classify each email in batch
      const classificationPromises = emails.map(async (email) => {
        try {
          // Use full body if available, otherwise use snippet
          const body = email.fullBody || email.text || email.html || email.body || email.snippet || ''
          
          const response = await axios.post(
            `${MODEL_SERVICE_URL}/predict`,
            {
              subject: email.subject || '',
              body: body,
              user_id: userId.toString()
            },
            { timeout: 10000 }
          )

          if (response.data) {
            // Update email with classification
            await Email.updateOne(
              { _id: email._id },
              {
                $set: {
                  category: response.data.label,
                  'classification.label': response.data.label,
                  'classification.confidence': response.data.confidence,
                  'classification.classifiedAt': new Date(),
                  'classification.model': 'distilbert-trained',
                  'classification.modelVersion': '3.0.0'
                }
              }
            )

            classified++
            return { success: true }
          }
        } catch (error) {
          console.error(`❌ Failed to classify email ${email._id}:`, error.message)
          failed++
          return { success: false, error: error.message }
        }
      })

      await Promise.all(classificationPromises)

      // Progress update
      const progress = Math.min(skip + batchSize, totalEmails)
      const percentage = Math.round((progress / totalEmails) * 100)
      console.log(`📊 Progress: ${progress}/${totalEmails} (${percentage}%) - Classified: ${classified}, Failed: ${failed}`)

      // Small delay between batches
      if (skip + batchSize < totalEmails) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log(`\n✅ Classification complete!`)
    console.log(`   Total: ${totalEmails}`)
    console.log(`   Classified: ${classified}`)
    console.log(`   Failed: ${failed}`)

    return { total: totalEmails, classified, failed }
  } catch (error) {
    console.error('❌ Classification failed:', error)
    throw error
  }
}

/**
 * Get final category statistics
 */
const getCategoryStats = async (userId) => {
  try {
    const stats = await Email.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ])

    return stats
  } catch (error) {
    console.error('❌ Failed to get stats:', error)
    return []
  }
}

/**
 * Main orchestration function
 */
const main = async () => {
  try {
    console.log('═══════════════════════════════════════════════════')
    console.log('  EMAIL CLASSIFICATION TRAINING & DEPLOYMENT')
    console.log('═══════════════════════════════════════════════════\n')

    // Connect to database
    await connectDB()

    // Get first user with Gmail connected
    const user = await User.findOne({
      gmailConnected: true,
      gmailAccessToken: { $exists: true, $ne: null }
    })

    if (!user) {
      console.error('❌ No user found with Gmail connected')
      console.log('   Please connect your Gmail account first')
      process.exit(1)
    }

    console.log(`👤 User: ${user.email}`)

    // Check if model service is running
    console.log('\n🔍 Checking model service...')
    const modelServiceRunning = await checkModelService()
    if (!modelServiceRunning) {
      console.error('❌ Model service is not running!')
      console.log('   Please start it with: cd model_service && python3 enhanced_app.py')
      process.exit(1)
    }
    console.log('✅ Model service is running')

    // ========================================
    // PHASE 1: TRAINING DATA COLLECTION
    // ========================================
    console.log('\n' + '='.repeat(50))
    console.log('PHASE 1: TRAINING DATA COLLECTION')
    console.log('='.repeat(50))

    // Step 1: Fetch full email bodies
    console.log('\n📥 Step 1: Fetching full email bodies from Gmail...')
    const fetchResults = await fetchAllEmailBodies(user, {
      batchSize: 100,
      onProgress: (progress) => {
        console.log(`📊 Progress: ${progress.current}/${progress.total} (${progress.percentage}%)`)
      }
    })

    if (fetchResults.fetched === 0 && fetchResults.skipped === 0) {
      console.error('❌ No emails fetched. Cannot proceed with training.')
      process.exit(1)
    }

    // Step 2: Extract training data
    console.log('\n📊 Step 2: Extracting training data...')
    await runPythonScript('extract_training_data.py')

    // Step 3: Prepare dataset
    console.log('\n📋 Step 3: Preparing training dataset...')
    await runPythonScript('prepare_distilbert_dataset.py')

    // ========================================
    // PHASE 2: MODEL TRAINING
    // ========================================
    console.log('\n' + '='.repeat(50))
    console.log('PHASE 2: MODEL TRAINING')
    console.log('='.repeat(50))

    // Step 4: Train model (this will take 30-60 minutes)
    console.log('\n🎓 Step 4: Training DistilBERT model...')
    console.log('⏱️  This will take 30-60 minutes. Please be patient...')
    await runPythonScript('train_email_classifier.py')

    // Step 5: Evaluate model
    console.log('\n📈 Step 5: Evaluating trained model...')
    await runPythonScript('evaluate_model.py')

    // Step 6: Load model into service
    console.log('\n📥 Step 6: Loading trained model...')
    await loadTrainedModel()

    // ========================================
    // PHASE 3: CLASSIFY ALL EMAILS
    // ========================================
    console.log('\n' + '='.repeat(50))
    console.log('PHASE 3: CLASSIFY ALL EMAILS')
    console.log('='.repeat(50))

    // Step 7: Classify all emails
    const classificationResults = await classifyAllEmails(user._id)

    // ========================================
    // PHASE 4: CLEANUP & VERIFICATION
    // ========================================
    console.log('\n' + '='.repeat(50))
    console.log('PHASE 4: CLEANUP & VERIFICATION')
    console.log('='.repeat(50))

    // Step 8: Cleanup full bodies
    console.log('\n🧹 Step 8: Cleaning up full email bodies...')
    const cleanupResults = await cleanupFullBodies(user._id)

    // Step 9: Get final statistics
    console.log('\n📊 Step 9: Final category distribution...')
    const categoryStats = await getCategoryStats(user._id)

    console.log('\n📈 Category Distribution:')
    console.log('─'.repeat(50))
    categoryStats.forEach(stat => {
      console.log(`  ${stat._id || 'Uncategorized'}: ${stat.count}`)
    })

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n' + '═'.repeat(50))
    console.log('✅ TRAINING & CLASSIFICATION COMPLETE!')
    console.log('═'.repeat(50))
    console.log(`\n📊 Summary:`)
    console.log(`   Emails Fetched: ${fetchResults.fetched}`)
    console.log(`   Emails Classified: ${classificationResults.classified}`)
    console.log(`   Failed Classifications: ${classificationResults.failed}`)
    console.log(`   Emails Cleaned: ${cleanupResults.cleaned}`)
    console.log(`\n🎉 Your email classification system is ready!`)
    console.log(`   New emails will be automatically classified on sync.\n`)

    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

// Run the orchestrator
main()

