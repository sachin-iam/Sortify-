import mongoose from 'mongoose'

// Setup for tests
beforeAll(async () => {
  // Connect to test database
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sortify-test'
  await mongoose.connect(mongoUri)
})

afterAll(async () => {
  // Clean up and disconnect
  await mongoose.connection.close()
})

// Increase timeout for database operations
jest.setTimeout(10000)
