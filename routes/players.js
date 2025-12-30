/**
 * Player Routes
 * Handles player data operations with computed participation fields
 */

import express from 'express'
import Player from '../models/Player.js'
import EventYear from '../models/EventYear.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { validateUpdatePlayerData, validatePlayerData, trimObjectFields } from '../utils/validation.js'
import { computePlayerParticipation, computeYearDisplay, canParticipateInEvents, validateDepartmentExists } from '../utils/playerHelpers.js'
import { getCache, setCache, clearCache } from '../utils/cache.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * Helper function to add computed fields to player data
 */
async function addComputedFields(player, eventYear = null) {
  const playerObj = player.toObject ? player.toObject() : player
  
  // Compute participation data
  const participation = await computePlayerParticipation(playerObj.reg_number, eventYear)
  playerObj.participated_in = participation.participated_in
  playerObj.captain_in = participation.captain_in
  
  // Compute year display format
  if (playerObj.year_of_admission) {
    const currentYear = eventYear || new Date().getFullYear()
    playerObj.year = computeYearDisplay(playerObj.year_of_admission, currentYear)
  }
  
  return playerObj
}

/**
 * GET /api/me
 * Get current authenticated user data
 * Add computed participated_in, captain_in, and year fields (filtered by active year or provided year)
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    let eventYear = req.query.year ? parseInt(req.query.year) : null

    // Get event year (default to active year if not provided)
    if (!eventYear) {
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
    }

    // Check cache
    const cacheKey = `/api/me?year=${eventYear}`
    const cached = getCache(cacheKey)
    if (cached && cached.reg_number === req.user.reg_number) {
      return res.json(cached)
    }

    const user = await Player.findOne({ reg_number: req.user.reg_number })
      .select('-password')

    if (!user) {
      return handleNotFoundError(res, 'User')
    }

    // Add computed fields
    const userWithComputed = await addComputedFields(user, eventYear)

    // Cache the result
    setCache(cacheKey, userWithComputed)

    return sendSuccessResponse(res, { player: userWithComputed })
  })
)

/**
 * GET /api/players
 * Get all players (requires authentication)
 * Add computed participated_in, captain_in, and year fields (filtered by active year or provided year)
 */
router.get(
  '/players',
  authenticateToken,
  asyncHandler(async (req, res) => {
    let eventYear = req.query.year ? parseInt(req.query.year) : null

    // Get event year (default to active year if not provided)
    if (!eventYear) {
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
    }

    // Check cache
    const cacheKey = `/api/players?year=${eventYear}`
    const cached = getCache(cacheKey)
    if (cached) {
      return res.json(cached)
    }

    const players = await Player.find({ reg_number: { $ne: 'admin' } })
      .select('-password')
      .lean()

    // Add computed fields to all players
    const playersWithComputed = await Promise.all(
      players.map(player => addComputedFields(player, eventYear))
    )

    const result = { players: playersWithComputed }

    // Cache the result
    setCache(cacheKey, result)

    return sendSuccessResponse(res, result)
  })
)

/**
 * POST /api/save-player
 * Register a new player (no authentication required)
 * Update to accept year_of_admission instead of year
 * Validate department exists and is active
 * Validate participation eligibility (1st to 5th year only)
 */
router.post(
  '/save-player',
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    
    // Convert year to year_of_admission if provided (for backward compatibility during transition)
    if (trimmed.year && !trimmed.year_of_admission) {
      // Try to extract year from formatted string like "1st Year (2025)"
      const yearMatch = trimmed.year.match(/\((\d{4})\)/)
      if (yearMatch) {
        trimmed.year_of_admission = parseInt(yearMatch[1])
      }
    }

    const validation = await validatePlayerData(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, year_of_admission } = trimmed

    // Check if player with same reg_number already exists
    const existingPlayer = await Player.findOne({ reg_number })
    if (existingPlayer) {
      return sendErrorResponse(res, 409, 'Registration number already exists. Please use a different registration number.', {
        code: 'DUPLICATE_REG_NUMBER',
      })
    }

    // Validate department exists
    const deptValidation = await validateDepartmentExists(trimmed.department_branch)
    if (!deptValidation.exists) {
      return sendErrorResponse(res, 400, `Department "${trimmed.department_branch}" does not exist`)
    }

    // Validate participation eligibility
    if (!canParticipateInEvents(year_of_admission)) {
      return sendErrorResponse(
        res,
        400,
        'Only 1st to 5th year students can register and participate in events'
      )
    }

    // Create new player object (remove year field, use year_of_admission)
    const { year, ...playerData } = trimmed
    const newPlayer = new Player({
      ...playerData,
      year_of_admission: parseInt(year_of_admission)
    })

    await newPlayer.save()

    const savedPlayer = newPlayer.toObject()
    delete savedPlayer.password

    // Clear cache
    clearCache('/api/players')

    return sendSuccessResponse(res, { player: savedPlayer }, 'Player data saved successfully')
  })
)

