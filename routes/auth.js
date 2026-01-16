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
import { getPlayerBatchName } from '../utils/batchHelpers.js'
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
    let eventId = null
    const cachedActiveYear = getCache('/api/event-years/active')
    if (cachedActiveYear) {
      eventId = cachedActiveYear.event_id || null
    } else {
      const activeYear = await findActiveEventYear()
      if (activeYear) {
        eventId = activeYear.event_id || null
        setCache('/api/event-years/active', activeYear)
      } else {
        eventId = null
      }
    }

    // Compute participation data (allow login even if no active event exists)
    let participation = { participated_in: [], captain_in: [], coordinator_in: [] }
    try {
      participation = await computePlayerParticipation(player.reg_number, eventId)
    } catch (error) {
      if (String(error?.message || '').includes('No active event year found')) {
        participation = { participated_in: [], captain_in: [], coordinator_in: [] }
      } else {
        throw error
      }
    }

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
    playerData.coordinator_in = participation.coordinator_in
    if (eventId) {
      try {
        playerData.batch_name = await getPlayerBatchName(playerData.reg_number, eventId)
      } catch (error) {
        logger.warn(`Could not get batch_name for player ${playerData.reg_number}:`, error)
        playerData.batch_name = null
      }
    } else {
      playerData.batch_name = null
    }

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
    const { reg_number, email_id } = req.body

    if (!reg_number || !reg_number.trim()) {
      return sendErrorResponse(res, 400, 'Registration number is required')
    }

    if (!email_id || !email_id.trim()) {
      return sendErrorResponse(res, 400, 'Email ID is required')
    }

    const trimmedRegNumber = reg_number.trim()
    const trimmedEmail = email_id.trim()

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      return sendErrorResponse(res, 400, 'Invalid email format')
    }

    // Find player by reg_number and email
    const player = await Player.findOne({ reg_number: trimmedRegNumber, email_id: trimmedEmail })
    if (!player) {
      // Don't reveal if reg_number/email exists or not for security
      return sendSuccessResponse(res, {}, 'If the registration number and email match, a new password has been sent')
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

    // Send email with new password
    const emailResult = await sendPasswordResetEmail(
      trimmedEmail,
      newPassword,
      player.full_name
    )

    if (!emailResult.success) {
      // Log the error but don't fail the request (password is already reset)
      logger.error(`Failed to send password reset email to ${trimmedEmail}:`, emailResult.error)
      // Do not update password if email delivery failed
      return sendSuccessResponse(res, {}, 'If the registration number and email match, a new password has been sent')
    }

    // Update player password and set change_password_required flag
    player.password = newPassword
    player.change_password_required = true
    await player.save()

    // Return success (don't reveal if reg_number/email exists)
    return sendSuccessResponse(res, {}, 'If the registration number and email match, a new password has been sent')
  })
)

export default router

