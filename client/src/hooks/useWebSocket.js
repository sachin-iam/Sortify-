// WebSocket hook for real-time updates
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export const useWebSocket = () => {
  const { token } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [lastMessage, setLastMessage] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const pendingSubscriptions = useRef(null)
  const maxReconnectAttempts = 5
  const reconnectDelay = 3000

  const connect = useCallback(() => {
    if (!token) {
      console.log('No token available for WebSocket connection')
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected')
      return
    }

    try {
      const wsUrl = `ws://localhost:5000/ws?token=${encodeURIComponent(token)}`
      console.log('Connecting to WebSocket:', wsUrl)
      
      wsRef.current = new WebSocket(wsUrl)
      
      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected')
        setIsConnected(true)
        setConnectionStatus('connected')
        reconnectAttempts.current = 0
        
        // Send initial ping
        sendMessage({ type: 'ping' })
        
        // Handle pending subscriptions
        if (pendingSubscriptions.current) {
          console.log('📡 Processing pending subscriptions:', pendingSubscriptions.current)
          sendMessage({
            type: 'subscribe',
            events: pendingSubscriptions.current
          })
          pendingSubscriptions.current = null
        }
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('📨 WebSocket message received:', data)
          setLastMessage(data)
          
          // Handle different message types
          handleMessage(data)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      wsRef.current.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason)
        setIsConnected(false)
        setConnectionStatus('disconnected')
        
        // Attempt to reconnect if not a manual close
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          console.log(`🔄 Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectDelay * reconnectAttempts.current)
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setConnectionStatus('failed')
          toast.error('Connection lost. Please refresh the page.')
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        setConnectionStatus('error')
      }

    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      setConnectionStatus('error')
    }
  }, [token])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }
    
    setIsConnected(false)
    setConnectionStatus('disconnected')
    reconnectAttempts.current = 0
  }, [])

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message))
        console.log('📤 WebSocket message sent:', message)
        return true
      } catch (error) {
        console.error('Error sending WebSocket message:', error)
        return false
      }
    } else {
      console.warn('WebSocket not connected, cannot send message')
      return false
    }
  }, [])

  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'pong':
        console.log('🏓 Pong received')
        break
        
      case 'email_synced':
        handleEmailSync(data.data)
        break
        
      case 'category_updated':
        handleCategoryUpdate(data.data)
        break
        
      case 'sync_status':
        handleSyncStatus(data.data)
        break
        
      case 'connection':
        console.log('🔌 Connection message:', data.message)
        break
        
      case 'subscribed':
        console.log('📋 Subscribed to events:', data.events)
        break
        
      default:
        console.log('📨 Unknown message type:', data.type)
    }
  }, [])

  const handleEmailSync = useCallback((emailData) => {
    toast.success(`📧 New email: "${emailData.subject}"`, {
      duration: 4000,
      style: {
        background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: '20px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
        color: '#065f46',
        fontSize: '14px',
        fontWeight: '600',
        padding: '16px 20px',
        maxWidth: '400px'
      }
    })
  }, [])

  const handleCategoryUpdate = useCallback((categoryData) => {
    toast.success(`🏷️ Category updated: ${categoryData.category?.name}`, {
      duration: 3000,
      style: {
        background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(124,58,237,0.1))',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: '20px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
        color: '#6b21a8',
        fontSize: '14px',
        fontWeight: '600',
        padding: '16px 20px',
        maxWidth: '400px'
      }
    })
  }, [])

  const handleSyncStatus = useCallback((statusData) => {
    if (statusData.status === 'active') {
      toast.success('🔄 Real-time sync started', {
        duration: 3000,
        style: {
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(37,99,235,0.1))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          color: '#1e40af',
          fontSize: '14px',
          fontWeight: '600',
          padding: '16px 20px',
          maxWidth: '400px'
        }
      })
    }
  }, [])

  // Auto-connect when token is available
  useEffect(() => {
    if (token && !isConnected) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [token, connect, disconnect]) // Removed isConnected from dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  const setPendingSubscriptions = useCallback((events) => {
    pendingSubscriptions.current = events
  }, [])

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
    setPendingSubscriptions
  }
}
