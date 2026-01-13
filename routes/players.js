/**
 * Player Routes
 * Handles player data operations with computed participation fields
 */

import express from 'express'
import Player from '../models/Player.js'
import EventYear from '../models/EventYear.js'
import Sport from '../models/Sport.js'
import EventSchedule from '../models/EventSchedule.js'
import Batch from '../models/Batch.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireRegistrationPeriod } from '../middleware/dateRestrictions.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { validateUpdatePlayerData, validatePlayerData, trimObjectFields } from '../utils/validation.js'
import { computePlayerParticipation, computePlayersParticipationBatch, validateDepartmentExists } from '../utils/playerHelpers.js'
import { getPlayerBatchName } from '../utils/batchHelpers.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { getCache, setCache, clearCache, clearCachePattern } from '../utils/cache.js'
import { clearPlayerGenderCache } from '../utils/genderHelpers.js'
import { findActiveEventYear } from '../utils/yearHelpers.js'
import { DEFAULT_PLAYERS_PAGE_SIZE } from '../constants/index.js'
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
  playerObj.coordinator_in = participation.coordinator_in
  
  // Get batch name from Batch collection
  if (eventYear) {
    try {
      const eventYearData = await getEventYear(eventYear, { returnDoc: true })
      const eventName = eventYearData.doc.event_name
      const batchName = await getPlayerBatchName(playerObj.reg_number, eventYear, eventName)
      playerObj.batch_name = batchName // Use batch_name instead of year
    } catch (error) {
      playerObj.batch_name = null
    }
  } else {
    playerObj.batch_name = null
  }
  
  return playerObj
}

/**
 * GET /api/me
 * Get current authenticated user data
 * Add computed participated_in, captain_in, coordinator_in, and batch_name fields (filtered by active event year or provided event year)
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    let eventYear = req.query.event_year ? parseInt(req.query.event_year) : null

    // Get event year (default to active event year if not provided)
    if (!eventYear) {
      const cachedActiveYear = getCache('/api/event-years/active')
      if (cachedActiveYear) {
        eventYear = cachedActiveYear.event_year
      } else {
        const activeYear = await findActiveEventYear()
        if (activeYear) {
          eventYear = activeYear.event_year
          setCache('/api/event-years/active', activeYear)
        } else {
          eventYear = new Date().getFullYear()
        }
      }
    }

    // Check cache
    const cacheKey = `/api/me?event_year=${eventYear}`
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
 * Get players (requires authentication)
 * Add computed participated_in, captain_in, coordinator_in, and batch_name fields (filtered by active event year or provided event year)
 * Supports search query parameter to search by registration number or name
 * 
 * Pagination behavior:
 * - If 'page' parameter is provided: Returns paginated results with pagination metadata
 * - If 'page' parameter is NOT provided: Returns all matching records (no pagination)
 * 
 * Query parameters:
 * - event_year: Event year (optional, defaults to active event year)
 * - search: Search query for registration number or name (optional)
 * - page: Page number for pagination (optional, if not provided returns all records)
 * - limit: Items per page when pagination is used (optional, defaults to DEFAULT_PLAYERS_PAGE_SIZE, max 100)
 */
