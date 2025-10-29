#!/usr/bin/env node

/**
 * Validation Script
 * Checks if everything is properly set up before running training
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../../.env') })

import User from '../models/User.js'
import Email from '../models/Email.js'

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'
const MODEL_SERVICE_PATH = path.join(__dirname, '../../../model_service')

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/sortify'
    await mongoose.connect(mongoUri)
    return true
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message)
    return false
  }
}

const checkModelService = async () => {
  try {
    const response = await axios.get(`${MODEL_SERVICE_URL}/status`, { timeout: 5000 })
    return response.data.status === 'ready'
  } catch (error) {
    return false
  }
}

const validate = async () => {
  console.log('═══════════════════════════════════════════════════')
  console.log('  SETUP VALIDATION')
  console.log('═══════════════════════════════════════════════════\n')

  let allGood = true

  // Check 1: MongoDB Connection
  console.log('1. Checking MongoDB connection...')
  const mongoConnected = await connectDB()
  if (mongoConnected) {
    console.log('   ✅ MongoDB connected\n')
  } else {
    console.log('   ❌ MongoDB connection failed\n')
    allGood = false
  }

  if (!mongoConnected) {
    console.log('❌ Cannot proceed without MongoDB. Please start MongoDB and try again.')
    process.exit(1)
  }

  // Check 2: User with Gmail Connected
  console.log('2. Checking for Gmail-connected user...')
  const user = await User.findOne({
    gmailConnected: true,
    gmailAccessToken: { $exists: true, $ne: null }
  })
  
  if (user) {
    console.log(`   ✅ Found user: ${user.email}`)
    console.log(`   ✅ Gmail connected: Yes\n`)
  } else {
    console.log('   ❌ No user found with Gmail connected')
    console.log('   → Please connect Gmail in the application first\n')
    allGood = false
  }

  // Check 3: Emails in Database
  console.log('3. Checking emails in database...')
  const emailCount = await Email.countDocuments({ isDeleted: false })
  
  if (emailCount > 0) {
    console.log(`   ✅ Found ${emailCount} emails in database\n`)
    
    // Show current category distribution
    const categoryDist = await Email.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
    
    console.log('   Current category distribution:')
    categoryDist.forEach(cat => {
      console.log(`     ${cat._id || 'Uncategorized'}: ${cat.count}`)
    })
    console.log()
  } else {
    console.log('   ⚠️  No emails found in database')
    console.log('   → Please sync Gmail first in the application\n')
    allGood = false
  }

  // Check 4: Model Service
  console.log('4. Checking model service...')
  const modelServiceRunning = await checkModelService()
  
  if (modelServiceRunning) {
    console.log('   ✅ Model service is running')
    console.log(`   ✅ URL: ${MODEL_SERVICE_URL}\n`)
  } else {
    console.log('   ❌ Model service is not running')
    console.log('   → Start it with: cd model_service && python3 enhanced_app.py\n')
    allGood = false
  }

  // Check 5: Python Scripts
  console.log('5. Checking Python training scripts...')
  const pythonScripts = [
    'extract_training_data.py',
    'prepare_distilbert_dataset.py',
    'train_email_classifier.py',
    'evaluate_model.py'
  ]
  
  let allScriptsExist = true
  for (const script of pythonScripts) {
    const scriptPath = path.join(MODEL_SERVICE_PATH, script)
    if (fs.existsSync(scriptPath)) {
      console.log(`   ✅ ${script}`)
    } else {
      console.log(`   ❌ ${script} - NOT FOUND`)
      allScriptsExist = false
    }
  }
  
  if (allScriptsExist) {
    console.log()
  } else {
    console.log('   → Some Python scripts are missing\n')
    allGood = false
  }

  // Check 6: Categories Configuration
  console.log('6. Checking categories configuration...')
  const categoriesPath = path.join(MODEL_SERVICE_PATH, 'categories.json')
  if (fs.existsSync(categoriesPath)) {
    try {
      const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'))
      const categoryCount = Object.keys(categoriesData.categories || {}).length
      console.log(`   ✅ categories.json found`)
      console.log(`   ✅ ${categoryCount} categories defined\n`)
    } catch (error) {
      console.log(`   ⚠️  categories.json exists but is invalid JSON\n`)
    }
  } else {
    console.log('   ❌ categories.json not found\n')
    allGood = false
  }

  // Summary
  console.log('═══════════════════════════════════════════════════')
  if (allGood) {
    console.log('✅ ALL CHECKS PASSED!')
    console.log('═══════════════════════════════════════════════════')
    console.log('\nYou can now run the training script:')
    console.log('  ./train-and-classify.sh')
    console.log('\nOR')
    console.log('  cd server && node src/scripts/trainAndClassifyAll.js\n')
  } else {
    console.log('❌ SOME CHECKS FAILED')
    console.log('═══════════════════════════════════════════════════')
    console.log('\nPlease fix the issues above before running training.\n')
    console.log('Common fixes:')
    console.log('  1. Start MongoDB: sudo systemctl start mongodb')
    console.log('  2. Connect Gmail: Open app → Settings → Connect Gmail')
    console.log('  3. Sync emails: Open app → Sync button')
    console.log('  4. Start model service: cd model_service && python3 enhanced_app.py\n')
  }

  await mongoose.disconnect()
  process.exit(allGood ? 0 : 1)
}

validate()

