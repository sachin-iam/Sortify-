import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import Dashboard from '../pages/Dashboard'
import { vi } from 'vitest'

// Mock the API
const mockApi = {
  get: vi.fn(),
  post: vi.fn()
}

vi.mock('../services/api', () => ({
  api: mockApi
}))

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => 'test-token'),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
})

// Mock EventSource
const mockEventSource = {
  close: vi.fn(),
  onmessage: null,
  onerror: null
}

global.EventSource = vi.fn(() => mockEventSource)

// Mock toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn()
  }
}))

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('Gmail Sync Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful API responses
    mockApi.get.mockImplementation((url) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          data: {
            success: true,
            user: { 
              gmailConnected: true,
              gmailEmail: 'test@gmail.com'
            }
          }
        })
      }
      if (url === '/api/analytics/stats') {
        return Promise.resolve({
          data: {
            success: true,
            stats: { 
              totalEmails: 5000,
              academicEmails: 1000,
              promotionEmails: 1500,
              placementEmails: 800,
              spamEmails: 200,
              otherEmails: 1500
            }
          }
        })
      }
      if (url.startsWith('/api/emails')) {
        const params = new URLSearchParams(url.split('?')[1])
        const page = parseInt(params.get('page')) || 1
        const limit = parseInt(params.get('limit')) || 50
        const category = params.get('category')
        const q = params.get('q')
        
        // Generate mock emails
        const emails = []
        const startIdx = (page - 1) * limit
        const endIdx = startIdx + limit
        
        for (let i = startIdx; i < endIdx && i < 5000; i++) {
          const categories = ['Academic', 'Promotions', 'Placement', 'Spam', 'Other']
          const categoryIndex = i % categories.length
          const emailCategory = categories[categoryIndex]
          
          // Apply filters
          if (category && category !== 'All' && emailCategory !== category) continue
          if (q && !`Test Email ${i}`.toLowerCase().includes(q.toLowerCase())) continue
          
          emails.push({
            _id: `email_${i}`,
            subject: `Test Email ${i}`,
            from: `sender${i}@example.com`,
            to: 'test@gmail.com',
            snippet: `This is email snippet ${i}`,
            date: new Date(Date.now() - i * 60000).toISOString(),
            category: emailCategory,
            classification: {
              label: emailCategory,
              confidence: 0.7 + (Math.random() * 0.3)
            }
          })
        }
        
        return Promise.resolve({
          data: {
            success: true,
            items: emails,
            total: 5000,
            page,
            limit
          }
        })
      }
      return Promise.resolve({ data: { success: true } })
    })
    
    mockApi.post.mockImplementation((url) => {
      if (url === '/api/emails/gmail/sync-all') {
        return Promise.resolve({
          data: {
            success: true,
            synced: 5000,
            classified: 5000,
            skipped: 0,
            total: 5000
          }
        })
      }
      if (url === '/api/bootstrap/gmail') {
        return Promise.resolve({
          data: { success: true, started: true, existing: 0 }
        })
      }
      return Promise.resolve({ data: { success: true } })
    })
  })

  it('renders dashboard with Gmail connection status', async () => {
    renderWithProviders(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Gmail Connected')).toBeInTheDocument()
    })
  })

  it('displays email statistics correctly', async () => {
    renderWithProviders(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('5,000')).toBeInTheDocument() // Total emails
      expect(screen.getByText('1,000')).toBeInTheDocument() // Academic emails
    })
  })

  it('loads and displays email list with pagination', async () => {
    renderWithProviders(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Test Email 0')).toBeInTheDocument()
      expect(screen.getByText('Test Email 49')).toBeInTheDocument()
    })
  })

  it('filters emails by category', async () => {
    renderWithProviders(<Dashboard />)
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test Email 0')).toBeInTheDocument()
    })
    
    // Click on Academic category
    const academicTab = screen.getByText('Academic')
    fireEvent.click(academicTab)
    
    await waitFor(() => {
      // Should show Academic emails
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/emails?category=Academic')
      )
    })
  })

  it('searches emails correctly', async () => {
    renderWithProviders(<Dashboard />)
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test Email 0')).toBeInTheDocument()
    })
    
    // Type in search box
    const searchInput = screen.getByPlaceholderText('Search emails...')
    fireEvent.change(searchInput, { target: { value: 'Test Email 1' } })
    
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/emails?q=Test Email 1')
      )
    })
  })

  it('handles Gmail sync button click', async () => {
    renderWithProviders(<Dashboard />)
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Gmail Connected')).toBeInTheDocument()
    })
    
    // Find and click sync button
    const syncButton = screen.getByText('Sync Now')
    fireEvent.click(syncButton)
    
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/emails/gmail/sync-all')
    })
  })

  it('handles sync error gracefully', async () => {
    // Mock sync error
    mockApi.post.mockImplementation((url) => {
      if (url === '/api/emails/gmail/sync-all') {
        return Promise.reject({
          response: {
            data: { message: 'Gmail not connected' }
          }
        })
      }
      return Promise.resolve({ data: { success: true } })
    })
    
    renderWithProviders(<Dashboard />)
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Gmail Connected')).toBeInTheDocument()
    })
    
    // Click sync button
    const syncButton = screen.getByText('Sync Now')
    fireEvent.click(syncButton)
    
    // Should handle error gracefully
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/emails/gmail/sync-all')
    })
  })

  it('displays email details when email is selected', async () => {
    renderWithProviders(<Dashboard />)
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test Email 0')).toBeInTheDocument()
    })
    
    // Click on first email
    const firstEmail = screen.getByText('Test Email 0')
    fireEvent.click(firstEmail)
    
    // Should fetch email details
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/emails/email_0')
      )
    })
  })

  it('handles large email lists efficiently', async () => {
    renderWithProviders(<Dashboard />)
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test Email 0')).toBeInTheDocument()
    })
    
    // Should only load first page (50 emails)
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/emails?page=1&limit=50')
    )
  })
})
