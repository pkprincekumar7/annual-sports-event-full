/**
 * Participant Routes
 * Handles participant management operations
 */

import express from 'express'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { trimObjectFields } from '../utils/validation.js'
import { TEAM_SPORTS, MAX_PARTICIPATIONS, ADMIN_REG_NUMBER } from '../constants/index.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * GET /api/participants/:sport
 * Get all participants for a specific sport (non-team events) (admin only)
 */
router.get(
  '/participants/:sport',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    // Decode the sport name from URL parameter
    let sport = decodeURIComponent(req.params.sport)
    logger.api('Received request for participants - sport:', sport)

    if (!sport) {
      return sendErrorResponse(res, 400, 'Sport name is required')
    }

    // Query directly for players who have participated in this sport without team_name
    const players = await Player.find({
      reg_number: { $ne: ADMIN_REG_NUMBER },
      participated_in: {
        $elemMatch: {
          sport: sport,
          $or: [{ team_name: { $exists: false } }, { team_name: null }, { team_name: '' }],
        },
      },
    })
      .select('-password')
      .lean()

    // Map to participants (excluding password)
    const participants = players.map((player) => {
      const { password: _, ...playerData } = player
      return playerData
    })

    // Sort participants by name
    participants.sort((a, b) => a.full_name.localeCompare(b.full_name))

    return sendSuccessResponse(res, {
      sport: sport,
      participants: participants,
      total_participants: participants.length,
    })
  })
)

/**
 * GET /api/participants-count/:sport
 * Get total participants count for a specific sport (non-team events)
 */
router.get(
  '/participants-count/:sport',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Decode the sport name from URL parameter
    let sport = decodeURIComponent(req.params.sport)
    logger.api('Received request for participants count - sport:', sport)

    if (!sport) {
      return sendErrorResponse(res, 400, 'Sport name is required')
    }

    // Count players who have participated in this sport without team_name
    const result = await Player.aggregate([
      {
        $match: {
          reg_number: { $ne: ADMIN_REG_NUMBER },
        },
      },
      {
        $unwind: '$participated_in',
      },
      {
        $match: {
          'participated_in.sport': sport,
          $or: [
            { 'participated_in.team_name': { $exists: false } },
            { 'participated_in.team_name': null },
            { 'participated_in.team_name': '' },
          ],
        },
      },
      {
        $count: 'total',
      },
    ])

    const count = result.length > 0 ? result[0].total : 0

    logger.api(`Participants count for ${sport}: ${count}`)

    return sendSuccessResponse(res, {
      sport: sport,
      total_participants: count,
    })
  })
)

/**
 * POST /api/update-participation
 * Update participated_in field for individual events
 */
router.post(
  '/update-participation',
  authenticateToken,
  asyncHandler(async (req, res) => {
    let { reg_number, sport } = req.body

    // Trim fields
    const trimmed = trimObjectFields({ reg_number, sport })
    reg_number = trimmed.reg_number
    sport = trimmed.sport

    // Validate required fields
    if (!reg_number || !sport) {
      return sendErrorResponse(res, 400, 'Registration number and sport are required')
    }

    // Check if the sport is a Team Event (individual registration not allowed)
    if (TEAM_SPORTS.includes(sport)) {
      return sendErrorResponse(
        res,
        400,
        `${sport} is a Team Event. Individual registration is not allowed. Please register as a team.`
      )
    }

    // Find player
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Initialize participated_in array if it doesn't exist
    if (!player.participated_in) {
      player.participated_in = []
    }

    // Check for duplicate sport entries
    const sportSet = new Set(player.participated_in.map((p) => p.sport))
    if (sportSet.size !== player.participated_in.length) {
      return sendErrorResponse(
        res,
        400,
        'participated_in array contains duplicate sport entries. Please fix the data first.'
      )
    }

    // Check maximum limit
    const currentParticipationsCount = player.participated_in.length
    if (currentParticipationsCount >= MAX_PARTICIPATIONS) {
      return sendErrorResponse(
        res,
        400,
        `Maximum ${MAX_PARTICIPATIONS} participations allowed (based on unique sport names). Please remove a participation first.`
      )
    }

    // Check if already participated in this sport
    const existingParticipation = player.participated_in.find((p) => p.sport === sport)

    if (existingParticipation) {
      return sendErrorResponse(
        res,
        400,
        `You are already registered for ${sport}. Same sport cannot be participated twice.`
      )
    }

    // Count non-team participations
    const nonTeamParticipations = player.participated_in.filter((p) => !p.team_name).length

    // Get captain count
    const captainCount = player.captain_in && Array.isArray(player.captain_in) ? player.captain_in.length : 0

    // Check maximum limit: (captain_in length + non-team participated_in) should not exceed 10
    if (captainCount + nonTeamParticipations >= MAX_PARTICIPATIONS) {
      const remainingSlots = MAX_PARTICIPATIONS - captainCount
      if (remainingSlots <= 0) {
        return sendErrorResponse(
          res,
          400,
          `Maximum limit reached. You are a captain in ${captainCount} sport(s). You cannot register for any non-team events. Total (captain roles + non-team participations) cannot exceed ${MAX_PARTICIPATIONS}.`
        )
      } else {
        return sendErrorResponse(
          res,
          400,
          `Maximum limit reached. You are a captain in ${captainCount} sport(s) and have ${nonTeamParticipations} non-team participation(s). You can only register for ${remainingSlots} more non-team event(s). Total (captain roles + non-team participations) cannot exceed ${MAX_PARTICIPATIONS}.`
        )
      }
    }

    // Add sport to participated_in array (without team_name for individual events)
    player.participated_in.push({ sport })
    await player.save()

    // Return player data (excluding password for security)
    const playerData = player.toObject()
    delete playerData.password

    return sendSuccessResponse(res, { player: playerData }, `Participation updated successfully for ${sport}`)
  })
)

/**
 * DELETE /api/remove-participation
 * Remove participation for non-team events (admin only)
 */
router.delete(
  '/remove-participation',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    let { reg_number, sport } = req.body

    // Trim fields
    const trimmed = trimObjectFields({ reg_number, sport })
    reg_number = trimmed.reg_number
    sport = trimmed.sport

    // Validate required fields
    if (!reg_number || !sport) {
      return sendErrorResponse(res, 400, 'Registration number and sport are required')
    }

    // Find player
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Initialize participated_in array if it doesn't exist
    if (!player.participated_in) {
      player.participated_in = []
    }

    // Find the participation entry for this sport (non-team event - no team_name)
    const participationIndex = player.participated_in.findIndex((p) => p.sport === sport && !p.team_name)

    if (participationIndex === -1) {
      return sendErrorResponse(res, 404, `Player is not registered for ${sport} as a non-team event`)
    }

    // Remove the participation entry
    player.participated_in.splice(participationIndex, 1)
    await player.save()

    // Return player data (excluding password for security)
    const playerData = player.toObject()
    delete playerData.password

    return sendSuccessResponse(res, { player: playerData }, `Participation removed successfully for ${sport}`)
  })
)

export default router

