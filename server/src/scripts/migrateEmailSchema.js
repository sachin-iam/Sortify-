import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Email from '../models/Email.js'

// Load environment variables
dotenv.config()

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    return true
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message)
    return false
  }
}

const migrateEmailSchema = async () => {
  try {
    console.log('🚀 Starting Email schema migration...')
    
    // Check if migration is needed
    const sampleEmail = await Email.findOne({})
    if (sampleEmail && sampleEmail.isFullContentLoaded !== undefined) {
      console.log('✅ Schema migration already completed')
      return
    }

    // Add new fields to existing documents
    const result = await Email.updateMany(
      { isFullContentLoaded: { $exists: false } },
      { 
        $set: { 
          isFullContentLoaded: false,
          fullContentLoadedAt: null,
          lastAccessedAt: null
        }
      }
    )

    console.log(`✅ Migration completed: Updated ${result.modifiedCount} email documents`)
    
    // Verify migration
    const totalEmails = await Email.countDocuments({})
    const migratedEmails = await Email.countDocuments({ isFullContentLoaded: { $exists: true } })
    
    console.log(`📊 Migration verification:`)
    console.log(`   Total emails: ${totalEmails}`)
    console.log(`   Migrated emails: ${migratedEmails}`)
    
    if (totalEmails === migratedEmails) {
      console.log('✅ All emails successfully migrated')
    } else {
      console.log('⚠️ Some emails may not have been migrated')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

const main = async () => {
  try {
    const connected = await connectDB()
    if (!connected) {
      process.exit(1)
    }

    await migrateEmailSchema()
    
    console.log('🎉 Migration script completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('💥 Migration script failed:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { migrateEmailSchema }
