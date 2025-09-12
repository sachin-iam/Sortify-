import mongoose from 'mongoose'
import dotenv from 'dotenv'

// Load test environment variables
dotenv.config({ path: '.env.test' })

// Set default test environment variables
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jest'
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sortify-test'

// Setup for tests
beforeAll(async () => {
  // Connect to test database
  const mongoUri = process.env.MONGODB_URI
  await mongoose.connect(mongoUri)
})

afterAll(async () => {
  // Clean up and disconnect
  await mongoose.connection.close()
})
