/**
 * Captain Routes
 * Handles captain assignment and management using Sports collection
 */

import express from 'express'
import Sport from '../models/Sport.js'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireRegistrationPeriod } from '../middleware/dateRestrictions.js'
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
 * Event Year Required: event_year field required in request body (defaults to active event year)
 * Update Sports collection's eligible_captains array (add player reg_number for the specified event year)
 */
router.post(
  '/add-captain',
  authenticateToken,
  requireAdmin,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = validateCaptainAssignment(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, sport, event_year, event_name } = trimmed

    // Get event year with document (event_name is now required via validation)
    const eventYearData = await getEventYear(parseInt(event_year), { requireYear: true, returnDoc: true, eventName: event_name.trim() })
    const eventYear = eventYearData.event_year
    const eventName = eventYearData.doc.event_name

    // Validate player exists
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Find sport by name, event_year, and event_name
    const sportDoc = await findSportByNameAndYear(sport, eventYear, eventName, { lean: false })

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
    clearCache(`/api/sports?event_year=${eventYear}`)
    clearCache(`/api/sports/${sport}?event_year=${eventYear}`)

    return sendSuccessResponse(res, { sport: sportDoc }, `Captain added successfully for ${sport}`)
  })
)

/**
 * DELETE /api/remove-captain
 * Remove captain role from a player (admin only)
 * Event Year Required: event_year field required in request body (defaults to active event year)
 * Update Sports collection's eligible_captains array (remove player reg_number for the specified event year)
 */
router.delete(
  '/remove-captain',
  authenticateToken,
  requireAdmin,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = validateCaptainAssignment(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, sport, event_year, event_name } = trimmed

    // Get event year with document (event_name is now required via validation)
    const eventYearData = await getEventYear(parseInt(event_year), { requireYear: true, returnDoc: true, eventName: event_name.trim() })
    const eventYear = eventYearData.event_year
    const eventName = eventYearData.doc.event_name

    // Find sport by name, event_year, and event_name
    const sportDoc = await findSportByNameAndYear(sport, eventYear, eventName, { lean: false })

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
    clearCache(`/api/sports?event_year=${eventYear}`)
    clearCache(`/api/sports/${sport}?event_year=${eventYear}`)

    return sendSuccessResponse(res, { sport: sportDoc }, `Captain role removed successfully for ${sport}`)
  })
)

/**
 * GET /api/captains-by-sport
 * Get all captains grouped by sport (admin only)
 * Event Year Filter: Accepts ?event_year=2026 parameter (defaults to active event year)
 */
router.get(
  '/captains-by-sport',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    // For optional event_year/event_name: either both must be provided, or neither
    // If one is provided, the other is also required for composite key filtering
    const hasEventYear = req.query.event_year !== undefined && req.query.event_year !== null && req.query.event_year !== ''
    const hasEventName = req.query.event_name !== undefined && req.query.event_name !== null && req.query.event_name !== '' && req.query.event_name.trim()
    
    if (hasEventYear && !hasEventName) {
      return sendErrorResponse(res, 400, 'event_name is required when event_year is provided')
    }
    if (hasEventName && !hasEventYear) {
      return sendErrorResponse(res, 400, 'event_year is required when event_name is provided')
    }
    
    let eventYearData
    
    try {
      // Try to get event year with document - if it doesn't exist, return empty object
      // Extract event_name from query if provided for composite key filtering
      const eventNameQuery = hasEventName ? req.query.event_name.trim() : null
      eventYearData = await getEventYear(hasEventYear ? parseInt(req.query.event_year) : null, { returnDoc: true, eventName: eventNameQuery })
    } catch (error) {
      // If event year not found, return empty object instead of error
      if (error.message === 'Event year not found' || error.message === 'No active event year found') {
        return sendSuccessResponse(res, { captainsBySport: {} })
      }
      // Re-throw other errors to be handled by asyncHandler
      throw error
    }

    const eventYear = eventYearData.event_year
    const eventName = eventYearData.doc.event_name

    // Get all sports with eligible captains for this event year and event name
    const sports = await Sport.find({
      event_year: eventYear,
      event_name: eventName,
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

    // Fetch all captains at once (only if there are any)
    if (captainRegNumbers.size > 0) {
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
    }

    return sendSuccessResponse(res, { captainsBySport })
  })
)

export default router
