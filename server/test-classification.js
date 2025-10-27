// Test classification directly
import { classifyEmail } from './src/services/classificationService.js';
import Category from './src/models/Category.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

async function testClassification() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sortify');

    // Get NPTEL category and user ID
    const nptelCategory = await Category.findOne({ name: 'NPTEL' });
    if (!nptelCategory) {
      console.log('❌ NPTEL category not found');
      process.exit(1);
    }

    const userId = nptelCategory.userId.toString();

    console.log('🧪 Testing classification with NPTEL-related content...\n');

    // Test 1: NPTEL email
    console.log('Test 1: NPTEL course email');
    const result1 = await classifyEmail(
      'NPTEL Online Course - Week 5 Assignment',
      'This is your NPTEL online course assignment reminder',
      'Complete your NPTEL course assignment for Week 5. Visit nptel.iitm.ac.in',
      userId
    );
    console.log('  Result:', result1.label, `(${result1.confidence})`, `[${result1.model}]`);

    // Test 2: Placement email
    console.log('\nTest 2: Placement email');
    const result2 = await classifyEmail(
      'Job Opportunity - Software Engineer at Google',
      'Exciting job opening for Software Engineer role',
      'Apply now for Software Engineer position at Google. Great career opportunity.',
      userId
    );
    console.log('  Result:', result2.label, `(${result2.confidence})`, `[${result2.model}]`);

    // Test 3: Academic email
    console.log('\nTest 3: Academic email');
    const result3 = await classifyEmail(
      'Assignment Deadline Reminder',
      'Your assignment is due tomorrow',
      'Please submit your homework assignment by tomorrow. Contact professor for help.',
      userId
    );
    console.log('  Result:', result3.label, `(${result3.confidence})`, `[${result3.model}]`);

    console.log('\n✅ Classification tests completed');
    console.log('\n💡 Note: If all results show "Other" or non-NPTEL categories,');
    console.log('   the ML service might not be properly classifying NPTEL content.');
    console.log('   This could mean:');
    console.log('   1. The ML service needs the NPTEL patterns/keywords');
    console.log('   2. The classification threshold is too high');
    console.log('   3. The training didn\'t complete properly');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testClassification();

