/**
 * Coordinator Routes
 * Handles coordinator assignment and management using Sports collection
 */

import express from 'express'
import Sport from '../models/Sport.js'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireRegistrationPeriod } from '../middleware/dateRestrictions.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { validateCaptainAssignment, trimObjectFields } from '../utils/validation.js'
import { clearCache, clearCachePattern } from '../utils/cache.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { findSportByNameAndId } from '../utils/sportHelpers.js'
import { computePlayersParticipationBatch } from '../utils/playerHelpers.js'

const router = express.Router()

/**
 * POST /api/add-coordinator
 * Add coordinator role to a player (admin only)
 * Workflow: Admin assigns a player as coordinator for a sport
 * Event ID Required: event_id field required in request body (defaults to active event)
 * Update Sports collection's eligible_coordinators array (add player reg_number for the specified event year)
 */
router.post(
  '/add-coordinator',
  authenticateToken,
  requireAdmin,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = validateCaptainAssignment(trimmed) // Reuse same validation

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

    // Coordinators cannot be captains or participants for the same sport
    const isEligibleCaptain = sportDoc.eligible_captains && sportDoc.eligible_captains.includes(reg_number)
    const isTeamCaptain = (sportDoc.teams_participated || []).some(team => team.captain === reg_number)
    const isTeamPlayer = (sportDoc.teams_participated || []).some(
      team => Array.isArray(team.players) && team.players.includes(reg_number)
    )
    const isIndividualParticipant = (sportDoc.players_participated || []).includes(reg_number)
    if (isEligibleCaptain || isTeamCaptain || isTeamPlayer || isIndividualParticipant) {
      return sendErrorResponse(
        res,
        400,
        `Player cannot be assigned as coordinator for ${sport} because they already participate in that sport.`
      )
    }

    // Check if already in eligible_coordinators
    if (sportDoc.eligible_coordinators && sportDoc.eligible_coordinators.includes(reg_number)) {
      return sendErrorResponse(res, 400, `Player is already a coordinator for ${sport}`)
    }

    // Add to eligible_coordinators array
    if (!sportDoc.eligible_coordinators) {
      sportDoc.eligible_coordinators = []
    }
    sportDoc.eligible_coordinators.push(reg_number)
    await sportDoc.save()

    // Clear cache
    clearCache(`/api/sports?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCachePattern('/api/players')
    clearCachePattern('/api/me')

    return sendSuccessResponse(res, { sport: sportDoc }, `Coordinator added successfully for ${sport}`)
  })
)

/**
 * DELETE /api/remove-coordinator
 * Remove coordinator role from a player (admin only)
 * Event ID Required: event_id field required in request body (defaults to active event)
 * Update Sports collection's eligible_coordinators array (remove player reg_number for the specified event year)
 */
router.delete(
  '/remove-coordinator',
  authenticateToken,
  requireAdmin,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = validateCaptainAssignment(trimmed) // Reuse same validation

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, sport, event_id } = trimmed

    // Get event with document
    const eventYearData = await getEventYear(String(event_id).trim(), { requireId: true, returnDoc: true })
    const eventId = eventYearData.doc.event_id

    // Find sport by name and event_id
    const sportDoc = await findSportByNameAndId(sport, eventId, { lean: false })

    // Check if player is in eligible_coordinators
    if (!sportDoc.eligible_coordinators || !sportDoc.eligible_coordinators.includes(reg_number)) {
      return sendErrorResponse(res, 400, `Player is not a coordinator for ${sport}`)
    }

    // Remove from eligible_coordinators array
    sportDoc.eligible_coordinators = sportDoc.eligible_coordinators.filter(c => c !== reg_number)
    await sportDoc.save()

    // Clear cache
    clearCache(`/api/sports?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCachePattern('/api/players')
    clearCachePattern('/api/me')

    return sendSuccessResponse(res, { sport: sportDoc }, `Coordinator role removed successfully for ${sport}`)
  })
)

/**
 * GET /api/coordinators-by-sport
 * Get all coordinators grouped by sport (admin only)
 * Event ID Filter: Accepts ?event_id=2026-umang parameter (defaults to active event)
 */
router.get(
  '/coordinators-by-sport',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
    
    let eventYearData
    
    try {
      // Try to get event year with document - if it doesn't exist, return empty object
      eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
    } catch (error) {
      // If event year not found, return empty object instead of error
      if (error.message === 'Event year not found' || error.message === 'No active event year found') {
        return sendSuccessResponse(res, { coordinatorsBySport: {} })
      }
      // Re-throw other errors to be handled by asyncHandler
      throw error
    }

    const eventId = eventYearData.doc.event_id

    // Get all sports with eligible coordinators for this event
    const sports = await Sport.find({
      event_id: eventId,
      eligible_coordinators: { $exists: true, $ne: [] }
    }).lean()

    const coordinatorsBySport = {}

    // Get all unique coordinator reg_numbers
    const coordinatorRegNumbers = new Set()
    sports.forEach(sport => {
      if (sport.eligible_coordinators && Array.isArray(sport.eligible_coordinators)) {
        sport.eligible_coordinators.forEach(regNumber => {
          coordinatorRegNumbers.add(regNumber)
        })
      }
    })

    // Fetch all coordinators at once (only if there are any)
    if (coordinatorRegNumbers.size > 0) {
      const coordinators = await Player.find({
        reg_number: { $in: Array.from(coordinatorRegNumbers) }
      })
        .select('-password')
        .lean()

      // OPTIMIZATION: Batch compute participation for all coordinators in one query
      const participationMap = await computePlayersParticipationBatch(Array.from(coordinatorRegNumbers), eventId)

      // Add computed fields to each coordinator
      const coordinatorsWithComputed = coordinators.map(coordinator => {
        const coordinatorObj = { ...coordinator }
        const participation = participationMap[coordinator.reg_number] || { participated_in: [], captain_in: [], coordinator_in: [] }
        coordinatorObj.participated_in = participation.participated_in
        coordinatorObj.captain_in = participation.captain_in
        coordinatorObj.coordinator_in = participation.coordinator_in
        return coordinatorObj
      })

      const coordinatorsMap = new Map(coordinatorsWithComputed.map(p => [p.reg_number, p]))

      // Group coordinators by sport
      sports.forEach(sport => {
        if (sport.eligible_coordinators && Array.isArray(sport.eligible_coordinators)) {
          if (!coordinatorsBySport[sport.name]) {
            coordinatorsBySport[sport.name] = []
          }
          sport.eligible_coordinators.forEach(regNumber => {
            const coordinator = coordinatorsMap.get(regNumber)
            if (coordinator) {
              coordinatorsBySport[sport.name].push(coordinator)
            }
          })
        }
      })
    }

    return sendSuccessResponse(res, { coordinatorsBySport })
  })
)

export default router
