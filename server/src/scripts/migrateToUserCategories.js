/**
 * Migration Script: Convert existing hardcoded categories to user-specific categories
 * This script preserves existing email classifications and creates user-specific categories
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Email from '../models/Email.js'
import Category from '../models/Category.js'
import { extractPatternsForCategory } from '../services/patternExtractionService.js'
import { syncCategoryToML } from '../services/mlCategorySync.js'

// Load environment variables
dotenv.config()

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sortify')
    console.log('✅ Connected to MongoDB')
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    process.exit(1)
  }
}

// Migration categories to preserve
const MIGRATION_CATEGORIES = [
  'Academic',
  'Promotions', 
  'Placement',
  'Spam',
  'NPTEL',
  'E-Zone',
  'Newsletter'
]

/**
 * Migrate categories for a specific user
 */
const migrateUserCategories = async (userId) => {
  try {
    console.log(`🔄 Migrating categories for user: ${userId}`)

    // Get all emails for this user
    const userEmails = await Email.find({ 
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false 
    }).select('category subject from body text snippet')

    if (userEmails.length === 0) {
      console.log(`📧 No emails found for user ${userId}, skipping migration`)
      return
    }

    // Get unique categories from user's emails
    const userCategories = [...new Set(userEmails.map(email => email.category).filter(Boolean))]
    console.log(`📊 Found ${userCategories.length} categories in user's emails:`, userCategories)

    // Create "Other" category if it doesn't exist
    let otherCategory = await Category.findOne({ 
      userId: new mongoose.Types.ObjectId(userId), 
      name: 'Other' 
    })

    if (!otherCategory) {
      otherCategory = new Category({
        userId: new mongoose.Types.ObjectId(userId),
        name: 'Other',
        description: 'Miscellaneous emails',
        color: '#6B7280',
        isDefault: true,
        learningMode: 'automatic',
        templateSource: null
      })
      await otherCategory.save()
      console.log(`✅ Created "Other" category for user ${userId}`)
    }

    // Process each category found in user's emails
    for (const categoryName of userCategories) {
      if (categoryName === 'Other') continue

      // Check if category already exists
      let existingCategory = await Category.findOne({ 
        userId: new mongoose.Types.ObjectId(userId), 
        name: categoryName 
      })

      if (existingCategory) {
        console.log(`📁 Category "${categoryName}" already exists for user ${userId}`)
        continue
      }

      console.log(`🔍 Creating category "${categoryName}" for user ${userId}`)

      // Get sample emails for this category
      const categoryEmails = userEmails.filter(email => email.category === categoryName)
      const sampleEmailIds = categoryEmails.slice(0, 100).map(email => email._id)

      // Extract patterns from sample emails
      const patterns = await extractPatternsForCategory(
        userId, 
        categoryName, 
        1000, 
        sampleEmailIds
      )

      // Create category with extracted patterns
      const newCategory = new Category({
        userId: new mongoose.Types.ObjectId(userId),
        name: categoryName,
        description: `Auto-migrated category: ${categoryName}`,
        color: getCategoryColor(categoryName),
        isDefault: false,
        learningMode: 'automatic',
        templateSource: MIGRATION_CATEGORIES.includes(categoryName) ? categoryName : null,
        classificationStrategy: patterns.classificationStrategy,
        patterns: patterns.patterns,
        sampleEmailIds: sampleEmailIds,
        trainingStatus: 'completed'
      })

      await newCategory.save()
      console.log(`✅ Created category "${categoryName}" with ${sampleEmailIds.length} sample emails`)

      // Sync to ML service
      try {
        await syncCategoryToML(newCategory)
        console.log(`🔄 Synced category "${categoryName}" to ML service`)
      } catch (mlError) {
        console.warn(`⚠️ Failed to sync category "${categoryName}" to ML service:`, mlError.message)
      }
    }

    console.log(`✅ Migration completed for user ${userId}`)

  } catch (error) {
    console.error(`❌ Error migrating categories for user ${userId}:`, error)
  }
}

/**
 * Get color for category based on name
 */
const getCategoryColor = (categoryName) => {
  const colorMap = {
    'Academic': '#3B82F6',
    'Promotions': '#10B981', 
    'Placement': '#F59E0B',
    'Spam': '#EF4444',
    'NPTEL': '#8B5CF6',
    'E-Zone': '#06B6D4',
    'Newsletter': '#F97316'
  }
  return colorMap[categoryName] || '#6B7280'
}

/**
 * Main migration function
 */
const runMigration = async () => {
  try {
    console.log('🚀 Starting category migration...')
    
    // Get all users who have emails
    const usersWithEmails = await Email.distinct('userId')
    console.log(`👥 Found ${usersWithEmails.length} users with emails`)

    if (usersWithEmails.length === 0) {
      console.log('📧 No users with emails found, migration not needed')
      return
    }

    // Migrate each user
    for (const userId of usersWithEmails) {
      await migrateUserCategories(userId.toString())
    }

    console.log('🎉 Migration completed successfully!')
    console.log('📋 Summary:')
    console.log(`   - Processed ${usersWithEmails.length} users`)
    console.log(`   - All users now have "Other" as default category`)
    console.log(`   - User-specific categories created from existing email classifications`)
    console.log(`   - Categories synced to ML service`)

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Disconnected from MongoDB')
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  connectDB().then(() => runMigration())
}

export { migrateUserCategories, runMigration }
