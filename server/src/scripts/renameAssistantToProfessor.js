#!/usr/bin/env node

/**
 * Migration Script: Rename "Assistant" category to "Professor"
 * 
 * This script:
 * 1. Updates all Category documents: Assistant → Professor
 * 2. Updates all Email documents with category = "Assistant" → "Professor"
 * 3. Clears category cache
 * 4. Updates enhanced patterns from categories.json
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { clearCategoryCache } from '../services/phase1ClassificationService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') })

// Import models
import Category from '../models/Category.js'
import Email from '../models/Email.js'

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
 * Load enhanced category data from categories.json
 */
const loadEnhancedCategoryData = () => {
  try {
    const categoriesPath = path.join(__dirname, '../../../model_service/categories.json')
    const data = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'))
    return data.categories.Professor
  } catch (error) {
    console.error('❌ Error loading categories.json:', error)
    return null
  }
}

/**
 * Main migration function
 */
const main = async () => {
  try {
    console.log('═══════════════════════════════════════════════════')
    console.log('  MIGRATION: ASSISTANT → PROFESSOR')
    console.log('═══════════════════════════════════════════════════\n')

    // Connect to database
    await connectDB()

    // Load enhanced category data
    console.log('📥 Loading enhanced category data...')
    const professorData = loadEnhancedCategoryData()
    if (!professorData) {
      console.error('❌ Could not load Professor category data from categories.json')
      process.exit(1)
    }
    console.log('✅ Enhanced category data loaded\n')

    // ========================================
    // STEP 1: Update/Create Category Documents
    // ========================================
    console.log('Step 1: Updating/Creating Category documents...')
    console.log('─'.repeat(50))

    // Check if Assistant exists
    const assistantCategories = await Category.find({ name: 'Assistant' })
    console.log(`   Found ${assistantCategories.length} "Assistant" categories`)

    // Rename Assistant to Professor
    const categoryUpdateResult = await Category.updateMany(
      { name: 'Assistant' },
      {
        $set: {
          name: 'Professor',
          description: professorData.description,
          keywords: professorData.keywords,
          classificationStrategy: 'enhanced-v5',
          patterns: {
            senderDomains: professorData.classification_strategy?.headerAnalysis?.senderDomains || [],
            senderNames: professorData.classification_strategy?.headerAnalysis?.senderPatterns || [],
            subjectPatterns: professorData.classification_strategy?.headerAnalysis?.subjectPatterns || []
          }
        }
      }
    )

    console.log(`✅ Renamed ${categoryUpdateResult.modifiedCount} Assistant → Professor\n`)

    // Also ensure Professor category exists for all users with emails
    const usersWithEmails = await Email.distinct('userId')
    console.log(`   Found ${usersWithEmails.length} users with emails`)

    for (const userId of usersWithEmails) {
      const existingProfessor = await Category.findOne({ userId, name: 'Professor' })
      
      if (!existingProfessor) {
        // Create Professor category for this user
        await Category.create({
          userId,
          name: 'Professor',
          description: professorData.description,
          keywords: professorData.keywords,
          classificationStrategy: 'enhanced-v5',
          patterns: {
            senderDomains: professorData.classification_strategy?.headerAnalysis?.senderDomains || [],
            senderNames: professorData.classification_strategy?.headerAnalysis?.senderPatterns || [],
            subjectPatterns: professorData.classification_strategy?.headerAnalysis?.subjectPatterns || []
          },
          color: professorData.color || '#6366F1',
          isDefault: false,
          isActive: true,
          emailCount: 0
        })
        console.log(`   ✅ Created Professor category for user ${userId}`)
      }
    }

    console.log(`✅ Professor category ensured for all users\n`)

    // ========================================
    // STEP 2: Update Email Documents
    // ========================================
    console.log('Step 2: Updating Email documents...')
    console.log('─'.repeat(50))

    const emailUpdateResult = await Email.updateMany(
      { category: 'Assistant' },
      {
        $set: {
          category: 'Professor',
          'classification.label': 'Professor'
        }
      }
    )

    console.log(`✅ Updated ${emailUpdateResult.modifiedCount} Email document(s)`)
    console.log(`   Matched: ${emailUpdateResult.matchedCount}`)
    console.log(`   Modified: ${emailUpdateResult.modifiedCount}\n`)

    // ========================================
    // STEP 3: Update classification.label in emails
    // ========================================
    console.log('Step 3: Updating classification labels...')
    console.log('─'.repeat(50))

    const classificationUpdateResult = await Email.updateMany(
      { 'classification.label': 'Assistant' },
      {
        $set: {
          'classification.label': 'Professor'
        }
      }
    )

    console.log(`✅ Updated ${classificationUpdateResult.modifiedCount} classification label(s)\n`)

    // ========================================
    // STEP 4: Clear Cache
    // ========================================
    console.log('Step 4: Clearing category cache...')
    console.log('─'.repeat(50))
    clearCategoryCache()
    console.log('✅ Category cache cleared\n')

    // ========================================
    // STEP 5: Verification
    // ========================================
    console.log('Step 5: Verification...')
    console.log('─'.repeat(50))

    const professorCategoryCount = await Category.countDocuments({ name: 'Professor' })
    const assistantCategoryCount = await Category.countDocuments({ name: 'Assistant' })
    const professorEmailCount = await Email.countDocuments({ category: 'Professor' })
    const assistantEmailCount = await Email.countDocuments({ category: 'Assistant' })

    console.log(`✅ Professor categories: ${professorCategoryCount}`)
    console.log(`   Assistant categories: ${assistantCategoryCount} (should be 0)`)
    console.log(`✅ Professor emails: ${professorEmailCount}`)
    console.log(`   Assistant emails: ${assistantEmailCount} (should be 0)\n`)

    // ========================================
    // SUMMARY
    // ========================================
    console.log('═'.repeat(50))
    console.log('✅ MIGRATION COMPLETE!')
    console.log('═'.repeat(50))
    console.log('\n📊 Summary:')
    console.log(`   Categories renamed: ${categoryUpdateResult.modifiedCount}`)
    console.log(`   Emails updated: ${emailUpdateResult.modifiedCount}`)
    console.log(`   Classification labels updated: ${classificationUpdateResult.modifiedCount}`)
    console.log('\n✅ All "Assistant" references have been renamed to "Professor"')
    console.log('✅ Enhanced patterns and keywords have been applied')
    console.log('\n💡 Next steps:')
    console.log('   1. Restart your backend server')
    console.log('   2. Run reclassification to apply new patterns')
    console.log('   3. Train the DistilBERT model with enhanced features\n')

    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

// Run the migration
main()

