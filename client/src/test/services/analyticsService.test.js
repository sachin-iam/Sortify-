import { analyticsService } from '../../services/analyticsService'
import { api } from '../../services/api'

// Mock the api module
jest.mock('../../services/api', () => ({
  api: {
    get: jest.fn()
  }
}))

// Mock window.URL and document methods
global.URL = {
  createObjectURL: jest.fn(() => 'mock-url'),
  revokeObjectURL: jest.fn()
}

global.Blob = jest.fn(() => ({}))
global.document = {
  createElement: jest.fn(() => ({
    href: '',
    setAttribute: jest.fn(),
    click: jest.fn(),
    remove: jest.fn()
  })),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
}

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getCategoryCounts', () => {
    it('should fetch category counts successfully', async () => {
      const mockData = {
        success: true,
        data: [
          { label: 'inbox', count: 10 },
          { label: 'promotions', count: 5 }
        ]
      }

      api.get.mockResolvedValueOnce({ data: mockData })

      const result = await analyticsService.getCategoryCounts()

      expect(api.get).toHaveBeenCalledWith('/api/analytics/categories')
      expect(result).toEqual(mockData)
    })

    it('should handle errors', async () => {
      const error = new Error('Network error')
      api.get.mockRejectedValueOnce(error)

      await expect(analyticsService.getCategoryCounts()).rejects.toThrow('Network error')
    })
  })

  describe('getClassificationAccuracy', () => {
    it('should fetch accuracy data successfully', async () => {
      const mockData = {
        success: true,
        data: {
          overallAccuracy: 95.5,
          correct: 95,
          total: 100,
          accuracyBreakdown: []
        }
      }

      api.get.mockResolvedValueOnce({ data: mockData })

      const result = await analyticsService.getClassificationAccuracy()

      expect(api.get).toHaveBeenCalledWith('/api/analytics/accuracy')
      expect(result).toEqual(mockData)
    })
  })

  describe('getMisclassifications', () => {
    it('should fetch misclassifications with default limit', async () => {
      const mockData = {
        success: true,
        data: [
          { subject: 'Test Email', category: 'inbox' }
        ]
      }

      api.get.mockResolvedValueOnce({ data: mockData })

      const result = await analyticsService.getMisclassifications()

      expect(api.get).toHaveBeenCalledWith('/api/analytics/misclassifications?limit=50')
      expect(result).toEqual(mockData)
    })

    it('should fetch misclassifications with custom limit', async () => {
      const mockData = { success: true, data: [] }
      api.get.mockResolvedValueOnce({ data: mockData })

      await analyticsService.getMisclassifications(25)

      expect(api.get).toHaveBeenCalledWith('/api/analytics/misclassifications?limit=25')
    })
  })


  describe('getEmailStats', () => {
    it('should fetch email stats successfully', async () => {
      const mockData = {
        success: true,
        stats: {
          totalEmails: 100,
          categories: 5,
          processedToday: 10,
          unreadCount: 15
        }
      }

      api.get.mockResolvedValueOnce({ data: mockData })

      const result = await analyticsService.getEmailStats()

      expect(api.get).toHaveBeenCalledWith('/api/analytics/stats')
      expect(result).toEqual(mockData)
    })
  })

  describe('getPerformanceMetrics', () => {
    it('should fetch performance metrics successfully', async () => {
      const mockData = {
        success: true,
        data: [
          { date: '2024-01-01', count: 10 },
          { date: '2024-01-02', count: 15 }
        ]
      }

      api.get.mockResolvedValueOnce({ data: mockData })

      const result = await analyticsService.getPerformanceMetrics()

      expect(api.get).toHaveBeenCalledWith('/api/analytics/performance')
      expect(result).toEqual(mockData)
    })
  })
})
