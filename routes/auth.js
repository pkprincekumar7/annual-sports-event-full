/**
 * Authentication Routes
 * Handles user login and authentication
 */

import express from 'express'
import jwt from 'jsonwebtoken'
import Player from '../models/Player.js'
import EventYear from '../models/EventYear.js'
import logger from '../utils/logger.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse } from '../utils/errorHandler.js'
import { trimObjectFields } from '../utils/validation.js'
import { computePlayerParticipation } from '../utils/playerHelpers.js'
import { getCache, setCache } from '../utils/cache.js'
import { findActiveEventYear } from '../utils/yearHelpers.js'
import { JWT_EXPIRES_IN } from '../constants/index.js'
import { authenticateToken } from '../middleware/auth.js'
import { sendPasswordResetEmail } from '../utils/emailService.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

/**
 * POST /api/login
 * User login endpoint
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    let { reg_number, password } = req.body

    // Trim fields
    const trimmed = trimObjectFields({ reg_number, password })
    reg_number = trimmed.reg_number
    password = trimmed.password

    // Validate required fields
    if (!reg_number || !password) {
      return sendErrorResponse(res, 400, 'Registration number and password are required')
    }

    // Find player with matching reg_number
    const player = await Player.findOne({ reg_number })

    if (!player) {
      return sendErrorResponse(res, 401, 'Invalid registration number or password')
    }

    // Check password
    if (player.password !== password) {
      return sendErrorResponse(res, 401, 'Invalid registration number or password')
    }

    // Get active event year for computed fields
    let eventYear = null
    const cachedActiveYear = getCache('/api/event-years/active')
    if (cachedActiveYear) {
      eventYear = cachedActiveYear.event_year
    } else {
      const activeYear = await findActiveEventYear()
      if (activeYear) {
        eventYear = activeYear.event_year
        setCache('/api/event-years/active', activeYear)
      } else {
        eventYear = new Date().getFullYear()
      }
    }

    // Compute participation data
    const participation = await computePlayerParticipation(player.reg_number, eventYear)

    // Generate JWT token
    const tokenPayload = {
      reg_number: player.reg_number,
      full_name: player.full_name,
      isAdmin: player.reg_number === 'admin',
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

    // Return player data (excluding password for security) and token
    const playerData = player.toObject()
    delete playerData.password
    
    // Add computed fields
    playerData.participated_in = participation.participated_in
    playerData.captain_in = participation.captain_in

    return sendSuccessResponse(
      res,
      {
        player: playerData,
        token,
        change_password_required: player.change_password_required || false,
      },
      'Login successful'
    )
  })
)

/**
 * POST /api/change-password
 * Change password (authenticated users only)
 */
router.post(
  '/change-password',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body
    const reg_number = req.user?.reg_number

    if (!reg_number) {
      return sendErrorResponse(res, 401, 'Authentication required')
    }

    // Validate required fields
    if (!current_password || !new_password) {
      return sendErrorResponse(res, 400, 'Current password and new password are required')
    }

    // Trim passwords
    const trimmedCurrentPassword = current_password.trim()
    const trimmedNewPassword = new_password.trim()

    // Validate new password is not empty
    if (!trimmedNewPassword) {
      return sendErrorResponse(res, 400, 'New password cannot be empty')
    }

    // Find player
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return sendErrorResponse(res, 404, 'Player not found')
    }

    // Verify current password
    if (player.password !== trimmedCurrentPassword) {
      return sendErrorResponse(res, 401, 'Current password is incorrect')
    }

    // Check if new password is same as current password
    if (player.password === trimmedNewPassword) {
      return sendErrorResponse(res, 400, 'New password must be different from current password')
    }

    // Update password
    player.password = trimmedNewPassword
    player.change_password_required = false // Reset flag after password change
    await player.save()

    return sendSuccessResponse(res, {}, 'Password changed successfully')
  })
)

/**
 * POST /api/reset-password
 * Reset password - sends new password to email (no authentication required)
 */
router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { email_id } = req.body

    if (!email_id || !email_id.trim()) {
      return sendErrorResponse(res, 400, 'Email ID is required')
    }

    const trimmedEmail = email_id.trim()

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      return sendErrorResponse(res, 400, 'Invalid email format')
    }

    // Find player by email
    const player = await Player.findOne({ email_id: trimmedEmail })
    if (!player) {
      // Don't reveal if email exists or not for security
      return sendSuccessResponse(res, {}, 'If the email exists, a new password has been sent')
    }

    // Generate new random password (8 characters, alphanumeric)
    const generateRandomPassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let password = ''
      for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return password
    }

    const newPassword = generateRandomPassword()

    // Update player password and set change_password_required flag
    player.password = newPassword
    player.change_password_required = true
    await player.save()

    // Send email with new password
    const emailResult = await sendPasswordResetEmail(
      trimmedEmail,
      newPassword,
      player.full_name
    )

    if (!emailResult.success) {
      // Log the error but don't fail the request (password is already reset)
      logger.error(`Failed to send password reset email to ${trimmedEmail}:`, emailResult.error)
      // Still return success to user (don't reveal if email exists)
      // But log the password for admin reference if email fails
      logger.warn(`Password reset for ${trimmedEmail}. New password: ${newPassword} (Email sending failed)`)
    }

    // Return success (don't reveal if email exists)
    return sendSuccessResponse(res, {}, 'If the email exists, a new password has been sent')
  })
)

export default router

