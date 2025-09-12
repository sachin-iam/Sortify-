import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import Dashboard from '../pages/Dashboard'
import { vi } from 'vitest'

// Mock EventSource
const mockEventSource = {
  close: vi.fn(),
  onmessage: null,
  onerror: null
}

global.EventSource = vi.fn(() => mockEventSource)

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

describe('dashboard sse one connection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({
      data: {
        success: true,
        user: { gmailConnected: true },
        stats: { totalEmails: 0 }
      }
    })
  })

  it('creates one EventSource connection', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </BrowserRouter>
    )

    expect(global.EventSource).toHaveBeenCalledTimes(1)
    expect(global.EventSource).toHaveBeenCalledWith(
      expect.stringContaining('/api/analytics/realtime?token=')
    )
  })

  it('handles SSE error with backoff reconnect', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </BrowserRouter>
    )

    // Simulate error
    if (mockEventSource.onerror) {
      mockEventSource.onerror()
    }

    // Should not create another connection immediately
    expect(global.EventSource).toHaveBeenCalledTimes(1)
  })
})
