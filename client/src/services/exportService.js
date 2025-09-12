/**
 * Export service for handling email and analytics data exports
 */

import { api } from './api'

export const exportService = {
  /**
   * Export emails to CSV format
   */
  async exportEmailsToCSV(emailIds, filters = {}) {
    try {
      const response = await api.post('/api/emails/export/csv', {
        emailIds,
        filters
      }, {
        responseType: 'blob'
      })

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `emails-export-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      return { success: true }
    } catch (error) {
      console.error('Error exporting emails to CSV:', error)
      throw error
    }
  },

  /**
   * Export emails to PDF format
   */
  async exportEmailsToPDF(emailIds, filters = {}) {
    try {
      const response = await api.post('/api/emails/export/pdf', {
        emailIds,
        filters
      }, {
        responseType: 'blob'
      })

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `emails-export-${new Date().toISOString().split('T')[0]}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      return { success: true }
    } catch (error) {
      console.error('Error exporting emails to PDF:', error)
      throw error
    }
  },

  /**
   * Export analytics data to CSV
   */
  async exportAnalyticsToCSV(timeRange = '30d') {
    try {
      const response = await api.post('/api/analytics/export/csv', {
        timeRange
      }, {
        responseType: 'blob'
      })

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `analytics-export-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      return { success: true }
    } catch (error) {
      console.error('Error exporting analytics to CSV:', error)
      throw error
    }
  },

  /**
   * Export analytics report to PDF
   */
  async exportAnalyticsToPDF(timeRange = '30d') {
    try {
      const response = await api.post('/api/analytics/export/pdf', {
        timeRange
      }, {
        responseType: 'blob'
      })

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      return { success: true }
    } catch (error) {
      console.error('Error exporting analytics to PDF:', error)
      throw error
    }
  },

  /**
   * Export user data (GDPR compliance)
   */
  async exportUserData() {
    try {
      const response = await api.get('/api/users/export', {
        responseType: 'blob'
      })

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `user-data-export-${new Date().toISOString().split('T')[0]}.json`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      return { success: true }
    } catch (error) {
      console.error('Error exporting user data:', error)
      throw error
    }
  }
}
