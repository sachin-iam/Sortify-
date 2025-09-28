import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import User from '../models/User.js'

const router = express.Router()

// @desc    Get connection status
// @route   GET /api/connections/status
// @access  Private
router.get('/status', protect, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('gmailConnected gmailName gmailEmail outlookConnected email')

    res.json({
      success: true,
      connections: {
        gmail: {
          connected: !!user.gmailConnected,
          email: user.gmailConnected ? (user.gmailEmail || user.email) : null,
          name: user.gmailConnected ? user.gmailName : null
        },
        outlook: {
          connected: !!user.outlookConnected,
          email: user.outlookConnected ? user.email : null
        }
      }
    })

  } catch (error) {
    console.error('Get connection status error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch connection status',
      error: error.message
    })
  }
}))

export default router

