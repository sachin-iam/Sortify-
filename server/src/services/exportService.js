// Enhanced export service for multiple formats and advanced options
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import archiver from 'archiver'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class ExportService {
  constructor() {
    this.exportFormats = {
      'csv': { name: 'CSV', mimeType: 'text/csv', extension: 'csv' },
      'xlsx': { name: 'Excel', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' },
      'json': { name: 'JSON', mimeType: 'application/json', extension: 'json' },
      'pdf': { name: 'PDF', mimeType: 'application/pdf', extension: 'pdf' },
      'txt': { name: 'Text', mimeType: 'text/plain', extension: 'txt' },
      'zip': { name: 'ZIP Archive', mimeType: 'application/zip', extension: 'zip' }
    }
    
    this.exportTemplates = {
      'basic': {
        name: 'Basic Export',
        description: 'Simple email list with basic fields',
        fields: ['subject', 'from', 'date', 'category', 'isRead']
      },
      'detailed': {
        name: 'Detailed Export',
        description: 'Comprehensive email data with all fields',
        fields: ['subject', 'from', 'to', 'date', 'category', 'isRead', 'snippet', 'body', 'attachments']
      },
      'analytics': {
        name: 'Analytics Export',
        description: 'Email analytics and statistics',
        fields: ['category', 'count', 'percentage', 'avgConfidence', 'trends']
      }
    }
  }

  // Main export function
  async exportEmails(emails, options = {}) {
    const {
      format = 'csv',
      template = 'basic',
      fields = [],
      filters = {},
      dateRange = {},
      includeAttachments = false
    } = options

    try {
      // Filter emails based on criteria
      let filteredEmails = this.filterEmails(emails, filters, dateRange)
      
      // Select fields based on template
      const selectedFields = this.getFieldsForTemplate(template, fields)
      
      // Process emails for export
      const processedEmails = this.processEmailsForExport(filteredEmails, selectedFields)
      
      // Generate export based on format
      const exportData = await this.generateExport(processedEmails, format, options)
      
      return {
        success: true,
        data: exportData,
        metadata: {
          format,
          template,
          recordCount: filteredEmails.length,
          fields: selectedFields,
          generatedAt: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('Export error:', error)
      throw new Error(`Export failed: ${error.message}`)
    }
  }

  // Filter emails based on criteria
  filterEmails(emails, filters, dateRange) {
    let filtered = [...emails]

    // Category filter
    if (filters.category && filters.category !== 'All') {
      filtered = filtered.filter(email => email.category === filters.category)
    }

    // Read status filter
    if (filters.isRead !== undefined) {
      filtered = filtered.filter(email => email.isRead === filters.isRead)
    }

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      filtered = filtered.filter(email => 
        email.subject.toLowerCase().includes(searchTerm) ||
        email.from.toLowerCase().includes(searchTerm) ||
        email.snippet.toLowerCase().includes(searchTerm)
      )
    }

    // Date range filter
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(email => {
        const emailDate = new Date(email.date)
        if (dateRange.start && emailDate < new Date(dateRange.start)) return false
        if (dateRange.end && emailDate > new Date(dateRange.end)) return false
        return true
      })
    }

    return filtered
  }

  // Get fields for template
  getFieldsForTemplate(template, customFields = []) {
    if (template === 'custom' && customFields.length > 0) {
      return customFields
    }
    
    const templateFields = this.exportTemplates[template]?.fields || this.exportTemplates.basic.fields
    return templateFields
  }

  // Process emails for export
  processEmailsForExport(emails, fields) {
    return emails.map(email => {
      const processed = {}
      
      fields.forEach(field => {
        switch (field) {
          case 'subject':
            processed.subject = email.subject || ''
            break
          case 'from':
            processed.from = email.from || ''
            break
          case 'to':
            processed.to = email.to || ''
            break
          case 'date':
            processed.date = new Date(email.date).toISOString()
            break
          case 'category':
            processed.category = email.category || 'Other'
            break
          case 'isRead':
            processed.isRead = email.isRead ? 'Yes' : 'No'
            break
          case 'snippet':
            processed.snippet = email.snippet || ''
            break
          case 'body':
            processed.body = email.body || email.text || ''
            break
          case 'attachments':
            processed.attachments = email.attachments?.length || 0
            break
          case 'confidence':
            processed.confidence = email.classification?.confidence || 0
            break
          case 'gmailId':
            processed.gmailId = email.gmailId || ''
            break
          default:
            processed[field] = email[field] || ''
        }
      })
      
      return processed
    })
  }

  // Generate export based on format
  async generateExport(emails, format, options) {
    switch (format) {
      case 'csv':
        return this.generateCSV(emails)
      case 'xlsx':
        return this.generateExcel(emails, options)
      case 'json':
        return this.generateJSON(emails)
      case 'pdf':
        return this.generatePDF(emails, options)
      case 'txt':
        return this.generateText(emails)
      case 'zip':
        return this.generateZIP(emails, options)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  // Generate CSV export
  generateCSV(emails) {
    if (emails.length === 0) return ''

    const headers = Object.keys(emails[0])
    const csvContent = [
      headers.join(','),
      ...emails.map(email => 
        headers.map(header => {
          const value = email[header] || ''
          return `"${value.toString().replace(/"/g, '""')}"`
        }).join(',')
      )
    ].join('\n')

    return csvContent
  }

  // Generate Excel export
  async generateExcel(emails, options) {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Emails')

    if (emails.length === 0) {
      return workbook
    }

    // Add headers
    const headers = Object.keys(emails[0])
    worksheet.addRow(headers)

    // Style headers
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    }

    // Add data rows
    emails.forEach(email => {
      const row = worksheet.addRow(Object.values(email))
      
      // Add conditional formatting for categories
      const categoryCell = row.getCell(headers.indexOf('category') + 1)
      const category = email.category
      
      if (category === 'Academic') {
        categoryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } }
      } else if (category === 'Promotions') {
        categoryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } }
      } else if (category === 'Placement') {
        categoryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } }
      } else if (category === 'Spam') {
        categoryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } }
      }
    })

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width || 10, 15)
    })

    // Add filters
    worksheet.autoFilter = 'A1:' + String.fromCharCode(65 + headers.length - 1) + '1'

    return workbook
  }

  // Generate JSON export
  generateJSON(emails) {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      totalEmails: emails.length,
      emails: emails
    }, null, 2)
  }

  // Generate PDF export
  async generatePDF(emails, options) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 })
      const chunks = []

      doc.on('data', chunk => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Add title
      doc.fontSize(20).text('Email Export Report', { align: 'center' })
      doc.moveDown()

      // Add metadata
      doc.fontSize(12)
      doc.text(`Generated: ${new Date().toLocaleString()}`)
      doc.text(`Total Emails: ${emails.length}`)
      doc.moveDown()

      // Add emails
      emails.forEach((email, index) => {
        if (index > 0) {
          doc.addPage()
        }

        doc.fontSize(16).text(`Email ${index + 1}`, { underline: true })
        doc.moveDown(0.5)

        doc.fontSize(12)
        doc.text(`Subject: ${email.subject}`)
        doc.text(`From: ${email.from}`)
        doc.text(`Date: ${new Date(email.date).toLocaleString()}`)
        doc.text(`Category: ${email.category}`)
        doc.text(`Read: ${email.isRead}`)
        
        if (email.snippet) {
          doc.moveDown()
          doc.text('Preview:', { underline: true })
          doc.text(email.snippet, { width: 500 })
        }

        doc.moveDown()
      })

      doc.end()
    })
  }

  // Generate text export
  generateText(emails) {
    let text = `Email Export Report\n`
    text += `Generated: ${new Date().toLocaleString()}\n`
    text += `Total Emails: ${emails.length}\n`
    text += `${'='.repeat(50)}\n\n`

    emails.forEach((email, index) => {
      text += `Email ${index + 1}:\n`
      text += `Subject: ${email.subject}\n`
      text += `From: ${email.from}\n`
      text += `Date: ${new Date(email.date).toLocaleString()}\n`
      text += `Category: ${email.category}\n`
      text += `Read: ${email.isRead}\n`
      
      if (email.snippet) {
        text += `Preview: ${email.snippet}\n`
      }
      
      text += `${'-'.repeat(30)}\n\n`
    })

    return text
  }

  // Generate ZIP archive
  async generateZIP(emails, options) {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } })
      const chunks = []

      archive.on('data', chunk => chunks.push(chunk))
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)

      // Add CSV file
      const csvData = this.generateCSV(emails)
      archive.append(csvData, { name: 'emails.csv' })

      // Add JSON file
      const jsonData = this.generateJSON(emails)
      archive.append(jsonData, { name: 'emails.json' })

      // Add text file
      const textData = this.generateText(emails)
      archive.append(textData, { name: 'emails.txt' })

      archive.finalize()
    })
  }

  // Get available export formats
  getExportFormats() {
    return this.exportFormats
  }

  // Get available export templates
  getExportTemplates() {
    return this.exportTemplates
  }

  // Get export statistics
  getExportStats(emails) {
    const stats = {
      totalEmails: emails.length,
      byCategory: {},
      byReadStatus: { read: 0, unread: 0 },
      dateRange: { earliest: null, latest: null },
      withAttachments: 0
    }

    emails.forEach(email => {
      // Category stats
      stats.byCategory[email.category] = (stats.byCategory[email.category] || 0) + 1

      // Read status stats
      if (email.isRead) {
        stats.byReadStatus.read++
      } else {
        stats.byReadStatus.unread++
      }

      // Date range
      const emailDate = new Date(email.date)
      if (!stats.dateRange.earliest || emailDate < stats.dateRange.earliest) {
        stats.dateRange.earliest = emailDate
      }
      if (!stats.dateRange.latest || emailDate > stats.dateRange.latest) {
        stats.dateRange.latest = emailDate
      }

      // Attachments
      if (email.attachments && email.attachments.length > 0) {
        stats.withAttachments++
      }
    })

    return stats
  }
}

// Create singleton instance
const exportService = new ExportService()

export default exportService