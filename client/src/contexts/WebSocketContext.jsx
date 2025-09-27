// WebSocket context for real-time updates
import React, { createContext, useContext, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'

const WebSocketContext = createContext()

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider')
  }
  return context
}

export const WebSocketProvider = ({ children, onEmailSync, onCategoryUpdate, onSyncStatus }) => {
  const webSocket = useWebSocket()

  // Handle email sync updates
  useEffect(() => {
    if (webSocket.lastMessage?.type === 'email_synced' && onEmailSync) {
      onEmailSync(webSocket.lastMessage.data)
    }
  }, [webSocket.lastMessage, onEmailSync])

  // Handle category updates
  useEffect(() => {
    if (webSocket.lastMessage?.type === 'category_updated' && onCategoryUpdate) {
      onCategoryUpdate(webSocket.lastMessage.data)
    }
  }, [webSocket.lastMessage, onCategoryUpdate])

  // Handle sync status updates
  useEffect(() => {
    if (webSocket.lastMessage?.type === 'sync_status' && onSyncStatus) {
      onSyncStatus(webSocket.lastMessage.data)
    }
  }, [webSocket.lastMessage, onSyncStatus])

  const value = {
    ...webSocket,
    // Additional methods for specific actions
    subscribeToEvents: (events) => {
      if (webSocket.isConnected) {
        webSocket.sendMessage({
          type: 'subscribe',
          events
        })
      } else {
        console.log('WebSocket not connected, will subscribe when connected')
        // Store events to subscribe when connected
        webSocket.setPendingSubscriptions(events)
      }
    },
    requestSyncStatus: () => {
      webSocket.sendMessage({
        type: 'get_sync_status'
      })
    }
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}
