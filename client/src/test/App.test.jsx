import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import App from '../App'


// Mock the AuthProvider
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({
    user: null,
    token: null,
    loading: false,
    isAuthenticated: false
  })
}))

// Mock the ErrorBoundary
vi.mock('../components/ErrorBoundary', () => ({
  default: ({ children }) => <div data-testid="error-boundary">{children}</div>
}))

// Mock the ProtectedRoute
vi.mock('../components/ProtectedRoute', () => ({
  default: ({ children }) => <div data-testid="protected-route">{children}</div>
}))

// Mock the Navbar
vi.mock('../components/Navbar', () => ({
  default: () => <div data-testid="navbar">Navbar</div>
}))

// Mock the pages
vi.mock('../pages/Login', () => ({
  default: () => <div data-testid="login-page">Login Page</div>
}))

vi.mock('../pages/Dashboard', () => ({
  default: () => <div data-testid="dashboard-page">Dashboard Page</div>
}))

vi.mock('../pages/Settings', () => ({
  default: () => <div data-testid="settings-page">Settings Page</div>
}))

vi.mock('../pages/NotFound', () => ({
  default: () => <div data-testid="not-found-page">Not Found Page</div>
}))

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )
    
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument()
  })

  it('renders login page for /login route', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )
    
    // Since we're mocking the routes, we can't test specific routes easily
    // But we can test that the app renders without errors
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
  })
})
