/**
 * Team Routes
 * Handles team management operations using Sports collection
 */

import express from 'express'
import Sport from '../models/Sport.js'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireRegistrationPeriod } from '../middleware/dateRestrictions.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError, handleForbiddenError } from '../utils/errorHandler.js'
import { trimObjectFields } from '../utils/validation.js'
import { getCache, setCache, clearCache } from '../utils/cache.js'
import { clearTeamGenderCache, clearSportGenderCache } from '../utils/genderHelpers.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { findSportByNameAndId } from '../utils/sportHelpers.js'
import { requireAdminOrCoordinator } from '../utils/coordinatorHelpers.js'

const router = express.Router()

/**
 * POST /api/update-team-participation
 * Captain creates a team (workflow: captain assigned via POST /api/add-captain)
 * Event ID Required: event_id field required in request body (defaults to active event)
 * Update Sports collection's teams_participated array (for the specified event)
 */
router.post(
  '/update-team-participation',
  authenticateToken,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    let { team_name, sport, reg_numbers, event_id } = req.body

    // Trim fields
    const trimmed = trimObjectFields({ team_name, sport, event_id })
    sport = trimmed.sport
    team_name = trimmed.team_name
    event_id = trimmed.event_id

    if (!event_id || !String(event_id).trim()) {
      return sendErrorResponse(res, 400, 'event_id is required')
    }

    // Get event (default to active event if not provided)
    const eventYearData = await getEventYear(String(event_id).trim(), { returnDoc: true })
    const eventId = eventYearData.doc.event_id

    // Validate required fields
    if (!team_name || !sport || !reg_numbers || !Array.isArray(reg_numbers) || reg_numbers.length === 0) {
      return sendErrorResponse(res, 400, 'Team name, sport, and registration numbers array are required')
    }

    // Trim reg_numbers array
    reg_numbers = reg_numbers.map((rn) => rn?.trim()).filter((rn) => rn)

    // Check for duplicate players in the team
    const regNumberSet = new Set()
    const duplicates = []
    for (const reg_number of reg_numbers) {
      if (regNumberSet.has(reg_number)) {
        duplicates.push(reg_number)
      } else {
        regNumberSet.add(reg_number)
      }
    }
    if (duplicates.length > 0) {
      return sendErrorResponse(
        res,
        400,
        `Duplicate players found in team: ${duplicates.join(', ')}. Each player can only be selected once.`
      )
    }

    // Find sport by name and event_id
    const sportDoc = await findSportByNameAndId(sport, eventId, { lean: false })

    // Coordinators cannot participate in the same sport
    if (sportDoc.eligible_coordinators && sportDoc.eligible_coordinators.includes(loggedInUserRegNumber)) {
      return handleForbiddenError(
        res,
        `You are a coordinator for ${sport} and cannot create or join a team for that sport.`
      )
    }

    // Validate sport is a team sport
    if (sportDoc.type !== 'dual_team' && sportDoc.type !== 'multi_team') {
      return sendErrorResponse(res, 400, 'Team participation is only applicable for team sports (dual_team or multi_team)')
    }

    // Check if team name already exists for this sport
    const existingTeam = sportDoc.teams_participated.find(
      team => team.team_name.toLowerCase() === team_name.toLowerCase()
    )
    if (existingTeam) {
      return sendErrorResponse(
        res,
        400,
        `Team name "${team_name}" already exists for ${sport}. Please choose a different team name.`
      )
    }

    // Fetch all players at once
    const players = await Player.find({ reg_number: { $in: reg_numbers } }).select('-password')
    const playersMap = new Map(players.map((p) => [p.reg_number, p]))

    // Validate all players exist
    const errors = []
    for (const reg_number of reg_numbers) {
      if (!playersMap.has(reg_number)) {
        errors.push(`Player with reg_number ${reg_number} not found`)
      }
    }
    if (errors.length > 0) {
      return sendErrorResponse(res, 400, errors.join('; '))
    }

    const playerData = reg_numbers.map(rn => playersMap.get(rn))

    // Coordinators cannot participate in the same sport
    if (sportDoc.eligible_coordinators && sportDoc.eligible_coordinators.length > 0) {
      const coordinatorInTeam = reg_numbers.find(rn => sportDoc.eligible_coordinators.includes(rn))
      if (coordinatorInTeam) {
        return sendErrorResponse(
          res,
          400,
          `Player ${coordinatorInTeam} is a coordinator for ${sport} and cannot participate in that sport.`
        )
      }
    }

    // Validate that all players have the same gender
    if (playerData.length > 0) {
      const firstGender = playerData[0].gender
      const genderMismatches = playerData.filter((p) => p.gender !== firstGender).map((p) => `${p.full_name} (${p.reg_number})`)

      if (genderMismatches.length > 0) {
        return sendErrorResponse(
          res,
          400,
          `Gender mismatch: ${genderMismatches.join(', ')} must have the same gender (${firstGender}) as other team members.`
        )
      }
    }

    // CRITICAL: Validate that all players have the same year
    if (playerData.length > 0) {
      const firstYear = playerData[0].year
      const yearMismatches = playerData.filter((p) => p.year !== firstYear).map((p) => `${p.full_name} (${p.reg_number})`)

      if (yearMismatches.length > 0) {
        return sendErrorResponse(
          res,
          400,
          `Year mismatch: ${yearMismatches.join(', ')} must be in the same year (${firstYear}) as other team members.`
        )
      }
    }

    // Validate captain eligibility
    const loggedInUserRegNumber = req.user?.reg_number
    if (!loggedInUserRegNumber) {
      return handleForbiddenError(res, 'You must be logged in to create a team')
    }

    // Check if logged-in user is in eligible_captains
    if (!sportDoc.eligible_captains || !sportDoc.eligible_captains.includes(loggedInUserRegNumber)) {
      return handleForbiddenError(
        res,
        `You can only create teams for sports where you are assigned as captain. You are not assigned as captain for ${sport}.`
      )
    }

    // Check if logged-in user is in the team
    if (!reg_numbers.includes(loggedInUserRegNumber)) {
      return handleForbiddenError(res, 'You must be included in the team to create it.')
    }

    // Validate exactly one captain in the team
    const captainsInTeam = playerData.filter(
      (p) => sportDoc.eligible_captains && sportDoc.eligible_captains.includes(p.reg_number)
    )

    if (captainsInTeam.length === 0) {
      return sendErrorResponse(
        res,
        400,
        `Team must have exactly one captain for ${sport}. At least one player in the team must be assigned as captain for this sport.`
      )
    }

    if (captainsInTeam.length > 1) {
      const captainNames = captainsInTeam.map((p) => `${p.full_name} (${p.reg_number})`)
      return sendErrorResponse(
        res,
        400,
        `Multiple captains found in the same team: ${captainNames.join(', ')}. A team can only have exactly one captain for ${sport}.`
      )
    }

    // Validate team size
    if (sportDoc.team_size !== null && sportDoc.team_size !== undefined) {
      if (reg_numbers.length !== sportDoc.team_size) {
        return sendErrorResponse(
          res,
          400,
          `Team size mismatch. This sport requires exactly ${sportDoc.team_size} players, but ${reg_numbers.length} players were provided.`
        )
      }
    }

    // Check if any player is already in a team for this sport
    for (const player of playerData) {
      const existingTeam = sportDoc.teams_participated.find(
        team => team.players && team.players.includes(player.reg_number)
      )
      if (existingTeam) {
        return sendErrorResponse(
          res,
          400,
          `${player.full_name} (${player.reg_number}) is already in a team (${existingTeam.team_name}) for ${sport}. A player can only belong to one team per sport.`
        )
      }
    }

    // Add team to teams_participated array
    const captain = captainsInTeam[0]
    const newTeam = {
      team_name: team_name.trim(),
      captain: captain.reg_number,
      players: reg_numbers
    }

    if (!sportDoc.teams_participated) {
      sportDoc.teams_participated = []
    }
    sportDoc.teams_participated.push(newTeam)
    await sportDoc.save()

    // Clear cache
    clearCache(`/api/sports?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/teams/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports-counts?event_id=${encodeURIComponent(eventId)}`)
    // Clear gender cache for this team (team composition changed)
    clearTeamGenderCache(team_name, sport, eventYear, eventName)

    return sendSuccessResponse(
      res,
      { team: newTeam, sport: sportDoc },
      `Team "${team_name}" created successfully for ${sport}`
    )
  })
)

