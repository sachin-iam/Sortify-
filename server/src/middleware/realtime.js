// Real-time analytics update middleware
import Email from '../models/Email.js'

// Store active connections for real-time updates
const activeConnections = new Map()

export const addRealtimeConnection = (userId, res) => {
  activeConnections.set(userId, res)
  
  // Clean up connection on close
  res.on('close', () => {
    activeConnections.delete(userId)
  })
}

export const broadcastAnalyticsUpdate = async (userId) => {
  try {
    const connection = activeConnections.get(userId)
    if (!connection) return

    // Get updated analytics data
    const stats = await Email.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalEmails: { $sum: 1 },
          totalByCategory: {
            $push: {
              category: '$category',
              count: 1
            }
          },
          unreadCount: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          },
          processedToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$createdAt', new Date(new Date().setHours(0, 0, 0, 0))] },
                    { $lt: ['$createdAt', new Date(new Date().setHours(23, 59, 59, 999))] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ])

    const result = stats[0] || {
      totalEmails: 0,
      totalByCategory: [],
      unreadCount: 0,
      processedToday: 0
    }

    // Count unique categories
    const categoryCount = new Set(
      result.totalByCategory
        .filter(item => item.category !== null)
        .map(item => item.category)
    ).size

    const analyticsData = {
      totalEmails: result.totalEmails,
      categories: categoryCount,
      processedToday: result.processedToday,
      unreadCount: result.unreadCount
    }

    // Send real-time update
    connection.write(`data: ${JSON.stringify(analyticsData)}\n\n`)
  } catch (error) {
    console.error('Error broadcasting analytics update:', error)
  }
}

export const getRealtimeAnalytics = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  })

  // Add this connection to active connections
  addRealtimeConnection(req.user._id, res)

  // Send initial data
  res.write(`data: ${JSON.stringify({ connected: true })}\n\n`)

  // Keep connection alive
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ ping: Date.now() })}\n\n`)
  }, 30000)

  res.on('close', () => {
    clearInterval(interval)
    activeConnections.delete(req.user._id)
  })
}
