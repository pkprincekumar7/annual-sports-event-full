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
import { clearCache } from '../utils/cache.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { findSportByNameAndYear } from '../utils/sportHelpers.js'
import { computePlayersParticipationBatch } from '../utils/playerHelpers.js'

const router = express.Router()

/**
 * POST /api/add-coordinator
 * Add coordinator role to a player (admin only)
 * Workflow: Admin assigns a player as coordinator for a sport
 * Event Year Required: event_year field required in request body (defaults to active event year)
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
    clearCache(`/api/sports?event_year=${eventYear}&event_name=${encodeURIComponent(eventName)}`)
    clearCache(`/api/sports/${sport}?event_year=${eventYear}&event_name=${encodeURIComponent(eventName)}`)

    return sendSuccessResponse(res, { sport: sportDoc }, `Coordinator added successfully for ${sport}`)
  })
)

/**
 * DELETE /api/remove-coordinator
 * Remove coordinator role from a player (admin only)
 * Event Year Required: event_year field required in request body (defaults to active event year)
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

    const { reg_number, sport, event_year, event_name } = trimmed

    // Get event year with document (event_name is now required via validation)
    const eventYearData = await getEventYear(parseInt(event_year), { requireYear: true, returnDoc: true, eventName: event_name.trim() })
    const eventYear = eventYearData.event_year
    const eventName = eventYearData.doc.event_name

    // Find sport by name, event_year, and event_name
    const sportDoc = await findSportByNameAndYear(sport, eventYear, eventName, { lean: false })

    // Check if player is in eligible_coordinators
    if (!sportDoc.eligible_coordinators || !sportDoc.eligible_coordinators.includes(reg_number)) {
      return sendErrorResponse(res, 400, `Player is not a coordinator for ${sport}`)
    }

    // Remove from eligible_coordinators array
    sportDoc.eligible_coordinators = sportDoc.eligible_coordinators.filter(c => c !== reg_number)
    await sportDoc.save()

    // Clear cache
    clearCache(`/api/sports?event_year=${eventYear}&event_name=${encodeURIComponent(eventName)}`)
    clearCache(`/api/sports/${sport}?event_year=${eventYear}&event_name=${encodeURIComponent(eventName)}`)

    return sendSuccessResponse(res, { sport: sportDoc }, `Coordinator role removed successfully for ${sport}`)
  })
)

/**
 * GET /api/coordinators-by-sport
 * Get all coordinators grouped by sport (admin only)
 * Event Year Filter: Accepts ?event_year=2026 parameter (defaults to active event year)
 */
router.get(
  '/coordinators-by-sport',
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
        return sendSuccessResponse(res, { coordinatorsBySport: {} })
      }
      // Re-throw other errors to be handled by asyncHandler
      throw error
    }

    const eventYear = eventYearData.event_year
    const eventName = eventYearData.doc.event_name

    // Get all sports with eligible coordinators for this event year and event name
    const sports = await Sport.find({
      event_year: eventYear,
      event_name: eventName,
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
      const participationMap = await computePlayersParticipationBatch(Array.from(coordinatorRegNumbers), eventYear)

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
