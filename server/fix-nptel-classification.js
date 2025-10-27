// Script to directly fix NPTEL classification by applying keyword-based rules
import mongoose from 'mongoose';
import Email from './src/models/Email.js';
import Category from './src/models/Category.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sortify';

async function fixNPTELClassification() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get NPTEL category
    const nptelCategory = await Category.findOne({ name: 'NPTEL' });
    if (!nptelCategory) {
      console.log('❌ NPTEL category not found');
      process.exit(1);
    }

    const userId = nptelCategory.userId;

    console.log('🔍 Searching for NPTEL emails using keyword patterns...');

    // NPTEL keyword patterns
    const nptelPatterns = [
      /nptel/i,
      /iitm/i,
      /nptel\.iitm\.ac\.in/i,
      /online course/i,
      /course.*nptel/i,
      /nptel.*course/i,
      /assignment.*nptel/i,
      /nptel.*assignment/i
    ];

    // Find emails that match NPTEL patterns
    const nptelEmails = await Email.find({
      userId: userId,
      isDeleted: false,
      $or: [
        { subject: { $regex: /nptel|iitm|nptel\.iitm\.ac\.in/i } },
        { snippet: { $regex: /nptel|iitm/i } },
        { body: { $regex: /nptel|iitm/i } },
        { text: { $regex: /nptel|iitm/i } },
        { from: { $regex: /nptel\.iitm\.ac\.in/i } }
      ]
    }).limit(1000); // Process in batches

    console.log(`📧 Found ${nptelEmails.length} potential NPTEL emails`);

    let updatedCount = 0;

    for (const email of nptelEmails) {
      try {
        const fullText = `${email.subject || ''} ${email.snippet || ''} ${email.body || email.text || ''}`.toLowerCase();
        const fromField = (email.from || '').toLowerCase();
        
        // Check if email matches NPTEL patterns
        let isNPTEL = false;
        
        // Check sender domain
        if (fromField.includes('nptel.iitm.ac.in')) {
          isNPTEL = true;
        }
        
        // Check content patterns
        for (const pattern of nptelPatterns) {
          if (pattern.test(fullText)) {
            isNPTEL = true;
            break;
          }
        }

        if (isNPTEL) {
          // Update email to NPTEL category
          await Email.findByIdAndUpdate(email._id, {
            category: 'NPTEL',
            classification: {
              label: 'NPTEL',
              confidence: 0.95, // High confidence for keyword match
              modelVersion: '3.0.0',
              classifiedAt: new Date(),
              reason: 'Direct keyword-based classification',
              model: 'keyword-enhanced'
            },
            updatedAt: new Date()
          });

          updatedCount++;
          console.log(`✅ Updated: "${email.subject}" -> NPTEL`);
        }
      } catch (error) {
        console.error(`❌ Error updating email ${email._id}:`, error.message);
      }
    }

    // Update category email count
    const actualNPTELCount = await Email.countDocuments({
      userId: userId,
      category: 'NPTEL',
      isDeleted: false
    });

    await Category.findByIdAndUpdate(nptelCategory._id, {
      emailCount: actualNPTELCount
    });

    console.log(`\n🎉 NPTEL Classification Fix Complete!`);
    console.log(`📊 Statistics:`);
    console.log(`  - Emails examined: ${nptelEmails.length}`);
    console.log(`  - Emails updated: ${updatedCount}`);
    console.log(`  - Total NPTEL emails now: ${actualNPTELCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixNPTELClassification();
