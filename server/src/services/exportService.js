import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'

// For now, let's create a simple PDF without autoTable to avoid import issues
// In production, you would properly configure jsPDF with autoTable

// @desc    Export emails as CSV
// @param   {Array} emails - Array of email objects
// @param   {Object} options - Export options
// @returns {String} CSV content
export const exportToCSV = (emails, options = {}) => {
  const { includeHeaders = true, fields = ['subject', 'from', 'date', 'category'] } = options
  
  if (emails.length === 0) {
    return 'No data to export'
  }

  // Create CSV header
  const csvHeader = fields.map(field => 
    field.charAt(0).toUpperCase() + field.slice(1)
  ).join(',') + '\n'

  // Create CSV rows
  const csvRows = emails.map(email => {
    return fields.map(field => {
      let value = email[field] || ''
      
      // Format date
      if (field === 'date' && value) {
        value = new Date(value).toISOString()
      }
      
      // Escape quotes and wrap in quotes
      value = `"${String(value).replace(/"/g, '""')}"`
      return value
    }).join(',')
  }).join('\n')

  return includeHeaders ? csvHeader + csvRows : csvRows
}

// @desc    Export emails as PDF
// @param   {Array} emails - Array of email objects
// @param   {Object} options - Export options
// @returns {Buffer} PDF buffer
export const exportToPDF = (emails, options = {}) => {
  const { 
    title = 'Sortify Email Analytics',
    fields = ['subject', 'from', 'date', 'category'],
    pageSize = 'A4'
  } = options

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: pageSize
  })

  // Add title
  doc.setFontSize(20)
  doc.text(title, 14, 22)

  // Add export date
  doc.setFontSize(10)
  doc.text(`Exported on: ${new Date().toLocaleDateString()}`, 14, 30)

  // Prepare table data
  const tableData = emails.map(email => {
    return fields.map(field => {
      let value = email[field] || ''
      
      // Format date
      if (field === 'date' && value) {
        value = new Date(value).toLocaleDateString()
      }
      
      // Truncate long text
      if (field === 'subject' && value.length > 50) {
        value = value.substring(0, 47) + '...'
      }
      
      return value
    })
  })

  // Add simple table data (without autoTable for now)
  let yPosition = 40
  const lineHeight = 6
  
  // Add headers
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  const headerText = fields.map(field => 
    field.charAt(0).toUpperCase() + field.slice(1)
  ).join(' | ')
  doc.text(headerText, 14, yPosition)
  yPosition += lineHeight * 2
  
  // Add data rows
  doc.setFont(undefined, 'normal')
  doc.setFontSize(8)
  tableData.forEach((row, index) => {
    if (yPosition > 280) { // Start new page if needed
      doc.addPage()
      yPosition = 20
    }
    
    const rowText = row.join(' | ')
    doc.text(rowText, 14, yPosition)
    yPosition += lineHeight
  })

  return doc.output('arraybuffer')
}

// @desc    Export emails as Excel
// @param   {Array} emails - Array of email objects
// @param   {Object} options - Export options
// @returns {Buffer} Excel buffer
export const exportToExcel = (emails, options = {}) => {
  const { 
    sheetName = 'Email Analytics',
    fields = ['subject', 'from', 'date', 'category']
  } = options

  // Prepare worksheet data
  const worksheetData = [
    // Header row
    fields.map(field => 
      field.charAt(0).toUpperCase() + field.slice(1)
    ),
    // Data rows
    ...emails.map(email => {
      return fields.map(field => {
        let value = email[field] || ''
        
        // Format date
        if (field === 'date' && value) {
          value = new Date(value).toISOString()
        }
        
        return value
      })
    })
  ]

  // Create workbook
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  // Set column widths
  const columnWidths = fields.map(field => {
    switch (field) {
      case 'subject': return { wch: 50 }
      case 'from': return { wch: 30 }
      case 'date': return { wch: 20 }
      case 'category': return { wch: 15 }
      default: return { wch: 20 }
    }
  })
  worksheet['!cols'] = columnWidths

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  // Convert to buffer
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}

// @desc    Get export statistics
// @param   {Array} emails - Array of email objects
// @returns {Object} Export statistics
export const getExportStats = (emails) => {
  const totalEmails = emails.length
  const categories = [...new Set(emails.map(email => email.category).filter(Boolean))]
  const dateRange = emails.length > 0 ? {
    earliest: new Date(Math.min(...emails.map(email => new Date(email.date)))),
    latest: new Date(Math.max(...emails.map(email => new Date(email.date))))
  } : null

  return {
    totalEmails,
    categories: categories.length,
    categoryList: categories,
    dateRange
  }
}
