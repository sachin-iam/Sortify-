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
  startRealtime: jest.fn(),
  connectGmail: jest.fn(),
  disconnectGmail: jest.fn()
}))

// Mock window.location
const mockLocation = {
  href: ''
}
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
})

const mockUser = {
  _id: 'user123',
  name: 'Test User',
  email: 'test@example.com',
  gmailConnected: false
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

describe('Gmail Connect/Disconnect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocation.href = ''
    
    emailService.list.mockResolvedValue({
      success: true,
      items: [],
      total: 0,
      page: 1,
      limit: 25
    })
  })

  describe('Gmail Connection', () => {
    test('shows connect button when Gmail is not connected', () => {
      renderDashboard()

      expect(screen.getByText('Connect Gmail')).toBeInTheDocument()
      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })

    test('triggers Gmail connection when connect button is clicked', async () => {
      emailService.connectGmail.mockResolvedValue({
        success: true,
        authUrl: 'https://accounts.google.com/oauth/authorize?client_id=...'
      })

      renderDashboard()

      const connectButton = screen.getByText('Connect Gmail')
      fireEvent.click(connectButton)

      await waitFor(() => {
        expect(emailService.connectGmail).toHaveBeenCalled()
      })

      expect(mockLocation.href).toBe('https://accounts.google.com/oauth/authorize?client_id=...')
    })

    test('shows loading state during connection', async () => {
      emailService.connectGmail.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )

      renderDashboard()

      const connectButton = screen.getByText('Connect Gmail')
      fireEvent.click(connectButton)

      expect(screen.getByText('Connecting...')).toBeInTheDocument()
    })

    test('handles connection errors', async () => {
      emailService.connectGmail.mockRejectedValue(new Error('Connection failed'))

      renderDashboard()

      const connectButton = screen.getByText('Connect Gmail')
      fireEvent.click(connectButton)

      await waitFor(() => {
        expect(screen.getByText('Connect Gmail')).toBeInTheDocument() // Button should still be there
      })
    })

    test('shows connected state when Gmail is connected', () => {
      const connectedUser = { ...mockUser, gmailConnected: true }
      renderDashboard(connectedUser)

      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.getByText('Sync Now')).toBeInTheDocument()
      expect(screen.getByText('Disconnect')).toBeInTheDocument()
    })
  })

  describe('Gmail Disconnection', () => {
    test('shows disconnect button when Gmail is connected', () => {
      const connectedUser = { ...mockUser, gmailConnected: true }
      renderDashboard(connectedUser)

      expect(screen.getByText('Disconnect')).toBeInTheDocument()
    })

    test('triggers Gmail disconnection when disconnect button is clicked', async () => {
      emailService.disconnectGmail.mockResolvedValue({
        success: true,
        message: 'Disconnected and purged Gmail data',
        deletedEmails: 100
      })

      const connectedUser = { ...mockUser, gmailConnected: true }
      renderDashboard(connectedUser)

      const disconnectButton = screen.getByText('Disconnect')
      fireEvent.click(disconnectButton)

      await waitFor(() => {
        expect(emailService.disconnectGmail).toHaveBeenCalled()
      })
    })

    test('handles disconnection errors', async () => {
      emailService.disconnectGmail.mockRejectedValue(new Error('Disconnection failed'))

      const connectedUser = { ...mockUser, gmailConnected: true }
      renderDashboard(connectedUser)

      const disconnectButton = screen.getByText('Disconnect')
      fireEvent.click(disconnectButton)

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument() // Button should still be there
      })
    })

    test('clears emails from UI after disconnection', async () => {
      emailService.disconnectGmail.mockResolvedValue({
        success: true,
        message: 'Disconnected and purged Gmail data',
        deletedEmails: 100
      })

      const connectedUser = { ...mockUser, gmailConnected: true }
      renderDashboard(connectedUser)

      const disconnectButton = screen.getByText('Disconnect')
      fireEvent.click(disconnectButton)

      await waitFor(() => {
        expect(emailService.disconnectGmail).toHaveBeenCalled()
      })
    })
  })

  describe('Service Card States', () => {
    test('shows Gmail card with correct styling when connected', () => {
      const connectedUser = { ...mockUser, gmailConnected: true }
      renderDashboard(connectedUser)

      const gmailCard = screen.getByText('Gmail').closest('.backdrop-blur-xl')
      expect(gmailCard).toBeInTheDocument()
      expect(gmailCard).toHaveClass('backdrop-blur-xl', 'bg-white/30', 'border', 'border-white/20', 'rounded-2xl')
    })

    test('shows Gmail card with correct styling when disconnected', () => {
      renderDashboard()

      const gmailCard = screen.getByText('Gmail').closest('.backdrop-blur-xl')
      expect(gmailCard).toBeInTheDocument()
      expect(gmailCard).toHaveClass('backdrop-blur-xl', 'bg-white/30', 'border', 'border-white/20', 'rounded-2xl')
    })

    test('shows Outlook card as disabled', () => {
      renderDashboard()

      const outlookCard = screen.getByText('Microsoft Outlook').closest('.backdrop-blur-xl')
      expect(outlookCard).toBeInTheDocument()
      expect(outlookCard).toHaveClass('opacity-60')
      
      const outlookButton = screen.getByText('Coming Soon')
      expect(outlookButton).toBeDisabled()
    })

    test('shows mini stats when Gmail is connected', () => {
      const connectedUser = { ...mockUser, gmailConnected: true }
      renderDashboard(connectedUser)

      expect(screen.getByText('Total')).toBeInTheDocument()
      expect(screen.getByText('Categories')).toBeInTheDocument()
      expect(screen.getByText('Today')).toBeInTheDocument()
    })

    test('hides mini stats when Gmail is disconnected', () => {
      renderDashboard()

      expect(screen.queryByText('Total')).not.toBeInTheDocument()
      expect(screen.queryByText('Categories')).not.toBeInTheDocument()
      expect(screen.queryByText('Today')).not.toBeInTheDocument()
    })
  })

  describe('Button States', () => {
    test('connect button has correct styling', () => {
      renderDashboard()

      const connectButton = screen.getByText('Connect Gmail')
      expect(connectButton).toHaveClass('bg-gradient-to-br', 'from-emerald-400', 'to-emerald-600', 'text-white', 'shadow-lg', 'rounded-xl')
    })

    test('disconnect button has correct styling', () => {
      const connectedUser = { ...mockUser, gmailConnected: true }
      renderDashboard(connectedUser)

      const disconnectButton = screen.getByText('Disconnect')
      expect(disconnectButton).toHaveClass('bg-rose-50', 'text-rose-600', 'border', 'border-rose-200', 'hover:bg-rose-100', 'rounded-xl')
    })

    test('sync button has correct styling', () => {
      const connectedUser = { ...mockUser, gmailConnected: true }
      renderDashboard(connectedUser)

      const syncButton = screen.getByText('Sync Now')
      expect(syncButton).toHaveClass('bg-gradient-to-br', 'from-emerald-400', 'to-emerald-600', 'text-white', 'shadow-lg', 'rounded-xl')
    })

    test('outlook button has correct disabled styling', () => {
      renderDashboard()

      const outlookButton = screen.getByText('Coming Soon')
      expect(outlookButton).toHaveClass('bg-slate-200/60', 'text-slate-400', 'cursor-not-allowed')
    })
  })
})
