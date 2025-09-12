// Manual test without starting the server
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import User from '../src/models/User.js'
import Email from '../src/models/Email.js'

let mongoServer

const setup = async () => {
  mongoServer = await MongoMemoryServer.create()
  const mongoUri = mongoServer.getUri()
  await mongoose.connect(mongoUri)
}

const teardown = async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
}

const createTestUser = async () => {
  const user = new User({
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword'
  })
  await user.save()
  return user
}

const createTestUserWithGmail = async () => {
  const user = new User({
    name: 'Test User',
    email: 'test@gmail.com',
    password: 'hashedpassword',
    gmailConnected: true,
    gmailAccessToken: 'test-access-token',
    gmailRefreshToken: 'test-refresh-token',
    gmailTokenExpiry: new Date(Date.now() + 3600000)
  })
  await user.save()
  return user
}

const runTests = async () => {
  try {
    await setup()
    console.log('✅ Database setup complete')

    // Test 1: User creation
    console.log('Testing user creation...')
    const user = await createTestUser()
    if (!user._id) {
      throw new Error('User not created properly')
    }
    console.log('✅ User creation test passed')

    // Test 2: Gmail user creation
    console.log('Testing Gmail user creation...')
    const gmailUser = await createTestUserWithGmail()
    if (!gmailUser.gmailConnected) {
      throw new Error('Gmail user not created properly')
    }
    console.log('✅ Gmail user creation test passed')

    // Test 3: Email creation and purge
    console.log('Testing email creation and purge...')
    await Email.insertMany([
      { 
        userId: gmailUser._id, 
        provider: 'gmail', 
        gmailId: 'test1', 
        subject: 'Test 1',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        date: new Date()
      },
      { 
        userId: gmailUser._id, 
        provider: 'gmail', 
        gmailId: 'test2', 
        subject: 'Test 2',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        date: new Date()
      }
    ])
    
    const beforeCount = await Email.countDocuments({ userId: gmailUser._id, provider: 'gmail' })
    if (beforeCount !== 2) {
      throw new Error(`Expected 2 emails, got ${beforeCount}`)
    }

    // Test purge
    await Email.deleteMany({ userId: gmailUser._id, provider: 'gmail' })
    const afterCount = await Email.countDocuments({ userId: gmailUser._id, provider: 'gmail' })
    if (afterCount !== 0) {
      throw new Error(`Expected 0 emails after purge, got ${afterCount}`)
    }
    console.log('✅ Email creation and purge test passed')

    console.log('🎉 All tests passed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  } finally {
    await teardown()
  }
}

runTests()