/**
 * GET /api/teams/:sport
 * Get all teams for a specific sport
 * Event ID Filter: Accepts ?event_id=2026-umang parameter (defaults to active event)
 * Query Sports collection instead of Player collection
 */
router.get(
  '/teams/:sport',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Decode the sport name from URL parameter
    let sport = decodeURIComponent(req.params.sport)

    if (!sport) {
      return sendErrorResponse(res, 400, 'Sport name is required')
    }

    let eventYearData
    
    try {
      // Try to get event year with document - if it doesn't exist, return empty teams array
      const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
      eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
    } catch (error) {
      // If event year not found, return empty teams array instead of error
      if (error.message === 'Event year not found' || error.message === 'No active event year found') {
        const emptyResult = {
          sport: sport,
          teams: [],
          total_teams: 0
        }
        return sendSuccessResponse(res, emptyResult)
      }
      // Re-throw other errors to be handled by asyncHandler
      throw error
    }

    const eventId = eventYearData.doc.event_id

    // Check cache
    const cacheKey = `/api/teams/${sport}?event_id=${encodeURIComponent(eventId)}`
    const cached = getCache(cacheKey)
    if (cached) {
      // Always use sendSuccessResponse for consistency, even for cached data
      return sendSuccessResponse(res, cached)
    }

    // Find sport by name and event_id
    let sportDoc
    try {
      sportDoc = await findSportByNameAndId(sport, eventId)
    } catch (error) {
      // If sport not found, return empty teams array
      if (error.message.includes('not found')) {
        const emptyResult = {
          sport: sport,
          teams: [],
          total_teams: 0
        }
        return sendSuccessResponse(res, emptyResult)
      }
      // Re-throw other errors to be handled by asyncHandler
      throw error
    }

    // Get all unique player registration numbers from all teams
    const allRegNumbers = new Set()
    ;(sportDoc.teams_participated || []).forEach(team => {
      if (team.players && Array.isArray(team.players)) {
        team.players.forEach(regNumber => allRegNumbers.add(regNumber))
      }
    })

    // Fetch all players at once for efficiency
    const playersList = await Player.find({ reg_number: { $in: Array.from(allRegNumbers) } })
      .select('-password')
      .lean()
    
    // Create a map for quick lookup
    const playersMap = new Map(playersList.map(p => [p.reg_number, p]))

    // Get teams from teams_participated array and populate player details
    const teams = (sportDoc.teams_participated || []).map(team => {
      const playerRegNumbers = team.players || []
      const playerDetails = playerRegNumbers
        .map(regNumber => {
          const player = playersMap.get(regNumber)
          if (!player) return null
          // Return player object with all necessary fields
          return {
            reg_number: player.reg_number,
            full_name: player.full_name,
            department_branch: player.department_branch,
            year: player.year,
            gender: player.gender,
            mobile_number: player.mobile_number,
            email_id: player.email_id,
            captain_in: player.captain_in || []
          }
        })
        .filter(p => p !== null) // Remove any null entries (players not found)
      
      return {
        team_name: team.team_name,
        captain: team.captain,
        players: playerDetails,
        player_count: playerDetails.length
      }
    })

    // Sort teams by team name
    teams.sort((a, b) => a.team_name.localeCompare(b.team_name))

    const result = {
      sport: sport,
      teams: teams,
      total_teams: teams.length
    }

    // Cache the result
    setCache(cacheKey, result)

    return sendSuccessResponse(res, result)
  })
)

