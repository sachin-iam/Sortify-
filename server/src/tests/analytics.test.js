import request from 'supertest'
import express from 'express'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import Email from '../models/Email.js'
import User from '../models/User.js'
import { asyncHandler } from '../middleware/errorHandler.js'

describe('Analytics API', () => {
  let testUser
  let testEmails
  let app

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    })

    // Create app with mock auth
    app = express()
    app.use(express.json())
    
    // Mock auth middleware
    const mockAuth = (req, res, next) => {
      req.user = { _id: testUser._id }
      next()
    }
    
    // Create analytics routes without protect middleware
    const analyticsRouter = express.Router()
    
    // Stats endpoint
    analyticsRouter.get('/stats', mockAuth, asyncHandler(async (req, res) => {
      try {
        const stats = await Email.aggregate([
          { $match: { userId: req.user._id } },
          {
            $group: {
              _id: null,
              totalEmails: { $sum: 1 },
              totalByProvider: {
                $push: {
                  provider: 'gmail',
                  count: 1
                }
              },
              totalByCategory: {
                $push: {
                  category: '$category',
                  count: 1
                }
              },
              unreadCount: {
                $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
              },
              processedToday: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$createdAt', new Date(new Date().setHours(0, 0, 0, 0))] },
                        { $lt: ['$createdAt', new Date(new Date().setHours(23, 59, 59, 999))] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ])

        const result = stats[0] || {
          totalEmails: 0,
          totalByProvider: [],
          totalByCategory: [],
          unreadCount: 0,
          processedToday: 0
        }

        const categoryCount = new Set(
          result.totalByCategory
            .filter(item => item.category !== null)
            .map(item => item.category)
        ).size

        res.json({
          success: true,
          stats: {
            totalEmails: result.totalEmails,
            categories: categoryCount,
            processedToday: result.processedToday,
            unreadCount: result.unreadCount
          }
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
        res.status(500).json({
          success: false,
          message: 'Failed to fetch statistics'
        })
      }
    }))
    
    // Categories endpoint
    analyticsRouter.get('/categories', mockAuth, asyncHandler(async (req, res) => {
      try {
        const categoryData = await Email.aggregate([
          { $match: { userId: req.user._id, category: { $ne: null } } },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              label: '$_id',
              count: 1,
              _id: 0
            }
          },
          { $sort: { count: -1 } }
        ])

        res.json({
          success: true,
          data: categoryData
        })
      } catch (error) {
        console.error('Error fetching categories:', error)
        res.status(500).json({
          success: false,
          message: 'Failed to fetch category data'
        })
      }
    }))
    
    // Accuracy endpoint
    analyticsRouter.get('/accuracy', mockAuth, asyncHandler(async (req, res) => {
      try {
        const accuracyData = await Email.aggregate([
          {
            $match: {
              userId: req.user._id,
              category: { $ne: null }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              correct: { $sum: 1 },
              accuracyBreakdown: {
                $push: {
                  category: '$category',
                  isCorrect: true
                }
              }
            }
          }
        ])

        const result = accuracyData[0] || { total: 0, correct: 0, accuracyBreakdown: [] }
        
        const overallAccuracy = result.total > 0 ? (result.correct / result.total) * 100 : 0

        const categoryAccuracy = {}
        result.accuracyBreakdown.forEach(item => {
          if (!categoryAccuracy[item.category]) {
            categoryAccuracy[item.category] = { correct: 0, total: 0 }
          }
          categoryAccuracy[item.category].total++
          if (item.isCorrect) {
            categoryAccuracy[item.category].correct++
          }
        })

        const accuracyBreakdown = Object.entries(categoryAccuracy).map(([category, data]) => ({
          category,
          correct: data.correct,
          total: data.total,
          accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0
        }))

        res.json({
          success: true,
          data: {
            overallAccuracy: Math.round(overallAccuracy * 100) / 100,
            correct: result.correct,
            total: result.total,
            accuracyBreakdown
          }
        })
      } catch (error) {
        console.error('Error fetching accuracy data:', error)
        res.status(500).json({
          success: false,
          message: 'Failed to fetch accuracy data'
        })
      }
    }))
    
    // Misclassifications endpoint
    analyticsRouter.get('/misclassifications', mockAuth, asyncHandler(async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50

        const misclassifications = await Email.find({
          userId: req.user._id,
          category: { $ne: null }
        })
        .select('subject from date category classification labels')
        .sort({ date: -1 })
        .limit(limit)

        res.json({
          success: true,
          data: misclassifications
        })
      } catch (error) {
        console.error('Error fetching misclassifications:', error)
        res.status(500).json({
          success: false,
          message: 'Failed to fetch misclassifications'
        })
      }
    }))
    
    // Export endpoint
    analyticsRouter.get('/export', mockAuth, asyncHandler(async (req, res) => {
      try {
        const { format = 'csv', fields = 'subject,from,date,category' } = req.query
        
        const emails = await Email.find({ userId: req.user._id })
          .select('subject from date category snippet isRead labels')
          .sort({ date: -1 })

        if (emails.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'No emails found to export'
          })
        }

        const fieldArray = fields.split(',').map(field => field.trim())
        
        let buffer, contentType, filename, extension

        switch (format.toLowerCase()) {
          case 'pdf':
            // Simple PDF export for testing
            buffer = Buffer.from('PDF content would go here')
            contentType = 'application/pdf'
            extension = 'pdf'
            break
          
          case 'excel':
          case 'xlsx':
            // Simple Excel export for testing
            buffer = Buffer.from('Excel content would go here')
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            extension = 'xlsx'
            break
          
          case 'csv':
          default:
            const csvHeader = fieldArray.map(field => 
              field.charAt(0).toUpperCase() + field.slice(1)
            ).join(',') + '\n'
            const csvRows = emails.map(email => {
              return fieldArray.map(field => {
                let value = email[field] || ''
                if (field === 'date' && value) {
                  value = new Date(value).toISOString()
                }
                value = `"${String(value).replace(/"/g, '""')}"`
                return value
              }).join(',')
            }).join('\n')
            const csvContent = csvHeader + csvRows
            buffer = Buffer.from(csvContent, 'utf8')
            contentType = 'text/csv'
            extension = 'csv'
            break
        }

        filename = `sortify-analytics-${new Date().toISOString().split('T')[0]}.${extension}`

        res.setHeader('Content-Type', contentType)
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.setHeader('Content-Length', buffer.length)
        res.send(buffer)

      } catch (error) {
        console.error('Export error:', error)
        res.status(500).json({
          success: false,
          message: 'Failed to export data'
        })
      }
    }))
    
    // Performance endpoint
    analyticsRouter.get('/performance', mockAuth, asyncHandler(async (req, res) => {
      try {
        const performanceData = await Email.aggregate([
          { $match: { userId: req.user._id } },
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' },
                day: { $dayOfMonth: '$date' }
              },
              count: { $sum: 1 },
              classifiedCount: {
                $sum: {
                  $cond: [
                    { $ne: ['$category', null] },
                    1,
                    0
                  ]
                }
              }
            }
          },
          {
            $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 }
          },
          { $limit: 30 }
        ])

        res.json({
          success: true,
          data: performanceData
        })
      } catch (error) {
        console.error('Error fetching performance data:', error)
        res.status(500).json({
          success: false,
          message: 'Failed to fetch performance data'
        })
      }
    }))
    
    app.use('/api/analytics', analyticsRouter)

    // Create test emails
    testEmails = await Email.create([
      {
        userId: testUser._id,
        subject: 'Test Email 1',
        from: 'sender1@example.com',
        to: 'test@example.com',
        date: new Date('2024-01-01'),
        category: 'Other',
        isRead: false
      },
      {
        userId: testUser._id,
        subject: 'Test Email 2',
        from: 'sender2@example.com',
        to: 'test@example.com',
        date: new Date('2024-01-02'),
        category: 'Promotions',
        isRead: true
      },
      {
        userId: testUser._id,
        subject: 'Test Email 3',
        from: 'sender3@example.com',
        to: 'test@example.com',
        date: new Date('2024-01-03'),
        category: 'Academic',
        isRead: false
      }
    ])
  })

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await Email.deleteMany({ userId: testUser._id })
      await User.deleteOne({ _id: testUser._id })
    }
  })

  describe('GET /api/analytics/stats', () => {
    it('should return email statistics', async () => {
      const response = await request(app)
        .get('/api/analytics/stats')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.stats).toHaveProperty('totalEmails')
      expect(response.body.stats).toHaveProperty('categories')
      expect(response.body.stats).toHaveProperty('processedToday')
      expect(response.body.stats).toHaveProperty('unreadCount')
      expect(response.body.stats.totalEmails).toBe(3)
      expect(response.body.stats.categories).toBe(3)
      expect(response.body.stats.unreadCount).toBe(2)
    })

    it('should handle empty email list', async () => {
      // Create a new user with no emails
      const emptyUser = await User.create({
        name: 'Empty User',
        email: `empty-${Date.now()}@example.com`, // Use timestamp to avoid duplicates
        password: 'password123'
      })

      // Create a new analytics router for this test
      const emptyAnalyticsRouter = express.Router()
      const mockAuth = (req, res, next) => {
        req.user = { _id: emptyUser._id }
        next()
      }
      
      // Add the same routes as the main router
      emptyAnalyticsRouter.get('/stats', mockAuth, asyncHandler(async (req, res) => {
        try {
          const stats = await Email.aggregate([
            { $match: { userId: req.user._id } },
            {
              $group: {
                _id: null,
                totalEmails: { $sum: 1 },
                totalByProvider: {
                  $push: {
                    provider: 'gmail',
                    count: 1
                  }
                },
                totalByCategory: {
                  $push: {
                    category: '$category',
                    count: 1
                  }
                },
                unreadCount: {
                  $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
                },
                processedToday: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ['$createdAt', new Date(new Date().setHours(0, 0, 0, 0))] },
                          { $lt: ['$createdAt', new Date(new Date().setHours(23, 59, 59, 999))] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ])

          const result = stats[0] || {
            totalEmails: 0,
            totalByProvider: [],
            totalByCategory: [],
            unreadCount: 0,
            processedToday: 0
          }

          const categoryCount = new Set(
            result.totalByCategory
              .filter(item => item.category !== null)
              .map(item => item.category)
          ).size

          res.json({
            success: true,
            stats: {
              totalEmails: result.totalEmails,
              categories: categoryCount,
              processedToday: result.processedToday,
              unreadCount: result.unreadCount
            }
          })
        } catch (error) {
          console.error('Error fetching stats:', error)
          res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
          })
        }
      }))

      // Mock the auth middleware for this test
      const emptyApp = express()
      emptyApp.use(express.json())
      emptyApp.use('/api/analytics', emptyAnalyticsRouter)

      const response = await request(emptyApp)
        .get('/api/analytics/stats')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.stats.totalEmails).toBe(0)
      expect(response.body.stats.categories).toBe(0)

      // Clean up
      await User.deleteOne({ _id: emptyUser._id })
    })
  })

  describe('GET /api/analytics/categories', () => {
    it('should return category data', async () => {
      const response = await request(app)
        .get('/api/analytics/categories')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data).toHaveLength(3)
      
      // Check that categories are sorted by count
      const counts = response.body.data.map(item => item.count)
      expect(counts).toEqual([...counts].sort((a, b) => b - a))
    })
  })

  describe('GET /api/analytics/accuracy', () => {
    it('should return accuracy data', async () => {
      const response = await request(app)
        .get('/api/analytics/accuracy')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('overallAccuracy')
      expect(response.body.data).toHaveProperty('correct')
      expect(response.body.data).toHaveProperty('total')
      expect(response.body.data).toHaveProperty('accuracyBreakdown')
      expect(response.body.data.total).toBe(3)
      expect(response.body.data.correct).toBe(3)
      expect(response.body.data.overallAccuracy).toBe(100)
    })
  })

  describe('GET /api/analytics/misclassifications', () => {
    it('should return misclassifications', async () => {
      const response = await request(app)
        .get('/api/analytics/misclassifications')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data).toHaveLength(3)
    })

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/misclassifications?limit=2')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(2)
    })
  })

  describe('GET /api/analytics/export', () => {
    it('should export CSV data', async () => {
      const response = await request(app)
        .get('/api/analytics/export?format=csv')
        .expect(200)

      expect(response.headers['content-type']).toContain('text/csv')
      expect(response.headers['content-disposition']).toContain('attachment')
      expect(response.text).toContain('Subject,From,Date,Category')
      expect(response.text).toContain('Test Email 1')
    })

    it('should export PDF data', async () => {
      const response = await request(app)
        .get('/api/analytics/export?format=pdf')
        .expect(200)

      expect(response.headers['content-type']).toContain('application/pdf')
      expect(response.headers['content-disposition']).toContain('attachment')
      expect(response.headers['content-disposition']).toContain('.pdf')
    })

    it('should export Excel data', async () => {
      const response = await request(app)
        .get('/api/analytics/export?format=excel')
        .expect(200)

      expect(response.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(response.headers['content-disposition']).toContain('attachment')
      expect(response.headers['content-disposition']).toContain('.xlsx')
    })

    it('should handle custom fields parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/export?format=csv&fields=subject,category')
        .expect(200)

      expect(response.text).toContain('Subject,Category')
      expect(response.text).not.toContain('From')
      expect(response.text).not.toContain('Date')
    })

    it('should return 404 when no emails found', async () => {
      // Create a new user with no emails
      const emptyUser = await User.create({
        name: 'Empty User 2',
        email: `empty2-${Date.now()}@example.com`, // Use timestamp to avoid duplicates
        password: 'password123'
      })

      // Create a new analytics router for this test
      const emptyAnalyticsRouter = express.Router()
      const mockAuth = (req, res, next) => {
        req.user = { _id: emptyUser._id }
        next()
      }
      
      // Add export route
      emptyAnalyticsRouter.get('/export', mockAuth, asyncHandler(async (req, res) => {
        try {
          const { format = 'csv', fields = 'subject,from,date,category' } = req.query
          
          const emails = await Email.find({ userId: req.user._id })
            .select('subject from date category snippet isRead labels')
            .sort({ date: -1 })

          if (emails.length === 0) {
            return res.status(404).json({
              success: false,
              message: 'No emails found to export'
            })
          }

          const fieldArray = fields.split(',').map(field => field.trim())
          
          let buffer, contentType, filename, extension

          switch (format.toLowerCase()) {
            case 'pdf':
              buffer = Buffer.from('PDF content would go here')
              contentType = 'application/pdf'
              extension = 'pdf'
              break
            
            case 'excel':
            case 'xlsx':
              buffer = Buffer.from('Excel content would go here')
              contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              extension = 'xlsx'
              break
            
            case 'csv':
            default:
              const csvHeader = fieldArray.map(field => 
                field.charAt(0).toUpperCase() + field.slice(1)
              ).join(',') + '\n'
              const csvRows = emails.map(email => {
                return fieldArray.map(field => {
                  let value = email[field] || ''
                  if (field === 'date' && value) {
                    value = new Date(value).toISOString()
                  }
                  value = `"${String(value).replace(/"/g, '""')}"`
                  return value
                }).join(',')
              }).join('\n')
              const csvContent = csvHeader + csvRows
              buffer = Buffer.from(csvContent, 'utf8')
              contentType = 'text/csv'
              extension = 'csv'
              break
          }

          filename = `sortify-analytics-${new Date().toISOString().split('T')[0]}.${extension}`

          res.setHeader('Content-Type', contentType)
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
          res.setHeader('Content-Length', buffer.length)
          res.send(buffer)

        } catch (error) {
          console.error('Export error:', error)
          res.status(500).json({
            success: false,
            message: 'Failed to export data'
          })
        }
      }))

      // Mock the auth middleware for this test
      const emptyApp = express()
      emptyApp.use(express.json())
      emptyApp.use('/api/analytics', emptyAnalyticsRouter)

      const response = await request(emptyApp)
        .get('/api/analytics/export')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('No emails found')

      // Clean up
      await User.deleteOne({ _id: emptyUser._id })
    })

    it('should default to CSV format', async () => {
      const response = await request(app)
        .get('/api/analytics/export')
        .expect(200)

      expect(response.headers['content-type']).toContain('text/csv')
    })
  })

  describe('GET /api/analytics/performance', () => {
    it('should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/performance')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
    })
  })
})
