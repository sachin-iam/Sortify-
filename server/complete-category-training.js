#!/usr/bin/env node

/**
 * Complete Category Training & Reclassification Script
 * 
 * This comprehensive script:
 * 1. Scans ALL emails in database
 * 2. Extracts real patterns from email data
 * 3. Creates/updates Assistant, HOD, Promotions categories
 * 4. Updates NPTEL, E-Zone with enhanced patterns
 * 5. Sets correct priorities
 * 6. Trains ML service
 * 7. Reclassifies ALL emails
 * 8. Verifies results
 * 
 * Usage: node complete-category-training.js
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
import { classifyEmailPhase1, clearCategoryCache } from './src/services/phase1ClassificationService.js'

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
 * Category configurations with patterns and priorities
 */
const CATEGORY_CONFIGS = {
  'Assistant': {
    priority: 'normal',
    color: '#8B5CF6',
    description: 'Emails from assistant professors and faculty',
    patterns: {
      senderNames: ['Assistant Professor', 'Asst. Professor', 'Asst Professor', 'Assistant', 'SSET Assistant', 'Asst.', 'Assistant Prof'],
      senderDomains: ['sharda.ac.in', 'shardauniversity.com'],
      keywords: ['assistant', 'professor', 'faculty', 'lecturer', 'asst', 'sset']
    }
  },
  'HOD': {
    priority: 'low',
    color: '#EC4899',
    description: 'Emails from Head of Department',
    patterns: {
      senderNames: ['HOD', 'HOD CSE', 'Head of Department', 'hod.cse', 'Department Head', 'Dept Head', 'Dept. Head'],
      senderDomains: [],
      keywords: ['hod', 'department', 'head', 'dept']
    }
  },
  'Promotions': {
    priority: 'high',
    color: '#10B981',
    description: 'Promotional and marketing emails',
    patterns: {
      senderNames: ["'Promotions'", "Promotions' via", 'Promotions via', 'Promotion', 'Promotions'],
      senderDomains: ['promo', 'offer', 'deal', 'marketing'],
      keywords: ['promo', 'promotion', 'offer', 'discount', 'sale', 'deal', 'limited', 'special', 'off', 'care', 'opd', 'diagnostics', 'percent', 'save']
    }
  },
  'NPTEL': {
    priority: 'high',
    color: '#F59E0B',
    description: 'NPTEL online courses',
    patterns: {
      senderDomains: ['nptel.ac.in', 'nptel.iitm.ac.in', 'nptelhrd.com', 'onlinecourses.nptel.ac.in'],
      senderNames: ['NPTEL', 'onlinecourses', 'IIT Madras', 'NPTEL Online'],
      keywords: ['nptel', 'course', 'assignment', 'certificate', 'iit', 'madras', 'online']
    }
  },
  'E-Zone': {
    priority: 'high',
    color: '#3B82F6',
    description: 'Sharda University E-Zone portal',
    patterns: {
      senderDomains: ['shardauniversity.com', 'ezone@sharda'],
      senderNames: ['E-Zone', 'E-Zone Online Portal', 'Sharda E-Zone', 'ezone', 'E-ZONE'],
      keywords: ['ezone', 'e-zone', 'portal', 'otp', 'sharda', 'password', 'student portal']
    }
  },
  'Placement': {
    priority: 'high',
    color: '#EF4444',
    description: 'Job placements and career opportunities',
    patterns: {
      senderDomains: ['placement', 'career', 'jobs', 'tpo'],
      senderNames: ['Placement', 'Career', 'Placement Cell', 'Training and Placement', 'TPO'],
      keywords: ['placement', 'job', 'interview', 'career', 'company', 'recruitment', 'hiring', 'opportunity', 'internship']
    }
  },
  'Whats happening': {
    priority: 'high',
    color: '#A855F7',
    description: 'University announcements and events',
    patterns: {
      senderNames: ["What's Happening", "Whats Happening", "What's Happening' via", 'Batch'],
      senderDomains: ['shardaevents.com', 'sgei.org', 'batch'],
      keywords: ['happening', 'events', 'announcement', 'semester', 'university', 'batch']
    }
  }
}

