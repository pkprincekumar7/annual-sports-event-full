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
import { computePlayerParticipation, computeYearDisplay } from '../utils/playerHelpers.js'
import { getCache, setCache } from '../utils/cache.js'
import { JWT_EXPIRES_IN } from '../constants/index.js'

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
      eventYear = cachedActiveYear.year
    } else {
      const activeYear = await EventYear.findOne({ is_active: true }).lean()
      if (activeYear) {
        eventYear = activeYear.year
        setCache('/api/event-years/active', activeYear)
      } else {
        eventYear = new Date().getFullYear()
      }
    }

    // Compute participation data
    const participation = await computePlayerParticipation(player.reg_number, eventYear)
    
    // Compute year display format
    let yearDisplay = null
    if (player.year_of_admission) {
      yearDisplay = computeYearDisplay(player.year_of_admission, eventYear)
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
    playerData.year = yearDisplay

    return sendSuccessResponse(
      res,
      {
        player: playerData,
        token,
      },
      'Login successful'
    )
  })
)

export default router

