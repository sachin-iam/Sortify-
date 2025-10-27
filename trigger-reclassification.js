// Script to trigger manual reclassification for NPTEL category
import mongoose from 'mongoose';
import { startReclassificationJob } from './server/src/services/emailReclassificationService.js';
import Category from './server/src/models/Category.js';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sortify';

async function triggerReclassification() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find NPTEL category
    const nptelCategory = await Category.findOne({ name: 'NPTEL' });
    
    if (!nptelCategory) {
      console.log('❌ NPTEL category not found in database');
      process.exit(1);
    }

    console.log('✅ Found NPTEL category:', {
      id: nptelCategory._id,
      name: nptelCategory.name,
      emailCount: nptelCategory.emailCount,
      trainingStatus: nptelCategory.trainingStatus
    });

    // Trigger reclassification
    console.log('\n🚀 Starting reclassification job for NPTEL...');
    const job = await startReclassificationJob(
      nptelCategory.userId.toString(),
      'NPTEL',
      nptelCategory._id.toString()
    );

    console.log('✅ Reclassification job started!');
    console.log('📊 Job details:', {
      jobId: job._id,
      status: job.status,
      totalEmails: job.totalEmails,
      totalBatches: job.totalBatches
    });

    console.log('\n⏳ The reclassification is running in the background.');
    console.log('📝 Check the server logs for progress updates.');
    console.log('🔍 Watch for logs like:');
    console.log('   - "🔍 Reclassifying email: ..."');
    console.log('   - "📊 Classification result: NPTEL (0.85)"');
    console.log('   - "✅ Updated email ... to category: NPTEL"');

    // Keep connection open for a few seconds to let job start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

triggerReclassification();

