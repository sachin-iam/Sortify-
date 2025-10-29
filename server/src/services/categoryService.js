// Category service for managing user-specific categories with database persistence
import mongoose from 'mongoose'
import Category from '../models/Category.js'
import Email from '../models/Email.js'
import { startReclassificationJob } from './emailReclassificationService.js'

// Helper function to convert userId to ObjectId
const toObjectId = (userId) => {
  return typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId
}

// Cache for category data to improve performance
const categoryCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Clear category cache for a specific user
 * @param {string} userId - User ID
 */
export const clearCategoryCache = (userId) => {
  if (userId) {
    categoryCache.delete(userId.toString())
    console.log(`🗑️ Cleared category cache for user: ${userId}`)
  } else {
    categoryCache.clear()
    console.log(`🗑️ Cleared all category cache`)
  }
}

/**
 * Get all categories for a specific user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of categories
 */
export const getCategories = async (userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required')
    }

    const userIdStr = userId.toString()

    // Check cache first
    const cached = categoryCache.get(userIdStr)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`✅ Returning cached categories for user: ${userIdStr}`)
      return cached.data
    }

    console.time(`getCategories-${userIdStr}`)

    // Convert userId to ObjectId
    const userIdObj = toObjectId(userId)

    // Ensure user has default categories
    const allCategories = await Category.getOrCreateDefaults(userIdObj)
    
    // Filter to only active categories (matches previous analytics endpoint behavior)
    const categories = allCategories.filter(category => category.isActive !== false)
    
    // OPTIMIZED: Get ALL email counts with a SINGLE aggregation query
    const emailCounts = await Email.aggregate([
      { 
        $match: { 
          userId: userIdObj,
          isDeleted: false 
        } 
      },
      { 
        $group: { 
          _id: '$category', 
          count: { $sum: 1 } 
        } 
      }
    ])

    // Create a Map for O(1) lookups
    const countMap = new Map(
      emailCounts.map(item => [item._id, item.count])
    )

    // Map categories with their counts (no additional queries!)
    const categoriesWithCounts = categories.map(category => ({
      id: category._id.toString(),
      name: category.name,
      description: category.description,
      count: countMap.get(category.name) || 0,
      color: category.color,
      isDefault: category.isDefault,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    }))

    // Store in cache
    categoryCache.set(userIdStr, {
      data: categoriesWithCounts,
      timestamp: Date.now()
    })

    console.timeEnd(`getCategories-${userIdStr}`)
    console.log(`✅ Categories loaded and cached (${categories.length} categories, 1 query)`)

    return categoriesWithCounts
  } catch (error) {
    console.error('Error getting categories:', error)
    throw error
  }
}

/**
 * Get category count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of categories
 */
export const getCategoryCount = async (userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required')
    }
    
    return await Category.countDocuments({ userId: toObjectId(userId) })
  } catch (error) {
    console.error('Error getting category count:', error)
    throw error
  }
}

/**
 * Add a new category for a user
 * @param {string} userId - User ID
 * @param {Object} categoryData - Category data
 * @returns {Promise<Object>} Created category
 */
export const addCategory = async (userId, categoryData) => {
  try {
    if (!userId) {
      throw new Error('User ID is required')
    }

    const newCategory = new Category({
      userId: toObjectId(userId),
      name: categoryData.name.trim(),
      description: categoryData.description || `Custom category: ${categoryData.name.trim()}`,
      color: categoryData.color || '#6B7280',
      isDefault: false,
      emailCount: 0,
      // Add new fields for dynamic classification
      classificationStrategy: categoryData.classificationStrategy || null,
      patterns: categoryData.patterns || null,
      trainingStatus: categoryData.trainingStatus || 'pending',
      sampleEmailIds: categoryData.sampleEmailIds || [],
      keywords: categoryData.keywords || []
    })

    const savedCategory = await newCategory.save()
    
    // Clear cache after adding category
    clearCategoryCache(userId)
    
    // Don't trigger reclassification here - let the caller handle it
    // This prevents duplicate reclassification jobs
    console.log(`✅ Category "${savedCategory.name}" saved to database`)
    
    return {
      id: savedCategory._id.toString(),
      name: savedCategory.name,
      description: savedCategory.description,
      count: savedCategory.emailCount,
      color: savedCategory.color,
      isDefault: savedCategory.isDefault,
      isActive: savedCategory.isActive,
      classificationStrategy: savedCategory.classificationStrategy,
      patterns: savedCategory.patterns,
      trainingStatus: savedCategory.trainingStatus,
      mlServiceId: savedCategory.mlServiceId,
      createdAt: savedCategory.createdAt,
      updatedAt: savedCategory.updatedAt
    }
  } catch (error) {
    console.error('Error adding category:', error)
    throw error
  }
}

/**
 * Update an existing category
 * @param {string} userId - User ID
 * @param {string} categoryId - Category ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object|null>} Updated category or null if not found
 */
