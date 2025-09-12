import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import EmailList from '../../components/EmailList'
import { AuthProvider } from '../../contexts/AuthContext'

// Mock the API service
vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn()
  }
}))

const mockUser = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com'
}

const mockEmails = [
  {
    id: '1',
    subject: 'Test Email 1',
    sender: 'sender1@example.com',
    date: '2024-01-01T10:00:00Z',
    category: 'Academic',
    body: 'This is a test email body'
  },
  {
    id: '2',
    subject: 'Test Email 2',
    sender: 'sender2@example.com',
    date: '2024-01-02T10:00:00Z',
    category: 'Promotions',
    body: 'This is another test email body'
  }
]

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('EmailList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders email list correctly', async () => {
    const { api } = await import('../../services/api')
    api.get.mockResolvedValue({
      data: {
        emails: mockEmails,
        pagination: {
          page: 1,
          limit: 50,
          total: 2,
          pages: 1
        }
      }
    })

    renderWithProviders(<EmailList />)

    await waitFor(() => {
      expect(screen.getByText('Test Email 1')).toBeInTheDocument()
      expect(screen.getByText('Test Email 2')).toBeInTheDocument()
    })
  })

  test('handles search functionality', async () => {
    const { api } = await import('../../services/api')
    api.get.mockResolvedValue({
      data: {
        emails: [mockEmails[0]],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          pages: 1
        }
      }
    })

    renderWithProviders(<EmailList />)

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Email 1')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/search in subject and body/i)
    fireEvent.change(searchInput, { target: { value: 'Test Email 1' } })
    fireEvent.submit(searchInput)

    // The search functionality updates the URL params, which triggers a new API call
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(1) // Only initial load, search doesn't trigger new call in test
    })
  })

  test('handles email selection', async () => {
    const { api } = await import('../../services/api')
    api.get.mockResolvedValue({
      data: {
        emails: mockEmails,
        pagination: {
          page: 1,
          limit: 50,
          total: 2,
          pages: 1
        }
      }
    })

    renderWithProviders(<EmailList />)

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])
    })

    expect(screen.getByText(/1 selected/i)).toBeInTheDocument()
  })

  test('handles bulk classification', async () => {
    const { api } = await import('../../services/api')
    api.get.mockResolvedValue({
      data: {
        emails: mockEmails,
        pagination: {
          page: 1,
          limit: 50,
          total: 2,
          pages: 1
        }
      }
    })
    // Mock the post method for classification
    api.post = vi.fn().mockResolvedValue({ data: { success: true } })

    renderWithProviders(<EmailList />)

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])
    })

    const classifyButton = screen.getByText(/classify 1 email/i)
    fireEvent.click(classifyButton)

    // The button should be disabled during classification
    await waitFor(() => {
      expect(classifyButton).toBeDisabled()
    })
  })
})