router.get(
  '/players',
  authenticateToken,
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
    
    const searchQuery = req.query.search ? req.query.search.trim() : null
    const hasPageParam = req.query.page !== undefined && req.query.page !== null && req.query.page !== ''
    // Validate and parse page parameter if provided
    let page = 1
    if (hasPageParam) {
      const parsedPage = parseInt(req.query.page)
      page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage
    }
    // If page parameter is provided, use pagination; otherwise return all records
    let limit = null
    if (hasPageParam) {
      if (req.query.limit !== undefined && req.query.limit !== null && req.query.limit !== '') {
        const parsedLimit = parseInt(req.query.limit)
        limit = isNaN(parsedLimit) || parsedLimit < 1 ? DEFAULT_PLAYERS_PAGE_SIZE : Math.min(100, parsedLimit)
      } else {
        limit = DEFAULT_PLAYERS_PAGE_SIZE
      }
    }
    const skip = hasPageParam && limit ? (page - 1) * limit : 0

    // Get event year and event_name (default to active event year if not provided)
    // Extract event_name from query if provided for composite key filtering
    const eventNameQuery = hasEventName ? req.query.event_name.trim() : null
    let eventYearData
    try {
      eventYearData = await getEventYear(hasEventYear ? parseInt(req.query.event_year) : null, { returnDoc: true, eventName: eventNameQuery })
    } catch (error) {
      // If event year not found, return error
      if (error.message === 'Event year not found' || error.message === 'No active event year found') {
        return sendErrorResponse(res, 400, error.message)
      }
      // Re-throw other errors to be handled by asyncHandler
      throw error
    }
    
    const eventYear = eventYearData.event_year
    const eventName = eventYearData.doc.event_name

    // Build query
    const query = { reg_number: { $ne: 'admin' } }
    
    // Add search filter if provided (server-side search across entire record)
    // Searches anywhere in registration number or full name (case-insensitive)
    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') // Case-insensitive, contains pattern, escape special regex chars
      query.$or = [
        { reg_number: searchRegex },
        { full_name: searchRegex }
      ]
    }

    // Check cache only if no search query, no pagination (all records), and page 1
    // eventName is always available after getEventYear call (either from query or from active event year)
    if (!searchQuery && !hasPageParam) {
      const cacheKey = `/api/players?event_year=${eventYear}&event_name=${encodeURIComponent(eventName)}`
      const cached = getCache(cacheKey)
      if (cached) {
        // Always use sendSuccessResponse for consistency, even for cached data
        return sendSuccessResponse(res, cached)
      }
    }

    // Get total count
    const totalCount = await Player.countDocuments(query)

    // Build query with optional pagination
    let playersQuery = Player.find(query).select('-password')
    
    // Apply pagination only if page parameter is provided
    if (hasPageParam && limit) {
      playersQuery = playersQuery.skip(skip).limit(limit)
    }
    
    const players = await playersQuery.lean()

    // OPTIMIZATION: Batch compute participation for all players in one query
    const regNumbers = players.map(p => p.reg_number)
    const participationMap = await computePlayersParticipationBatch(regNumbers, eventYear)

    // Add computed fields to all players using batch results
    // Also compute batch_name for each player
    const playersWithComputed = await Promise.all(players.map(async (player) => {
      const playerObj = player
      const participation = participationMap[player.reg_number] || { participated_in: [], captain_in: [], coordinator_in: [] }
      playerObj.participated_in = participation.participated_in
      playerObj.captain_in = participation.captain_in
      playerObj.coordinator_in = participation.coordinator_in
      
      // Get batch name if eventYear and eventName are available
      if (eventYear && eventName) {
        try {
          const batchName = await getPlayerBatchName(playerObj.reg_number, eventYear, eventName)
          playerObj.batch_name = batchName
        } catch (error) {
          logger.warn(`Could not get batch_name for player ${playerObj.reg_number}:`, error)
          playerObj.batch_name = null
        }
      } else {
        playerObj.batch_name = null
      }
      
      return playerObj
    }))

    // Build response - include pagination only if page parameter was provided
    const result = {
      players: playersWithComputed
    }

    if (hasPageParam && limit) {
      const totalPages = Math.ceil(totalCount / limit)
      result.pagination = {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    } else {
      // For non-paginated requests, still include total count for reference
      result.totalCount = totalCount
    }

    // Cache the result only if no search query and no pagination (all records)
    // eventName is always available after getEventYear call (either from query or from active event year)
    if (!searchQuery && !hasPageParam) {
      const cacheKey = `/api/players?event_year=${eventYear}&event_name=${encodeURIComponent(eventName)}`
      setCache(cacheKey, result)
    }

    return sendSuccessResponse(res, result)
  })
)

/**
 * POST /api/save-player
 * Register a new player (no authentication required)
 * Accepts batch_name field (formatted string like "1st Year (2025)") - player will be added to this batch
 * Validate department exists and is active
 */
