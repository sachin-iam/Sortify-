import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from '../pages/Dashboard'
import { AuthProvider } from '../contexts/AuthContext'
import emailService from '../services/emailService'

// Mock the email service
jest.mock('../services/emailService', () => ({
  list: jest.fn(),
  detail: jest.fn(),
  archive: jest.fn(),
  remove: jest.fn(),
  downloadAttachment: jest.fn(),
  startRealtime: jest.fn()
}))

const mockUser = {
  _id: 'user123',
  name: 'Test User',
  email: 'test@example.com',
  gmailConnected: true
}

const mockEmailsByCategory = {
  All: [
    { _id: 'email1', subject: 'Academic Email', category: 'Academic' },
    { _id: 'email2', subject: 'Promotion Email', category: 'Promotions' },
    { _id: 'email3', subject: 'Placement Email', category: 'Placement' }
  ],
  Academic: [
    { _id: 'email1', subject: 'Academic Email', category: 'Academic' }
  ],
  Promotions: [
    { _id: 'email2', subject: 'Promotion Email', category: 'Promotions' }
  ],
  Placement: [
    { _id: 'email3', subject: 'Placement Email', category: 'Placement' }
  ],
  Spam: [],
  Other: []
}

const renderDashboard = (user = mockUser) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('Inbox Category Filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock API responses for different categories
    emailService.list.mockImplementation(({ category }) => {
      const items = mockEmailsByCategory[category] || []
      return Promise.resolve({
        success: true,
        items,
        total: items.length,
        page: 1,
        limit: 25
      })
    })
  })

  test('renders all category tabs', () => {
    renderDashboard()

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Academic')).toBeInTheDocument()
    expect(screen.getByText('Promotions')).toBeInTheDocument()
    expect(screen.getByText('Placement')).toBeInTheDocument()
    expect(screen.getByText('Spam')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  test('shows all emails by default', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Academic Email')).toBeInTheDocument()
      expect(screen.getByText('Promotion Email')).toBeInTheDocument()
      expect(screen.getByText('Placement Email')).toBeInTheDocument()
    })

    expect(emailService.list).toHaveBeenCalledWith({
      page: 1,
      category: 'All',
      provider: 'gmail',
      q: ''
    })
  })

  test('filters emails by Academic category', async () => {
    renderDashboard()

    // Click Academic tab
    fireEvent.click(screen.getByText('Academic'))

    await waitFor(() => {
      expect(screen.getByText('Academic Email')).toBeInTheDocument()
      expect(screen.queryByText('Promotion Email')).not.toBeInTheDocument()
      expect(screen.queryByText('Placement Email')).not.toBeInTheDocument()
    })

    expect(emailService.list).toHaveBeenCalledWith({
      page: 1,
      category: 'Academic',
      provider: 'gmail',
      q: ''
    })
  })

  test('filters emails by Promotions category', async () => {
    renderDashboard()

    // Click Promotions tab
    fireEvent.click(screen.getByText('Promotions'))

    await waitFor(() => {
      expect(screen.getByText('Promotion Email')).toBeInTheDocument()
      expect(screen.queryByText('Academic Email')).not.toBeInTheDocument()
      expect(screen.queryByText('Placement Email')).not.toBeInTheDocument()
    })

    expect(emailService.list).toHaveBeenCalledWith({
      page: 1,
      category: 'Promotions',
      provider: 'gmail',
      q: ''
    })
  })

  test('filters emails by Placement category', async () => {
    renderDashboard()

    // Click Placement tab
    fireEvent.click(screen.getByText('Placement'))

    await waitFor(() => {
      expect(screen.getByText('Placement Email')).toBeInTheDocument()
      expect(screen.queryByText('Academic Email')).not.toBeInTheDocument()
      expect(screen.queryByText('Promotion Email')).not.toBeInTheDocument()
    })

    expect(emailService.list).toHaveBeenCalledWith({
      page: 1,
      category: 'Placement',
      provider: 'gmail',
      q: ''
    })
  })

  test('shows empty state for Spam category', async () => {
    renderDashboard()

    // Click Spam tab
    fireEvent.click(screen.getByText('Spam'))

    await waitFor(() => {
      expect(screen.getByText('No emails found')).toBeInTheDocument()
    })

    expect(emailService.list).toHaveBeenCalledWith({
      page: 1,
      category: 'Spam',
      provider: 'gmail',
      q: ''
    })
  })

  test('shows empty state for Other category', async () => {
    renderDashboard()

    // Click Other tab
    fireEvent.click(screen.getByText('Other'))

    await waitFor(() => {
      expect(screen.getByText('No emails found')).toBeInTheDocument()
    })

    expect(emailService.list).toHaveBeenCalledWith({
      page: 1,
      category: 'Other',
      provider: 'gmail',
      q: ''
    })
  })

  test('resets to page 1 when changing categories', async () => {
    renderDashboard()

    // Click Academic tab
    fireEvent.click(screen.getByText('Academic'))

    await waitFor(() => {
      expect(emailService.list).toHaveBeenCalledWith({
        page: 1,
        category: 'Academic',
        provider: 'gmail',
        q: ''
      })
    })

    // Click Promotions tab
    fireEvent.click(screen.getByText('Promotions'))

    await waitFor(() => {
      expect(emailService.list).toHaveBeenCalledWith({
        page: 1,
        category: 'Promotions',
        provider: 'gmail',
        q: ''
      })
    })
  })

  test('highlights active category tab', async () => {
    renderDashboard()

    // All tab should be active by default
    const allTab = screen.getByText('All')
    expect(allTab).toHaveClass('bg-white/60')

    // Click Academic tab
    fireEvent.click(screen.getByText('Academic'))

    await waitFor(() => {
      const academicTab = screen.getByText('Academic')
      expect(academicTab).toHaveClass('bg-white/60')
      expect(allTab).not.toHaveClass('bg-white/60')
    })
  })

  test('handles category filtering errors gracefully', async () => {
    emailService.list.mockRejectedValue(new Error('API Error'))

    renderDashboard()

    // Click Academic tab
    fireEvent.click(screen.getByText('Academic'))

    await waitFor(() => {
      expect(screen.getByText('No emails found')).toBeInTheDocument()
    })
  })
})