/**
 * POST /api/update-team-player
 * Update/replace a player in a team (admin only)
 * Event ID Filter: Accepts ?event_id=2026-umang parameter (defaults to active event)
 * Update Sports collection's teams_participated[].players array (for the specified event)
 */
router.post(
  '/update-team-player',
  authenticateToken,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    let { team_name, sport, old_reg_number, new_reg_number, event_id } = req.body

    // Trim fields
    const trimmed = trimObjectFields({ team_name, sport, old_reg_number, new_reg_number, event_id })
    sport = trimmed.sport
    team_name = trimmed.team_name
    old_reg_number = trimmed.old_reg_number
    new_reg_number = trimmed.new_reg_number
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
    if (!team_name || !sport || !old_reg_number || !new_reg_number) {
      return sendErrorResponse(
        res,
        400,
        'Team name, sport, old registration number, and new registration number are required'
      )
    }

    // Find sport by name and event_id
    const sportDoc = await findSportByNameAndId(sport, eventId, { lean: false })

    // Find the team
    const team = sportDoc.teams_participated.find(
      t => t.team_name.toLowerCase() === team_name.toLowerCase()
    )
    if (!team) {
      return sendErrorResponse(res, 404, `Team "${team_name}" not found for ${sport}`)
    }

    // Check if old player is in the team
    if (!team.players || !team.players.includes(old_reg_number)) {
      return sendErrorResponse(res, 400, 'Old player is not in this team')
    }

    // Check if new player is already in this team
    if (team.players.includes(new_reg_number)) {
      return sendErrorResponse(res, 400, 'New player is already in this team')
    }

    // Find old and new players
    const oldPlayer = await Player.findOne({ reg_number: old_reg_number })
    if (!oldPlayer) {
      return handleNotFoundError(res, 'Old player')
    }

    const newPlayer = await Player.findOne({ reg_number: new_reg_number })
    if (!newPlayer) {
      return handleNotFoundError(res, 'New player')
    }

    // Get all current team members (excluding the old player)
    const currentTeamMembersRegNumbers = team.players.filter(rn => rn !== old_reg_number)
    const currentTeamMembers = await Player.find({
      reg_number: { $in: currentTeamMembersRegNumbers }
    }).select('-password').lean()

    // Validate gender match with team
    if (currentTeamMembers.length > 0) {
      const teamGender = currentTeamMembers[0].gender
      if (newPlayer.gender !== teamGender) {
        return sendErrorResponse(
          res,
          400,
          `Gender mismatch: New player must have the same gender (${teamGender}) as other team members.`
        )
      }

      // CRITICAL: Validate same year
      const teamYear = currentTeamMembers[0].year
      if (newPlayer.year !== teamYear) {
        return sendErrorResponse(
          res,
          400,
          `Year mismatch: New player must be in the same year (${teamYear}) as other team members.`
        )
      }
    }

    // Check if new player is already in another team for this sport
    const existingTeam = sportDoc.teams_participated.find(
      t => t.players && t.players.includes(new_reg_number)
    )
    if (existingTeam) {
      return sendErrorResponse(
        res,
        400,
        `New player is already in a team (${existingTeam.team_name}) for ${sport}. A player can only belong to one team per sport.`
      )
    }

    // Cannot replace the captain - captain is immutable once team is created
    if (team.captain === old_reg_number) {
      return sendErrorResponse(
        res,
        400,
        'Cannot replace the team captain. The captain cannot be changed once a team is created. To change the captain, you must delete the team and create a new one.'
      )
    }

    // Replace player in team
    const playerIndex = team.players.indexOf(old_reg_number)
    if (playerIndex !== -1) {
      team.players[playerIndex] = new_reg_number
      await sportDoc.save()
    }

    // Clear cache
    clearCache(`/api/sports?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/teams/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports-counts?event_id=${encodeURIComponent(eventId)}`)
    // Clear gender cache for this team (team composition changed - first player might have changed)
    clearTeamGenderCache(team_name, sport, eventYear, eventName)

    const newPlayerData = newPlayer.toObject()
    delete newPlayerData.password

    return sendSuccessResponse(
      res,
      {
        old_player: { reg_number: old_reg_number, full_name: oldPlayer.full_name },
        new_player: newPlayerData,
        team: team
      },
      `Player updated successfully in team ${team_name}`
    )
  })
)

