/**
 * Captain Routes
 * Handles captain assignment and management using Sports collection
 */

import express from 'express'
import Sport from '../models/Sport.js'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { validateCaptainAssignment, trimObjectFields } from '../utils/validation.js'
import { clearCache } from '../utils/cache.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { findSportByNameAndYear } from '../utils/sportHelpers.js'

const router = express.Router()

/**
 * POST /api/add-captain
 * Add captain role to a player (admin only)
 * Workflow: Admin assigns a player as captain for a sport (makes player eligible to create a team)
 * Year Required: event_year field required in request body (defaults to active year)
 * Update Sports collection's eligible_captains array (add player reg_number for the specified year)
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

    const { reg_number, sport, event_year } = trimmed

    // Get event year (default to active year if not provided)
    const eventYear = await getEventYear(event_year ? parseInt(event_year) : null)

    // Validate player exists
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Find sport by name and event_year
    const sportDoc = await findSportByNameAndYear(sport, eventYear, { lean: false })

    // Validate sport is a team sport
    if (sportDoc.type !== 'dual_team' && sportDoc.type !== 'multi_team') {
      return sendErrorResponse(res, 400, 'Captain assignment is only applicable for team sports (dual_team or multi_team)')
    }

    // Check if already in eligible_captains
    if (sportDoc.eligible_captains && sportDoc.eligible_captains.includes(reg_number)) {
      return sendErrorResponse(res, 400, `Player is already an eligible captain for ${sport}`)
    }

    // Check if player has already created a team for this sport
    const existingTeam = sportDoc.teams_participated.find(
      team => team.captain === reg_number
    )
    if (existingTeam) {
      return sendErrorResponse(res, 400, `Player has already created a team (${existingTeam.team_name}) for ${sport}. Cannot add as eligible captain.`)
    }

    // Add to eligible_captains array
    if (!sportDoc.eligible_captains) {
      sportDoc.eligible_captains = []
    }
    sportDoc.eligible_captains.push(reg_number)
    await sportDoc.save()

    // Clear cache
    clearCache(`/api/sports?year=${eventYear}`)
    clearCache(`/api/sports/${sport}?year=${eventYear}`)

    return sendSuccessResponse(res, { sport: sportDoc }, `Captain added successfully for ${sport}`)
  })
)

/**
 * DELETE /api/remove-captain
 * Remove captain role from a player (admin only)
 * Year Required: event_year field required in request body (defaults to active year)
 * Update Sports collection's eligible_captains array (remove player reg_number for the specified year)
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

    const { reg_number, sport, event_year } = trimmed

    // Get event year (default to active year if not provided)
    const eventYear = await getEventYear(event_year ? parseInt(event_year) : null)

    // Find sport by name and event_year
    const sportDoc = await findSportByNameAndYear(sport, eventYear, { lean: false })

    // Check if player is in eligible_captains
    if (!sportDoc.eligible_captains || !sportDoc.eligible_captains.includes(reg_number)) {
      return sendErrorResponse(res, 400, `Player is not an eligible captain for ${sport}`)
    }

    // Check if player has created a team for this sport
    const existingTeam = sportDoc.teams_participated.find(
      team => team.captain === reg_number
    )
    if (existingTeam) {
      return sendErrorResponse(
        res,
        400,
        `Cannot remove captain role. Player has already created a team (${existingTeam.team_name}) for ${sport}. Please delete the team first.`
      )
    }

    // Remove from eligible_captains array
    sportDoc.eligible_captains = sportDoc.eligible_captains.filter(c => c !== reg_number)
    await sportDoc.save()

    // Clear cache
    clearCache(`/api/sports?year=${eventYear}`)
    clearCache(`/api/sports/${sport}?year=${eventYear}`)

    return sendSuccessResponse(res, { sport: sportDoc }, `Captain role removed successfully for ${sport}`)
  })
)

/**
 * GET /api/captains-by-sport
 * Get all captains grouped by sport (admin only)
 * Year Filter: Accepts ?year=2026 parameter (defaults to active year)
 */
router.get(
  '/captains-by-sport',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    // Get event year (default to active year if not provided)
    const eventYear = await getEventYear(req.query.year ? parseInt(req.query.year) : null)

    // Get all sports with eligible captains for this year
    const sports = await Sport.find({
      event_year: eventYear,
      eligible_captains: { $exists: true, $ne: [] }
    }).lean()

    const captainsBySport = {}

    // Get all unique captain reg_numbers
    const captainRegNumbers = new Set()
    sports.forEach(sport => {
      if (sport.eligible_captains && Array.isArray(sport.eligible_captains)) {
        sport.eligible_captains.forEach(regNumber => {
          captainRegNumbers.add(regNumber)
        })
      }
    })

    // Fetch all captains at once
    const captains = await Player.find({
      reg_number: { $in: Array.from(captainRegNumbers) }
    })
      .select('-password')
      .lean()

    const captainsMap = new Map(captains.map(p => [p.reg_number, p]))

    // Group captains by sport
    sports.forEach(sport => {
      if (sport.eligible_captains && Array.isArray(sport.eligible_captains)) {
        if (!captainsBySport[sport.name]) {
          captainsBySport[sport.name] = []
        }
        sport.eligible_captains.forEach(regNumber => {
          const captain = captainsMap.get(regNumber)
          if (captain) {
            captainsBySport[sport.name].push(captain)
          }
        })
      }
    })

    return sendSuccessResponse(res, { captainsBySport })
  })
)

export default router
