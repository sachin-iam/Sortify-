/**
 * One-Time Script to Fix Existing Categories
 * Adds patterns to categories that were created without them
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Category from './src/models/Category.js'
import { extractPatternsForCategory } from './src/services/patternExtractionService.js'

dotenv.config()

/**
 * Convert extracted patterns to Phase 1 compatible format
 */
const convertToPhase1Format = (extractedPatterns, categoryName) => {
  const headerAnalysis = extractedPatterns.classificationStrategy?.headerAnalysis || {}
  const bodyAnalysis = extractedPatterns.classificationStrategy?.bodyAnalysis || {}
  
  // Extract top sender domains
  const senderDomains = (headerAnalysis.senderDomains || [])
    .slice(0, 10)
    .map(domain => {
      if (typeof domain === 'string') return domain
      return domain.domain || domain.value || domain
    })
    .filter(d => d && d.length > 0)
  
  // Extract sender name patterns
  const senderNames = (headerAnalysis.senderPatterns || [])
    .slice(0, 10)
    .map(pattern => {
      if (typeof pattern === 'string') return pattern
      return pattern.name || pattern.pattern || pattern.value || pattern
    })
    .filter(n => n && n.length > 0)
  
  // Extract keywords
  const keywords = bodyAnalysis.keywords || [categoryName.toLowerCase()]
  
  return {
    senderDomains: senderDomains.length > 0 ? senderDomains : [],
    senderNames: senderNames.length > 0 ? senderNames : [],
    keywords: keywords.length > 0 ? keywords : [categoryName.toLowerCase()],
    extractedAt: new Date(),
    source: 'fix_script'
  }
}

/**
 * Generate basic patterns when extraction fails
 */
const generateBasicPatterns = (categoryName) => {
  const name = categoryName.toLowerCase()
  const patterns = {
    senderDomains: [],
    senderNames: [],
    keywords: []
  }
  
  // E-Zone
  if (name.includes('zone') || name.includes('e-zone') || name.includes('ezone')) {
    patterns.senderDomains.push('ezone@shardauniversity.com', 'shardauniversity.com')
    patterns.senderNames.push('E-Zone', 'e-zone', 'E-Zone Online Portal', 'Sharda E-Zone')
    patterns.keywords.push('ezone', 'e-zone', 'portal', 'otp', 'login', 'sharda')
  }
  
  // NPTEL
  if (name.includes('nptel')) {
    patterns.senderDomains.push('nptel.ac.in', 'nptel.iitm.ac.in', 'nptelhrd.com')
    patterns.senderNames.push('NPTEL', 'nptel', 'IIT Madras', 'NPTEL Online')
    patterns.keywords.push('nptel', 'course', 'assignment', 'lecture', 'certificate', 'exam', 'iit')
  }
  
  // Placement
  if (name.includes('placement')) {
    patterns.senderDomains.push('placement', 'career', 'jobs', 'tpo')
    patterns.senderNames.push('Placement', 'Career', 'Placement Cell', 'Training and Placement', 'TPO')
    patterns.keywords.push('placement', 'job', 'interview', 'career', 'company', 'recruitment', 'hiring', 'opportunity')
  }
  
  // HOD
  if (name.includes('hod')) {
    patterns.senderNames.push('HOD', 'Head of Department', 'Department Head', 'Dept. Head')
    patterns.keywords.push('hod', 'department', 'head', 'dept')
  }
  
  // Promotions
  if (name.includes('promotion') || name.includes('promo')) {
    patterns.senderDomains.push('promo', 'offer', 'deal', 'marketing')
    patterns.keywords.push('promo', 'promotion', 'offer', 'discount', 'sale', 'deal', 'limited', 'special')
  }
  
  // What's Happening
  if (name.includes('happening') || name.includes('what')) {
    patterns.senderNames.push("What's Happening", "Whats Happening", "What's Happening' via", "Batch")
    patterns.senderDomains.push('shardaevents.com', 'sgei.org', 'batch')
    patterns.keywords.push('happening', 'events', 'announcement', 'semester', 'university', 'batch')
  }
  
  // Always include the category name as a keyword
  const nameWords = categoryName.toLowerCase().split(/[\s-_]+/)
  patterns.keywords.push(...nameWords.filter(word => word.length > 2))
  
  return patterns
}

/**
 * Fix a single category by adding patterns
 */
