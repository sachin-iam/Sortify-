#!/usr/bin/env node
/**
 * Diagnostic script to check "What's Happening" email classification issue
 * 
 * This script will:
 * 1. Find all emails from "What's Happening" senders
 * 2. Show what categories they're actually classified as
 * 3. Check if "Whats happening" category exists
 * 4. Provide recommendations for fixing the issue
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Email from './src/models/Email.js';
import Category from './src/models/Category.js';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/sortify';

async function diagnose() {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Step 1: Find all emails from "What's Happening" senders
    console.log('📧 Step 1: Finding emails from "What\'s Happening" senders...');
    const whatsHappeningEmails = await Email.find({
      from: { $regex: 'what.*s.?happening', $options: 'i' }
    }).select('from category subject date userId').lean();

    console.log(`Found ${whatsHappeningEmails.length} emails from "What's Happening" senders\n`);

    if (whatsHappeningEmails.length === 0) {
      console.log('⚠️  No emails found from "What\'s Happening" senders');
      await mongoose.connection.close();
      return;
    }

    // Step 2: Analyze category distribution
    console.log('📊 Step 2: Category distribution of these emails:');
    const categoryCounts = {};
    const userIds = new Set();
    
    whatsHappeningEmails.forEach(email => {
      const category = email.category || 'Uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      userIds.add(email.userId.toString());
    });

    Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        const percentage = ((count / whatsHappeningEmails.length) * 100).toFixed(1);
        console.log(`  - ${cat}: ${count} emails (${percentage}%)`);
      });

    // Step 3: Check if "Whats happening" category exists
    console.log('\n🏷️  Step 3: Checking existing categories...');
    for (const userId of userIds) {
      console.log(`\n  User ID: ${userId}`);
      
      const userCategories = await Category.find({ userId, isActive: true }).select('name').lean();
      
      if (userCategories.length === 0) {
        console.log('    ⚠️  No categories found for this user');
        continue;
      }
      
      console.log(`    Total categories: ${userCategories.length}`);
      
      // Check for variations of "Whats happening"
      const whatsHappeningVariations = ['Whats happening', 'What\'s happening', 'Whats Happening', 'What\'s Happening', 'whats happening'];
      const matchingCategories = userCategories.filter(cat => 
        whatsHappeningVariations.some(variant => 
          cat.name.toLowerCase() === variant.toLowerCase()
        )
      );
      
      if (matchingCategories.length > 0) {
        console.log(`    ✅ Found "Whats happening" category variants:`);
        matchingCategories.forEach(cat => {
          console.log(`       - "${cat.name}"`);
        });
      } else {
        console.log(`    ⚠️  No "Whats happening" category found`);
      }
      
      // Show all categories
      console.log(`    \n    All user categories:`);
      userCategories.forEach(cat => {
        const emailCount = categoryCounts[cat.name] || 0;
        console.log(`       - "${cat.name}" (${emailCount} What's Happening emails)`);
      });
    }

    // Step 4: Show sample emails
    console.log('\n\n📋 Step 4: Sample emails from "What\'s Happening" senders:');
    whatsHappeningEmails.slice(0, 5).forEach((email, index) => {
      console.log(`\n  ${index + 1}. From: ${email.from.substring(0, 70)}${email.from.length > 70 ? '...' : ''}`);
      console.log(`     Subject: ${email.subject}`);
      console.log(`     Category: ${email.category || 'Uncategorized'}`);
      console.log(`     Date: ${email.date.toISOString().split('T')[0]}`);
    });

    // Step 5: Recommendations
    console.log('\n\n💡 Step 5: Recommendations:');
    console.log('═'.repeat(80));
    
    if (!Object.keys(categoryCounts).includes('Whats happening')) {
      console.log('\n⚠️  ISSUE IDENTIFIED: The "Whats happening" category exists but emails are');
      console.log('   NOT being classified into it. They are being classified as:');
      Object.entries(categoryCounts).slice(0, 3).forEach(([cat, count]) => {
        console.log(`     - ${cat}: ${count} emails`);
      });
      
      console.log('\n📝 SOLUTIONS:');
      console.log('   1. Create or update "Whats happening" category with better classification rules');
      console.log('   2. Add patterns to match sender domains like:');
      console.log('      - batch2022-2023@ug.sharda.ac.in');
      console.log('      - ug.group@ug.sharda.ac.in');
      console.log('   3. Reclassify all existing emails after updating the category');
      console.log('\n   Run this command to fix:');
      console.log('   node fix-whats-happening-classification.js');
    } else {
      console.log('✅ Emails ARE being classified as "Whats happening"');
      console.log('   The issue might be with the frontend category filter.');
    }

    console.log('\n' + '═'.repeat(80));
    await mongoose.connection.close();
    console.log('\n✅ Diagnostic complete. Database connection closed.');

  } catch (error) {
    console.error('\n❌ Error during diagnostic:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

diagnose();

