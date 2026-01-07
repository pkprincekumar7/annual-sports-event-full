/**
 * Player Routes
 * Handles player data operations with computed participation fields
 */

import express from 'express'
import Player from '../models/Player.js'
import EventYear from '../models/EventYear.js'
import Sport from '../models/Sport.js'
import EventSchedule from '../models/EventSchedule.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireRegistrationPeriod } from '../middleware/dateRestrictions.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { validateUpdatePlayerData, validatePlayerData, trimObjectFields } from '../utils/validation.js'
import { computePlayerParticipation, validateDepartmentExists } from '../utils/playerHelpers.js'
import { getCache, setCache, clearCache } from '../utils/cache.js'
import { clearPlayerGenderCache } from '../utils/genderHelpers.js'
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
  
  // Year is already stored directly, no computation needed
  
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
      // Always use sendSuccessResponse for consistency, even for cached data
      // Note: cached data might be the player object directly, so wrap it
      if (cached.player) {
        return sendSuccessResponse(res, cached)
      } else {
        return sendSuccessResponse(res, { player: cached })
      }
    }

    const user = await Player.findOne({ reg_number: req.user.reg_number })
      .select('-password')

    if (!user) {
      return handleNotFoundError(res, 'User')
    }

    // Add computed fields
    const userWithComputed = await addComputedFields(user, eventYear)

    // Cache the result (store as player object to match response format)
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
      // Always use sendSuccessResponse for consistency, even for cached data
      return sendSuccessResponse(res, cached)
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
 * Accepts year field (formatted string like "1st Year (2025)")
 * Validate department exists and is active
 */
router.post(
  '/save-player',
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)

    const validation = await validatePlayerData(trimmed)

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

    // Validate department exists
    const deptValidation = await validateDepartmentExists(trimmed.department_branch)
    if (!deptValidation.exists) {
      return sendErrorResponse(res, 400, `Department "${trimmed.department_branch}" does not exist`)
    }

    // Create new player object
    const newPlayer = new Player(trimmed)

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
 * Accepts year field (formatted string like "1st Year (2025)")
 */
router.post(
  '/save-players',
  requireRegistrationPeriod,
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

    // Create player documents
    const playerDocuments = players

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
 * Accepts year field (formatted string like "1st Year (2025)")
 * year cannot be modified
 * Validate department exists and is active
 */
router.put(
  '/update-player',
  authenticateToken,
  requireAdmin,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = await validateUpdatePlayerData(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, full_name, department_branch, mobile_number, email_id, gender, year } = trimmed

    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Check if gender is being changed (not allowed)
    if (player.gender !== gender) {
      return sendErrorResponse(res, 400, 'Gender cannot be modified. Please keep the original gender value.')
    }

    // Check if year is being changed (not allowed)
    if (year !== undefined && year !== null && player.year !== year) {
      return sendErrorResponse(res, 400, 'Year cannot be modified. Please keep the original year value.')
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
    // Clear gender cache for this player (in case gender derivation is affected)
    clearPlayerGenderCache(reg_number)

    return sendSuccessResponse(res, { player: playerData }, 'Player data updated successfully')
  })
)

/**
 * GET /api/player-enrollments/:reg_number
 * Get player enrollments (non-team events and teams) for deletion validation
 * Returns: { nonTeamEvents: Array, teams: Array }
 */
router.get(
  '/player-enrollments/:reg_number',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { reg_number } = req.params
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

    // Check if player exists
    const player = await Player.findOne({ reg_number }).lean()
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Find all sports where player is enrolled
    const sports = await Sport.find({
      event_year: eventYear,
      $or: [
        { 'teams_participated.captain': reg_number },
        { 'teams_participated.players': reg_number },
        { players_participated: reg_number }
      ]
    }).lean()

    const nonTeamEvents = []
    const teams = []

    sports.forEach(sport => {
      // Check if player is in a team
      const teamMember = sport.teams_participated.find(
        team => team.captain === reg_number || (team.players && team.players.includes(reg_number))
      )

      if (teamMember) {
        // Player is in a team
        teams.push({
          sport: sport.name,
          team_name: teamMember.team_name,
          is_captain: teamMember.captain === reg_number
        })
      } else if (sport.players_participated && sport.players_participated.includes(reg_number)) {
        // Player is enrolled in non-team event (individual event)
        nonTeamEvents.push({
          sport: sport.name,
          category: sport.category
        })
      }
    })

    // Check for matches (any status: scheduled, completed, draw, cancelled)
    // 1. Check individual events (player reg_number in players array)
    const individualMatches = await EventSchedule.find({
      event_year: eventYear,
      players: reg_number
    }).select('sports_name match_number match_type match_date status').lean()

    // 2. Check team events (player's teams in teams array)
    const playerTeamNames = teams.map(t => t.team_name)
    const teamMatches = await EventSchedule.find({
      event_year: eventYear,
      teams: { $in: playerTeamNames }
    }).select('sports_name match_number match_type match_date teams status').lean()

    const allMatches = [
      ...individualMatches.map(m => ({
        sport: m.sports_name,
        match_number: m.match_number,
        match_type: m.match_type,
        match_date: m.match_date,
        status: m.status,
        type: 'individual'
      })),
      ...teamMatches.map(m => ({
        sport: m.sports_name,
        match_number: m.match_number,
        match_type: m.match_type,
        match_date: m.match_date,
        status: m.status,
        teams: m.teams,
        type: 'team'
      }))
    ]

    return sendSuccessResponse(res, {
      nonTeamEvents,
      teams,
      matches: allMatches,
      hasEnrollments: nonTeamEvents.length > 0 || teams.length > 0,
      hasMatches: allMatches.length > 0
    })
  })
)