export const updateCategory = async (userId, categoryId, updates) => {
  try {
    if (!userId || !categoryId) {
      throw new Error('User ID and Category ID are required')
    }

    // Find the category and ensure it belongs to the user
    const category = await Category.findOne({ _id: categoryId, userId: toObjectId(userId) })
    
    if (!category) {
      return null
    }

    // Prevent renaming the "Other" category
    if (category.name === 'Other' && updates.name && updates.name !== category.name) {
      throw new Error('Cannot rename the "Other" category')
    }

    // Check if classification strategy is being updated
    const shouldTriggerReclassification = 
      updates.classificationStrategy && 
      JSON.stringify(updates.classificationStrategy) !== JSON.stringify(category.classificationStrategy)

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      {
        ...updates,
        name: updates.name ? updates.name.trim() : category.name,
        updatedAt: new Date()
      },
      { new: true }
    )

    // Clear cache after updating category
    clearCategoryCache(userId)

    // Trigger reclassification if classification strategy changed
    if (shouldTriggerReclassification && updatedCategory) {
      try {
        console.log(`🔄 Triggering reclassification for updated category strategy: ${updatedCategory.name}`)
        await startReclassificationJob(userId, updatedCategory.name, updatedCategory._id.toString())
      } catch (reclassifyError) {
        console.error('❌ Error starting reclassification for updated category:', reclassifyError)
        // Don't fail the category update if reclassification fails
      }
    }

    return {
      id: updatedCategory._id.toString(),
      name: updatedCategory.name,
      description: updatedCategory.description,
      count: updatedCategory.emailCount,
      color: updatedCategory.color,
      isDefault: updatedCategory.isDefault,
      isActive: updatedCategory.isActive,
      createdAt: updatedCategory.createdAt,
      updatedAt: updatedCategory.updatedAt
    }
  } catch (error) {
    console.error('Error updating category:', error)
    throw error
  }
}

/**
 * Delete a category for a user
 * @param {string} userId - User ID
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object|null>} Deleted category or null if not found
 */
export const deleteCategory = async (userId, categoryId) => {
  try {
    if (!userId || !categoryId) {
      throw new Error('User ID and Category ID are required')
    }

    // Find the category and ensure it belongs to the user
    const category = await Category.findOne({ _id: categoryId, userId: toObjectId(userId) })
    
    if (!category) {
      return null
    }

    // Only prevent deleting the "Other" category - allow deletion of all other categories
    if (category.name === 'Other') {
      throw new Error('Cannot delete the "Other" category')
    }

    // Move all emails from this category to "Other" before deleting
    const emailCount = await Email.countDocuments({ 
      userId: toObjectId(userId), 
      category: category.name 
    })

    if (emailCount > 0) {
      console.log(`🔄 Moving ${emailCount} emails from "${category.name}" to "Other" category`)
      
      await Email.updateMany(
        { 
          userId: toObjectId(userId),
          category: category.name
        },
        { 
          $set: { 
            category: 'Other',
            classification: {
              label: 'Other',
              confidence: 1.0,
              modelVersion: 'manual',
              classifiedAt: new Date(),
              reason: `Moved to Other due to category "${category.name}" deletion`
            },
            updatedAt: new Date()
          }
        }
      )
      
      console.log(`✅ Moved ${emailCount} emails to "Other" category`)
    }

    const deletedCategory = await Category.findByIdAndDelete(categoryId)
    
    // Clear cache after deleting category
    clearCategoryCache(userId)
    
    return {
      id: deletedCategory._id.toString(),
      name: deletedCategory.name,
      description: deletedCategory.description,
      count: deletedCategory.emailCount,
      color: deletedCategory.color,
      isDefault: deletedCategory.isDefault,
      isActive: deletedCategory.isActive,
      createdAt: deletedCategory.createdAt,
      updatedAt: deletedCategory.updatedAt
    }
  } catch (error) {
    console.error('Error deleting category:', error)
    throw error
  }
}

/**
 * Find category by ID for a specific user
 * @param {string} userId - User ID
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object|null>} Category or null if not found
 */
export const findCategoryById = async (userId, categoryId) => {
  try {
    if (!userId || !categoryId) {
      return null
    }

    const category = await Category.findOne({ _id: categoryId, userId: toObjectId(userId) })
    
    if (!category) {
      return null
    }

    return {
      id: category._id.toString(),
      name: category.name,
      description: category.description,
      count: category.emailCount,
      color: category.color,
      isDefault: category.isDefault,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    }
  } catch (error) {
    console.error('Error finding category by ID:', error)
    return null
  }
}

/**
 * Find category by name for a specific user
 * @param {string} userId - User ID
 * @param {string} name - Category name
 * @returns {Promise<Object|null>} Category or null if not found
 */
export const findCategoryByName = async (userId, name) => {
  try {
    if (!userId || !name) {
      return null
    }

    const category = await Category.findOne({ 
      userId: toObjectId(userId), 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    })
    
    if (!category) {
      return null
    }

    return {
      id: category._id.toString(),
      name: category.name,
      description: category.description,
      count: category.emailCount,
      color: category.color,
      isDefault: category.isDefault,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    }
  } catch (error) {
    console.error('Error finding category by name:', error)
    return null
  }
}
