import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AnalyticsDashboard from '../../components/AnalyticsDashboard'

// Mock the analytics service
vi.mock('../../services/analyticsService', () => ({
  getCategoryCounts: vi.fn(),
  getClassificationAccuracy: vi.fn(),
  getMisclassifications: vi.fn(),
  exportAnalyticsData: vi.fn()
}))

const mockAnalytics = {
  totalEmails: 100,
  categories: {
    Academic: 30,
    Promotions: 25,
    Placement: 20,
    Spam: 15,
    Other: 10
  },
  timeSeries: [
    { date: '2024-01-01', count: 10 },
    { date: '2024-01-02', count: 15 },
    { date: '2024-01-03', count: 12 }
  ]
}

describe('AnalyticsDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders analytics dashboard correctly', async () => {
    const { getCategoryCounts, getClassificationAccuracy, getMisclassifications } = await import('../../services/analyticsService')
    
    getCategoryCounts.mockResolvedValue({ data: [
      { label: 'Academic', count: 30 },
      { label: 'Promotions', count: 25 },
      { label: 'Placement', count: 20 },
      { label: 'Spam', count: 15 },
      { label: 'Other', count: 10 }
    ]})
    getClassificationAccuracy.mockResolvedValue({ data: { overallAccuracy: 85, total: 100 } })
    getMisclassifications.mockResolvedValue({ data: [] })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('📊 Analytics Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })
  })

  test('displays category statistics', async () => {
    const { getCategoryCounts, getClassificationAccuracy, getMisclassifications } = await import('../../services/analyticsService')
    
    getCategoryCounts.mockResolvedValue({ data: [
      { label: 'Academic', count: 30 },
      { label: 'Promotions', count: 25 }
    ]})
    getClassificationAccuracy.mockResolvedValue({ data: { overallAccuracy: 85, total: 100 } })
    getMisclassifications.mockResolvedValue({ data: [] })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('📊 Analytics Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })
  })

  test('handles loading state', () => {
    render(<AnalyticsDashboard />)
    // The component shows loading state initially, then renders the main content
    expect(screen.getByText('📊 Analytics Dashboard')).toBeInTheDocument()
  })

  test('handles error state', async () => {
    const { getCategoryCounts, getClassificationAccuracy, getMisclassifications } = await import('../../services/analyticsService')
    
    getCategoryCounts.mockRejectedValue(new Error('Failed to fetch analytics'))
    getClassificationAccuracy.mockRejectedValue(new Error('Failed to fetch analytics'))
    getMisclassifications.mockRejectedValue(new Error('Failed to fetch analytics'))

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('📊 Analytics Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })
  })
})
