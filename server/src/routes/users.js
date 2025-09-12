import express from 'express'
import User from '../models/User.js'
import { protect } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = express.Router()

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password')

  res.json({
    success: true,
    user
  })
}))

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, asyncHandler(async (req, res) => {
  const { name, emailPreferences } = req.body

  const updateFields = {}
  if (name) updateFields.name = name
  if (emailPreferences) updateFields.emailPreferences = emailPreferences

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateFields,
    { new: true, runValidators: true }
  ).select('-password')

  res.json({
    success: true,
    user
  })
}))

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
router.delete('/account', protect, asyncHandler(async (req, res) => {
  await User.findByIdAndDelete(req.user._id)

  res.json({
    success: true,
    message: 'Account deleted successfully'
  })
}))

export default router
