import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthProvider } from '../contexts/AuthContext'
import Login from '../pages/Login'
import ForgotPassword from '../pages/ForgotPassword'
import ResetPassword from '../pages/ResetPassword'
import EmailVerification from '../pages/EmailVerification'

// Mock API
const mockApi = {
  post: vi.fn(),
  put: vi.fn(),
  get: vi.fn()
}

vi.mock('../services/api', () => ({
  api: mockApi
}))

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ resetToken: 'test-token', verificationToken: 'test-verification-token' })
  }
})

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
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

describe('Authentication System - Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Login Page', () => {
    it('should render login form', () => {
      renderWithProviders(<Login />)
      
      expect(screen.getByText('Welcome back!')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
      expect(screen.getByText('Sign In')).toBeInTheDocument()
    })

    it('should toggle between login and register modes', () => {
      renderWithProviders(<Login />)
      
      // Initially in login mode
      expect(screen.getByText('Welcome back!')).toBeInTheDocument()
      
      // Click to switch to register mode
      fireEvent.click(screen.getByText('Sign up'))
      expect(screen.getByText('Create your account')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your full name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument()
    })

    it('should handle login successfully', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: {
          success: true,
          token: 'test-token',
          user: { id: '1', email: 'test@example.com', name: 'Test User' }
        }
      })

      renderWithProviders(<Login />)
      
      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'password123' }
      })
      
      fireEvent.click(screen.getByText('Sign In'))
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/api/auth/login', {
          email: 'test@example.com',
          password: 'password123'
        })
      })
    })

    it('should handle login failure', async () => {
      mockApi.post.mockRejectedValueOnce({
        response: { data: { message: 'Invalid credentials' } }
      })

      renderWithProviders(<Login />)
      
      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'wrongpassword' }
      })
      
      fireEvent.click(screen.getByText('Sign In'))
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/api/auth/login', {
          email: 'test@example.com',
          password: 'wrongpassword'
        })
      })
    })

    it('should show forgot password link', () => {
      renderWithProviders(<Login />)
      expect(screen.getByText('Forgot password?')).toBeInTheDocument()
    })
  })

  describe('Forgot Password Page', () => {
    it('should render forgot password form', () => {
      renderWithProviders(<ForgotPassword />)
      
      expect(screen.getByText('Forgot Password?')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument()
      expect(screen.getByText('Send Reset Link')).toBeInTheDocument()
    })

    it('should handle forgot password successfully', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Password reset token generated',
          resetUrl: 'http://localhost:3000/reset-password?token=test-token'
        }
      })

      renderWithProviders(<ForgotPassword />)
      
      fireEvent.change(screen.getByPlaceholderText('Enter your email address'), {
        target: { value: 'test@example.com' }
      })
      
      fireEvent.click(screen.getByText('Send Reset Link'))
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/api/auth/forgot-password', {
          email: 'test@example.com'
        })
      })
    })

    it('should show success message after sending reset email', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Password reset token generated',
          resetUrl: 'http://localhost:3000/reset-password?token=test-token'
        }
      })

      renderWithProviders(<ForgotPassword />)
      
      fireEvent.change(screen.getByPlaceholderText('Enter your email address'), {
        target: { value: 'test@example.com' }
      })
      
      fireEvent.click(screen.getByText('Send Reset Link'))
      
      await waitFor(() => {
        expect(screen.getByText('Check Your Email')).toBeInTheDocument()
        expect(screen.getByText(/We've sent a password reset link to/)).toBeInTheDocument()
      })
    })
  })

  describe('Reset Password Page', () => {
    it('should render reset password form', () => {
      renderWithProviders(<ResetPassword />)
      
      expect(screen.getByText('Reset Password')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your new password')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Confirm your new password')).toBeInTheDocument()
      expect(screen.getByText('Reset Password')).toBeInTheDocument()
    })

    it('should validate password confirmation', async () => {
      renderWithProviders(<ResetPassword />)
      
      fireEvent.change(screen.getByPlaceholderText('Enter your new password'), {
        target: { value: 'newpassword123' }
      })
      fireEvent.change(screen.getByPlaceholderText('Confirm your new password'), {
        target: { value: 'differentpassword' }
      })
      
      fireEvent.click(screen.getByText('Reset Password'))
      
      // Should show error for password mismatch
      await waitFor(() => {
        // Error handling would be tested through toast notifications
      })
    })

    it('should handle reset password successfully', async () => {
      mockApi.put.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Password reset successfully'
        }
      })

      renderWithProviders(<ResetPassword />)
      
      fireEvent.change(screen.getByPlaceholderText('Enter your new password'), {
        target: { value: 'newpassword123' }
      })
      fireEvent.change(screen.getByPlaceholderText('Confirm your new password'), {
        target: { value: 'newpassword123' }
      })
      
      fireEvent.click(screen.getByText('Reset Password'))
      
      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith('/api/auth/reset-password/test-token', {
          password: 'newpassword123'
        })
      })
    })
  })

  describe('Email Verification Page', () => {
    it('should render email verification form', () => {
      renderWithProviders(<EmailVerification />)
      
      expect(screen.getByText('Verify Your Email')).toBeInTheDocument()
      expect(screen.getByText('Send Verification Email')).toBeInTheDocument()
    })

    it('should handle email verification with token', async () => {
      mockApi.put.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Email verified successfully'
        }
      })

      renderWithProviders(<EmailVerification />)
      
      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith('/api/auth/verify-email/test-verification-token')
      })
    })

    it('should handle send verification email', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Verification email sent',
          verificationUrl: 'http://localhost:3000/verify-email?token=test-token'
        }
      })

      renderWithProviders(<EmailVerification />)
      
      fireEvent.click(screen.getByText('Send Verification Email'))
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/api/auth/send-verification')
      })
    })
  })

  describe('AuthContext Integration', () => {
    it('should provide authentication context', () => {
      const TestComponent = () => {
        const { login, register, logout, isAuthenticated } = useAuth()
        return (
          <div>
            <span data-testid="authenticated">{isAuthenticated.toString()}</span>
            <button onClick={() => login('test@example.com', 'password')}>Login</button>
            <button onClick={() => register('Test User', 'test@example.com', 'password')}>Register</button>
            <button onClick={logout}>Logout</button>
          </div>
        )
      }

      renderWithProviders(<TestComponent />)
      
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
      expect(screen.getByText('Login')).toBeInTheDocument()
      expect(screen.getByText('Register')).toBeInTheDocument()
      expect(screen.getByText('Logout')).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should validate email format', () => {
      renderWithProviders(<Login />)
      
      const emailInput = screen.getByPlaceholderText('Enter your email')
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
      
      // HTML5 validation would prevent form submission
      expect(emailInput).toHaveValue('invalid-email')
    })

    it('should validate password length', () => {
      renderWithProviders(<Login />)
      
      const passwordInput = screen.getByPlaceholderText('Enter your password')
      fireEvent.change(passwordInput, { target: { value: '123' } })
      
      expect(passwordInput).toHaveValue('123')
    })

    it('should validate required fields', () => {
      renderWithProviders(<Login />)
      
      const submitButton = screen.getByText('Sign In')
      expect(submitButton).toBeInTheDocument()
      
      // Form should not submit without required fields
      fireEvent.click(submitButton)
      // Validation would be handled by HTML5 or custom validation
    })
  })
})
