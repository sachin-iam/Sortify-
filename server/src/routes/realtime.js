// Real-time sync management routes
import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import User from '../models/User.js'
import { 
  startEnhancedRealtimeSync, 
  stopEnhancedRealtimeSync, 
  getSyncStatus,
  forceSync,
  refreshUserTokens
} from '../services/enhancedRealtimeSync.js'
import { 
  sendSyncStatusUpdate,
  getConnectionStats 
} from '../services/websocketService.js'

const router = express.Router()

// @desc    Start real-time sync for user
// @route   POST /api/realtime/start
// @access  Private
router.post('/start', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    
    if (!user.gmailConnected || !user.gmailAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Gmail account not connected'
      })
    }

    // Refresh tokens if needed
    const tokensValid = await refreshUserTokens(user)
    if (!tokensValid) {
      return res.status(400).json({
        success: false,
        message: 'Gmail tokens expired. Please reconnect your account.'
      })
    }

    // Start enhanced real-time sync
    const syncStarted = await startEnhancedRealtimeSync(user)
    
    if (syncStarted) {
      // Send WebSocket update
      sendSyncStatusUpdate(user._id.toString(), {
        status: 'active',
        message: 'Real-time sync started successfully'
      })

      res.json({
        success: true,
        message: 'Real-time sync started successfully',
        syncStatus: getSyncStatus(user._id.toString())
      })
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to start real-time sync'
      })
    }

  } catch (error) {
    console.error('Start real-time sync error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to start real-time sync',
      error: error.message
    })
  }
}))

// @desc    Stop real-time sync for user
// @route   POST /api/realtime/stop
// @access  Private
router.post('/stop', protect, asyncHandler(async (req, res) => {
  try {
    stopEnhancedRealtimeSync(req.user._id.toString())

    // Send WebSocket update
    sendSyncStatusUpdate(req.user._id.toString(), {
      status: 'stopped',
      message: 'Real-time sync stopped'
    })

    res.json({
      success: true,
      message: 'Real-time sync stopped successfully'
    })

  } catch (error) {
    console.error('Stop real-time sync error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to stop real-time sync',
      error: error.message
    })
  }
}))

// @desc    Get sync status for user
// @route   GET /api/realtime/status
// @access  Private
router.get('/status', protect, asyncHandler(async (req, res) => {
  try {
    const status = getSyncStatus(req.user._id.toString())
    
    res.json({
      success: true,
      syncStatus: status
    })

  } catch (error) {
    console.error('Get sync status error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get sync status',
      error: error.message
    })
  }
}))

// @desc    Force sync for user
// @route   POST /api/realtime/force-sync
// @access  Private
router.post('/force-sync', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    
    if (!user.gmailConnected || !user.gmailAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Gmail account not connected'
      })
    }

    // Force sync
    const syncedCount = await forceSync(user._id.toString())

    // Send WebSocket update
    sendSyncStatusUpdate(user._id.toString(), {
      status: 'syncing',
      message: `Force sync completed: ${syncedCount} emails synced`
    })

    res.json({
      success: true,
      message: `Force sync completed: ${syncedCount} emails synced`,
      syncedCount
    })

  } catch (error) {
    console.error('Force sync error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to force sync',
      error: error.message
    })
  }
}))

// @desc    Get WebSocket connection stats
// @route   GET /api/realtime/connections
// @access  Private
router.get('/connections', protect, asyncHandler(async (req, res) => {
  try {
    const stats = getConnectionStats()
    
    res.json({
      success: true,
      connections: stats
    })

  } catch (error) {
    console.error('Get connection stats error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get connection stats',
      error: error.message
    })
  }
}))

// @desc    Refresh Gmail tokens
// @route   POST /api/realtime/refresh-tokens
// @access  Private
router.post('/refresh-tokens', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    
    if (!user.gmailConnected || !user.gmailAccessToken) {
      return res.status(400).json({
        success: false,
        message: 'Gmail account not connected'
      })
    }

    const tokensValid = await refreshUserTokens(user)
    
    if (tokensValid) {
      res.json({
        success: true,
        message: 'Tokens refreshed successfully'
      })
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to refresh tokens. Please reconnect your account.'
      })
    }

  } catch (error) {
    console.error('Refresh tokens error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to refresh tokens',
      error: error.message
    })
  }
}))

export default router