/**
 * Step 1: Diagnosis - Check current state
 */
async function diagnose(userId) {
  console.log('=' .repeat(70))
  console.log('🔍 STEP 1: DIAGNOSIS')
  console.log('='.repeat(70) + '\n')
  
  // Count total emails
  const totalEmails = await Email.countDocuments({ userId })
  console.log(`📧 Total Emails in Database: ${totalEmails}`)
  
  if (totalEmails === 0) {
    console.log('\n❌ No emails found. Please sync your emails first.')
    process.exit(1)
  }
  
  // Current category distribution
  const categories = await Category.find({ userId }).select('name priority emailCount')
  console.log(`\n📁 Current Categories: ${categories.length}`)
  
  if (categories.length > 0) {
    console.log('\nCurrent Category Distribution:')
    for (const cat of categories) {
      console.log(`   - ${cat.name}: ${cat.emailCount} emails (Priority: ${cat.priority || 'normal'})`)
    }
  }
  
  // Email distribution by category field
  console.log('\n📊 Current Email Distribution (by category field):')
  const emailCategories = await Email.distinct('category', { userId })
  for (const cat of emailCategories) {
    const count = await Email.countDocuments({ userId, category: cat })
    console.log(`   - ${cat}: ${count} emails`)
  }
  
  return { totalEmails, existingCategories: categories }
}

/**
 * Step 2: Extract patterns from real emails
 */
async function extractPatterns(userId) {
  console.log('\n' + '='.repeat(70))
  console.log('📊 STEP 2: EXTRACTING PATTERNS FROM REAL EMAILS')
  console.log('='.repeat(70) + '\n')
  
  const patterns = {}
  
  // Find Assistant emails
  const assistantEmails = await Email.find({
    userId,
    from: /assistant|asst\.|asst /i
  }).limit(10).select('from subject')
  
  console.log(`🔍 Found ${assistantEmails.length} potential Assistant emails`)
  if (assistantEmails.length > 0) {
    console.log('Sample:')
    assistantEmails.slice(0, 3).forEach(e => {
      console.log(`   - From: ${e.from.substring(0, 70)}`)
    })
  }
  patterns.assistant = assistantEmails.length
  
  // Find HOD emails
  const hodEmails = await Email.find({
    userId,
    from: /\bHOD\b|head of department|hod\./i
  }).limit(10).select('from subject')
  
  console.log(`\n🔍 Found ${hodEmails.length} potential HOD emails`)
  if (hodEmails.length > 0) {
    console.log('Sample:')
    hodEmails.slice(0, 3).forEach(e => {
      console.log(`   - From: ${e.from.substring(0, 70)}`)
    })
  }
  patterns.hod = hodEmails.length
  
  // Find Promotions emails
  const promoEmails = await Email.find({
    userId,
    from: /promotion|'Promotions'/i
  }).limit(10).select('from subject')
  
  console.log(`\n🔍 Found ${promoEmails.length} potential Promotions emails`)
  if (promoEmails.length > 0) {
    console.log('Sample:')
    promoEmails.slice(0, 3).forEach(e => {
      console.log(`   - From: ${e.from.substring(0, 70)}`)
    })
  }
  patterns.promotions = promoEmails.length
  
  // Find NPTEL emails
  const nptelEmails = await Email.find({
    userId,
    from: /nptel/i
  }).limit(10).select('from')
  
  console.log(`\n🔍 Found ${nptelEmails.length} potential NPTEL emails`)
  patterns.nptel = nptelEmails.length
  
  // Find E-Zone emails
  const ezoneEmails = await Email.find({
    userId,
    from: /ezone|e-zone|shardauniversity\.com/i
  }).limit(10).select('from')
  
  console.log(`\n🔍 Found ${ezoneEmails.length} potential E-Zone emails`)
  patterns.ezone = ezoneEmails.length
  
  return patterns
}

