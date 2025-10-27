#!/usr/bin/env node

/**
 * Migration script to reclassify all existing emails with the new dynamic ML classification system
 * This script will update all emails that were classified without userId to use the new dynamic ML service
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Setup path resolution for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') })

// Import models and services
import User from '../models/User.js'
import Email from '../models/Email.js'
import { reclassifyAllEmails } from '../services/emailReclassificationService.js'

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sortify'
    await mongoose.connect(mongoUri)
    console.log('✅ Connected to MongoDB')
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    process.exit(1)
  }
}

/**
 * Disconnect from MongoDB
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close()
    console.log('✅ Disconnected from MongoDB')
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error)
  }
}

/**
 * Get all users from the database
 */
const getAllUsers = async () => {
  try {
    const users = await User.find({}, '_id email').lean()
    console.log(`📊 Found ${users.length} users in database`)
    return users
  } catch (error) {
    console.error('❌ Error fetching users:', error)
    throw error
  }
}

/**
 * Get statistics about emails per user
 */
const getEmailStats = async (userId) => {
  try {
    const totalEmails = await Email.countDocuments({ userId, isDeleted: false })
    const categorizedEmails = await Email.countDocuments({ 
      userId, 
      category: { $exists: true, $ne: null },
      isDeleted: false 
    })
    
    return { totalEmails, categorizedEmails }
  } catch (error) {
    console.error(`❌ Error getting email stats for user ${userId}:`, error)
    return { totalEmails: 0, categorizedEmails: 0 }
  }
}

/**
 * Process a single user's emails
 */
const processUserEmails = async (user, dryRun = false) => {
  try {
    console.log(`\n👤 Processing user: ${user.email} (${user._id})`)
    
    const stats = await getEmailStats(user._id)
    console.log(`📧 Email stats: ${stats.totalEmails} total, ${stats.categorizedEmails} categorized`)
    
    if (stats.totalEmails === 0) {
      console.log('⏭️  No emails found for this user, skipping...')
      return { 
        userId: user._id, 
        email: user.email, 
        totalEmails: 0, 
        processed: 0, 
        changed: 0, 
        errors: 0,
        skipped: true 
      }
    }

    if (dryRun) {
      console.log(`🔍 DRY RUN: Would reclassify ${stats.totalEmails} emails for ${user.email}`)
      return { 
        userId: user._id, 
        email: user.email, 
        totalEmails: stats.totalEmails, 
        processed: 0, 
        changed: 0, 
        errors: 0,
        skipped: false,
        dryRun: true 
      }
    }

    console.log(`🔄 Starting reclassification for ${stats.totalEmails} emails...`)
    const startTime = Date.now()
    
    const result = await reclassifyAllEmails(user._id.toString())
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    console.log(`✅ Completed: ${result.processedCount}/${result.totalEmails} processed`)
    console.log(`🔄 Changed: ${result.changedCount} emails`)
    console.log(`❌ Errors: ${result.errorCount}`)
    console.log(`⏱️  Duration: ${duration}s`)
    
    return {
      userId: user._id,
      email: user.email,
      totalEmails: result.totalEmails,
      processed: result.processedCount,
      changed: result.changedCount,
      errors: result.errorCount,
      duration: parseFloat(duration),
      skipped: false
    }
    
  } catch (error) {
    console.error(`❌ Error processing user ${user.email}:`, error.message)
    return {
      userId: user._id,
      email: user.email,
      totalEmails: 0,
      processed: 0,
      changed: 0,
      errors: 1,
      error: error.message,
      skipped: false
    }
  }
}

/**
 * Main migration function
 */