/**
 * POST /api/save-players
 * Register multiple players (for team events) (no authentication required)
 * Updated to use year_of_admission
 */
router.post(
  '/save-players',
  asyncHandler(async (req, res) => {
    let { players } = req.body

    if (!Array.isArray(players) || players.length === 0) {
      return sendErrorResponse(res, 400, 'Invalid players data')
    }

    // Validate and trim each player
    const errors = []
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      const trimmed = trimObjectFields(player)
      
      // Convert year to year_of_admission if provided
      if (trimmed.year && !trimmed.year_of_admission) {
        const yearMatch = trimmed.year.match(/\((\d{4})\)/)
        if (yearMatch) {
          trimmed.year_of_admission = parseInt(yearMatch[1])
        }
      }

      const validation = await validatePlayerData(trimmed)

      if (!validation.isValid) {
        errors.push(`Player ${i + 1}: ${validation.errors.join('; ')}`)
      } else {
        players[i] = trimmed
      }
    }

    if (errors.length > 0) {
      return sendErrorResponse(res, 400, errors.join(' | '))
    }

    // Check for duplicates within the incoming array
    const regNumbers = new Set()
    for (const player of players) {
      if (regNumbers.has(player.reg_number)) {
        return sendErrorResponse(res, 409, `Duplicate registration number found in the provided data: ${player.reg_number}`, {
          code: 'DUPLICATE_REG_NUMBER',
        })
      }
      regNumbers.add(player.reg_number)
    }

    // Check for duplicates against existing players
    const incomingRegNumbers = players.map((p) => p.reg_number)
    const existingPlayers = await Player.find({ reg_number: { $in: incomingRegNumbers } })
    if (existingPlayers.length > 0) {
      const existingRegNumbers = existingPlayers.map((p) => p.reg_number)
      return sendErrorResponse(res, 409, `Registration number(s) already exist: ${existingRegNumbers.join(', ')}`, {
        code: 'DUPLICATE_REG_NUMBER',
      })
    }

    // Create player documents (remove year field, use year_of_admission)
    const playerDocuments = players.map((player) => {
      const { year, ...playerData } = player
      return {
        ...playerData,
        year_of_admission: parseInt(player.year_of_admission)
      }
    })

    // Add new players to database
    await Player.insertMany(playerDocuments)

    // Clear cache
    clearCache('/api/players')

    return sendSuccessResponse(res, { count: players.length }, `${players.length} player(s) saved successfully`)
  })
)

/**
 * PUT /api/update-player
 * Update player data (admin only)
 * Update to accept year_of_admission instead of year
 * year_of_admission cannot be modified
 * Validate department exists and is active
 */
router.put(
  '/update-player',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = await validateUpdatePlayerData(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, full_name, department_branch, mobile_number, email_id, gender, year_of_admission } = trimmed

    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Check if gender is being changed (not allowed)
    if (player.gender !== gender) {
      return sendErrorResponse(res, 400, 'Gender cannot be modified. Please keep the original gender value.')
    }

    // Check if year_of_admission is being changed (not allowed)
    if (year_of_admission !== undefined && year_of_admission !== null) {
      const newYearOfAdmission = parseInt(year_of_admission)
      if (!isNaN(newYearOfAdmission) && player.year_of_admission !== newYearOfAdmission) {
        return sendErrorResponse(res, 400, 'Year of admission cannot be modified. Please keep the original year of admission value.')
      }
    }

    // Validate department exists
    const deptValidation = await validateDepartmentExists(department_branch)
    if (!deptValidation.exists) {
      return sendErrorResponse(res, 400, `Department "${department_branch}" does not exist`)
    }

    // Update allowed fields
    player.full_name = full_name
    player.department_branch = department_branch
    player.mobile_number = mobile_number
    player.email_id = email_id

    await player.save()

    const playerData = player.toObject()
    delete playerData.password

    // Clear cache
    clearCache('/api/players')
    clearCache(`/api/me?year=${new Date().getFullYear()}`)

    return sendSuccessResponse(res, { player: playerData }, 'Player data updated successfully')
  })
)

export default router
