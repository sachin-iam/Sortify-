import { api } from './api'

const emailService = {
  // List emails with filtering and pagination
  list: async (params = {}) => {
    const {
      page = 1,
      limit = 25,
      category = 'All',
      provider = 'gmail',
      q: search = ''
    } = params

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      category,
      provider,
      ...(search && { q: search }),
      t: Date.now() // Cache-busting parameter
    })

    const response = await api.get(`/api/emails?${queryParams}`)
    return response.data
  },

  // Alias for list function (for compatibility)
  getEmails: async (params = {}) => {
    return emailService.list(params)
  },

  // Get email statistics
  getStats: async () => {
    const response = await api.get(`/api/analytics/stats?t=${Date.now()}`)
    return response.data
  },

  // Get single email details
  detail: async (id) => {
    const response = await api.get(`/api/emails/${id}`)
    return response.data
  },

  // Archive email
  archive: async (id) => {
    const response = await api.put(`/api/emails/${id}/archive`)
    return response.data
  },

  // Delete email
  remove: async (id) => {
    const response = await api.delete(`/api/emails/${id}`)
    return response.data
  },

  // Download attachment
  downloadAttachment: async (emailId, attachmentId) => {
    const response = await api.get(
      `/api/emails/${emailId}/attachments/${attachmentId}/download`,
      {
        responseType: 'blob'
      }
    )
    return response.data
  },

  // Export email (single)
  export: async (id) => {
    const response = await api.post(`/api/emails/export`, {
      emailIds: [id],
      format: 'pdf'
    })
    return response.data
  },

  // Bulk operations
  bulkArchive: async (ids) => {
    const response = await api.post('/api/emails/bulk', {
      action: 'archive',
      emailIds: ids
    })
    return response.data
  },

  bulkDelete: async (ids) => {
    const response = await api.post('/api/emails/bulk', {
      action: 'delete',
      emailIds: ids
    })
    return response.data
  },

  bulkExport: async (ids) => {
    const response = await api.post('/api/emails/export', {
      emailIds: ids,
      format: 'csv'
    })
    return response.data
  },

  // Gmail sync
  syncGmail: async () => {
    const response = await api.post('/api/emails/gmail/sync-all')
    return response.data
  },

  // Gmail sync all
  syncGmailAll: async () => {
    const response = await api.post('/api/emails/gmail/sync-all')
    return response.data
  },

  // Outlook sync (coming soon)
  syncOutlook: async () => {
    const response = await api.post('/api/emails/outlook/sync-all')
    return response.data
  },

  // Realtime SSE - removed duplicate, handled in Dashboard component

  // Auth services
  connectGmail: async () => {
    const response = await api.get('/api/auth/gmail/connect')
    return response.data
  },

  disconnectGmail: async () => {
    const response = await api.post('/api/auth/gmail/disconnect')
    return response.data
  }
}

export default emailService
