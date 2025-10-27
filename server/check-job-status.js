// Script to check reclassification job status
import mongoose from 'mongoose';
import ReclassificationJob from './src/models/ReclassificationJob.js';
import Category from './src/models/Category.js';
import Email from './src/models/Email.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sortify';

async function checkJobStatus() {
  try {
    await mongoose.connect(MONGO_URI);

    // Find NPTEL category
    const nptelCategory = await Category.findOne({ name: 'NPTEL' });
    
    if (!nptelCategory) {
      console.log('❌ NPTEL category not found');
      process.exit(1);
    }

    // Get latest job for NPTEL
    const job = await ReclassificationJob.findOne({ categoryName: 'NPTEL' })
      .sort({ createdAt: -1 });

    if (!job) {
      console.log('❌ No reclassification job found for NPTEL');
      process.exit(1);
    }

    console.log('\n📊 Job Status:');
    console.log('  Status:', job.status);
    console.log('  Progress:', job.progressPercentage + '%');
    console.log('  Processed:', job.processedEmails, '/', job.totalEmails);
    console.log('  Successful:', job.successfulClassifications);
    console.log('  Failed:', job.failedClassifications);
    console.log('  Current Batch:', job.currentBatch, '/', job.totalBatches);
    
    if (job.startedAt) {
      console.log('  Started:', job.startedAt.toISOString());
    }
    if (job.completedAt) {
      console.log('  Completed:', job.completedAt.toISOString());
    }

    // Count emails in NPTEL category
    const nptelEmailCount = await Email.countDocuments({
      userId: nptelCategory.userId,
      category: 'NPTEL'
    });

    console.log('\n📧 NPTEL Category:');
    console.log('  Email count in DB:', nptelCategory.emailCount);
    console.log('  Actual emails with NPTEL category:', nptelEmailCount);

    // Get some sample NPTEL emails
    const sampleEmails = await Email.find({
      userId: nptelCategory.userId,
      category: 'NPTEL'
    }).select('subject classification.confidence').limit(5);

    if (sampleEmails.length > 0) {
      console.log('\n📝 Sample NPTEL emails:');
      sampleEmails.forEach((email, i) => {
        console.log(`  ${i + 1}. ${email.subject} (confidence: ${email.classification?.confidence || 'N/A'})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkJobStatus();