/**
 * Step 3: Create/Update Categories
 */
async function createUpdateCategories(userId) {
  console.log('\n' + '='.repeat(70))
  console.log('📁 STEP 3: CREATING/UPDATING CATEGORIES')
  console.log('='.repeat(70) + '\n')
  
  const results = []
  
  for (const [name, config] of Object.entries(CATEGORY_CONFIGS)) {
    console.log(`\n🔧 Processing: ${name}`)
    
    let category = await Category.findOne({ userId, name })
    
    if (!category) {
      console.log(`   Creating new category...`)
      category = await Category.create({
        userId,
        name,
        description: config.description,
        color: config.color,
        priority: config.priority,
        patterns: config.patterns,
        keywords: config.patterns.keywords,
        isActive: true,
        trainingStatus: 'completed'
      })
      console.log(`   ✅ Created "${name}" (Priority: ${config.priority})`)
      results.push({ name, action: 'created' })
    } else {
      console.log(`   Updating existing category...`)
      category.priority = config.priority
      category.patterns = config.patterns
      category.keywords = config.patterns.keywords
      category.description = config.description
      category.trainingStatus = 'completed'
      await category.save()
      console.log(`   ✅ Updated "${name}" (Priority: ${config.priority})`)
      results.push({ name, action: 'updated' })
    }
    
    console.log(`   Patterns: ${config.patterns.senderNames?.length || 0} names, ${config.patterns.senderDomains?.length || 0} domains, ${config.patterns.keywords?.length || 0} keywords`)
  }
  
  return results
}

/**
 * Step 4: Train ML Service
 */
async function trainMLService(userId) {
  console.log('\n' + '='.repeat(70))
  console.log('🤖 STEP 4: TRAINING ML SERVICE')
  console.log('='.repeat(70) + '\n')
  
  const categories = await Category.find({ userId })
  const results = []
  
  for (const category of categories) {
    try {
      console.log(`Training: ${category.name}...`)
      await syncCategoryToML(category)
      console.log(`   ✅ Synced "${category.name}" to ML service`)
      results.push({ name: category.name, success: true })
    } catch (error) {
      console.log(`   ⚠️ ML sync failed for "${category.name}": ${error.message}`)
      results.push({ name: category.name, success: false, error: error.message })
    }
  }
  
  return results
}

/**
 * Step 5: Reclassify ALL Emails
 */
async function reclassifyAllEmails(userId) {
  console.log('\n' + '='.repeat(70))
  console.log('🔄 STEP 5: RECLASSIFYING ALL EMAILS')
  console.log('='.repeat(70) + '\n')
  
  // Clear cache to ensure fresh category data
  clearCategoryCache(userId)
  console.log('✅ Category cache cleared\n')
  
  // Get all emails
  const totalEmails = await Email.countDocuments({ userId })
  console.log(`Processing ${totalEmails} emails...\n`)
  
  const batchSize = 100
  let processed = 0
  let reclassified = 0
  const categoryChanges = {}
  
  // Process in batches
  for (let skip = 0; skip < totalEmails; skip += batchSize) {
    const emails = await Email.find({ userId })
      .select('_id from subject snippet body category')
      .skip(skip)
      .limit(batchSize)
      .lean()
    
    for (const email of emails) {
      try {
        const oldCategory = email.category
        
        // Classify using Phase 1 with priority system
        const result = await classifyEmailPhase1({
          from: email.from,
          subject: email.subject,
          snippet: email.snippet,
          body: email.body
        }, userId.toString())
        
        const newCategory = result.label
        
        // Update if changed
        if (oldCategory !== newCategory) {
          await Email.findByIdAndUpdate(email._id, { category: newCategory })
          reclassified++
          
          categoryChanges[newCategory] = (categoryChanges[newCategory] || 0) + 1
        }
        
        processed++
      } catch (error) {
        console.error(`   Error classifying email ${email._id}:`, error.message)
      }
    }
    
    // Show progress
    console.log(`Progress: ${processed}/${totalEmails} (${Math.round(processed/totalEmails*100)}%) - Reclassified: ${reclassified}`)
  }
  
  console.log(`\n✅ Reclassification complete!`)
  console.log(`   Total processed: ${processed}`)
  console.log(`   Reclassified: ${reclassified}`)
  
  if (Object.keys(categoryChanges).length > 0) {
    console.log(`\n📊 Changes by category:`)
    for (const [cat, count] of Object.entries(categoryChanges).sort((a, b) => b[1] - a[1])) {
      console.log(`   - ${cat}: +${count} emails`)
    }
  }
  
  return { processed, reclassified, categoryChanges }
}

