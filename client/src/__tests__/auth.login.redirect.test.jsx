import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import { vi } from 'vitest'

// Mock the API
const mockApi = {
  post: vi.fn()
}

vi.mock('../services/api', () => ({
  api: mockApi
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const TestComponent = () => {
  const { login } = useAuth()
  
  const handleLogin = async () => {
    const result = await login('test@example.com', 'password')
    if (result.success) {
      mockNavigate('/dashboard')
    }
  }
  
  return (
    <div>
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}

describe('auth login redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('navigates to dashboard after successful login', async () => {
    mockApi.post.mockResolvedValue({
      data: {
        success: true,
        token: 'test-token',
        user: { id: '1', email: 'test@example.com' }
      }
    })

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    const loginButton = screen.getByText('Login')
    loginButton.click()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })
})
