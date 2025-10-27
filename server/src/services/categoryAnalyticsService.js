/**
 * Category Analytics Service
 * Track and update category analytics including classification metrics and insights
 */

import mongoose from 'mongoose'
import Email from '../models/Email.js'
import Category from '../models/Category.js'

/**
 * Get analytics for all categories of a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Category analytics
 */
export const getCategoryAnalytics = async (userId) => {
  try {
    const categories = await Category.find({ 
      userId: new mongoose.Types.ObjectId(userId),
      isActive: true 
    })

    const analytics = {}

    for (const category of categories) {
      const categoryStats = await getCategoryStats(userId, category.name)
      analytics[category.name] = {
        ...categoryStats,
        categoryId: category._id,
        trainingStatus: category.trainingStatus,
        hasStrategy: !!category.classificationStrategy,
        patternCount: category.patterns?.rules?.length || 0
      }
    }

    return {
      success: true,
      analytics,
      totalCategories: categories.length,
      lastUpdated: new Date()
    }
  } catch (error) {
    console.error('Error getting category analytics:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Get detailed stats for a specific category
 * @param {string} userId - User ID
 * @param {string} categoryName - Category name
 * @returns {Promise<Object>} Category stats
 */
export const getCategoryStats = async (userId, categoryName) => {
  try {
    const [
      totalEmails,
      confidenceStats,
      recentEmails,
      timeDistribution
    ] = await Promise.all([
      // Total emails in category
      Email.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        category: categoryName,
        isDeleted: false
      }),

      // Confidence statistics
      Email.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            category: categoryName,
            isDeleted: false,
            'classification.confidence': { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            avgConfidence: { $avg: '$classification.confidence' },
            minConfidence: { $min: '$classification.confidence' },
            maxConfidence: { $max: '$classification.confidence' },
            highConfidenceCount: { $sum: { $cond: [{ $gte: ['$classification.confidence', 0.8] }, 1, 0] } },
            mediumConfidenceCount: { $sum: { $cond: [{ $and: [{ $gte: ['$classification.confidence', 0.5] }, { $lt: ['$classification.confidence', 0.8] }] }, 1, 0] } },
            lowConfidenceCount: { $sum: { $cond: [{ $lt: ['$classification.confidence', 0.5] }, 1, 0] } },
            totalCount: { $sum: 1 }
          }
        }
      ]),

      // Recent email activity (last 30 days)
      Email.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        category: categoryName,
        isDeleted: false,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),

      // Time distribution (emails by hour)
      Email.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            category: categoryName,
            isDeleted: false
          }
        },
        {
          $group: {
            _id: { $hour: '$date' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ])

    const confidenceData = confidenceStats[0] || {
      avgConfidence: 0,
      minConfidence: 0,
      maxConfidence: 0,
      highConfidenceCount: 0,
      mediumConfidenceCount: 0,
      lowConfidenceCount: 0,
      totalCount: 0
    }

    return {
      totalEmails,
      confidenceStats: {
        average: Math.round(confidenceData.avgConfidence * 100) / 100,
        min: confidenceData.minConfidence,
        max: confidenceData.maxConfidence,
        distribution: {
          high: confidenceData.highConfidenceCount,
          medium: confidenceData.mediumConfidenceCount,
          low: confidenceData.lowConfidenceCount
        }
      },
      recentActivity: {
        last30Days: recentEmails
      },
      timeDistribution: timeDistribution.reduce((acc, item) => {
        acc[item._id] = item.count
        return acc
      }, {}),
      lastAnalyzed: new Date()
    }
  } catch (error) {
    console.error(`Error getting stats for category ${categoryName}:`, error)
    return {
      totalEmails: 0,
      confidenceStats: null,
      recentActivity: { last30Days: 0 },
      timeDistribution: {},
      error: error.message
    }
  }
}

/**
 * Update category analytics after reclassification
 * @param {string} userId - User ID
 * @param {string} categoryName - Category name
 * @param {number} reclassifiedCount - Number of emails reclassified
 * @returns {Promise<Object>} Update result
 */
export const updateCategoryAnalytics = async (userId, categoryName, reclassifiedCount = 0) => {
  try {
    console.log(`📊 Updating analytics for category "${categoryName}"`)

    // Update email count in category
    await Category.updateEmailCount(userId, categoryName)

    // Get updated stats
    const stats = await getCategoryStats(userId, categoryName)

    // Optional: Store analytics history for trending
    // This could be implemented as a separate collection

    console.log(`✅ Updated analytics for "${categoryName}": ${stats.totalEmails} emails`)

    return {
      success: true,
      categoryName,
      updatedStats: stats,
      reclassifiedCount
    }
  } catch (error) {
    console.error(`Error updating analytics for category ${categoryName}:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Get classification accuracy insights
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Accuracy insights
 */
export const getClassificationInsights = async (userId) => {
  try {
    const categories = await Category.find({ 
      userId: new mongoose.Types.ObjectId(userId),
      isActive: true 
    })

    const insights = []
    const categoryNames = categories.map(cat => cat.name)

    for (const category of categories) {
      const stats = await getCategoryStats(userId, category.name)
      
      // Calculate insights based on confidence distribution
      if (stats.confidenceStats && stats.totalEmails > 0) {
        const highConfidenceRatio = stats.confidenceStats.distribution.high / stats.totalEmails
        const avgConfidence = stats.confidenceStats.average

        let insight = {
          categoryName: category.name,
          recommendation: null,
          accuracy: avgConfidence
        }

        if (highConfidenceRatio < 0.5 && stats.totalEmails > 10) {
          insight.recommendation = 'low_confidence'
          insight.message = 'Many emails in this category have low classification confidence. Consider adding more training samples or refining the category description.'
        } else if (avgConfidence > 0.8) {
          insight.recommendation = 'good_accuracy'
          insight.message = 'This category shows high classification accuracy.'
        } else if (stats.totalEmails < 5) {
          insight.recommendation = 'needs_samples'
          insight.message = 'This category has very few emails. More examples would help improve classification.'
        }

        insights.push(insight)
      }
    }

    return {
      success: true,
      insights,
      totalCategories: categories.length,
      recommendations: insights.filter(i => i.recommendation !== null).length
    }
  } catch (error) {
    console.error('Error getting classification insights:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Track category performance over time
 * @param {string} userId - User ID
 * @param {string} categoryName - Category name
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Performance trend
 */
export const getCategoryPerformanceTrend = async (userId, categoryName, days = 7) => {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const dailyStats = await Email.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          category: categoryName,
          isDeleted: false,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          emailCount: { $sum: 1 },
          avgConfidence: { $avg: '$classification.confidence' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ])

    return {
      success: true,
      categoryName,
      period: `${days} days`,
      dailyStats,
      trend: dailyStats.length > 1 ? 
        (dailyStats[dailyStats.length - 1].emailCount - dailyStats[0].emailCount) / dailyStats.length : 0
    }
  } catch (error) {
    console.error(`Error getting performance trend for ${categoryName}:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}

export default {
  getCategoryAnalytics,
  getCategoryStats,
  updateCategoryAnalytics,
  getClassificationInsights,
  getCategoryPerformanceTrend
}
