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

// Mock the API
jest.mock('../services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
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
    category: 'Academic',
    classification: { confidence: 0.9 },
    attachments: [
      {
        attachmentId: 'att1',
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        size: 1024
      }
    ]
  },
  {
    _id: 'email2',
    subject: 'Test Email 2',
    from: 'sender2@example.com',
    to: 'test@example.com',
    snippet: 'Another test email',
    date: new Date().toISOString(),
    category: 'Promotions',
    classification: { confidence: 0.8 },
    attachments: []
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

describe('Dashboard Inbox Rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock successful API responses
    emailService.list.mockResolvedValue({
      success: true,
      items: mockEmails,
      total: 2,
      page: 1,
      limit: 25
    })

    emailService.detail.mockResolvedValue({
      success: true,
      email: {
        ...mockEmails[0],
        html: '<p>HTML content</p>',
        text: 'Text content'
      }
    })
  })

  test('renders email list from API', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Test Email 1')).toBeInTheDocument()
      expect(screen.getByText('Test Email 2')).toBeInTheDocument()
    })

    expect(emailService.list).toHaveBeenCalledWith({
      page: 1,
      category: 'All',
      provider: 'gmail',
      q: ''
    })
  })

  test('opens email reader when email is selected', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Test Email 1')).toBeInTheDocument()
    })

    // Click on first email
    fireEvent.click(screen.getByText('Test Email 1'))

    await waitFor(() => {
      expect(emailService.detail).toHaveBeenCalledWith('email1')
    })
  })

  test('triggers attachment download', async () => {
    emailService.downloadAttachment.mockResolvedValue(new Blob(['test content']))
    
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Test Email 1')).toBeInTheDocument()
    })

    // Click on first email to open reader
    fireEvent.click(screen.getByText('Test Email 1'))

    await waitFor(() => {
      expect(screen.getByText('document.pdf')).toBeInTheDocument()
    })

    // Click download button
    const downloadButton = screen.getByText('Download')
    fireEvent.click(downloadButton)

    expect(emailService.downloadAttachment).toHaveBeenCalledWith('email1', 'att1')
  })

  test('handles email actions', async () => {
    emailService.archive.mockResolvedValue({ success: true })
    emailService.remove.mockResolvedValue({ success: true })
    emailService.export.mockResolvedValue({ success: true })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Test Email 1')).toBeInTheDocument()
    })

    // Click on first email to open reader
    fireEvent.click(screen.getByText('Test Email 1'))

    await waitFor(() => {
      expect(screen.getByText('Test Email 1')).toBeInTheDocument()
    })

    // Test archive action
    const archiveButton = screen.getByTitle('Archive')
    fireEvent.click(archiveButton)

    await waitFor(() => {
      expect(emailService.archive).toHaveBeenCalledWith('email1')
    })

    // Test delete action
    const deleteButton = screen.getByTitle('Delete')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(emailService.remove).toHaveBeenCalledWith('email1')
    })

    // Test export action
    const exportButton = screen.getByTitle('Export')
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(emailService.export).toHaveBeenCalledWith('email1')
    })
  })

  test('shows loading states', async () => {
    // Mock loading state
    emailService.list.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

    renderDashboard()

    // Should show loading state initially
    expect(screen.getByText('No emails found')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Test Email 1')).toBeInTheDocument()
    })
  })

  test('handles empty email list', async () => {
    emailService.list.mockResolvedValue({
      success: true,
      items: [],
      total: 0,
      page: 1,
      limit: 25
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('No emails found')).toBeInTheDocument()
    })
  })

  test('handles API errors gracefully', async () => {
    emailService.list.mockRejectedValue(new Error('API Error'))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('No emails found')).toBeInTheDocument()
    })
  })
})
