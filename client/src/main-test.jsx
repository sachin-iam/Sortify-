import React from 'react'
import ReactDOM from 'react-dom/client'

const TestApp = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
      color: 'white',
      fontSize: '32px',
      fontWeight: 'bold'
    }}>
      <h1>🚀 React is Working!</h1>
    </div>
  )
}

console.log('Main test script loading...')

try {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  console.log('Root element found:', root)
  root.render(<TestApp />)
  console.log('TestApp rendered successfully')
} catch (error) {
  console.error('Error rendering TestApp:', error)
}
