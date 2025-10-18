import { api } from './api'

export const analyticsService = {
  // Get category counts for pie chart
  getCategoryCounts: async () => {
    try {
      const response = await api.get('/analytics/categories')
      return response.data
    } catch (error) {
      console.error('Error fetching category counts:', error)
      throw error
    }
  },

  // Get classification accuracy metrics
  getClassificationAccuracy: async () => {
    try {
      const response = await api.get('/analytics/accuracy')
      return response.data
    } catch (error) {
      console.error('Error fetching accuracy metrics:', error)
      throw error
    }
  },

  // Get misclassifications for review
  getMisclassifications: async (limit = 50) => {
    try {
      const response = await api.get(`/analytics/misclassifications?limit=${limit}`)
      return response.data
    } catch (error) {
      console.error('Error fetching misclassifications:', error)
      throw error
    }
  },


  // Get email statistics
  getEmailStats: async () => {
    try {
      const response = await api.get('/analytics/stats')
      return response.data
    } catch (error) {
      console.error('Error fetching email stats:', error)
      throw error
    }
  },

  // Get performance metrics
  getPerformanceMetrics: async () => {
    try {
      const response = await api.get('/analytics/performance')
      return response.data
    } catch (error) {
      console.error('Error fetching performance metrics:', error)
      throw error
    }
  }
}