router.post(
  '/save-player',
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const { batch_name, createdBy, updatedBy, ...playerData } = trimmed // Extract batch_name and exclude createdBy/updatedBy (set from token only)

    // Explicitly reject if user tries to send createdBy or updatedBy
    if (createdBy !== undefined || updatedBy !== undefined) {
      return sendErrorResponse(res, 400, 'createdBy and updatedBy fields cannot be set by user. They are automatically set from authentication token.')
    }

    const validation = await validatePlayerData(playerData)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number } = playerData

    // Check if player with same reg_number already exists
    const existingPlayer = await Player.findOne({ reg_number })
    if (existingPlayer) {
      return sendErrorResponse(res, 409, 'Registration number already exists. Please use a different registration number.', {
        code: 'DUPLICATE_REG_NUMBER',
      })
    }

    // Validate department exists
    const deptValidation = await validateDepartmentExists(playerData.department_branch)
    if (!deptValidation.exists) {
      return sendErrorResponse(res, 400, `Department "${playerData.department_branch}" does not exist`)
    }

    // Get active event year for batch assignment
    const activeEventYear = await findActiveEventYear()
    if (!activeEventYear) {
      return sendErrorResponse(res, 400, 'No active event year found. Please configure an active event year first.')
    }

    // Validate active event year has event_name
    if (!activeEventYear.event_name || !activeEventYear.event_name.trim()) {
      return sendErrorResponse(res, 400, 'Active event year is missing event name. Please configure the event name for the active event year.')
    }

    // Create new player object (without year field)
    const newPlayer = new Player(playerData)
    await newPlayer.save()

    // Validate batch exists and add player to batch
    if (!batch_name || !batch_name.trim()) {
      return sendErrorResponse(res, 400, 'Batch name is required')
    }

    const batch = await Batch.findOne({
      name: batch_name.trim(),
      event_year: activeEventYear.event_year,
      event_name: activeEventYear.event_name.trim()
    })

    if (!batch) {
      return sendErrorResponse(res, 400, `Batch "${batch_name}" does not exist. Please create the batch first.`)
    }

    // Add player to batch if not already present
    if (!batch.players.includes(reg_number)) {
      batch.players.push(reg_number)
      await batch.save()
    }

    const savedPlayer = newPlayer.toObject()
    delete savedPlayer.password

    // Clear cache (use pattern to clear all variations with query params)
    clearCachePattern('/api/players')
    clearCache(`/api/batches?event_year=${activeEventYear.event_year}&event_name=${encodeURIComponent(activeEventYear.event_name.trim())}`)

    return sendSuccessResponse(res, { player: savedPlayer }, 'Player data saved successfully')
  })
)

/**
 * PUT /api/update-player
 * Update player data (admin only)
 * Batch assignment is handled separately via batch management endpoints
 * Validate department exists and is active
 */
router.put(
  '/update-player',
  authenticateToken,
  requireAdmin,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const { createdBy, updatedBy, batch_name, ...updateData } = trimmed // Exclude createdBy/updatedBy and batch_name (set from token only, batch handled separately)

    // Explicitly reject if user tries to send createdBy or updatedBy
    if (createdBy !== undefined || updatedBy !== undefined) {
      return sendErrorResponse(res, 400, 'createdBy and updatedBy fields cannot be set by user. They are automatically set from authentication token.')
    }

    // Explicitly reject if user tries to send batch_name (batch assignment is handled separately)
    if (batch_name !== undefined) {
      return sendErrorResponse(res, 400, 'Batch cannot be modified through player update. Batch assignment is handled separately via batch management endpoints.')
    }

    const validation = await validateUpdatePlayerData(updateData)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { reg_number, full_name, department_branch, mobile_number, email_id, gender } = updateData

    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Check if gender is being changed (not allowed)
    if (player.gender !== gender) {
      return sendErrorResponse(res, 400, 'Gender cannot be modified. Please keep the original gender value.')
    }

    // Batch assignment is handled separately via batch management endpoints

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

    // Set updatedBy from token
    player.updatedBy = req.user.reg_number

    await player.save()

    const playerData = player.toObject()
    delete playerData.password

    // Clear cache (use pattern to clear all variations with query params)
    clearCachePattern('/api/players')
    clearCache(`/api/me?event_year=${new Date().getFullYear()}`)
    // Clear gender cache for this player (in case gender derivation is affected)
    clearPlayerGenderCache(reg_number)

    return sendSuccessResponse(res, { player: playerData }, 'Player data updated successfully')
  })
)

/**
 * POST /api/bulk-player-enrollments
 * Get enrollments for multiple players (optimized bulk endpoint)
 * Accepts: { reg_numbers: Array<string>, event_year?: number } or query parameter ?event_year=2026
 * Returns: { enrollments: { [reg_number]: { nonTeamEvents, teams, matches, hasMatches } } }
 */
