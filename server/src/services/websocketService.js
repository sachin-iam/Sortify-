// WebSocket service for real-time updates
import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import notificationService from './notificationService.js'

// Store active connections by user ID
const userConnections = new Map()

/**
 * Initialize WebSocket server
 * @param {Object} server - HTTP server instance
 */
export const initializeWebSocket = (server) => {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  })

  // Initialize notification service with WebSocket server
  notificationService.setWebSocketServer(wss)

  wss.on('connection', (ws, req) => {
    console.log('🔌 New WebSocket connection')

    // Extract token from query parameters
    const url = new URL(req.url, `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      ws.close(1008, 'No authentication token provided')
      return
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const userId = decoded.id

      // Store connection
      if (!userConnections.has(userId)) {
        userConnections.set(userId, new Set())
      }
      userConnections.get(userId).add(ws)

      console.log(`✅ WebSocket authenticated for user: ${userId}`)

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to real-time updates',
        timestamp: new Date().toISOString()
      }))

      // Handle messages from client
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message)
          handleClientMessage(userId, data, ws)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      })

      // Handle connection close
      ws.on('close', () => {
        console.log(`🔌 WebSocket disconnected for user: ${userId}`)
        const userWs = userConnections.get(userId)
        if (userWs) {
          userWs.delete(ws)
          if (userWs.size === 0) {
            userConnections.delete(userId)
          }
        }
      })

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for user ${userId}:`, error)
      })

    } catch (error) {
      console.error('WebSocket authentication error:', error)
      ws.close(1008, 'Invalid authentication token')
    }
  })

  console.log('🚀 WebSocket server initialized')
  return wss
}

/**
 * Handle messages from client
 * @param {string} userId - User ID
 * @param {Object} data - Message data
 * @param {WebSocket} ws - WebSocket connection
 */
const handleClientMessage = (userId, data, ws) => {
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString()
      }))
      break

    case 'subscribe':
      // Handle subscription to specific events
      ws.subscriptions = data.events || []
      ws.send(JSON.stringify({
        type: 'subscribed',
        events: ws.subscriptions,
        timestamp: new Date().toISOString()
      }))
      break

    default:
      console.log(`Unknown message type: ${data.type}`)
  }
}

/**
 * Send real-time update to user
 * @param {string} userId - User ID
 * @param {Object} data - Update data
 */
export const sendUpdateToUser = (userId, data) => {
  const userWs = userConnections.get(userId)
  if (!userWs || userWs.size === 0) {
    console.log(`No active connections for user: ${userId}`)
    return false
  }

  const message = JSON.stringify({
    ...data,
    timestamp: new Date().toISOString()
  })

  let sentCount = 0
  userWs.forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(message)
        sentCount++
      } catch (error) {
        console.error('Error sending WebSocket message:', error)
        userWs.delete(ws)
      }
    } else {
      userWs.delete(ws)
    }
  })

  console.log(`📤 Sent update to ${sentCount} connections for user: ${userId}`)
  return sentCount > 0
}

/**
 * Send email sync update
 * @param {string} userId - User ID
 * @param {Object} emailData - Email data
 */
export const sendEmailSyncUpdate = (userId, emailData) => {
  return sendUpdateToUser(userId, {
    type: 'email_synced',
    data: {
      emailId: emailData.gmailId,
      subject: emailData.subject,
      category: emailData.category,
      confidence: emailData.classification?.confidence,
      from: emailData.from,
      date: emailData.date
    }
  })
}

/**
 * Send category update
 * @param {string} userId - User ID
 * @param {Object} categoryData - Category data
 */
export const sendCategoryUpdate = (userId, categoryData) => {
  return sendUpdateToUser(userId, {
    type: 'category_updated',
    data: categoryData
  })
}

/**
 * Send sync status update
 * @param {string} userId - User ID
 * @param {Object} statusData - Status data
 */
export const sendSyncStatusUpdate = (userId, statusData) => {
  return sendUpdateToUser(userId, {
    type: 'sync_status',
    data: statusData
  })
}

/**
 * Broadcast to all connected users
 * @param {Object} data - Broadcast data
 */
export const broadcastToAll = (data) => {
  let totalSent = 0
  userConnections.forEach((userWs, userId) => {
    const sent = sendUpdateToUser(userId, data)
    if (sent) totalSent++
  })
  console.log(`📢 Broadcast sent to ${totalSent} users`)
  return totalSent
}

/**
 * Get connection statistics
 * @returns {Object} Connection stats
 */
export const getConnectionStats = () => {
  let totalConnections = 0
  let activeUsers = 0

  userConnections.forEach((userWs, userId) => {
    activeUsers++
    totalConnections += userWs.size
  })

  return {
    activeUsers,
    totalConnections,
    users: Array.from(userConnections.keys())
  }
}

/**
 * Close all connections for a user
 * @param {string} userId - User ID
 */
export const closeUserConnections = (userId) => {
  const userWs = userConnections.get(userId)
  if (userWs) {
    userWs.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.close(1000, 'User disconnected')
      }
    })
    userConnections.delete(userId)
    console.log(`🔌 Closed all connections for user: ${userId}`)
  }
}

/**
 * Send Phase 1 completion update
 * @param {string} userId - User ID
 * @param {Object} data - Phase 1 completion data
 */
export const sendPhase1CompleteUpdate = (userId, data) => {
  return sendUpdateToUser(userId, {
    type: 'reclassification_phase1_complete',
    data: {
      phase: 1,
      totalEmails: data.totalEmails,
      processedEmails: data.processedEmails,
      updatedEmails: data.updatedEmails,
      errorCount: data.errorCount,
      duration: data.duration,
      message: data.message || `Phase 1 complete: ${data.updatedEmails} emails reclassified`
    }
  })
}

/**
 * Send Phase 2 category change update
 * @param {string} userId - User ID
 * @param {Object} data - Category change data
 */
export const sendPhase2CategoryChanged = (userId, data) => {
  return sendUpdateToUser(userId, {
    type: 'phase2_category_changed',
    data: {
      phase: 2,
      emailId: data.emailId,
      emailSubject: data.emailSubject,
      oldCategory: data.oldCategory,
      newCategory: data.newCategory,
      confidence: data.confidence,
      improvement: data.improvement,
      reason: data.reason,
      timestamp: new Date().toISOString()
    }
  })
}

/**
 * Send Phase 2 batch completion update
 * @param {string} userId - User ID
 * @param {Object} data - Batch completion data
 */
export const sendPhase2BatchComplete = (userId, data) => {
  return sendUpdateToUser(userId, {
    type: 'phase2_batch_complete',
    data: {
      phase: 2,
      batchNumber: data.batchNumber,
      emailsProcessed: data.emailsProcessed,
      categoriesChanged: data.categoriesChanged,
      categoryChanges: data.categoryChanges, // { fromCategory: count, toCategory: count }
      totalProcessed: data.totalProcessed,
      totalQueued: data.totalQueued,
      progress: data.progress,
      message: data.message || `Phase 2 batch ${data.batchNumber} complete`
    }
  })
}
