// Script to restart NPTEL reclassification with keyword boost
import mongoose from 'mongoose';
import { startReclassificationJob } from './src/services/emailReclassificationService.js';
import Category from './src/models/Category.js';
import ReclassificationJob from './src/models/ReclassificationJob.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

async function restartReclassification() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sortify');

    const nptelCategory = await Category.findOne({ name: 'NPTEL' });
    if (!nptelCategory) {
      console.log('❌ NPTEL category not found');
      process.exit(1);
    }

    // Find and mark the current job as completed to allow restart
    const currentJob = await ReclassificationJob.findOne({ categoryName: 'NPTEL' })
      .sort({ createdAt: -1 });

    if (currentJob && currentJob.status === 'processing') {
      console.log('🔄 Updating current job status to allow restart...');
      currentJob.status = 'failed';
      currentJob.errorMessage = 'Restarted with keyword boost fix';
      currentJob.completedAt = new Date();
      await currentJob.save();
    }

    console.log('🚀 Starting fresh reclassification with keyword boost...');
    
    const newJob = await startReclassificationJob(
      nptelCategory.userId.toString(),
      'NPTEL',
      nptelCategory._id.toString()
    );

    console.log('✅ New reclassification job started!');
    console.log('📊 Job details:', {
      jobId: newJob._id,
      status: newJob.status,
      totalEmails: newJob.totalEmails
    });

    console.log('\n💡 The keyword boost will now detect NPTEL emails by:');
    console.log('  - Checking for "nptel", "iitm", "nptel.iitm.ac.in" in content');
    console.log('  - Checking sender domain for nptel.iitm.ac.in');
    console.log('  - Boosting confidence to 0.95 for matches');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

restartReclassification();