const migrateAllExistingEmails = async (options = {}) => {
  const { dryRun = false, limit = null } = options
  
  console.log('🚀 Starting email reclassification migration...')
  console.log(`📋 Mode: ${dryRun ? 'DRY RUN' : 'LIVE RUN'}`)
  if (limit) {
    console.log(`🔢 Limit: Processing only ${limit} users`)
  }
  
  try {
    // Connect to database
    await connectDB()
    
    // Get all users
    let users = await getAllUsers()
    
    if (limit && users.length > limit) {
      users = users.slice(0, limit)
      console.log(`🔢 Limited to first ${limit} users`)
    }
    
    if (users.length === 0) {
      console.log('❌ No users found in database')
      return
    }
    
    const results = []
    const startTime = Date.now()
    
    // Process each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      console.log(`\n📊 Progress: ${i + 1}/${users.length}`)
      
      const result = await processUserEmails(user, dryRun)
      results.push(result)
      
      // Small delay between users to prevent overwhelming the system
      if (i < users.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    // Calculate final statistics
    const totalTime = Date.now() - startTime
    const totalEmails = results.reduce((sum, r) => sum + r.totalEmails, 0)
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0)
    const totalChanged = results.reduce((sum, r) => sum + r.changed, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
    const skippedUsers = results.filter(r => r.skipped).length
    
    console.log('\n📊 MIGRATION SUMMARY')
    console.log('='.repeat(50))
    console.log(`👥 Users processed: ${results.length}`)
    console.log(`⏭️  Users skipped (no emails): ${skippedUsers}`)
    console.log(`📧 Total emails found: ${totalEmails}`)
    console.log(`🔄 Total emails processed: ${totalProcessed}`)
    console.log(`✅ Total emails changed: ${totalChanged}`)
    console.log(`❌ Total errors: ${totalErrors}`)
    console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`)
    
    if (!dryRun && totalChanged > 0) {
      console.log(`\n🎉 Migration completed successfully!`)
      console.log(`📈 ${totalChanged} emails were reclassified with the new dynamic ML system.`)
    } else if (dryRun) {
      console.log(`\n🔍 Dry run completed. Use --live to perform actual migration.`)
    } else {
      console.log(`\n✅ Migration completed - no emails needed reclassification.`)
    }
    
    // Show users with errors
    const usersWithErrors = results.filter(r => r.errors > 0)
    if (usersWithErrors.length > 0) {
      console.log(`\n⚠️  Users with errors:`)
      usersWithErrors.forEach(user => {
        console.log(`   - ${user.email}: ${user.error || 'Unknown error'}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await disconnectDB()
  }
}

/**
 * Parse command line arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2)
  const options = {
    dryRun: false,
    limit: null
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--dry-run':
      case '--dry':
        options.dryRun = true
        break
      case '--live':
        options.dryRun = false
        break
      case '--limit':
        const limit = parseInt(args[i + 1])
        if (!isNaN(limit) && limit > 0) {
          options.limit = limit
          i++ // Skip next argument
        } else {
          console.error('❌ Invalid limit value')
          process.exit(1)
        }
        break
      case '--help':
      case '-h':
        console.log(`
Email Reclassification Migration Script

Usage: node migrateExistingEmails.js [options]

Options:
  --dry-run, --dry    Run in dry-run mode (don't make changes)
  --live              Run in live mode (make actual changes)
  --limit NUMBER      Limit processing to NUMBER users (useful for testing)
  --help, -h          Show this help message

Examples:
  node migrateExistingEmails.js --dry-run          # Test run with no changes
  node migrateExistingEmails.js --live --limit 5   # Process first 5 users only
  node migrateExistingEmails.js --live             # Process all users (live run)

Default: --dry-run (safe default)
        `)
        process.exit(0)
        break
      default:
        if (arg.startsWith('-')) {
          console.error(`❌ Unknown option: ${arg}`)
          console.error('Use --help for usage information')
          process.exit(1)
        }
    }
  }
  
  return options
}

// Main execution
const main = async () => {
  try {
    const options = parseArgs()
    
    // Default to dry-run for safety
    if (!process.argv.includes('--live') && !process.argv.includes('--dry-run') && !process.argv.includes('--dry')) {
      options.dryRun = true
      console.log('💡 Running in DRY-RUN mode by default. Use --live to make actual changes.')
    }
    
    await migrateAllExistingEmails(options)
    
  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Migration interrupted by user')
  await disconnectDB()
  process.exit(0)
})

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error)
  disconnectDB()
  process.exit(1)
})

// Run the migration
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export default migrateAllExistingEmails