/**
 * DELETE /api/delete-team
 * Delete a team (remove from teams_participated array) (admin only)
 * Event ID Required: event_id field required in request body (defaults to active event)
 */
router.delete(
  '/delete-team',
  authenticateToken,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    let { team_name, sport, event_id } = req.body

    // Trim fields
    const trimmed = trimObjectFields({ team_name, sport, event_id })
    sport = trimmed.sport
    team_name = trimmed.team_name
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
    if (!team_name || !sport) {
      return sendErrorResponse(res, 400, 'Team name and sport are required')
    }

    // Find sport by name and event_id
    const sportDoc = await findSportByNameAndId(sport, eventId, { lean: false })

    // Find the team
    const teamIndex = sportDoc.teams_participated.findIndex(
      t => t.team_name.toLowerCase() === team_name.toLowerCase()
    )
    if (teamIndex === -1) {
      return handleNotFoundError(res, 'Team')
    }

    const team = sportDoc.teams_participated[teamIndex]

    // Get team members info
    const teamMembers = await Player.find({
      reg_number: { $in: team.players || [] }
    }).select('reg_number full_name').lean()

    // Remove team from teams_participated array
    sportDoc.teams_participated.splice(teamIndex, 1)
    await sportDoc.save()

    // Clear cache
    clearCache(`/api/sports?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/teams/${sport}?event_id=${encodeURIComponent(eventId)}`)
    clearCache(`/api/sports-counts?event_id=${encodeURIComponent(eventId)}`)
    // Clear gender cache for this team (team deleted)
    clearTeamGenderCache(team_name, sport, eventId)

    return sendSuccessResponse(
      res,
      {
        deleted_count: teamMembers.length,
        team_members: teamMembers
      },
      `Team "${team_name}" deleted successfully. Removed ${teamMembers.length} player(s) from the team.`
    )
  })
)

