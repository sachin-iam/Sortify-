// Export routes for enhanced email export functionality
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import Email from '../models/Email.js'
import exportService from '../services/exportService.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// @desc    Get available export formats and templates
// @route   GET /api/export/formats
// @access  Private
router.get('/formats', protect, asyncHandler(async (req, res) => {
  try {
    const formats = exportService.getExportFormats()
    const templates = exportService.getExportTemplates()

    res.json({
      success: true,
      formats,
      templates
    })

  } catch (error) {
    console.error('Get export formats error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch export formats',
      error: error.message
    })
  }
}))

// @desc    Get export statistics
// @route   GET /api/export/stats
// @access  Private
router.get('/stats', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const { category, dateRange } = req.query

    // Build query
    let query = { userId }
    
    if (category && category !== 'All') {
      query.category = category
    }

    if (dateRange) {
      const { start, end } = JSON.parse(dateRange)
      if (start) query.date = { ...query.date, $gte: new Date(start) }
      if (end) query.date = { ...query.date, $lte: new Date(end) }
    }

    const emails = await Email.find(query).select('subject from date category isRead attachments classification')
    const stats = exportService.getExportStats(emails)

    res.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Get export stats error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch export statistics',
      error: error.message
    })
  }
}))

// @desc    Export emails
// @route   POST /api/export/emails
// @access  Private
router.post('/emails', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const {
      format = 'csv',
      template = 'basic',
      fields = [],
      filters = {},
      dateRange = {},
      includeAttachments = false,
      includeSummary = false
    } = req.body

    // Build query
    let query = { userId }
    
    if (filters.category && filters.category !== 'All') {
      query.category = filters.category
    }

    if (filters.isRead !== undefined) {
      query.isRead = filters.isRead
    }

    if (dateRange.start || dateRange.end) {
      query.date = {}
      if (dateRange.start) query.date.$gte = new Date(dateRange.start)
      if (dateRange.end) query.date.$lte = new Date(dateRange.end)
    }

    // Get emails
    let emails = await Email.find(query)
      .sort({ date: -1 })
      .select('subject from to date category isRead snippet body text attachments classification gmailId')

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      emails = emails.filter(email => 
        email.subject.toLowerCase().includes(searchTerm) ||
        email.from.toLowerCase().includes(searchTerm) ||
        email.snippet.toLowerCase().includes(searchTerm)
      )
    }

    // Export emails
    const exportResult = await exportService.exportEmails(emails, {
      format,
      template,
      fields,
      filters,
      dateRange,
      includeAttachments,
      includeSummary
    })

    // Set appropriate headers based on format
    const formatInfo = exportService.getExportFormats()[format]
    const filename = `emails_export_${Date.now()}.${formatInfo.extension}`

    res.setHeader('Content-Type', formatInfo.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // Send data based on format
    if (format === 'xlsx') {
      // For Excel files, we need to write to buffer
      const buffer = await exportResult.data.xlsx.writeBuffer()
      res.send(buffer)
    } else if (format === 'pdf') {
      // For PDF files
      res.send(exportResult.data)
    } else if (format === 'zip') {
      // For ZIP files
      res.setHeader('Content-Type', 'application/zip')
      res.send(exportResult.data)
    } else {
      // For text-based formats (CSV, JSON, TXT)
      res.send(exportResult.data)
    }

  } catch (error) {
    console.error('Export emails error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to export emails',
      error: error.message
    })
  }
}))

// @desc    Export specific emails by IDs
// @route   POST /api/export/emails/selected
// @access  Private
router.post('/emails/selected', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const { emailIds, format = 'csv', template = 'basic', fields = [] } = req.body

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email IDs are required'
      })
    }

    // Get selected emails
    const emails = await Email.find({
      _id: { $in: emailIds },
      userId
    }).select('subject from to date category isRead snippet body text attachments classification gmailId')

    // Export emails
    const exportResult = await exportService.exportEmails(emails, {
      format,
      template,
      fields
    })

    // Set appropriate headers
    const formatInfo = exportService.getExportFormats()[format]
    const filename = `selected_emails_${Date.now()}.${formatInfo.extension}`

    res.setHeader('Content-Type', formatInfo.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // Send data based on format
    if (format === 'xlsx') {
      const buffer = await exportResult.data.xlsx.writeBuffer()
      res.send(buffer)
    } else if (format === 'pdf') {
      res.send(exportResult.data)
    } else if (format === 'zip') {
      res.setHeader('Content-Type', 'application/zip')
      res.send(exportResult.data)
    } else {
      res.send(exportResult.data)
    }

  } catch (error) {
    console.error('Export selected emails error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to export selected emails',
      error: error.message
    })
  }
}))

