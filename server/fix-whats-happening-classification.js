#!/usr/bin/env node
/**
 * Fix script for "What's Happening" email classification issue
 * 
 * This script will:
 * 1. Create or update "Whats happening" category with proper classification patterns
 * 2. Reclassify all emails from "What's Happening" senders
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Email from './src/models/Email.js';
import Category from './src/models/Category.js';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/sortify';

// Classification patterns for "What's Happening" category
const WHATS_HAPPENING_PATTERNS = {
  senderDomains: [
    'batch2022-2023@ug.sharda.ac.in',
    'ug.group@ug.sharda.ac.in',
    'batch.*@ug.sharda.ac.in',
    'ug.group@.*sharda.*'
  ],
  senderNames: [
    "What's Happening",
    'Whats Happening',
    'What\\\'s Happening via',
    'Whats Happening via'
  ],
  keywords: [
    'happening',
    'announcement',
    'campus',
    'event',
    'notice',
    'circular'
  ]
};

async function fixClassification() {
  try {
    console.log('🔧 Starting fix process...');
    console.log('🔍 Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Step 1: Find all users who have emails from "What's Happening" senders
    console.log('📧 Step 1: Finding affected users...');
    const affectedEmails = await Email.find({
      from: { $regex: 'what.*s.?happening', $options: 'i' }
    }).select('userId').lean();

    if (affectedEmails.length === 0) {
      console.log('⚠️  No emails found from "What\'s Happening" senders');
      await mongoose.connection.close();
      return;
    }

    const userIds = [...new Set(affectedEmails.map(e => e.userId.toString()))];
    console.log(`   Found ${userIds.length} affected user(s)\n`);

    // Step 2: For each user, create or update the "Whats happening" category
    for (const userId of userIds) {
      console.log(`👤 Processing user: ${userId}`);
      
      // Check if category exists
      let category = await Category.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        name: { $regex: '^whats.?happening$', $options: 'i' }
      });

      if (category) {
        console.log(`   ✓ Found existing category: "${category.name}"`);
        console.log(`   Updating category with better patterns...`);
        
        // Update the category with better patterns
        category.classificationStrategy = 'enhanced-rule-based';
        category.patterns = {
          senderDomains: WHATS_HAPPENING_PATTERNS.senderDomains,
          senderNames: WHATS_HAPPENING_PATTERNS.senderNames,
          keywords: WHATS_HAPPENING_PATTERNS.keywords
        };
        category.keywords = WHATS_HAPPENING_PATTERNS.keywords;
        category.description = 'University announcements, events, and campus happenings';
        
        await category.save();
        console.log(`   ✅ Category updated successfully`);
      } else {
        console.log(`   Creating new "Whats happening" category...`);
        
        category = await Category.create({
          userId: new mongoose.Types.ObjectId(userId),
          name: 'Whats happening',
          description: 'University announcements, events, and campus happenings',
          classificationStrategy: 'enhanced-rule-based',
          patterns: {
            senderDomains: WHATS_HAPPENING_PATTERNS.senderDomains,
            senderNames: WHATS_HAPPENING_PATTERNS.senderNames,
            keywords: WHATS_HAPPENING_PATTERNS.keywords
          },
          keywords: WHATS_HAPPENING_PATTERNS.keywords,
          isActive: true,
          isSystem: false,
          trainingStatus: 'completed'
        });
        
        console.log(`   ✅ Category created successfully`);
      }

      // Step 3: Reclassify emails from "What's Happening" senders
      console.log(`\n   📝 Reclassifying emails...`);
      
      const emailsToReclassify = await Email.find({
        userId: new mongoose.Types.ObjectId(userId),
        from: { $regex: 'what.*s.?happening', $options: 'i' }
      });

      console.log(`   Found ${emailsToReclassify.length} emails to reclassify`);

      let reclassifiedCount = 0;
      let failedCount = 0;

      for (const email of emailsToReclassify) {
        try {
          const oldCategory = email.category;
          
          // Update email category
          email.category = 'Whats happening';
          email.classification = {
            label: 'Whats happening',
            confidence: 0.95,
            modelVersion: '2.0.0',
            classifiedAt: new Date(),
            reason: 'Manual reclassification - sender pattern match'
          };
          
          await email.save();
          reclassifiedCount++;
          
          if (reclassifiedCount % 100 === 0) {
            console.log(`   Progress: ${reclassifiedCount}/${emailsToReclassify.length} emails reclassified...`);
          }
        } catch (error) {
          console.error(`   ❌ Failed to reclassify email ${email._id}:`, error.message);
          failedCount++;
        }
      }

      console.log(`\n   ✅ Reclassification complete:`);
      console.log(`      - Successfully reclassified: ${reclassifiedCount} emails`);
      console.log(`      - Failed: ${failedCount} emails`);
      
      // Step 4: Sync category to ML service
      console.log(`\n   🤖 Syncing category to ML service...`);
      try {
        const ML_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000';
        const response = await fetch(`${ML_SERVICE_URL}/categories/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            category: {
              name: category.name,
              keywords: category.keywords || [],
              patterns: category.patterns || {},
              classificationStrategy: category.classificationStrategy || 'rule-based'
            }
          })
        });

        if (response.ok) {
          console.log(`   ✅ Category synced to ML service`);
        } else {
          console.log(`   ⚠️  ML service sync failed (non-critical): ${response.status}`);
        }
      } catch (mlError) {
        console.log(`   ⚠️  ML service not available (non-critical):`, mlError.message);
      }

      console.log(`\n${'═'.repeat(80)}`);
    }

    console.log(`\n✅ Fix process complete!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Users affected: ${userIds.length}`);
    console.log(`   - Total emails found: ${affectedEmails.length}`);
    console.log(`   - Category updated/created for all users`);
    console.log(`   - All emails reclassified to "Whats happening"`);
    
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Refresh the application in your browser`);
    console.log(`   2. Click "Refresh Data" button in the dashboard`);
    console.log(`   3. Filter by "Whats happening" category - you should now see all emails!`);

    await mongoose.connection.close();
    console.log(`\n✅ Database connection closed.`);

  } catch (error) {
    console.error('\n❌ Error during fix process:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixClassification();

