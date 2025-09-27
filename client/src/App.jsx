import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { WebSocketProvider } from './contexts/WebSocketContext'
import ProtectedRoute from './components/ProtectedRoute'
import ProtectedRouteNew from './components/ProtectedRouteNew'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import ParticleBackground from './components/ParticleBackground'
import Login from './pages/Login'
import LoginTest from './pages/LoginTest'
import Dashboard from './pages/Dashboard'
import DashboardNew from './pages/DashboardNew'
import Settings from './pages/Settings'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import EmailVerification from './pages/EmailVerification'
import NotFound from './pages/NotFound'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WebSocketProvider>
          <div className="App min-h-screen relative">
            <ParticleBackground />
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:resetToken" element={<ResetPassword />} />
            <Route path="/verify-email/:verificationToken?" element={<EmailVerification />} />
            <Route 
              path="/" 
              element={
                <>
                  <Navbar />
                  <ProtectedRouteNew>
                    <DashboardNew />
                  </ProtectedRouteNew>
                </>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <>
                  <Navbar />
                  <ProtectedRouteNew>
                    <DashboardNew />
                  </ProtectedRouteNew>
                </>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <>
                  <Navbar />
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                </>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </div>
        </WebSocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
