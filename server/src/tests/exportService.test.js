import { exportToCSV, exportToPDF, exportToExcel, getExportStats } from '../services/exportService.js'

describe('Export Service', () => {
  const mockEmails = [
    {
      subject: 'Test Email 1',
      from: 'sender1@example.com',
      date: new Date('2024-01-01T10:00:00Z'),
      category: 'Other',
      snippet: 'This is a test email'
    },
    {
      subject: 'Test Email 2',
      from: 'sender2@example.com',
      date: new Date('2024-01-02T11:00:00Z'),
      category: 'Promotions',
      snippet: 'Another test email'
    },
    {
      subject: 'Test Email 3',
      from: 'sender3@example.com',
      date: new Date('2024-01-03T12:00:00Z'),
      category: 'Academic',
      snippet: 'Third test email'
    }
  ]

  describe('exportToCSV', () => {
    it('should export emails as CSV with default fields', () => {
      const csv = exportToCSV(mockEmails)
      
      expect(csv).toContain('Subject,From,Date,Category')
      expect(csv).toContain('Test Email 1')
      expect(csv).toContain('sender1@example.com')
      expect(csv).toContain('Other')
    })

    it('should export emails as CSV with custom fields', () => {
      const csv = exportToCSV(mockEmails, { fields: ['subject', 'category'] })
      
      expect(csv).toContain('Subject,Category')
      expect(csv).not.toContain('From')
      expect(csv).not.toContain('Date')
      expect(csv).toContain('Test Email 1')
      expect(csv).toContain('Other')
    })

    it('should handle empty email list', () => {
      const csv = exportToCSV([])
      expect(csv).toBe('No data to export')
    })

    it('should escape quotes in CSV data', () => {
      const emailsWithQuotes = [{
        subject: 'Test "quoted" email',
        from: 'sender@example.com',
        date: new Date('2024-01-01'),
        category: 'inbox'
      }]
      
      const csv = exportToCSV(emailsWithQuotes)
      expect(csv).toContain('"Test ""quoted"" email"')
    })

    it('should handle missing fields gracefully', () => {
      const incompleteEmails = [{
        subject: 'Test Email',
        from: 'sender@example.com'
        // Missing date and category
      }]
      
      const csv = exportToCSV(incompleteEmails)
      expect(csv).toContain('Test Email')
      expect(csv).toContain('sender@example.com')
    })
  })

  describe('exportToPDF', () => {
    it('should export emails as PDF', () => {
      const pdfBuffer = exportToPDF(mockEmails)
      
      expect(pdfBuffer).toBeInstanceOf(ArrayBuffer)
      expect(pdfBuffer.byteLength).toBeGreaterThan(0)
    })

    it('should export with custom options', () => {
      const pdfBuffer = exportToPDF(mockEmails, {
        title: 'Custom Title',
        fields: ['subject', 'category'],
        pageSize: 'A4'
      })
      
      expect(pdfBuffer).toBeInstanceOf(ArrayBuffer)
      expect(pdfBuffer.byteLength).toBeGreaterThan(0)
    })

    it('should handle empty email list', () => {
      const pdfBuffer = exportToPDF([])
      expect(pdfBuffer).toBeInstanceOf(ArrayBuffer)
    })
  })

  describe('exportToExcel', () => {
    it('should export emails as Excel', () => {
      const excelBuffer = exportToExcel(mockEmails)
      
      expect(excelBuffer).toBeInstanceOf(ArrayBuffer)
      expect(excelBuffer.byteLength).toBeGreaterThan(0)
    })

    it('should export with custom options', () => {
      const excelBuffer = exportToExcel(mockEmails, {
        sheetName: 'Custom Sheet',
        fields: ['subject', 'category']
      })
      
      expect(excelBuffer).toBeInstanceOf(ArrayBuffer)
      expect(excelBuffer.byteLength).toBeGreaterThan(0)
    })

    it('should handle empty email list', () => {
      const excelBuffer = exportToExcel([])
      expect(excelBuffer).toBeInstanceOf(ArrayBuffer)
    })
  })

  describe('getExportStats', () => {
    it('should return correct statistics', () => {
      const stats = getExportStats(mockEmails)
      
      expect(stats.totalEmails).toBe(3)
      expect(stats.categories).toBe(3)
      expect(stats.categoryList).toEqual(['Other', 'Promotions', 'Academic'])
      expect(stats.dateRange).toBeDefined()
      expect(stats.dateRange.earliest).toBeInstanceOf(Date)
      expect(stats.dateRange.latest).toBeInstanceOf(Date)
    })

    it('should handle empty email list', () => {
      const stats = getExportStats([])
      
      expect(stats.totalEmails).toBe(0)
      expect(stats.categories).toBe(0)
      expect(stats.categoryList).toEqual([])
      expect(stats.dateRange).toBeNull()
    })

    it('should handle emails with duplicate categories', () => {
      const emailsWithDuplicates = [
        { ...mockEmails[0], category: 'Other' },
        { ...mockEmails[1], category: 'Other' },
        { ...mockEmails[2], category: 'Promotions' }
      ]
      
      const stats = getExportStats(emailsWithDuplicates)
      
      expect(stats.totalEmails).toBe(3)
      expect(stats.categories).toBe(2)
      expect(stats.categoryList).toEqual(['Other', 'Promotions'])
    })

    it('should handle emails with null categories', () => {
      const emailsWithNulls = [
        { ...mockEmails[0], category: 'Other' },
        { ...mockEmails[1], category: null },
        { ...mockEmails[2], category: undefined }
      ]
      
      const stats = getExportStats(emailsWithNulls)
      
      expect(stats.totalEmails).toBe(3)
      expect(stats.categories).toBe(1)
      expect(stats.categoryList).toEqual(['Other'])
    })
  })
})