/**
 * DELETE /api/delete-player/:reg_number
 * Delete player and their enrollments (admin only)
 * Cannot delete if player is a member of any team
 * Can delete if player is only enrolled in non-team events
 */
router.delete(
  '/delete-player/:reg_number',
  authenticateToken,
  requireAdmin,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const { reg_number } = req.params
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

    // Check if player exists
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Prevent deletion of admin user
    if (reg_number === 'admin') {
      return sendErrorResponse(res, 400, 'Cannot delete admin user')
    }

    // Find all sports where player is enrolled
    const sports = await Sport.find({
      event_year: eventYear,
      $or: [
        { 'teams_participated.captain': reg_number },
        { 'teams_participated.players': reg_number },
        { players_participated: reg_number }
      ]
    })

    const teams = []
    const nonTeamEvents = []

    // Check enrollments
    for (const sport of sports) {
      // Check if player is in a team
      const teamMember = sport.teams_participated.find(
        team => team.captain === reg_number || (team.players && team.players.includes(reg_number))
      )

      if (teamMember) {
        teams.push({
          sport: sport.name,
          team_name: teamMember.team_name
        })
      } else if (sport.players_participated && sport.players_participated.includes(reg_number)) {
        // Player is enrolled in non-team event
        nonTeamEvents.push({
          sport: sport.name
        })
      }
    }

    // Check for matches (any status: scheduled, completed, draw, cancelled)
    // 1. Check individual events (player reg_number in players array)
    const individualMatches = await EventSchedule.find({
      event_year: eventYear,
      players: reg_number
    }).lean()

    // 2. Check team events (player's teams in teams array)
    const playerTeamNames = teams.map(t => t.team_name)
    const teamMatches = playerTeamNames.length > 0
      ? await EventSchedule.find({
          event_year: eventYear,
          teams: { $in: playerTeamNames }
        }).lean()
      : []

    const allMatches = [...individualMatches, ...teamMatches]

    // Cannot delete if player has any matches (regardless of status)
    if (allMatches.length > 0) {
      const matchDetails = allMatches.map(m => ({
        sport: m.sports_name,
        match_number: m.match_number,
        match_type: m.match_type,
        match_date: m.match_date,
        status: m.status
      }))
      return sendErrorResponse(
        res,
        400,
        `Cannot delete player. Player has ${allMatches.length} match(es) (scheduled/completed/draw/cancelled). Player cannot be deleted if they have any match history.`,
        { matches: matchDetails }
      )
    }

    // Cannot delete if player is a member of any team
    if (teams.length > 0) {
      return sendErrorResponse(
        res,
        400,
        `Cannot delete player. Player is a member of ${teams.length} team(s). Please remove player from teams first.`,
        { teams }
      )
    }

    // Remove player from non-team events
    for (const event of nonTeamEvents) {
      const sport = await Sport.findOne({
        name: event.sport,
        event_year: eventYear
      })

      if (sport) {
        // Remove from players_participated array
        sport.players_participated = sport.players_participated.filter(
          p => p !== reg_number
        )
        await sport.save()

        // Clear cache for this sport
        clearCache(`/api/sports?year=${eventYear}`)
        clearCache(`/api/sports/${event.sport}?year=${eventYear}`)
        clearCache(`/api/participants/${event.sport}?year=${eventYear}`)
        clearCache(`/api/participants-count/${event.sport}?year=${eventYear}`)
        clearCache(`/api/sports-counts?year=${eventYear}`)
      }
    }

    // Delete player from database
    await Player.findOneAndDelete({ reg_number })

    // Clear cache
    clearCache('/api/players')
    clearCache(`/api/me?year=${eventYear}`)
    clearPlayerGenderCache(reg_number)

    return sendSuccessResponse(
      res,
      {
        deleted_events: nonTeamEvents.length,
        events: nonTeamEvents.map(e => e.sport)
      },
      `Player deleted successfully. Removed from ${nonTeamEvents.length} event(s).`
    )
  })
)

export default router
