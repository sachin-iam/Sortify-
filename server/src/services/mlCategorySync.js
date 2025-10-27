/**
 * ML Category Sync Service
 * Bidirectional sync between MongoDB categories and Python ML service
 */

import mongoose from 'mongoose'
import Category from '../models/Category.js'
import axios from 'axios'

const ML_SERVICE_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'
const SYNC_TIMEOUT = 10000 // 10 seconds

/**
 * Sync a single category to the ML service
 * @param {Object} category - Category object from MongoDB
 * @returns {Promise<boolean>} Success status
 */
export const syncCategoryToML = async (category) => {
  try {
    console.log(`🔄 Syncing category "${category.name}" to ML service...`)

    const categoryData = {
      name: category.name,
      description: category.description || `Auto-generated category: ${category.name}`,
      keywords: category.keywords || [],
      color: category.color || '#6B7280'
    }

    // Add classification strategy if available
    if (category.classificationStrategy) {
      categoryData.classification_strategy = category.classificationStrategy
    }

    const response = await axios.post(
      `${ML_SERVICE_BASE_URL}/categories`,
      categoryData,
      {
        timeout: SYNC_TIMEOUT,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (response.data?.status === 'success') {
      console.log(`✅ Category "${category.name}" synced to ML service`)
      
      // Update category with ML service ID if provided
      if (response.data.category?.id) {
        await Category.findByIdAndUpdate(category._id, {
          mlServiceId: response.data.category.id
        })
      }
      
      return true
    } else {
      console.error(`❌ Failed to sync category "${category.name}":`, response.data)
      return false
    }

  } catch (error) {
    console.error(`❌ Error syncing category "${category.name}" to ML service:`, error.message)
    
    if (error.response?.status === 400 && error.response.data?.detail?.includes('already exists')) {
      console.log(`Category "${category.name}" already exists in ML service, updating instead...`)
      return await updateCategoryInML(category)
    }
    
    return false
  }
}

/**
 * Update a category in the ML service
 * @param {Object} category - Category object from MongoDB
 * @returns {Promise<boolean>} Success status
 */
export const updateCategoryInML = async (category) => {
  try {
    console.log(`🔄 Updating category "${category.name}" in ML service...`)

    const updateData = {
      description: category.description,
      keywords: category.keywords || [],
      color: category.color || '#6B7280'
    }

    if (category.classificationStrategy) {
      updateData.classification_strategy = category.classificationStrategy
    }

    const response = await axios.put(
      `${ML_SERVICE_BASE_URL}/categories/${encodeURIComponent(category.name)}`,
      updateData,
      {
        timeout: SYNC_TIMEOUT,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (response.data?.status === 'success') {
      console.log(`✅ Category "${category.name}" updated in ML service`)
      return true
    } else {
      console.error(`❌ Failed to update category "${category.name}":`, response.data)
      return false
    }

  } catch (error) {
    console.error(`❌ Error updating category "${category.name}" in ML service:`, error.message)
    return false
  }
}

/**
 * Remove a category from the ML service
 * @param {string} categoryName - Category name
 * @returns {Promise<boolean>} Success status
 */
export const removeCategoryFromML = async (categoryName) => {
  try {
    console.log(`🔄 Removing category "${categoryName}" from ML service...`)

    const response = await axios.delete(
      `${ML_SERVICE_BASE_URL}/categories/${encodeURIComponent(categoryName)}`,
      {
        timeout: SYNC_TIMEOUT
      }
    )

    if (response.data?.status === 'success') {
      console.log(`✅ Category "${categoryName}" removed from ML service`)
      return true
    } else {
      console.error(`❌ Failed to remove category "${categoryName}":`, response.data)
      return false
    }

  } catch (error) {
    console.error(`❌ Error removing category "${categoryName}" from ML service:`, error.message)
    return false
  }
}

/**
 * Train a category in the ML service with classification strategy
 * @param {Object} category - Category object with classification strategy
 * @param {Array} sampleEmails - Sample emails for training
 * @returns {Promise<Object>} Training result
 */
export const trainCategoryInML = async (category, sampleEmails = []) => {
  try {
    console.log(`🤖 Training category "${category.name}" in ML service...`)

    const trainingData = {
      classification_strategy: category.classificationStrategy,
      sample_emails: sampleEmails.map(email => ({
        subject: email.subject || '',
        body: email.body || email.text || email.snippet || ''
      }))
    }

    const response = await axios.post(
      `${ML_SERVICE_BASE_URL}/categories/${encodeURIComponent(category.name)}/train`,
      trainingData,
      {
        timeout: SYNC_TIMEOUT * 2, // Longer timeout for training
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (response.data?.status === 'success') {
      console.log(`✅ Category "${category.name}" training completed successfully`)
      return {
        success: true,
        trainingData: response.data
      }
    } else {
      console.error(`❌ Training failed for category "${category.name}":`, response.data)
      return {
        success: false,
        error: response.data?.message || 'Training failed'
      }
    }

  } catch (error) {
    console.error(`❌ Error training category "${category.name}" in ML service:`, error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Sync all categories for a user to the ML service
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Sync result
 */
export const syncAllUserCategories = async (userId) => {
  try {
    console.log(`🔄 Syncing all categories for user ${userId}...`)

    const categories = await Category.find({
      userId: new mongoose.Types.ObjectId(userId),
      isActive: true
    })

    let successCount = 0
    let failureCount = 0

    for (const category of categories) {
      const success = await syncCategoryToML(category)
      if (success) {
        successCount++
      } else {
        failureCount++
      }
    }

    console.log(`✅ Synced ${successCount}/${categories.length} categories to ML service`)

    return {
      success: failureCount === 0,
      syncedCategories: successCount,
      totalCategories: categories.length,
      failures: failureCount
    }

  } catch (error) {
    console.error('❌ Error syncing user categories:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Get categories from ML service for validation
 * @returns {Promise<Array>} Categories from ML service
 */
export const getMLServiceCategories = async () => {
  try {
    const response = await axios.get(
      `${ML_SERVICE_BASE_URL}/categories`,
      {
        timeout: SYNC_TIMEOUT
      }
    )

    return response.data || []
  } catch (error) {
    console.error('❌ Error getting categories from ML service:', error.message)
    return []
  }
}

/**
 * Validate sync consistency between MongoDB and ML service
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Validation result
 */
export const validateCategorySync = async (userId) => {
  try {
    console.log(`🔍 Validating category sync for user ${userId}...`)

    // Get categories from both sources
    const mongoCategories = await Category.find({
      userId: new mongoose.Types.ObjectId(userId),
      isActive: true
    }).select('name description')

    const mlCategories = await getMLServiceCategories()
    const mlCategoryNames = mlCategories.map(cat => cat.name)

    // Find inconsistencies
    const mongoOnly = mongoCategories.filter(cat => !mlCategoryNames.includes(cat.name))
    const mlOnly = mlCategoryNames.filter(name => !mongoCategories.some(cat => cat.name === name))

    const isConsistent = mongoOnly.length === 0 && mlOnly.length === 0

    console.log(`📊 Sync validation: ${isConsistent ? 'CONSISTENT' : 'INCONSISTENT'}`)
    if (mongoOnly.length > 0) console.log(`   Missing in ML: ${mongoOnly.map(c => c.name).join(', ')}`)
    if (mlOnly.length > 0) console.log(`   Extra in ML: ${mlOnly.join(', ')}`)

    return {
      isConsistent,
      mongoCategories: mongoCategories.length,
      mlCategories: mlCategoryNames.length,
      missingInML: mongoOnly.map(c => c.name),
      extraInML: mlOnly
    }

  } catch (error) {
    console.error('❌ Error validating category sync:', error)
    return {
      isConsistent: false,
      error: error.message
    }
  }
}

/**
 * Initialize category sync on service startup
 * @param {string} userId - User ID to sync (optional, syncs all users if not provided)
 */
export const initializeCategorySync = async (userId = null) => {
  try {
    console.log('🚀 Initializing category sync...')

    // Check ML service health
    try {
      const healthResponse = await axios.get(`${ML_SERVICE_BASE_URL}/health`, { timeout: 5000 })
      if (healthResponse.data?.status !== 'OK') {
        console.warn('⚠️ ML service is not healthy, skipping sync initialization')
        return
      }
      console.log('✅ ML service is healthy')
    } catch (error) {
      console.warn('⚠️ Cannot connect to ML service, skipping sync initialization:', error.message)
      return
    }

    if (userId) {
      // Sync for specific user
      await syncAllUserCategories(userId)
    } else {
      // Sync for all users (in production, this might be too heavy)
      const allCategories = await Category.find({ isActive: true }).distinct('userId')
      for (const uid of allCategories) {
        await syncAllUserCategories(uid)
      }
    }

    console.log('✅ Category sync initialization completed')
  } catch (error) {
    console.error('❌ Error initializing category sync:', error)
  }
}

export default {
  syncCategoryToML,
  updateCategoryInML,
  removeCategoryFromML,
  trainCategoryInML,
  syncAllUserCategories,
  getMLServiceCategories,
  validateCategorySync,
  initializeCategorySync
}
