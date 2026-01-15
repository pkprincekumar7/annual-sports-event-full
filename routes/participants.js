/**
 * Participant Routes
 * Handles participant management operations using Sports collection
 */

import express from 'express'
import Sport from '../models/Sport.js'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireRegistrationPeriod } from '../middleware/dateRestrictions.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { trimObjectFields } from '../utils/validation.js'
import { getCache, setCache, clearCache } from '../utils/cache.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { findSportByNameAndId } from '../utils/sportHelpers.js'
import { requireAdminOrCoordinator } from '../utils/coordinatorHelpers.js'

const router = express.Router()

/**
 * GET /api/participants/:sport
 * Get all participants for a specific sport (non-team events) (admin only)
 * Event ID Filter: Accepts ?event_id=2026-umang parameter (defaults to active event)
 * Query Sports collection's players_participated array (filtered by event)
 */
router.get(
  '/participants/:sport',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Decode the sport name from URL parameter
    let sport = decodeURIComponent(req.params.sport)
    
    const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
    const eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
    const eventId = eventYearData.doc.event_id

    if (!sport) {
      return sendErrorResponse(res, 400, 'Sport name is required')
    }

    // Check if user is admin or coordinator for this sport
    try {
      await requireAdminOrCoordinator(req.user.reg_number, sport, eventId)
    } catch (error) {
      return sendErrorResponse(res, 403, error.message)
    }

    // Find sport by name and event_id
    const sportDoc = await findSportByNameAndId(sport, eventId)

    // Get participants from players_participated array
    const participantRegNumbers = sportDoc.players_participated || []

    if (participantRegNumbers.length === 0) {
      return sendSuccessResponse(res, {
        sport: sport,
        participants: [],
        total_participants: 0
      })
    }

    // Fetch all participants at once
    const participants = await Player.find({
      reg_number: { $in: participantRegNumbers }
    })
      .select('-password')
      .lean()

    // Sort participants by name
    participants.sort((a, b) => a.full_name.localeCompare(b.full_name))

    return sendSuccessResponse(res, {
      sport: sport,
      participants: participants,
      total_participants: participants.length
    })
  })
)

/**
 * GET /api/participants-count/:sport
 * Get total participants count for a specific sport (non-team events)
 * Event ID Filter: Accepts ?event_id=2026-umang parameter (defaults to active event)
 * Query Sports collection's players_participated array (filtered by event)
 */
router.get(
  '/participants-count/:sport',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Decode the sport name from URL parameter
    let sport = decodeURIComponent(req.params.sport)
    
    const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
    const eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
    const eventId = eventYearData.doc.event_id

    if (!sport) {
      return sendErrorResponse(res, 400, 'Sport name is required')
    }

    // Find sport by name and event_id
    const sportDoc = await findSportByNameAndId(sport, eventId)

    // Get count from players_participated array
    const count = (sportDoc.players_participated || []).length

    return sendSuccessResponse(res, {
      sport: sport,
      count: count
    })
  })
)

/**
 * POST /api/update-participation
 * Update individual/cultural event participation
 * Event ID Required: event_id field required in request body (defaults to active event)
 * Update Sports collection's players_participated array (for the specified event)
 */
