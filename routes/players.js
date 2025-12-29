/**
 * Player Routes
 * Handles player data operations
 */

import express from 'express'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { validateUpdatePlayerData, validatePlayerData, trimObjectFields } from '../utils/validation.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * GET /api/me
 * Get current authenticated user data
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await Player.findOne({ reg_number: req.user.reg_number })
      .select('-password')
      .lean()

    if (!user) {
      return handleNotFoundError(res, 'User')
    }

    return sendSuccessResponse(res, { player: user })
  })
)

/**
 * GET /api/players
 * Get all players (requires authentication)
 */
router.get(
  '/players',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const players = await Player.find({}).select('-password').lean()
    return sendSuccessResponse(res, { players })
  })
)

/**
 * POST /api/save-player
 * Register a new player (no authentication required)
 */
router.post(
  '/save-player',
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = validatePlayerData(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number } = trimmed

    // Check if player with same reg_number already exists
    const existingPlayer = await Player.findOne({ reg_number })
    if (existingPlayer) {
      return sendErrorResponse(res, 409, 'Registration number already exists. Please use a different registration number.', {
        code: 'DUPLICATE_REG_NUMBER',
      })
    }

    // Create new player object
    const newPlayer = new Player({
      ...trimmed,
      participated_in: [],
      captain_in: [],
    })

    await newPlayer.save()

    const playerData = newPlayer.toObject()
    delete playerData.password

    return sendSuccessResponse(res, { player: playerData }, 'Player data saved successfully')
  })
)

/**
 * POST /api/save-players
 * Register multiple players (for team events) (no authentication required)
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
      const validation = validatePlayerData(trimmed)

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

    // Create player documents
    const playerDocuments = players.map((player) => ({
      ...player,
      participated_in: [],
      captain_in: [],
    }))

    // Add new players to database
    await Player.insertMany(playerDocuments)

    return sendSuccessResponse(res, { count: players.length }, `${players.length} player(s) saved successfully`)
  })
)

/**
 * PUT /api/update-player
 * Update player data (admin only)
 */
router.put(
  '/update-player',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = validateUpdatePlayerData(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, full_name, department_branch, mobile_number, email_id, gender, year } = trimmed

    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Check if gender or year is being changed (not allowed)
    if (player.gender !== gender) {
      return sendErrorResponse(res, 400, 'Gender cannot be modified. Please keep the original gender value.')
    }

    if (player.year !== year) {
      return sendErrorResponse(res, 400, 'Year cannot be modified. Please keep the original year value.')
    }

    // Update allowed fields
    player.full_name = full_name
    player.department_branch = department_branch
    player.mobile_number = mobile_number
    player.email_id = email_id

    await player.save()

    const playerData = player.toObject()
    delete playerData.password

    return sendSuccessResponse(res, { player: playerData }, 'Player data updated successfully')
  })
)

export default router

