#!/usr/bin/env node

/**
 * Fix HOD and Promotions Category Classification
 * 
 * This script:
 * 1. Finds HOD and Promotions categories for all users
 * 2. Updates patterns (adds sender name patterns for Promotions)
 * 3. Sets priority levels (Promotions = high, HOD = low, Placement = high)
 * 4. Syncs categories to ML service
 * 
 * Usage: node fix-hod-promotions-classification.js
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') })

// Import models
import Category from './src/models/Category.js'
import Email from './src/models/Email.js'

// Import services
import { syncCategoryToML } from './src/services/mlCategorySync.js'

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sortify'
    await mongoose.connect(mongoUri)
    console.log('✅ Connected to MongoDB')
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    process.exit(1)
  }
}

/**
 * Improved patterns for HOD category
 */
const HOD_PATTERNS = {
  senderNames: ['HOD', 'Head of Department', 'Department Head', 'Dept. Head', 'hod.cse', 'hod cse', 'HOD CSE'],
  senderDomains: [],
  keywords: ['hod', 'department', 'head', 'dept']
}

/**
 * Improved patterns for Promotions category
 */
const PROMOTIONS_PATTERNS = {
  senderNames: ['Promotions', "'Promotions'", "Promotions' via", 'Promotion'],
  senderDomains: ['promo', 'offer', 'deal', 'marketing'],
  keywords: ['promo', 'promotion', 'offer', 'discount', 'sale', 'deal', 'limited', 'special', 'off', 'care', 'opd', 'diagnostics', 'percent', 'save']
}

/**
 * Categories that should be high priority
 */
const HIGH_PRIORITY_CATEGORIES = ['Promotions', 'Placement', 'NPTEL', 'E-Zone', 'Whats happening']

/**
 * Categories that should be low priority
 */
const LOW_PRIORITY_CATEGORIES = ['HOD']

/**
 * Fix categories for all users
 */
async function fixCategories() {
  try {
    console.log('\n🚀 Starting HOD and Promotions Category Fix...\n')

    // Find all HOD and Promotions categories
    const categoriesToFix = await Category.find({
      name: { $in: ['HOD', 'Promotions', 'Placement', 'NPTEL', 'E-Zone', 'Whats happening'] },
      isActive: true
    })

    console.log(`📋 Found ${categoriesToFix.length} categories to fix\n`)

    const results = {
      fixed: [],
      skipped: [],
      failed: []
    }

    for (const category of categoriesToFix) {
      try {
        console.log(`\n🔧 Fixing category: "${category.name}" (User: ${category.userId})`)

        let updated = false
        const updates = {}

        // Determine patterns and priority based on category name
        if (category.name === 'HOD') {
          // Update HOD patterns
          updates.patterns = HOD_PATTERNS
          updates.keywords = HOD_PATTERNS.keywords
          updates.priority = 'low'
          console.log(`   - Setting priority: low`)
          console.log(`   - Sender names: ${HOD_PATTERNS.senderNames.length}`)
          console.log(`   - Keywords: ${HOD_PATTERNS.keywords.length}`)
          updated = true
        } else if (category.name === 'Promotions') {
          // Update Promotions patterns
          updates.patterns = PROMOTIONS_PATTERNS
          updates.keywords = PROMOTIONS_PATTERNS.keywords
          updates.priority = 'high'
          console.log(`   - Setting priority: high`)
          console.log(`   - Sender names: ${PROMOTIONS_PATTERNS.senderNames.length}`)
          console.log(`   - Sender domains: ${PROMOTIONS_PATTERNS.senderDomains.length}`)
          console.log(`   - Keywords: ${PROMOTIONS_PATTERNS.keywords.length}`)
          updated = true
        } else if (HIGH_PRIORITY_CATEGORIES.includes(category.name)) {
          // Set high priority for other content-specific categories
          if (category.priority !== 'high') {
            updates.priority = 'high'
            console.log(`   - Setting priority: high`)
            updated = true
          }
        }

        if (updated) {
          // Update category
          await Category.findByIdAndUpdate(category._id, updates)
          console.log(`✅ Updated "${category.name}"`)

          // Sync to ML service
          try {
            const updatedCategory = await Category.findById(category._id)
            await syncCategoryToML(updatedCategory)
            console.log(`   - Synced to ML service`)
          } catch (mlError) {
            console.warn(`   ⚠️ Failed to sync to ML service: ${mlError.message}`)
          }

          results.fixed.push({
            categoryName: category.name,
            userId: category.userId.toString(),
            priority: updates.priority || category.priority
          })
        } else {
          console.log(`⏭️  No changes needed for "${category.name}"`)
          results.skipped.push({
            categoryName: category.name,
            userId: category.userId.toString()
          })
        }

      } catch (error) {
        console.error(`❌ Failed to fix "${category.name}": ${error.message}`)
        results.failed.push({
          categoryName: category.name,
          userId: category.userId.toString(),
          error: error.message
        })
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 SUMMARY')
    console.log('='.repeat(60))
    console.log(`✅ Successfully fixed: ${results.fixed.length}`)
    console.log(`⏭️  Skipped: ${results.skipped.length}`)
    console.log(`❌ Failed: ${results.failed.length}`)
    
    if (results.fixed.length > 0) {
      console.log('\n✅ Fixed categories:')
      results.fixed.forEach(cat => {
        console.log(`   - ${cat.categoryName} (Priority: ${cat.priority})`)
      })
    }

    if (results.failed.length > 0) {
      console.log('\n❌ Failed categories:')
      results.failed.forEach(cat => {
        console.log(`   - ${cat.categoryName}: ${cat.error}`)
      })
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Category fix complete!')
    console.log('\n📝 Next steps:')
    console.log('   1. Go to the Dashboard')
    console.log('   2. Click "Reclassify All Emails" button')
    console.log('   3. Wait for reclassification to complete')
    console.log('   4. Verify that HOD and Promotions categories show correct counts')
    console.log('='.repeat(60) + '\n')

  } catch (error) {
    console.error('\n❌ Error fixing categories:', error)
    throw error
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await connectDB()
    await fixCategories()
    await mongoose.connection.close()
    console.log('✅ Database connection closed')
    process.exit(0)
  } catch (error) {
    console.error('❌ Script failed:', error)
    await mongoose.connection.close()
    process.exit(1)
  }
}

// Run the script
main()