router.post(
  '/bulk-player-enrollments',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { reg_numbers } = req.body
    let eventYear = req.query.event_year ? parseInt(req.query.event_year) : (req.body.event_year ? parseInt(req.body.event_year) : null)

    // Validate input
    if (!Array.isArray(reg_numbers) || reg_numbers.length === 0) {
      return sendErrorResponse(res, 400, 'reg_numbers must be a non-empty array')
    }

    // Get event year with document (default to active event year if not provided)
    let eventYearDoc = null
    if (!eventYear) {
      const cachedActiveYear = getCache('/api/event-years/active')
      if (cachedActiveYear) {
        eventYearDoc = cachedActiveYear
        eventYear = cachedActiveYear.event_year
      } else {
        const activeYear = await findActiveEventYear()
        if (activeYear) {
          eventYearDoc = activeYear
          eventYear = activeYear.event_year
          setCache('/api/event-years/active', activeYear)
        } else {
          eventYear = new Date().getFullYear()
          // Try to get event year document
          const EventYear = (await import('../models/EventYear.js')).default
          eventYearDoc = await EventYear.findOne({ event_year: eventYear }).lean()
        }
      }
    } else {
      // Get event year document
      const EventYear = (await import('../models/EventYear.js')).default
      eventYearDoc = await EventYear.findOne({ event_year: eventYear }).lean()
    }

    const eventName = eventYearDoc ? eventYearDoc.event_name : null

    // Check if all players exist
    const players = await Player.find({ reg_number: { $in: reg_numbers } }).select('reg_number full_name').lean()
    const foundRegNumbers = players.map(p => p.reg_number)
    const notFound = reg_numbers.filter(reg => !foundRegNumbers.includes(reg))
    
    if (notFound.length > 0) {
      return sendErrorResponse(
        res,
        404,
        `Players not found: ${notFound.join(', ')}`,
        { notFound }
      )
    }

    // OPTIMIZATION: Fetch all sports for all players in one query - filter by both event_year and event_name
    const sportQuery = {
      event_year: eventYear,
      $or: [
        { 'teams_participated.captain': { $in: reg_numbers } },
        { 'teams_participated.players': { $in: reg_numbers } },
        { players_participated: { $in: reg_numbers } }
      ]
    }
    
    // Add event_name to query if available
    if (eventName) {
      sportQuery.event_name = eventName
    }
    
    const allSports = await Sport.find(sportQuery).lean()

    // OPTIMIZATION: Build enrollment maps for all players
    const enrollmentsMap = {}
    for (const reg_number of reg_numbers) {
      enrollmentsMap[reg_number] = {
        nonTeamEvents: [],
        teams: [],
        matches: [],
        hasMatches: false
      }
    }

    // Process all sports to build enrollment maps
    for (const sport of allSports) {
      // Check team participations
      if (sport.teams_participated && sport.teams_participated.length > 0) {
        for (const team of sport.teams_participated) {
          // Check if any of the players is captain
          if (team.captain && reg_numbers.includes(team.captain)) {
            enrollmentsMap[team.captain].teams.push({
              sport: sport.name,
              team_name: team.team_name,
              is_captain: true
            })
          }
          // Check if any of the players is in the team
          if (team.players && Array.isArray(team.players)) {
            for (const playerRegNumber of team.players) {
              if (reg_numbers.includes(playerRegNumber)) {
                // Only add if not already added as captain
                const existingTeam = enrollmentsMap[playerRegNumber].teams.find(
                  t => t.team_name === team.team_name && t.sport === sport.name
                )
                if (!existingTeam) {
                  enrollmentsMap[playerRegNumber].teams.push({
                    sport: sport.name,
                    team_name: team.team_name,
                    is_captain: false
                  })
                }
              }
            }
          }
        }
      }

      // Check non-team participations
      if (sport.players_participated && Array.isArray(sport.players_participated)) {
        for (const playerRegNumber of sport.players_participated) {
          if (reg_numbers.includes(playerRegNumber)) {
            // Only add if player is not in a team for this sport
            const hasTeamInSport = enrollmentsMap[playerRegNumber].teams.some(
              t => t.sport === sport.name
            )
            if (!hasTeamInSport) {
              enrollmentsMap[playerRegNumber].nonTeamEvents.push({
                sport: sport.name,
                category: sport.category
              })
            }
          }
        }
      }
    }

    // OPTIMIZATION: Get all non-team event names for all players
    const allNonTeamEventNames = new Set()
    for (const reg_number of reg_numbers) {
      enrollmentsMap[reg_number].nonTeamEvents.forEach(e => allNonTeamEventNames.add(e.sport))
    }

    // OPTIMIZATION: Fetch all matches for all players in one query - filter by both event_year and event_name
    const matchQuery = {
      event_year: eventYear,
      players: { $in: reg_numbers },
      sports_name: { $in: Array.from(allNonTeamEventNames) }
    }
    
    // Add event_name to query if available
    if (eventName) {
      matchQuery.event_name = eventName
    }
    
    const allMatches = allNonTeamEventNames.size > 0
      ? await EventSchedule.find(matchQuery).select('sports_name match_number match_type match_date status players').lean()
      : []

    // Group matches by player
    for (const match of allMatches) {
      if (match.players && Array.isArray(match.players)) {
        for (const playerRegNumber of match.players) {
          if (reg_numbers.includes(playerRegNumber)) {
            enrollmentsMap[playerRegNumber].matches.push({
              sport: match.sports_name,
              match_number: match.match_number,
              match_type: match.match_type,
              match_date: match.match_date,
              status: match.status,
              type: 'individual'
            })
            enrollmentsMap[playerRegNumber].hasMatches = true
          }
        }
      }
    }

    // Add player info to each enrollment
    const result = {}
    for (const reg_number of reg_numbers) {
      const player = players.find(p => p.reg_number === reg_number)
      result[reg_number] = {
        ...enrollmentsMap[reg_number],
        player: player || { reg_number, full_name: reg_number }
      }
    }

    return sendSuccessResponse(res, {
      enrollments: result
    })
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
    let eventYear = req.query.event_year ? parseInt(req.query.event_year) : null

    // Get event year with document (default to active event year if not provided)
    let eventYearDoc = null
    if (!eventYear) {
      const cachedActiveYear = getCache('/api/event-years/active')
      if (cachedActiveYear) {
        eventYearDoc = cachedActiveYear
        eventYear = cachedActiveYear.event_year
      } else {
        const activeYear = await findActiveEventYear()
        if (activeYear) {
          eventYearDoc = activeYear
          eventYear = activeYear.event_year
          setCache('/api/event-years/active', activeYear)
        } else {
          eventYear = new Date().getFullYear()
          eventYearDoc = await EventYear.findOne({ event_year: eventYear }).lean()
        }
      }
    } else {
      eventYearDoc = await EventYear.findOne({ event_year: eventYear }).lean()
    }

    const eventName = eventYearDoc ? eventYearDoc.event_name : null

    // Check if player exists
    const player = await Player.findOne({ reg_number }).lean()
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Find all sports where player is enrolled - filter by both event_year and event_name
    const sportQuery = {
      event_year: eventYear,
      $or: [
        { 'teams_participated.captain': reg_number },
        { 'teams_participated.players': reg_number },
        { players_participated: reg_number }
      ]
    }
    
    // Add event_name to query if available
    if (eventName) {
      sportQuery.event_name = eventName
    }
    
    const sports = await Sport.find(sportQuery).lean()

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

    // Check for matches only for non-team events (any status: scheduled, completed, draw, cancelled)
    // For team events, team membership is enough validation, no need to check matches
    const nonTeamEventNames = nonTeamEvents.map(e => e.sport)
    const matchQuery = {
      event_year: eventYear,
      players: reg_number,
      sports_name: { $in: nonTeamEventNames }
    }
    
    // Add event_name to query if available
    if (eventName) {
      matchQuery.event_name = eventName
    }
    
    const individualMatches = nonTeamEventNames.length > 0
      ? await EventSchedule.find(matchQuery).select('sports_name match_number match_type match_date status').lean()
      : []

    const allMatches = individualMatches.map(m => ({
      sport: m.sports_name,
      match_number: m.match_number,
      match_type: m.match_type,
      match_date: m.match_date,
      status: m.status,
      type: 'individual'
    }))

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
    let eventYear = req.query.event_year ? parseInt(req.query.event_year) : null

    // Get event year with document (default to active event year if not provided)
    let eventYearDoc = null
    if (!eventYear) {
      const cachedActiveYear = getCache('/api/event-years/active')
      if (cachedActiveYear) {
        eventYearDoc = cachedActiveYear
        eventYear = cachedActiveYear.event_year
      } else {
        const activeYear = await findActiveEventYear()
        if (activeYear) {
          eventYearDoc = activeYear
          eventYear = activeYear.event_year
          setCache('/api/event-years/active', activeYear)
        } else {
          eventYear = new Date().getFullYear()
          eventYearDoc = await EventYear.findOne({ event_year: eventYear }).lean()
        }
      }
    } else {
      eventYearDoc = await EventYear.findOne({ event_year: eventYear }).lean()
    }

    const eventName = eventYearDoc ? eventYearDoc.event_name : null

    // Check if player exists
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return handleNotFoundError(res, 'Player')
    }

    // Prevent deletion of admin user
    if (reg_number === 'admin') {
      return sendErrorResponse(res, 400, 'Cannot delete admin user')
    }

    // Find all sports where player is enrolled - filter by both event_year and event_name
    const sportQuery = {
      event_year: eventYear,
      $or: [
        { 'teams_participated.captain': reg_number },
        { 'teams_participated.players': reg_number },
        { players_participated: reg_number }
      ]
    }
    
    // Add event_name to query if available
    if (eventName) {
      sportQuery.event_name = eventName
    }
    
    const sports = await Sport.find(sportQuery)

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

    // Cannot delete if player is a member of any team (for team events, team membership is enough)
    if (teams.length > 0) {
      return sendErrorResponse(
        res,
        400,
        `Cannot delete player. Player is a member of ${teams.length} team(s). Please remove player from teams first.`,
        { teams }
      )
    }

    // For non-team events, check for matches (any status: scheduled, completed, draw, cancelled)
    // Only check matches for non-team events - filter by both event_year and event_name
    const nonTeamEventNames = nonTeamEvents.map(e => e.sport)
    const matchQuery = {
      event_year: eventYear,
      players: reg_number,
      sports_name: { $in: nonTeamEventNames }
    }
    
    // Add event_name to query if available
    if (eventName) {
      matchQuery.event_name = eventName
    }
    
    const individualMatches = nonTeamEventNames.length > 0
      ? await EventSchedule.find(matchQuery).lean()
      : []

    // Cannot delete if player has matches in non-team events
    if (individualMatches.length > 0) {
      const matchDetails = individualMatches.map(m => ({
        sport: m.sports_name,
        match_number: m.match_number,
        match_type: m.match_type,
        match_date: m.match_date,
        status: m.status
      }))
      return sendErrorResponse(
        res,
        400,
        `Cannot delete player. Player has ${individualMatches.length} match(es) in non-team events (scheduled/completed/draw/cancelled). Player cannot be deleted if they have any match history.`,
        { matches: matchDetails }
      )
    }

    // Remove player from non-team events
    for (const event of nonTeamEvents) {
      const sportQuery = {
        name: event.sport,
        event_year: eventYear
      }
      
      // Add event_name to query if available
      if (eventName) {
        sportQuery.event_name = eventName
      }
      
      const sport = await Sport.findOne(sportQuery)

      if (sport) {
        // Remove from players_participated array
        sport.players_participated = sport.players_participated.filter(
          p => p !== reg_number
        )
        // Set updatedBy from token if available
        if (req.user && req.user.reg_number) {
          sport.updatedBy = req.user.reg_number
        }
        await sport.save()

        // Clear cache for this sport
        clearCache(`/api/sports?event_year=${eventYear}`)
        clearCache(`/api/sports/${event.sport}?event_year=${eventYear}`)
        clearCache(`/api/participants/${event.sport}?event_year=${eventYear}`)
        clearCache(`/api/participants-count/${event.sport}?event_year=${eventYear}`)
        clearCache(`/api/sports-counts?event_year=${eventYear}`)
      }
    }

    // Delete player from database
    await Player.findOneAndDelete({ reg_number })

    // Clear cache (use pattern to clear all variations with query params)
    clearCachePattern('/api/players')
    clearCache(`/api/me?event_year=${eventYear}`)
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

