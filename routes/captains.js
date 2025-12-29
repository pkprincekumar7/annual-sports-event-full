/**
 * Captain Routes
 * Handles captain assignment and management
 */

import express from 'express'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { validateCaptainAssignment, trimObjectFields } from '../utils/validation.js'
import { TEAM_SPORTS, MAX_CAPTAIN_ROLES, MAX_PARTICIPATIONS, ADMIN_REG_NUMBER } from '../constants/index.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * POST /api/add-captain
 * Add captain role to a player (admin only)
 */
router.post(
  '/add-captain',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = validateCaptainAssignment(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, sport } = trimmed

    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Initialize arrays if they don't exist
    if (!player.captain_in) {
      player.captain_in = []
    }
    if (!player.participated_in) {
      player.participated_in = []
    }

    // Check if already a captain for this sport
    if (player.captain_in.includes(sport)) {
      return sendErrorResponse(res, 400, `Player is already a captain for ${sport}`)
    }

    // Check for duplicate elements in captain_in array
    const captainInSet = new Set(player.captain_in)
    if (captainInSet.size !== player.captain_in.length) {
      return sendErrorResponse(res, 400, 'captain_in array contains duplicate entries. Please fix the data first.')
    }

    // Check maximum limit: captain_in array can have maximum 10 unique entries
    const currentCaptainCount = player.captain_in.length
    if (currentCaptainCount >= MAX_CAPTAIN_ROLES) {
      return sendErrorResponse(
        res,
        400,
        `Maximum ${MAX_CAPTAIN_ROLES} captain roles allowed. Please remove a captain assignment first.`
      )
    }

    // Check for duplicate sport entries in participated_in array
    const sportSet = new Set(player.participated_in.map((p) => p.sport))
    if (sportSet.size !== player.participated_in.length) {
      return sendErrorResponse(
        res,
        400,
        'participated_in array contains duplicate sport entries. Please fix the data first.'
      )
    }

    // Check maximum limit: participated_in array can have maximum 10 unique entries
    const currentParticipationsCount = player.participated_in.length
    if (currentParticipationsCount >= MAX_PARTICIPATIONS) {
      return sendErrorResponse(
        res,
        400,
        `Maximum ${MAX_PARTICIPATIONS} participations allowed (based on unique sport names). Please remove a participation first.`
      )
    }

    // Count non-team participations
    const nonTeamParticipations = player.participated_in.filter((p) => !p.team_name).length

    // Count team participations where sport IS in captain_in array
    const captainTeamParticipations = player.participated_in.filter(
      (p) =>
        p.team_name &&
        player.captain_in &&
        Array.isArray(player.captain_in) &&
        player.captain_in.includes(p.sport)
    ).length

    // Check: (captain_in length + non-team participated_in) should not exceed 10
    if (currentCaptainCount + nonTeamParticipations >= MAX_PARTICIPATIONS) {
      return sendErrorResponse(
        res,
        400,
        `Cannot add captain role. Total (captain roles + non-team participations) cannot exceed ${MAX_PARTICIPATIONS}. Current: ${currentCaptainCount} captain role(s) + ${nonTeamParticipations} non-team participation(s) = ${currentCaptainCount + nonTeamParticipations}.`
      )
    }

    // Check: team participations (for captain sports) should not exceed captain_in length
    if (captainTeamParticipations >= currentCaptainCount + 1) {
      return sendErrorResponse(
        res,
        400,
        `Cannot add captain role. Maximum team participations allowed for sports in captain_in array is ${currentCaptainCount + 1} (equal to captain roles). Current team participations for captain sports: ${captainTeamParticipations}.`
      )
    }

    // Check if player is already a participant in a team for this sport
    const existingTeamParticipation = player.participated_in.find((p) => p.sport === sport && p.team_name)

    if (existingTeamParticipation) {
      const isAlreadyCaptain =
        player.captain_in && Array.isArray(player.captain_in) && player.captain_in.includes(sport)

      if (!isAlreadyCaptain) {
        return sendErrorResponse(
          res,
          400,
          `Cannot add captain role. Player is already in team "${existingTeamParticipation.team_name}" for ${sport}, which already has a captain. A team can only have one captain.`
        )
      }
    }

    // Add sport to captain_in array
    player.captain_in.push(sport)
    await player.save()

    const playerData = player.toObject()
    delete playerData.password

    return sendSuccessResponse(res, { player: playerData }, `Captain added successfully for ${sport}`)
  })
)

/**
 * DELETE /api/remove-captain
 * Remove captain role from a player (admin only)
 */
router.delete(
  '/remove-captain',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = validateCaptainAssignment(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, sport } = trimmed

    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Initialize captain_in array if it doesn't exist
    if (!player.captain_in) {
      player.captain_in = []
    }

    // Check if player is a captain for this sport
    if (!player.captain_in.includes(sport)) {
      return sendErrorResponse(res, 400, `Player is not a captain for ${sport}`)
    }

    // Check if player has created a team for this sport
    if (player.participated_in && Array.isArray(player.participated_in)) {
      const teamParticipation = player.participated_in.find((p) => p.sport === sport && p.team_name)

      if (teamParticipation) {
        return sendErrorResponse(
          res,
          400,
          `Cannot remove captain role. Player has already created a team (${teamParticipation.team_name}) for ${sport}. Please delete the team first.`
        )
      }
    }

    // Remove sport from captain_in array
    player.captain_in = player.captain_in.filter((s) => s !== sport)
    await player.save()

    const playerData = player.toObject()
    delete playerData.password

    return sendSuccessResponse(res, { player: playerData }, `Captain role removed successfully for ${sport}`)
  })
)

/**
 * GET /api/captains-by-sport
 * Get all captains grouped by sport (admin only)
 */
router.get(
  '/captains-by-sport',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    // Query directly for players who are captains
    const captains = await Player.find({
      reg_number: { $ne: ADMIN_REG_NUMBER },
      captain_in: { $exists: true, $ne: [] },
    })
      .select('-password')
      .lean()

    // Group captains by sport
    const captainsBySport = {}

    // Initialize all team sports
    TEAM_SPORTS.forEach((sport) => {
      captainsBySport[sport] = []
    })

    // Group captains by sport
    captains.forEach((player) => {
      if (player.captain_in && Array.isArray(player.captain_in)) {
        player.captain_in.forEach((sport) => {
          if (TEAM_SPORTS.includes(sport)) {
            if (!captainsBySport[sport]) {
              captainsBySport[sport] = []
            }
            const { password: _, ...playerData } = player
            captainsBySport[sport].push(playerData)
          }
        })
      }
    })

    return sendSuccessResponse(res, { captainsBySport })
  })
)

export default router