const fixCategory = async (category) => {
  try {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🔧 Fixing category: "${category.name}"`)
    console.log(`   Current state:`)
    console.log(`   - Has patterns: ${!!category.patterns}`)
    console.log(`   - Has keywords: ${category.keywords?.length || 0}`)
    console.log(`   - Training status: ${category.trainingStatus}`)
    
    // Skip "Other" category - it's a catch-all and shouldn't have patterns
    if (category.name.toLowerCase() === 'other') {
      console.log(`⏭️  Skipping "Other" category (catch-all category)`)
      return { skipped: true, reason: 'other_category' }
    }
    
    // Skip if already has patterns
    if (category.patterns && category.patterns.senderDomains?.length > 0) {
      console.log(`✅ Category "${category.name}" already has patterns, skipping`)
      return { skipped: true, reason: 'already_has_patterns' }
    }
    
    // Try direct pattern extraction first
    let updatedData = null
    try {
      console.log(`🔄 Attempting pattern extraction from existing emails...`)
      const extractedPatterns = await extractPatternsForCategory(
        category.userId.toString(),
        category.name,
        1000
      )
      
      if (extractedPatterns && extractedPatterns.patterns) {
        const phase1Patterns = convertToPhase1Format(extractedPatterns, category.name)
        
        updatedData = {
          patterns: phase1Patterns,
          keywords: extractedPatterns.classificationStrategy?.bodyAnalysis?.keywords || 
                    [category.name.toLowerCase()],
          trainingStatus: 'completed'
        }
        
        console.log(`✅ Extracted patterns from existing emails:`)
        console.log(`   - Sender domains: ${phase1Patterns.senderDomains?.length || 0}`)
        console.log(`   - Sender names: ${phase1Patterns.senderNames?.length || 0}`)
        console.log(`   - Keywords: ${phase1Patterns.keywords?.length || 0}`)
      }
    } catch (extractError) {
      console.warn(`⚠️ Pattern extraction failed:`, extractError.message)
    }
    
    // If extraction failed, use basic patterns
    if (!updatedData) {
      console.log(`🔄 Using basic pattern generation...`)
      const basicPatterns = generateBasicPatterns(category.name)
      
      updatedData = {
        patterns: basicPatterns,
        keywords: [category.name.toLowerCase(), ...basicPatterns.keywords],
        trainingStatus: 'basic'
      }
      
      console.log(`✅ Generated basic patterns:`)
      console.log(`   - Sender domains: ${basicPatterns.senderDomains?.length || 0}`)
      console.log(`   - Sender names: ${basicPatterns.senderNames?.length || 0}`)
      console.log(`   - Keywords: ${basicPatterns.keywords?.length || 0}`)
    }
    
    // Update category in database
    await Category.findByIdAndUpdate(category._id, updatedData)
    
    console.log(`✅ Category "${category.name}" fixed successfully!`)
    console.log(`${'='.repeat(60)}`)
    
    return { 
      success: true, 
      categoryName: category.name,
      patterns: updatedData.patterns,
      keywords: updatedData.keywords
    }
    
  } catch (error) {
    console.error(`❌ Error fixing category "${category.name}":`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Main function
 */
const main = async () => {
  try {
    console.log('\n🚀 Starting Category Fix Script...\n')
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB\n')
    
    // Get all categories that need fixing
    const categories = await Category.find({
      isActive: true,
      $or: [
        { patterns: null },
        { patterns: { $exists: false } },
        { 'patterns.senderDomains': { $size: 0 } }
      ]
    })
    
    console.log(`📋 Found ${categories.length} categories to fix:\n`)
    categories.forEach(cat => {
      console.log(`   - ${cat.name} (User: ${cat.userId})`)
    })
    console.log('')
    
    if (categories.length === 0) {
      console.log('✅ All categories already have patterns!')
      process.exit(0)
    }
    
    // Fix each category
    const results = []
    for (const category of categories) {
      const result = await fixCategory(category)
      results.push(result)
      
      // Small delay between categories
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    // Summary
    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 SUMMARY')
    console.log(`${'='.repeat(60)}`)
    
    const successful = results.filter(r => r.success).length
    const skipped = results.filter(r => r.skipped).length
    const failed = results.filter(r => !r.success && !r.skipped).length
    
    console.log(`✅ Successfully fixed: ${successful}`)
    console.log(`⏭️  Skipped (already had patterns): ${skipped}`)
    console.log(`❌ Failed: ${failed}`)
    
    if (successful > 0) {
      console.log(`\n🎉 Fixed categories:`)
      results.filter(r => r.success).forEach(r => {
        console.log(`   - ${r.categoryName}`)
        console.log(`     Domains: ${r.patterns?.senderDomains?.length || 0}, Names: ${r.patterns?.senderNames?.length || 0}, Keywords: ${r.keywords?.length || 0}`)
      })
    }
    
    console.log(`\n✅ Category fix complete!`)
    console.log(`\n📝 Next step: Click "Reclassify All Emails" to reclassify with new patterns\n`)
    
  } catch (error) {
    console.error('\n❌ Script error:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('✅ Disconnected from MongoDB')
    process.exit(0)
  }
}

// Run the script
main()