/**
 * POST /api/bulk-delete-players
 * Bulk delete players with validation (admin only)
 * Cannot delete if player is a member of any team or has matches
 * Returns detailed error information for players that cannot be deleted
 * 
 * OPTIMIZATIONS:
 * - Batch queries: Fetches all sports and matches for all players in single queries
 * - Batch updates: Groups sport updates by sport name (one query per sport)
 * - Single delete: Deletes all players in one query using deleteMany
 */
router.post(
  '/bulk-delete-players',
  authenticateToken,
  requireAdmin,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const { reg_numbers } = req.body
    let eventYear = req.query.event_year ? parseInt(req.query.event_year) : null

    // Validate input
    if (!Array.isArray(reg_numbers) || reg_numbers.length === 0) {
      return sendErrorResponse(res, 400, 'reg_numbers must be a non-empty array')
    }

    // Maximum players deletion limit (uses same constant as page size)
    if (reg_numbers.length > DEFAULT_PLAYERS_PAGE_SIZE) {
      return sendErrorResponse(res, 400, `Maximum ${DEFAULT_PLAYERS_PAGE_SIZE} players can be deleted at a time`)
    }

    // Get event year with document (default to active event year if not provided)
    let eventYearDoc = null
    if (!eventYear) {
      const cachedActiveYear = getCache('/api/event-years/active')
      if (cachedActiveYear) {
        eventYearDoc = cachedActiveYear
        eventYear = cachedActiveYear.event_year
      } else {
        const activeYear = await findActiveEventYear()
        if (activeYear) {
          eventYearDoc = activeYear
          eventYear = activeYear.event_year
          setCache('/api/event-years/active', activeYear)
        } else {
          eventYear = new Date().getFullYear()
          eventYearDoc = await EventYear.findOne({ event_year: eventYear }).lean()
        }
      }
    } else {
      eventYearDoc = await EventYear.findOne({ event_year: eventYear }).lean()
    }

    const eventName = eventYearDoc ? eventYearDoc.event_name : null

    // Prevent deletion of admin user
    if (reg_numbers.includes('admin')) {
      return sendErrorResponse(res, 400, 'Cannot delete admin user')
    }

    // Check if all players exist
    const players = await Player.find({ reg_number: { $in: reg_numbers } }).lean()
    const foundRegNumbers = players.map(p => p.reg_number)
    const notFound = reg_numbers.filter(reg => !foundRegNumbers.includes(reg))
    
    if (notFound.length > 0) {
      return sendErrorResponse(
        res,
        404,
        `Players not found: ${notFound.join(', ')}`,
        { notFound }
      )
    }

    // OPTIMIZATION: Fetch all sports for all players in one query - filter by both event_year and event_name
    const sportQuery = {
      event_year: eventYear,
      $or: [
        { 'teams_participated.captain': { $in: reg_numbers } },
        { 'teams_participated.players': { $in: reg_numbers } },
        { players_participated: { $in: reg_numbers } }
      ]
    }
    
    // Add event_name to query if available
    if (eventName) {
      sportQuery.event_name = eventName
    }
    
    const allSports = await Sport.find(sportQuery).lean()

    // OPTIMIZATION: Build a map of player enrollments from all sports
    const playerEnrollmentsMap = {}
    for (const reg_number of reg_numbers) {
      playerEnrollmentsMap[reg_number] = {
        teams: [],
        nonTeamEvents: []
      }
    }

    // Process all sports to build enrollment map
    for (const sport of allSports) {
      // Check team participations
      if (sport.teams_participated && sport.teams_participated.length > 0) {
        for (const team of sport.teams_participated) {
          // Check if any of the players to delete is captain
          if (team.captain && reg_numbers.includes(team.captain)) {
            if (!playerEnrollmentsMap[team.captain]) {
              playerEnrollmentsMap[team.captain] = { teams: [], nonTeamEvents: [] }
            }
            playerEnrollmentsMap[team.captain].teams.push({
              sport: sport.name,
              team_name: team.team_name,
              is_captain: true
            })
          }
          // Check if any of the players to delete is in the team
          if (team.players && Array.isArray(team.players)) {
            for (const playerRegNumber of team.players) {
              if (reg_numbers.includes(playerRegNumber)) {
                if (!playerEnrollmentsMap[playerRegNumber]) {
                  playerEnrollmentsMap[playerRegNumber] = { teams: [], nonTeamEvents: [] }
                }
                // Only add if not already added as captain
                const existingTeam = playerEnrollmentsMap[playerRegNumber].teams.find(
                  t => t.team_name === team.team_name && t.sport === sport.name
                )
                if (!existingTeam) {
                  playerEnrollmentsMap[playerRegNumber].teams.push({
                    sport: sport.name,
                    team_name: team.team_name,
                    is_captain: false
                  })
                }
              }
            }
          }
        }
      }

      // Check non-team participations
      if (sport.players_participated && Array.isArray(sport.players_participated)) {
        for (const playerRegNumber of sport.players_participated) {
          if (reg_numbers.includes(playerRegNumber)) {
            if (!playerEnrollmentsMap[playerRegNumber]) {
              playerEnrollmentsMap[playerRegNumber] = { teams: [], nonTeamEvents: [] }
            }
            // Only add if player is not in a team for this sport
            const hasTeamInSport = playerEnrollmentsMap[playerRegNumber].teams.some(
              t => t.sport === sport.name
            )
            if (!hasTeamInSport) {
              playerEnrollmentsMap[playerRegNumber].nonTeamEvents.push({
                sport: sport.name
              })
            }
          }
        }
      }
    }

    // OPTIMIZATION: Get all non-team event names for all players
    const allNonTeamEventNames = new Set()
    for (const reg_number of reg_numbers) {
      const enrollments = playerEnrollmentsMap[reg_number] || { teams: [], nonTeamEvents: [] }
      enrollments.nonTeamEvents.forEach(e => allNonTeamEventNames.add(e.sport))
    }

    // OPTIMIZATION: Fetch all matches for all players in one query - filter by both event_year and event_name
    const matchQuery = {
      event_year: eventYear,
      players: { $in: reg_numbers },
      sports_name: { $in: Array.from(allNonTeamEventNames) }
    }
    
    // Add event_name to query if available
    if (eventName) {
      matchQuery.event_name = eventName
    }
    
    const allMatches = allNonTeamEventNames.size > 0
      ? await EventSchedule.find(matchQuery).lean()
      : []

    // Group matches by player and sport
    const matchesByPlayerAndSport = {}
    for (const match of allMatches) {
      if (match.players && Array.isArray(match.players)) {
        for (const playerRegNumber of match.players) {
          if (reg_numbers.includes(playerRegNumber)) {
            if (!matchesByPlayerAndSport[playerRegNumber]) {
              matchesByPlayerAndSport[playerRegNumber] = {}
            }
            if (!matchesByPlayerAndSport[playerRegNumber][match.sports_name]) {
              matchesByPlayerAndSport[playerRegNumber][match.sports_name] = []
            }
            matchesByPlayerAndSport[playerRegNumber][match.sports_name].push({
              sport: match.sports_name,
              match_number: match.match_number,
              match_type: match.match_type,
              match_date: match.match_date,
              status: match.status
            })
          }
        }
      }
    }

    // Validate each player using the pre-fetched data
    const playersWithTeams = []
    const playersWithMatches = []
    const playersToDelete = []

    for (const reg_number of reg_numbers) {
      const enrollments = playerEnrollmentsMap[reg_number] || { teams: [], nonTeamEvents: [] }
      const { teams, nonTeamEvents } = enrollments
      const player = players.find(p => p.reg_number === reg_number)

      // Cannot delete if player is a member of any team (for team events, team membership is enough)
      if (teams.length > 0) {
        playersWithTeams.push({
          reg_number,
          full_name: player?.full_name || reg_number,
          teams
        })
        continue
      }

      // For non-team events, check for matches
      const playerMatches = []
      const playerNonTeamEventNames = nonTeamEvents.map(e => e.sport)
      for (const eventName of playerNonTeamEventNames) {
        if (matchesByPlayerAndSport[reg_number] && matchesByPlayerAndSport[reg_number][eventName]) {
          playerMatches.push(...matchesByPlayerAndSport[reg_number][eventName])
        }
      }

      // Cannot delete if player has matches in non-team events
      if (playerMatches.length > 0) {
        playersWithMatches.push({
          reg_number,
          full_name: player?.full_name || reg_number,
          matches: playerMatches
        })
        continue
      }

      // Player can be deleted
      playersToDelete.push({
        reg_number,
        nonTeamEvents
      })
    }

    // If any players cannot be deleted, return error with details
    if (playersWithTeams.length > 0 || playersWithMatches.length > 0) {
      // Custom error response to always include constraint details
      return res.status(400).json({
        success: false,
        error: 'Some players cannot be deleted due to constraints',
        playersWithTeams,
        playersWithMatches,
        totalFailed: playersWithTeams.length + playersWithMatches.length,
        totalRequested: reg_numbers.length
      })
    }

    // OPTIMIZATION: Group non-team events by sport name for batch updates
    const sportUpdatesMap = {} // sport name -> array of reg_numbers to remove
    const deletedEventsCount = {}
    const regNumbersToDelete = []

    for (const playerData of playersToDelete) {
      const { reg_number, nonTeamEvents } = playerData
      regNumbersToDelete.push(reg_number)

      // Track deleted events for response
      deletedEventsCount[reg_number] = nonTeamEvents.map(e => e.sport)

      // Group by sport for batch updates
      for (const event of nonTeamEvents) {
        if (!sportUpdatesMap[event.sport]) {
          sportUpdatesMap[event.sport] = []
        }
        sportUpdatesMap[event.sport].push(reg_number)
      }
    }

    // OPTIMIZATION: Update all sports in batch (one query per sport)
    const sportNames = Object.keys(sportUpdatesMap)
    for (const sportName of sportNames) {
      const regNumbersToRemove = sportUpdatesMap[sportName]
      
      // Update sport to remove all players at once
      await Sport.updateOne(
        {
          name: sportName,
          event_year: eventYear
        },
        {
          $pull: { players_participated: { $in: regNumbersToRemove } }
        }
      )

      // Clear cache for this sport (only once per sport)
      clearCache(`/api/sports?event_year=${eventYear}`)
      clearCache(`/api/sports/${sportName}?event_year=${eventYear}`)
      clearCache(`/api/participants/${sportName}?event_year=${eventYear}`)
      clearCache(`/api/participants-count/${sportName}?event_year=${eventYear}`)
      clearCache(`/api/sports-counts?event_year=${eventYear}`)
    }

    // OPTIMIZATION: Delete all players in one query
    if (regNumbersToDelete.length > 0) {
      await Player.deleteMany({ reg_number: { $in: regNumbersToDelete } })
      
      // Clear player gender cache for all deleted players
      for (const reg_number of regNumbersToDelete) {
        clearPlayerGenderCache(reg_number)
      }
    }

    // Clear cache (use pattern to clear all variations with query params)
    clearCachePattern('/api/players')
    clearCache(`/api/me?event_year=${eventYear}`)

    return sendSuccessResponse(
      res,
      {
        deleted_count: playersToDelete.length,
        deleted_players: playersToDelete.map(p => p.reg_number),
        deleted_events: deletedEventsCount
      },
      `Successfully deleted ${playersToDelete.length} player(s).`
    )
  })
)

export default router