/**
 * Step 6: Update Counts & Verify
 */
async function updateCountsAndVerify(userId) {
  console.log('\n' + '='.repeat(70))
  console.log('✅ STEP 6: UPDATING COUNTS & VERIFICATION')
  console.log('='.repeat(70) + '\n')
  
  // Update category email counts
  const categories = await Category.find({ userId }).select('name priority')
  
  console.log('📊 Final Email Distribution:\n')
  
  const results = []
  let totalCategorized = 0
  
  for (const category of categories) {
    const count = await Email.countDocuments({ userId, category: category.name })
    
    // Update count in database
    await Category.findByIdAndUpdate(category._id, { emailCount: count })
    
    results.push({ name: category.name, count, priority: category.priority })
    totalCategorized += count
  }
  
  // Sort by count descending
  results.sort((a, b) => b.count - a.count)
  
  // Display results
  for (const result of results) {
    const priorityTag = result.priority === 'high' ? '[HIGH]' : 
                       result.priority === 'low' ? '[LOW]' : '[NORM]'
    console.log(`   ${priorityTag} ${result.name}: ${result.count} emails`)
  }
  
  const totalEmails = await Email.countDocuments({ userId })
  console.log(`\n📧 Total: ${totalCategorized}/${totalEmails} emails categorized`)
  
  // Highlight important categories
  console.log('\n🎯 Key Categories:')
  const keyCategories = ['Assistant', 'HOD', 'Promotions', 'NPTEL', 'E-Zone']
  for (const catName of keyCategories) {
    const result = results.find(r => r.name === catName)
    if (result) {
      const status = result.count > 0 ? '✅' : '❌'
      console.log(`   ${status} ${catName}: ${result.count} emails`)
    } else {
      console.log(`   ⚠️ ${catName}: Not found`)
    }
  }
  
  return results
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('\n')
    console.log('='.repeat(70))
    console.log('🚀 COMPLETE CATEGORY TRAINING & RECLASSIFICATION')
    console.log('='.repeat(70))
    console.log('\n')
    
    await connectDB()
    
    // Get user
    const users = await User.find({})
    if (users.length === 0) {
      console.log('❌ No users found. Please log into the application first.')
      process.exit(1)
    }
    
    const userId = users[0]._id
    console.log(`✅ User: ${users[0].email}\n`)
    
    // Execute all steps
    const diagnosis = await diagnose(userId)
    const patterns = await extractPatterns(userId)
    const categoryResults = await createUpdateCategories(userId)
    const mlResults = await trainMLService(userId)
    const reclassResults = await reclassifyAllEmails(userId)
    const finalResults = await updateCountsAndVerify(userId)
    
    // Final summary
    console.log('\n' + '='.repeat(70))
    console.log('🎉 COMPLETE!')
    console.log('='.repeat(70))
    console.log('\n📝 Next steps:')
    console.log('   1. Refresh your dashboard in the browser')
    console.log('   2. Verify that Assistant, HOD, and Promotions categories show emails')
    console.log('   3. Check that NPTEL and E-Zone show all their emails')
    console.log('\n' + '='.repeat(70) + '\n')
    
    await mongoose.connection.close()
    console.log('✅ Database connection closed')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Script failed:', error)
    console.error(error.stack)
    await mongoose.connection.close()
    process.exit(1)
  }
}

// Run the script
main()

