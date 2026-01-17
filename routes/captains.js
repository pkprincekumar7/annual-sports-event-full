/**
 * Captain Routes
 * Handles captain assignment and management using Sports collection
 */

import express from 'express'
import Sport from '../models/Sport.js'
import Player from '../models/Player.js'
import { authenticateToken } from '../middleware/auth.js'
import { requireRegistrationPeriod } from '../middleware/dateRestrictions.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { validateCaptainAssignment, trimObjectFields } from '../utils/validation.js'
import { clearCache, clearCachePattern } from '../utils/cache.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { findSportByNameAndId } from '../utils/sportHelpers.js'
import { computePlayersParticipationBatch } from '../utils/playerHelpers.js'
import { ADMIN_REG_NUMBER } from '../constants/index.js'

const router = express.Router()

/**
 * POST /api/add-captain
 * Add captain role to a player (admin or coordinator)
 * Workflow: Admin or coordinator assigns a player as captain for a sport (makes player eligible to create a team)
 * Event ID Required: event_id field required in request body (defaults to active event)
 * Update Sports collection's eligible_captains array (add player reg_number for the specified event year)
 */
router.post(
  '/add-captain',
  authenticateToken,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = validateCaptainAssignment(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, sport, event_id } = trimmed

    // Get event with document
    const eventYearData = await getEventYear(String(event_id).trim(), { requireId: true, returnDoc: true })
    const eventId = eventYearData.doc.event_id

    // Validate player exists
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Find sport by name and event_id
    const sportDoc = await findSportByNameAndId(sport, eventId, { lean: false })

    // Allow admin or coordinator for this sport
    const isAdmin = req.user?.reg_number === ADMIN_REG_NUMBER
    if (!isAdmin) {
      const coordinators = sportDoc.eligible_coordinators || []
      if (!coordinators.includes(req.user?.reg_number)) {
        return sendErrorResponse(res, 403, 'Admin or coordinator access required for this sport')
      }
    }

    // Captains cannot be coordinators for the same sport
    if (sportDoc.eligible_coordinators && sportDoc.eligible_coordinators.includes(reg_number)) {
      return sendErrorResponse(res, 400, `Player is already a coordinator for ${sport} and cannot be assigned as captain.`)
    }

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
    clearCache(`/api/sports?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCachePattern('/api/players')
    clearCachePattern('/api/me')

    return sendSuccessResponse(res, { sport: sportDoc }, `Captain added successfully for ${sport}`)
  })
)

/**
 * DELETE /api/remove-captain
 * Remove captain role from a player (admin or coordinator)
 * Event ID Required: event_id field required in request body (defaults to active event)
 * Update Sports collection's eligible_captains array (remove player reg_number for the specified event year)
 */
router.delete(
  '/remove-captain',
  authenticateToken,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = validateCaptainAssignment(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, sport, event_id } = trimmed

    // Get event with document
    const eventYearData = await getEventYear(String(event_id).trim(), { requireId: true, returnDoc: true })
    const eventId = eventYearData.doc.event_id

    // Find sport by name and event_id
    const sportDoc = await findSportByNameAndId(sport, eventId, { lean: false })

    // Allow admin or coordinator for this sport
    const isAdmin = req.user?.reg_number === ADMIN_REG_NUMBER
    if (!isAdmin) {
      const coordinators = sportDoc.eligible_coordinators || []
      if (!coordinators.includes(req.user?.reg_number)) {
        return sendErrorResponse(res, 403, 'Admin or coordinator access required for this sport')
      }
    }

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
    clearCache(`/api/sports?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCachePattern('/api/players')
    clearCachePattern('/api/me')

    return sendSuccessResponse(res, { sport: sportDoc }, `Captain role removed successfully for ${sport}`)
  })
)

/**
 * GET /api/captains-by-sport
 * Get all captains grouped by sport (admin or coordinator)
 * Event ID Filter: Accepts ?event_id=2026-umang parameter (defaults to active event)
 */
router.get(
  '/captains-by-sport',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
    
    let eventYearData
    
    try {
      // Try to get event year with document - if it doesn't exist, return empty object
      eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
    } catch (error) {
      // If event year not found, return empty object instead of error
      if (error.message === 'Event year not found' || error.message === 'No active event year found') {
        return sendSuccessResponse(res, { captainsBySport: {} })
      }
      // Re-throw other errors to be handled by asyncHandler
      throw error
    }

    const eventId = eventYearData.doc.event_id

    const isAdmin = req.user?.reg_number === ADMIN_REG_NUMBER
    const sportsQuery = {
      event_id: eventId,
      eligible_captains: { $exists: true, $ne: [] }
    }
    if (!isAdmin) {
      sportsQuery.eligible_coordinators = req.user?.reg_number
    }

    // Get all sports with eligible captains for this event
    const sports = await Sport.find(sportsQuery).lean()

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

      // OPTIMIZATION: Batch compute participation for all captains in one query
      const participationMap = await computePlayersParticipationBatch(Array.from(captainRegNumbers), eventId)

      // Add computed fields to each captain
      const captainsWithComputed = captains.map(captain => {
        const captainObj = { ...captain }
        const participation = participationMap[captain.reg_number] || { participated_in: [], captain_in: [], coordinator_in: [] }
        captainObj.participated_in = participation.participated_in
        captainObj.captain_in = participation.captain_in
        captainObj.coordinator_in = participation.coordinator_in
        return captainObj
      })

      const captainsMap = new Map(captainsWithComputed.map(p => [p.reg_number, p]))

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
