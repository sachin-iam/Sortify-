import React from 'react'
import { Routes, Route } from 'react-router-dom'

// Simple test component
const SimpleLogin = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        padding: '40px',
        borderRadius: '20px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>🎉 Sortify Login</h1>
        <p style={{ fontSize: '18px', marginBottom: '20px' }}>React is working perfectly!</p>
        <button style={{
          background: 'rgba(255, 255, 255, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer'
        }}>
          Test Button
        </button>
        <p style={{ fontSize: '14px', marginTop: '20px' }}>
          Time: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}

function App() {
  console.log('App component rendering...')
  
  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<SimpleLogin />} />
        <Route path="/" element={<SimpleLogin />} />
      </Routes>
    </div>
  )
}

export default App
