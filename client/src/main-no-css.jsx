import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Simple test component with inline styles only
const TestComponent = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      fontWeight: 'bold'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        padding: '40px',
        borderRadius: '20px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center'
      }}>
        <h1>🚀 React Test (No CSS)</h1>
        <p>If you can see this, React is working!</p>
        <p>Time: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  )
}

console.log('Main script loading...')

try {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  console.log('Root element found:', root)
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <TestComponent />
      </BrowserRouter>
    </React.StrictMode>
  )
  console.log('Component rendered successfully')
} catch (error) {
  console.error('Error rendering component:', error)
}
