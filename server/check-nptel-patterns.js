// Script to check NPTEL classification patterns
import mongoose from 'mongoose';
import Category from './src/models/Category.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sortify';

async function checkPatterns() {
  try {
    await mongoose.connect(MONGO_URI);

    const nptelCategory = await Category.findOne({ name: 'NPTEL' });
    
    if (!nptelCategory) {
      console.log('❌ NPTEL category not found');
      process.exit(1);
    }

    console.log('\n📋 NPTEL Category Details:');
    console.log('  Name:', nptelCategory.name);
    console.log('  Training Status:', nptelCategory.trainingStatus);
    console.log('  Created:', nptelCategory.createdAt);

    console.log('\n🔍 Classification Strategy:');
    if (nptelCategory.classificationStrategy) {
      const strategy = nptelCategory.classificationStrategy;
      
      console.log('\n  Header Analysis:');
      console.log('    Sender Domains:', strategy.headerAnalysis?.senderDomains?.length || 0);
      if (strategy.headerAnalysis?.senderDomains?.length > 0) {
        console.log('    Sample domains:', strategy.headerAnalysis.senderDomains.slice(0, 5));
      }
      console.log('    Subject Patterns:', strategy.headerAnalysis?.subjectPatterns?.length || 0);
      if (strategy.headerAnalysis?.subjectPatterns?.length > 0) {
        console.log('    Sample patterns:', strategy.headerAnalysis.subjectPatterns.slice(0, 5));
      }
      
      console.log('\n  Body Analysis:');
      console.log('    Keywords:', strategy.bodyAnalysis?.keywords?.length || 0);
      if (strategy.bodyAnalysis?.keywords?.length > 0) {
        console.log('    Sample keywords:', strategy.bodyAnalysis.keywords.slice(0, 10));
      }
      
      console.log('\n  Confidence Threshold:', strategy.confidenceThreshold || 'Not set');
    } else {
      console.log('  ⚠️  No classification strategy found!');
    }

    console.log('\n📊 Extracted Patterns:');
    if (nptelCategory.patterns) {
      console.log('  Sample Size:', nptelCategory.patterns.sampleSize || 0);
      console.log('  Rules Count:', nptelCategory.patterns.rules?.length || 0);
      console.log('  Extracted At:', nptelCategory.patterns.extractedAt);
      
      if (nptelCategory.patterns.rules?.length > 0) {
        console.log('\n  Sample Rules:');
        nptelCategory.patterns.rules.slice(0, 10).forEach((rule, i) => {
          console.log(`    ${i + 1}. Field: ${rule.field}, Pattern: "${rule.pattern}", Confidence: ${rule.confidence}`);
        });
      }
    } else {
      console.log('  ⚠️  No patterns extracted!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkPatterns();

