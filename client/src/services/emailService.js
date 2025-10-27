import { api } from './api'

const emailService = {
  // List emails with filtering and pagination
  list: async (params = {}) => {
    const {
      page = 1,
      limit = 25,
      category = 'All',
      provider = 'gmail',
      q: search = '',
      threaded = true // Enable threading by default
    } = params

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      category,
      provider,
      threaded: threaded.toString(),
      ...(search && { q: search }),
      t: Date.now() // Cache-busting parameter
    })

    const response = await api.get(`/emails?${queryParams}`)
    return response.data
  },

  // Alias for list function (for compatibility)
  getEmails: async (params = {}) => {
    return emailService.list(params)
  },

  // Get email statistics
  getStats: async () => {
    const response = await api.get(`/analytics/stats?t=${Date.now()}`)
    return response.data
  },

  // Get single email details
  detail: async (id) => {
    const response = await api.get(`/emails/${id}`)
    return response.data
  },

  // Get full email content (lazy loading)
  getFullEmailContent: async (id) => {
    const response = await api.get(`/emails/${id}/full-content`)
    return response.data
  },

  // Get all messages in a thread
  getThreadMessages: async (containerId) => {
    const response = await api.get(`/emails/thread/${containerId}`)
    return response.data
  },

  // Archive email
  archive: async (id) => {
    const response = await api.put(`/emails/${id}/archive`)
    return response.data
  },

  // Unarchive email
  unarchive: async (id) => {
    const response = await api.put(`/emails/${id}/unarchive`)
    return response.data
  },

  // Delete email
  remove: async (id) => {
    const response = await api.delete(`/emails/${id}`)
    return response.data
  },

  // Download attachment
  downloadAttachment: async (emailId, attachmentId) => {
    const response = await api.get(
      `/emails/${emailId}/attachments/${attachmentId}/download`,
      {
        responseType: 'blob'
      }
    )
    return response.data
  },

  // Export email (single)
  export: async (id) => {
    const response = await api.post(`/emails/export`, {
      emailIds: [id],
      format: 'pdf'
    })
    return response.data
  },

  // Bulk operations
  bulkArchive: async (ids) => {
    const response = await api.post('/emails/bulk', {
      operation: 'archive',
      emailIds: ids
    })
    return response.data
  },

  bulkDelete: async (ids) => {
    const response = await api.post('/emails/bulk', {
      operation: 'delete',
      emailIds: ids
    })
    return response.data
  },

  bulkExport: async (ids) => {
    const response = await api.post('/emails/export', {
      emailIds: ids,
      format: 'csv'
    })
    return response.data
  },

  // Gmail sync
  syncGmail: async () => {
    const response = await api.post('/emails/gmail/sync-all')
    return response.data
  },

  // Gmail sync all
  syncGmailAll: async () => {
    const response = await api.post('/emails/gmail/sync-all')
    return response.data
  },

  // Outlook sync (coming soon)
  syncOutlook: async () => {
    const response = await api.post('/emails/outlook/sync-all')
    return response.data
  },

  // Realtime SSE - removed duplicate, handled in Dashboard component

  // Auth services
  connectGmail: async () => {
    const response = await api.get('/auth/gmail/connect')
    return response.data
  },

  disconnectGmail: async () => {
    const response = await api.post('/auth/gmail/disconnect')
    return response.data
  },

  // Send reply to an email
  sendReply: async (emailId, replyBody) => {
    const response = await api.post(`/emails/${emailId}/reply`, {
      body: replyBody
    })
    return response.data
  },

  // Mark email(s) as read
  markAsRead: async (emailIds) => {
    const ids = Array.isArray(emailIds) ? emailIds : [emailIds]
    const response = await api.post('/emails/bulk', {
      emailIds: ids,
      operation: 'markRead'
    })
    return response.data
  }
}

export default emailService
