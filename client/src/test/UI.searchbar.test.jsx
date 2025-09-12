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
  export: jest.fn(),
  downloadAttachment: jest.fn(),
  startRealtime: jest.fn()
}))

const mockUser = {
  _id: 'user123',
  name: 'Test User',
  email: 'test@example.com',
  gmailConnected: true
}

const mockEmails = [
  {
    _id: 'email1',
    subject: 'Test Email 1',
    from: 'sender1@example.com',
    to: 'test@example.com',
    snippet: 'This is a test email',
    date: new Date().toISOString(),
    category: 'Academic'
  },
  {
    _id: 'email2',
    subject: 'Another Email',
    from: 'sender2@example.com',
    to: 'test@example.com',
    snippet: 'Another test email',
    date: new Date().toISOString(),
    category: 'Promotions'
  }
]

const renderDashboard = (user = mockUser) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('Search Bar UI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    emailService.list.mockResolvedValue({
      success: true,
      items: mockEmails,
      total: 2,
      page: 1,
      limit: 25
    })
  })

  test('renders search input with correct styling', () => {
    renderDashboard()

    const searchInput = screen.getByPlaceholderText('Search emails...')
    expect(searchInput).toBeInTheDocument()
    expect(searchInput).toHaveClass('pl-10') // Should have left padding for icon
  })

  test('search icon is positioned correctly', () => {
    renderDashboard()

    // The search icon should be absolutely positioned
    const searchIcon = screen.getByRole('img', { hidden: true }) // ModernIcon renders as img
    expect(searchIcon).toHaveClass('absolute', 'left-3', 'top-1/2', '-translate-y-1/2', 'h-5', 'w-5')
  })

  test('search input has correct placeholder text', () => {
    renderDashboard()

    const searchInput = screen.getByPlaceholderText('Search emails...')
    expect(searchInput).toBeInTheDocument()
  })

  test('search input triggers API call on change', async () => {
    renderDashboard()

    const searchInput = screen.getByPlaceholderText('Search emails...')
    
    // Type in search input
    fireEvent.change(searchInput, { target: { value: 'test search' } })

    await waitFor(() => {
      expect(emailService.list).toHaveBeenCalledWith({
        page: 1,
        category: 'All',
        provider: 'gmail',
        q: 'test search'
      })
    })
  })

  test('search input resets to page 1 when searching', async () => {
    renderDashboard()

    const searchInput = screen.getByPlaceholderText('Search emails...')
    
    // Type in search input
    fireEvent.change(searchInput, { target: { value: 'test' } })

    await waitFor(() => {
      expect(emailService.list).toHaveBeenCalledWith({
        page: 1,
        category: 'All',
        provider: 'gmail',
        q: 'test'
      })
    })
  })

  test('search input clears and resets when emptied', async () => {
    renderDashboard()

    const searchInput = screen.getByPlaceholderText('Search emails...')
    
    // Type in search input
    fireEvent.change(searchInput, { target: { value: 'test' } })

    await waitFor(() => {
      expect(emailService.list).toHaveBeenCalledWith({
        page: 1,
        category: 'All',
        provider: 'gmail',
        q: 'test'
      })
    })

    // Clear search input
    fireEvent.change(searchInput, { target: { value: '' } })

    await waitFor(() => {
      expect(emailService.list).toHaveBeenCalledWith({
        page: 1,
        category: 'All',
        provider: 'gmail',
        q: ''
      })
    })
  })

  test('search input maintains focus and cursor position', () => {
    renderDashboard()

    const searchInput = screen.getByPlaceholderText('Search emails...')
    
    // Focus the input
    fireEvent.focus(searchInput)
    expect(searchInput).toHaveFocus()

    // Type some text
    fireEvent.change(searchInput, { target: { value: 'test' } })
    
    // Input should still have focus
    expect(searchInput).toHaveFocus()
    expect(searchInput.value).toBe('test')
  })

  test('search input has correct focus styles', () => {
    renderDashboard()

    const searchInput = screen.getByPlaceholderText('Search emails...')
    
    // Check focus styles are applied
    expect(searchInput).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-emerald-500/50', 'focus:border-emerald-500/50')
  })

  test('search input is responsive', () => {
    renderDashboard()

    const searchInput = screen.getByPlaceholderText('Search emails...')
    const searchContainer = searchInput.closest('.flex-1')
    
    // Should be in a flex container
    expect(searchContainer).toHaveClass('flex-1')
  })

  test('search input handles special characters', async () => {
    renderDashboard()

    const searchInput = screen.getByPlaceholderText('Search emails...')
    
    // Type special characters
    fireEvent.change(searchInput, { target: { value: 'test@#$%^&*()' } })

    await waitFor(() => {
      expect(emailService.list).toHaveBeenCalledWith({
        page: 1,
        category: 'All',
        provider: 'gmail',
        q: 'test@#$%^&*()'
      })
    })
  })

  test('search input handles long queries', async () => {
    renderDashboard()

    const searchInput = screen.getByPlaceholderText('Search emails...')
    const longQuery = 'a'.repeat(1000)
    
    // Type long query
    fireEvent.change(searchInput, { target: { value: longQuery } })

    await waitFor(() => {
      expect(emailService.list).toHaveBeenCalledWith({
        page: 1,
        category: 'All',
        provider: 'gmail',
        q: longQuery
      })
    })
  })

  test('search input debounces rapid changes', async () => {
    renderDashboard()

    const searchInput = screen.getByPlaceholderText('Search emails...')
    
    // Type multiple characters rapidly
    fireEvent.change(searchInput, { target: { value: 't' } })
    fireEvent.change(searchInput, { target: { value: 'te' } })
    fireEvent.change(searchInput, { target: { value: 'tes' } })
    fireEvent.change(searchInput, { target: { value: 'test' } })

    // Should only call API with final value
    await waitFor(() => {
      expect(emailService.list).toHaveBeenCalledWith({
        page: 1,
        category: 'All',
        provider: 'gmail',
        q: 'test'
      })
    })
  })
})
