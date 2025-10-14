import express from 'express'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import Email from '../models/Email.js'

const router = express.Router()

// @desc    Bootstrap Gmail connection
// @route   POST /api/bootstrap/gmail
// @access  Private
router.post('/gmail', protect, asyncHandler(async (req, res) => {
  try {
    const { startWatch } = await import('../services/gmailWatchService.js').catch(() => ({ startWatch: async () => {} }))
    
    // Try to start watch if service exists
    try { 
      await startWatch?.(req.user) 
    } catch (e) { 
      console.warn('watch start failed', e?.message) 
    }
    
    const count = await Email.countDocuments({ userId: req.user._id, provider: 'gmail' })
    
    if (count === 0) {
      // Fire-and-forget thumbnail sync so response is fast
      ;(async () => {
        try {
          const { syncEmailThumbnails } = await import('../services/gmailSyncService.js')
          const result = await syncEmailThumbnails(req.user, { maxResults: 1000 })
          console.log(`✅ Bootstrap thumbnail sync completed for ${req.user.email}:`, result)
        } catch (e) {
          console.error('bootstrap thumbnail sync error', e?.message)
        }
      })()
    } else {
      // Check if we need to sync more thumbnails for existing users
      const thumbnailCount = await Email.countDocuments({ 
        userId: req.user._id, 
        provider: 'gmail',
        isFullContentLoaded: false 
      })
      
      if (thumbnailCount < 500) {
        // Continue syncing thumbnails in background for existing users
        ;(async () => {
          try {
            const { syncEmailThumbnails } = await import('../services/gmailSyncService.js')
            const result = await syncEmailThumbnails(req.user, { maxResults: 1000 })
            console.log(`✅ Background thumbnail sync completed for ${req.user.email}:`, result)
          } catch (e) {
            console.error('background thumbnail sync error', e?.message)
          }
        })()
      }
    }
    
    res.json({ 
      success: true, 
      started: true, 
      existing: count 
    })
  } catch (e) {
    res.status(400).json({ 
      success: false, 
      message: e?.message || 'Bootstrap failed' 
    })
  }
}))

export default router