/**
 * POST /api/validate-participations
 * Validate participations before team registration
 * Updated to use Sports collection
 */
router.post(
  '/validate-participations',
  authenticateToken,
  asyncHandler(async (req, res) => {
    let { reg_numbers, sport, event_id } = req.body

    // Trim fields
    sport = sport?.trim()
    event_id = event_id ? String(event_id).trim() : null
    if (Array.isArray(reg_numbers)) {
      reg_numbers = reg_numbers.map((rn) => rn?.trim()).filter((rn) => rn)
    }

    // Validate required fields
    if (!reg_numbers || !Array.isArray(reg_numbers) || reg_numbers.length === 0 || !sport) {
      return sendErrorResponse(res, 400, 'Registration numbers array and sport are required')
    }

    // Get event with document (default to active event if not provided)
    const eventYearData = await getEventYear(event_id || null, { returnDoc: true })
    const eventId = eventYearData.doc.event_id

    // Find sport by name and event_id
    const sportDoc = await findSportByNameAndId(sport, eventId)

    const errors = []

    // Fetch all players at once
    const players = await Player.find({ reg_number: { $in: reg_numbers } }).select('-password').lean()
    const playersMap = new Map(players.map((p) => [p.reg_number, p]))

    // Validate each player
    for (const reg_number of reg_numbers) {
      const player = playersMap.get(reg_number)
      if (!player) {
        errors.push(`Player with reg_number ${reg_number} not found`)
        continue
      }

      // Check if already in a team for this sport
      const existingTeam = sportDoc.teams_participated.find(
        team => team.players && team.players.includes(reg_number)
      )
      if (existingTeam) {
        const isCaptain = existingTeam.captain === reg_number
        if (isCaptain) {
          errors.push(
            `${player.full_name} (${reg_number}) is a captain and has already created a team (${existingTeam.team_name}) for ${sport}. A captain cannot create multiple teams for the same sport.`
          )
        } else {
          errors.push(
            `${player.full_name} (${reg_number}) is already in a team (${existingTeam.team_name}) for ${sport}. A player can only belong to one team per sport.`
          )
        }
        continue
      }

    }

    if (errors.length > 0) {
      return sendErrorResponse(res, 400, errors.join('; '))
    }

    return sendSuccessResponse(res, { valid: true }, 'All players are valid for team registration')
  })
)

export default router
