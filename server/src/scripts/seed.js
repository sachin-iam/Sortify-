import mongoose from 'mongoose'
import dotenv from 'dotenv'
import User from '../models/User.js'
import Email from '../models/Email.js'

// Load environment variables
dotenv.config()

const seedData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Clear existing data
    await User.deleteMany({})
    await Email.deleteMany({})
    console.log('🗑️ Cleared existing data')

    // Create demo user
    const demoUser = await User.create({
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'demo123',
      isEmailVerified: true,
      gmailConnected: true,
      outlookConnected: true
    })
    console.log('👤 Created demo user')

    // Create sample emails
    const sampleEmails = [
      {
        user: demoUser._id,
        messageId: 'gmail-1',
        threadId: 'thread-1',
        subject: 'Welcome to Gmail',
        from: 'noreply@gmail.com',
        to: [demoUser.email],
        body: 'Welcome to Gmail! This is a sample email for testing purposes. You can use this to test the email classification features.',
        snippet: 'Welcome to Gmail! This is a sample email for testing purposes...',
        date: new Date(),
        provider: 'gmail',
        labels: ['INBOX'],
        classification: {
          label: 'Other',
          confidence: 0.85,
          modelVersion: '1.0.0',
          classifiedAt: new Date(),
          scores: {
            Academic: 0.1,
            Promotions: 0.05,
            Placement: 0.0,
            Spam: 0.0,
            Other: 0.85
          }
        }
      },
      {
        user: demoUser._id,
        messageId: 'gmail-2',
        threadId: 'thread-2',
        subject: 'Academic Newsletter - Spring 2024',
        from: 'newsletter@university.edu',
        to: [demoUser.email],
        body: 'This is an academic newsletter with important updates about courses, research opportunities, and campus events for the Spring 2024 semester.',
        snippet: 'This is an academic newsletter with important updates about courses...',
        date: new Date(Date.now() - 86400000), // 1 day ago
        provider: 'gmail',
        labels: ['INBOX'],
        classification: {
          label: 'Academic',
          confidence: 0.92,
          modelVersion: '1.0.0',
          classifiedAt: new Date(),
          scores: {
            Academic: 0.92,
            Promotions: 0.03,
            Placement: 0.02,
            Spam: 0.01,
            Other: 0.02
          }
        }
      },
      {
        user: demoUser._id,
        messageId: 'gmail-3',
        threadId: 'thread-3',
        subject: 'Special Offer - 50% Off All Courses!',
        from: 'offers@onlinelearning.com',
        to: [demoUser.email],
        body: 'Don\'t miss out on our special offer! Get 50% off on all online courses for a limited time. Use code SAVE50 at checkout.',
        snippet: 'Don\'t miss out on our special offer! Get 50% off on all online courses...',
        date: new Date(Date.now() - 172800000), // 2 days ago
        provider: 'gmail',
        labels: ['INBOX'],
        classification: {
          label: 'Promotions',
          confidence: 0.88,
          modelVersion: '1.0.0',
          classifiedAt: new Date(),
          scores: {
            Academic: 0.05,
            Promotions: 0.88,
            Placement: 0.02,
            Spam: 0.03,
            Other: 0.02
          }
        }
      },
      {
        user: demoUser._id,
        messageId: 'outlook-1',
        threadId: 'thread-4',
        subject: 'Job Opportunity - Software Engineer',
        from: 'hr@techcompany.com',
        to: [demoUser.email],
        body: 'We have an exciting opportunity for a Software Engineer position. Please review the attached job description and let us know if you\'re interested.',
        snippet: 'We have an exciting opportunity for a Software Engineer position...',
        date: new Date(Date.now() - 259200000), // 3 days ago
        provider: 'outlook',
        labels: ['INBOX'],
        classification: {
          label: 'Placement',
          confidence: 0.91,
          modelVersion: '1.0.0',
          classifiedAt: new Date(),
          scores: {
            Academic: 0.02,
            Promotions: 0.01,
            Placement: 0.91,
            Spam: 0.02,
            Other: 0.04
          }
        }
      },
      {
        user: demoUser._id,
        messageId: 'gmail-4',
        threadId: 'thread-5',
        subject: 'URGENT: Claim Your Prize Now!',
        from: 'winner@lottery.com',
        to: [demoUser.email],
        body: 'Congratulations! You have won $1,000,000! Click here to claim your prize immediately! This offer expires in 24 hours.',
        snippet: 'Congratulations! You have won $1,000,000! Click here to claim...',
        date: new Date(Date.now() - 345600000), // 4 days ago
        provider: 'gmail',
        labels: ['INBOX'],
        classification: {
          label: 'Spam',
          confidence: 0.95,
          modelVersion: '1.0.0',
          classifiedAt: new Date(),
          scores: {
            Academic: 0.01,
            Promotions: 0.02,
            Placement: 0.01,
            Spam: 0.95,
            Other: 0.01
          }
        }
      },
      {
        user: demoUser._id,
        messageId: 'outlook-2',
        threadId: 'thread-6',
        subject: 'Microsoft 365 Updates',
        from: 'updates@microsoft.com',
        to: [demoUser.email],
        body: 'Stay updated with the latest Microsoft 365 features and improvements. New security enhancements and productivity tools are now available.',
        snippet: 'Stay updated with the latest Microsoft 365 features and improvements...',
        date: new Date(Date.now() - 432000000), // 5 days ago
        provider: 'outlook',
        labels: ['INBOX'],
        classification: {
          label: 'Other',
          confidence: 0.78,
          modelVersion: '1.0.0',
          classifiedAt: new Date(),
          scores: {
            Academic: 0.1,
            Promotions: 0.05,
            Placement: 0.02,
            Spam: 0.05,
            Other: 0.78
          }
        }
      }
    ]

    await Email.insertMany(sampleEmails)
    console.log(`📧 Created ${sampleEmails.length} sample emails`)

    console.log('\n🎉 Database seeded successfully!')
    console.log('\nDemo credentials:')
    console.log('Email: demo@example.com')
    console.log('Password: demo123')
    console.log('\nSample emails created with different categories:')
    console.log('- Academic Newsletter')
    console.log('- Promotional Offer')
    console.log('- Job Opportunity')
    console.log('- Spam Email')
    console.log('- General Updates')

  } catch (error) {
    console.error('❌ Error seeding database:', error)
  } finally {
    await mongoose.connection.close()
    console.log('🔌 Database connection closed')
  }
}

// Run the seed function
seedData()
