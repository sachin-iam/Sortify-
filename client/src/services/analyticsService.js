import { api } from './api'

export const analyticsService = {
  // Get category counts for pie chart
  getCategoryCounts: async () => {
    try {
      const response = await api.get('/api/analytics/categories')
      return response.data
    } catch (error) {
      console.error('Error fetching category counts:', error)
      throw error
    }
  },

  // Get classification accuracy metrics
  getClassificationAccuracy: async () => {
    try {
      const response = await api.get('/api/analytics/accuracy')
      return response.data
    } catch (error) {
      console.error('Error fetching accuracy metrics:', error)
      throw error
    }
  },

  // Get misclassifications for review
  getMisclassifications: async (limit = 50) => {
    try {
      const response = await api.get(`/api/analytics/misclassifications?limit=${limit}`)
      return response.data
    } catch (error) {
      console.error('Error fetching misclassifications:', error)
      throw error
    }
  },

  // Export analytics data as CSV
  exportAnalyticsData: async () => {
    try {
      const response = await api.get('/api/analytics/export', {
        responseType: 'blob'
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `sortify-analytics-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      return { success: true }
    } catch (error) {
      console.error('Error exporting analytics data:', error)
      throw error
    }
  },

  // Get email statistics
  getEmailStats: async () => {
    try {
      const response = await api.get('/api/analytics/stats')
      return response.data
    } catch (error) {
      console.error('Error fetching email stats:', error)
      throw error
    }
  },

  // Get performance metrics
  getPerformanceMetrics: async () => {
    try {
      const response = await api.get('/api/analytics/performance')
      return response.data
    } catch (error) {
      console.error('Error fetching performance metrics:', error)
      throw error
    }
  }
}
