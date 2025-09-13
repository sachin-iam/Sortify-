import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Settings from '../pages/Settings'
import { AuthProvider } from '../contexts/AuthContext'
import { api } from '../services/api'

// Mock the API service
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    post: vi.fn()
  }
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  success: vi.fn(),
  error: vi.fn()
}))

const mockUser = {
  _id: 'user123',
  name: 'Test User',
  email: 'test@example.com',
  emailPreferences: {
    notifications: true,
    marketing: false
  }
}

const mockConnections = {
  gmail: { connected: false, email: null },
  outlook: { connected: false, email: null }
}

const renderSettings = (user = mockUser) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Settings />
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful API responses by default
    api.get.mockResolvedValue({
      data: {
        success: true,
        connections: mockConnections,
        emailPreferences: mockUser.emailPreferences
      }
    })
    
    api.put.mockResolvedValue({
      data: {
        success: true,
        user: mockUser,
        emailPreferences: mockUser.emailPreferences
      }
    })
  })

  test('renders all settings sections', () => {
    renderSettings()

    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Profile Information')).toBeInTheDocument()
    expect(screen.getByText('Email Preferences')).toBeInTheDocument()
    expect(screen.getByText('Change Password')).toBeInTheDocument()
    expect(screen.getByText('Email Sync Services')).toBeInTheDocument()
    expect(screen.getByText('Connected Accounts')).toBeInTheDocument()
    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
  })

  test('displays user profile information', () => {
    renderSettings()

    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
  })

  test('updates profile successfully', async () => {
    renderSettings()

    const nameInput = screen.getByDisplayValue('Test User')
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })

    const saveButton = screen.getByText('Save Profile')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/api/auth/profile', {
        name: 'Updated Name',
        emailPreferences: mockUser.emailPreferences
      })
    })
  })

  test('changes password successfully', async () => {
    renderSettings()

    const currentPasswordInput = screen.getByPlaceholderText('Enter your current password')
    const newPasswordInput = screen.getByPlaceholderText('Enter your new password')
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your new password')

    fireEvent.change(currentPasswordInput, { target: { value: 'current123' } })
    fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'newpassword123' } })

    const changeButton = screen.getByText('Change Password')
    fireEvent.click(changeButton)

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/api/auth/change-password', {
        currentPassword: 'current123',
        newPassword: 'newpassword123'
      })
    })
  })

  test('validates password confirmation', async () => {
    renderSettings()

    const currentPasswordInput = screen.getByPlaceholderText('Enter your current password')
    const newPasswordInput = screen.getByPlaceholderText('Enter your new password')
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your new password')

    fireEvent.change(currentPasswordInput, { target: { value: 'current123' } })
    fireEvent.change(newPasswordInput, { target: { value: 'newpassword123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } })

    const changeButton = screen.getByText('Change Password')
    fireEvent.click(changeButton)

    // Should not call API when passwords don't match
    await waitFor(() => {
      expect(api.put).not.toHaveBeenCalledWith('/api/auth/change-password', expect.anything())
    })
  })

  test('toggles email preferences', async () => {
    renderSettings()

    const notificationsToggle = screen.getByRole('checkbox', { name: /notifications/i })
    fireEvent.click(notificationsToggle)

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/api/auth/email-preferences', {
        notifications: false
      })
    })
  })

  test('handles Gmail connection', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        authUrl: 'https://accounts.google.com/oauth/authorize'
      }
    })

    renderSettings()

    const connectButton = screen.getByText('Connect Gmail')
    fireEvent.click(connectButton)

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/auth/gmail/connect')
    })
  })

  test('handles Gmail disconnection', async () => {
    // Mock user with Gmail connected
    const connectedConnections = {
      gmail: { connected: true, email: 'test@gmail.com' },
      outlook: { connected: false, email: null }
    }

    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        connections: connectedConnections,
        emailPreferences: mockUser.emailPreferences
      }
    })

    // Mock window.confirm
    window.confirm = vi.fn(() => true)

    renderSettings()

    const disconnectButton = screen.getByText('Disconnect')
    fireEvent.click(disconnectButton)

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to disconnect your Gmail account? This will remove all synced emails.'
      )
      expect(api.post).toHaveBeenCalledWith('/api/auth/gmail/disconnect')
    })
  })

  test('handles Outlook connection (coming soon)', async () => {
    renderSettings()

    const outlookButton = screen.getByText('Coming Soon')
    fireEvent.click(outlookButton)

    // Should show coming soon message
    await waitFor(() => {
      expect(api.get).not.toHaveBeenCalledWith('/api/auth/outlook/connect')
    })
  })

  test('deletes account with confirmation', async () => {
    // Mock window.prompt
    window.prompt = vi.fn(() => 'DELETE')

    renderSettings()

    const deleteButton = screen.getByText('Delete Account')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(window.prompt).toHaveBeenCalledWith(
        expect.stringContaining('Type "DELETE" to confirm:')
      )
      expect(api.delete).toHaveBeenCalledWith('/api/auth/account')
    })
  })

  test('cancels account deletion when confirmation fails', async () => {
    // Mock window.prompt to return wrong confirmation
    window.prompt = vi.fn(() => 'wrong')

    renderSettings()

    const deleteButton = screen.getByText('Delete Account')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(window.prompt).toHaveBeenCalled()
      expect(api.delete).not.toHaveBeenCalled()
    })
  })

  test('handles API errors gracefully', async () => {
    api.put.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Validation failed'
        }
      }
    })

    renderSettings()

    const nameInput = screen.getByDisplayValue('Test User')
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })

    const saveButton = screen.getByText('Save Profile')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(api.put).toHaveBeenCalled()
    })
  })

  test('shows loading states', async () => {
    // Mock slow API response
    api.put.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
      data: { success: true }
    }), 100)))

    renderSettings()

    const nameInput = screen.getByDisplayValue('Test User')
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })

    const saveButton = screen.getByText('Save Profile')
    fireEvent.click(saveButton)

    // Should show loading state
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  test('displays connected Gmail account', async () => {
    const connectedConnections = {
      gmail: { connected: true, email: 'test@gmail.com' },
      outlook: { connected: false, email: null }
    }

    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        connections: connectedConnections,
        emailPreferences: mockUser.emailPreferences
      }
    })

    renderSettings()

    await waitFor(() => {
      expect(screen.getByText('Gmail Connected')).toBeInTheDocument()
      expect(screen.getByText('test@gmail.com')).toBeInTheDocument()
    })
  })

  test('shows no connected accounts message', async () => {
    renderSettings()

    await waitFor(() => {
      expect(screen.getByText('No email accounts connected')).toBeInTheDocument()
    })
  })
})