// @desc    Export analytics data
// @route   POST /api/export/analytics
// @access  Private
router.post('/analytics', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const { format = 'xlsx', dateRange = {} } = req.body

    // Get emails for analytics
    let query = { userId }
    
    if (dateRange.start || dateRange.end) {
      query.date = {}
      if (dateRange.start) query.date.$gte = new Date(dateRange.start)
      if (dateRange.end) query.date.$lte = new Date(dateRange.end)
    }

    const emails = await Email.find(query)
      .select('category isRead date classification')

    // Generate analytics data
    const analyticsData = generateAnalyticsData(emails)

    // Export analytics
    const exportResult = await exportService.exportEmails(analyticsData, {
      format,
      template: 'analytics'
    })

    // Set headers
    const formatInfo = exportService.getExportFormats()[format]
    const filename = `analytics_export_${Date.now()}.${formatInfo.extension}`

    res.setHeader('Content-Type', formatInfo.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    if (format === 'xlsx') {
      const buffer = await exportResult.data.xlsx.writeBuffer()
      res.send(buffer)
    } else {
      res.send(exportResult.data)
    }

  } catch (error) {
    console.error('Export analytics error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to export analytics',
      error: error.message
    })
  }
}))

// @desc    Preview export data
// @route   POST /api/export/preview
// @access  Private
router.post('/preview', protect, asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const { filters = {}, dateRange = {}, template = 'basic', fields = [], limit = 10 } = req.body

    // Build query
    let query = { userId }
    
    if (filters.category && filters.category !== 'All') {
      query.category = filters.category
    }

    if (filters.isRead !== undefined) {
      query.isRead = filters.isRead
    }

    if (dateRange.start || dateRange.end) {
      query.date = {}
      if (dateRange.start) query.date.$gte = new Date(dateRange.start)
      if (dateRange.end) query.date.$lte = new Date(dateRange.end)
    }

    // Get limited emails for preview
    const emails = await Email.find(query)
      .sort({ date: -1 })
      .limit(limit)
      .select('subject from to date category isRead snippet body text attachments classification gmailId')

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      emails = emails.filter(email => 
        email.subject.toLowerCase().includes(searchTerm) ||
        email.from.toLowerCase().includes(searchTerm) ||
        email.snippet.toLowerCase().includes(searchTerm)
      )
    }

    // Get selected fields
    const selectedFields = exportService.getFieldsForTemplate(template, fields)
    
    // Process emails for preview
    const processedEmails = exportService.processEmailsForExport(emails, selectedFields)

    res.json({
      success: true,
      preview: processedEmails,
      fields: selectedFields,
      totalCount: emails.length
    })

  } catch (error) {
    console.error('Export preview error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to generate export preview',
      error: error.message
    })
  }
}))

// Helper function to generate analytics data
function generateAnalyticsData(emails) {
  const categoryStats = {}
  const readStats = { read: 0, unread: 0 }
  const confidenceStats = { total: 0, count: 0 }

  emails.forEach(email => {
    // Category statistics
    categoryStats[email.category] = (categoryStats[email.category] || 0) + 1

    // Read status statistics
    if (email.isRead) {
      readStats.read++
    } else {
      readStats.unread++
    }

    // Confidence statistics
    if (email.classification && email.classification.confidence) {
      confidenceStats.total += email.classification.confidence
      confidenceStats.count++
    }
  })

  const totalEmails = emails.length
  const avgConfidence = confidenceStats.count > 0 ? confidenceStats.total / confidenceStats.count : 0

  // Convert to array format for export
  const analyticsData = [
    {
      category: 'Total Emails',
      count: totalEmails,
      percentage: 100,
      avgConfidence: avgConfidence.toFixed(2)
    },
    {
      category: 'Read Emails',
      count: readStats.read,
      percentage: ((readStats.read / totalEmails) * 100).toFixed(2),
      avgConfidence: avgConfidence.toFixed(2)
    },
    {
      category: 'Unread Emails',
      count: readStats.unread,
      percentage: ((readStats.unread / totalEmails) * 100).toFixed(2),
      avgConfidence: avgConfidence.toFixed(2)
    }
  ]

  // Add category breakdown
  Object.entries(categoryStats).forEach(([category, count]) => {
    analyticsData.push({
      category: category,
      count: count,
      percentage: ((count / totalEmails) * 100).toFixed(2),
      avgConfidence: avgConfidence.toFixed(2)
    })
  })

  return analyticsData
}

export default router