router.post(
  '/update-participation',
  authenticateToken,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    let { reg_number, sport, event_id } = req.body

    // Trim fields
    const trimmed = trimObjectFields({ reg_number, sport, event_id })
    reg_number = trimmed.reg_number
    sport = trimmed.sport
    event_id = trimmed.event_id

    if (!event_id || !String(event_id).trim()) {
      return sendErrorResponse(res, 400, 'event_id is required')
    }

    // Get event with document
    const eventYearData = await getEventYear(String(event_id).trim(), { returnDoc: true })
    const eventId = eventYearData.doc.event_id

    // Check if user is admin or coordinator for this sport
    try {
      await requireAdminOrCoordinator(req.user.reg_number, sport, eventId)
    } catch (error) {
      return sendErrorResponse(res, 403, error.message)
    }

    // Validate required fields
    if (!reg_number || !sport) {
      return sendErrorResponse(res, 400, 'Registration number and sport are required')
    }

    // Validate player exists
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }


    // Find sport by name and event_id
    const sportDoc = await findSportByNameAndId(sport, eventId, { lean: false })

    // Coordinators cannot participate in the same sport
    if (sportDoc.eligible_coordinators && sportDoc.eligible_coordinators.includes(reg_number)) {
      return sendErrorResponse(res, 400, `Player is a coordinator for ${sport} and cannot participate in that sport.`)
    }

    // Validate sport is an individual/cultural sport
    if (sportDoc.type !== 'dual_player' && sportDoc.type !== 'multi_player') {
      return sendErrorResponse(res, 400, 'Individual participation is only applicable for individual/cultural sports (dual_player or multi_player)')
    }

    // Initialize players_participated array if it doesn't exist
    if (!sportDoc.players_participated) {
      sportDoc.players_participated = []
    }

    // Check if already participating
    if (sportDoc.players_participated.includes(reg_number)) {
      return sendErrorResponse(res, 400, `Player is already registered for ${sport}`)
    }

    // Add to players_participated array
    sportDoc.players_participated.push(reg_number)
    await sportDoc.save()

    // Clear cache
    clearCache(`/api/sports?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/participants/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/participants-count/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports-counts?event_id=${encodeURIComponent(eventId)}`)

    return sendSuccessResponse(res, { sport: sportDoc }, `Participation updated successfully for ${sport}`)
  })
)

/**
 * DELETE /api/remove-participation
 * Remove participation (team or individual) (admin only)
 * Event ID Required: event_id field required in request body (defaults to active event)
 * Update Sports collection's teams_participated or players_participated (for the specified year)
 */
router.delete(
  '/remove-participation',
  authenticateToken,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    let { reg_number, sport, event_id } = req.body

    // Trim fields
    const trimmed = trimObjectFields({ reg_number, sport, event_id })
    reg_number = trimmed.reg_number
    sport = trimmed.sport
    event_id = trimmed.event_id

    if (!event_id || !String(event_id).trim()) {
      return sendErrorResponse(res, 400, 'event_id is required')
    }

    // Get event with document
    const eventYearData = await getEventYear(String(event_id).trim(), { returnDoc: true })
    const eventId = eventYearData.doc.event_id

    // Check if user is admin or coordinator for this sport
    try {
      await requireAdminOrCoordinator(req.user.reg_number, sport, eventId)
    } catch (error) {
      return sendErrorResponse(res, 403, error.message)
    }

    // Validate required fields
    if (!reg_number || !sport) {
      return sendErrorResponse(res, 400, 'Registration number and sport are required')
    }

    // Find sport by name and event_id
    const sportDoc = await findSportByNameAndId(sport, eventId, { lean: false })

    let removed = false

    // Check if player is in a team
    const teamIndex = sportDoc.teams_participated.findIndex(
      team => team.players && team.players.includes(reg_number)
    )

    if (teamIndex !== -1) {
      // Player is in a team - remove from team
      const team = sportDoc.teams_participated[teamIndex]
      
      // Cannot remove if player is the captain
      if (team.captain === reg_number) {
        return sendErrorResponse(
          res,
          400,
          `Cannot remove participation. Player is the captain of team "${team.team_name}". Please delete the team first or assign a new captain.`
        )
      }

      // Remove player from team
      team.players = team.players.filter(p => p !== reg_number)
      
      // If team has no players left, remove the team
      if (team.players.length === 0) {
        sportDoc.teams_participated.splice(teamIndex, 1)
      }
      
      removed = true
    } else if (sportDoc.players_participated && sportDoc.players_participated.includes(reg_number)) {
      // Player is an individual participant - remove from players_participated
      sportDoc.players_participated = sportDoc.players_participated.filter(p => p !== reg_number)
      removed = true
    }

    if (!removed) {
      return sendErrorResponse(res, 400, `Player is not registered for ${sport}`)
    }

    await sportDoc.save()

    // Clear cache
    clearCache(`/api/sports?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/teams/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/participants/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/participants-count/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports-counts?event_id=${encodeURIComponent(eventId)}`)

    return sendSuccessResponse(res, { sport: sportDoc }, `Participation removed successfully for ${sport}`)
  })
)

export default router
