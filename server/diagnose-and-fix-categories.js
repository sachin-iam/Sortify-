#!/usr/bin/env node

/**
 * Diagnose and Fix HOD/Promotions Categories
 * 
 * This script:
 * 1. Checks what categories and emails exist
 * 2. Creates HOD and Promotions categories if missing
 * 3. Updates patterns and priorities
 * 4. Shows which emails should be reclassified
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
import User from './src/models/User.js'

// Import services
import { syncCategoryToML } from './src/services/mlCategorySync.js'

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/sortify'
    console.log('Connecting to MongoDB...')
    await mongoose.connect(mongoUri)
    console.log('✅ Connected to MongoDB\n')
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

async function diagnoseAndFix() {
  try {
    console.log('🔍 DIAGNOSIS\n')
    console.log('='.repeat(60))
    
    // Get user
    const users = await User.find({})
    if (users.length === 0) {
      console.log('❌ No users found. Please log into the application first.')
      return
    }
    
    const userId = users[0]._id
    console.log(`✅ User found: ${users[0].email}\n`)
    
    // Check existing categories
    const categories = await Category.find({ userId }).select('name priority emailCount patterns')
    console.log(`📁 Existing Categories: ${categories.length}`)
    categories.forEach(cat => {
      console.log(`   - ${cat.name}: ${cat.emailCount} emails (Priority: ${cat.priority || 'normal'})`)
    })
    
    // Check total emails
    const totalEmails = await Email.countDocuments({ userId })
    console.log(`\n📧 Total Emails: ${totalEmails}`)
    
    if (totalEmails > 0) {
      const emailCategories = await Email.distinct('category', { userId })
      console.log(`\n📊 Current Email Distribution:`)
      for (const cat of emailCategories) {
        const count = await Email.countDocuments({ userId, category: cat })
        console.log(`   - ${cat}: ${count}`)
      }
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🔧 FIXING CATEGORIES\n')
    
    // Check/Create HOD category
    let hodCategory = await Category.findOne({ userId, name: 'HOD' })
    if (!hodCategory) {
      console.log('Creating HOD category...')
      hodCategory = await Category.create({
        userId,
        name: 'HOD',
        description: 'Emails from Head of Department',
        color: '#8B5CF6',
        priority: 'low',
        patterns: HOD_PATTERNS,
        keywords: HOD_PATTERNS.keywords,
        isActive: true,
        trainingStatus: 'completed'
      })
      console.log('✅ HOD category created')
    } else {
      console.log('HOD category exists, updating patterns...')
      hodCategory.priority = 'low'
      hodCategory.patterns = HOD_PATTERNS
      hodCategory.keywords = HOD_PATTERNS.keywords
      await hodCategory.save()
      console.log('✅ HOD category updated')
    }
    
    // Sync to ML
    try {
      await syncCategoryToML(hodCategory)
      console.log('   - Synced to ML service')
    } catch (e) {
      console.log('   - ML sync skipped:', e.message)
    }
    
    // Check/Create Promotions category
    let promoCat = await Category.findOne({ userId, name: 'Promotions' })
    if (!promoCat) {
      console.log('\nCreating Promotions category...')
      promoCat = await Category.create({
        userId,
        name: 'Promotions',
        description: 'Promotional and marketing emails',
        color: '#10B981',
        priority: 'high',
        patterns: PROMOTIONS_PATTERNS,
        keywords: PROMOTIONS_PATTERNS.keywords,
        isActive: true,
        trainingStatus: 'completed'
      })
      console.log('✅ Promotions category created')
    } else {
      console.log('\nPromotions category exists, updating patterns...')
      promoCat.priority = 'high'
      promoCat.patterns = PROMOTIONS_PATTERNS
      promoCat.keywords = PROMOTIONS_PATTERNS.keywords
      await promoCat.save()
      console.log('✅ Promotions category updated')
    }
    
    // Sync to ML
    try {
      await syncCategoryToML(promoCat)
      console.log('   - Synced to ML service')
    } catch (e) {
      console.log('   - ML sync skipped:', e.message)
    }
    
    // Set other categories to high priority
    const highPriorityNames = ['Placement', 'NPTEL', 'E-Zone', 'Whats happening']
    for (const name of highPriorityNames) {
      const cat = await Category.findOne({ userId, name })
      if (cat && cat.priority !== 'high') {
        console.log(`\nUpdating ${name} priority to high...`)
        cat.priority = 'high'
        await cat.save()
        console.log(`✅ ${name} updated`)
      }
    }
    
    // Search for emails that should be HOD or Promotions
    console.log('\n' + '='.repeat(60))
    console.log('🔍 EMAILS THAT SHOULD BE RECLASSIFIED\n')
    
    const hodEmails = await Email.find({
      userId,
      from: /HOD/i
    }).select('from subject category').limit(5)
    
    if (hodEmails.length > 0) {
      console.log(`Found ${hodEmails.length} emails with 'HOD' in sender:`)
      hodEmails.forEach((e, i) => {
        console.log(`${i+1}. From: ${e.from.substring(0, 70)}`)
        console.log(`   Current Category: ${e.category}`)
      })
    } else {
      console.log('No emails with "HOD" in sender found.')
    }
    
    const promoEmails = await Email.find({
      userId,
      from: /Promotion/i
    }).select('from subject category').limit(5)
    
    if (promoEmails.length > 0) {
      console.log(`\nFound ${promoEmails.length} emails with 'Promotion' in sender:`)
      promoEmails.forEach((e, i) => {
        console.log(`${i+1}. From: ${e.from.substring(0, 70)}`)
        console.log(`   Current Category: ${e.category}`)
      })
    } else {
      console.log('\nNo emails with "Promotion" in sender found.')
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ DONE!\n')
    console.log('📝 Next steps:')
    console.log('   1. Go to your Dashboard in the browser')
    console.log('   2. Click the "Reclassify All Emails" button')
    console.log('   3. Wait for reclassification to complete')
    console.log('   4. Refresh the page')
    console.log('   5. Check if HOD and Promotions show correct counts')
    console.log('='.repeat(60) + '\n')
    
  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  }
}

async function main() {
  try {
    await connectDB()
    await diagnoseAndFix()
    await mongoose.connection.close()
    console.log('✅ Database connection closed')
    process.exit(0)
  } catch (error) {
    console.error('❌ Script failed:', error)
    await mongoose.connection.close()
    process.exit(1)
  }
}

main()

