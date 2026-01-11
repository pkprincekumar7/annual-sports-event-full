/**
 * Event Schedule Routes
 * Handles event schedule/match management operations using new schema
 */

import express from 'express'
import EventSchedule from '../models/EventSchedule.js'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireEventPeriod, requireEventSchedulingPeriod, requireEventStatusUpdatePeriod, isMatchDateWithinEventRange } from '../middleware/dateRestrictions.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import logger from '../utils/logger.js'
import { getCache, setCache, clearCache } from '../utils/cache.js'
import { updatePointsTable } from '../utils/pointsTable.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { findSportByNameAndYear, normalizeSportName } from '../utils/sportHelpers.js'
import { getMatchGender, getParticipantsGender } from '../utils/genderHelpers.js'
import { clearMatchCaches, clearNewMatchCaches } from '../utils/cacheHelpers.js'
import { 
  validateMatchTypeForSport, 
  validateFinalMatchRequirement,
  validateAllMatchesCompletedBeforeFinal,
  validateAllLeagueMatchesCompletedBeforeKnockout,
  getKnockedOutParticipants,
  getParticipantsInScheduledMatches
} from '../utils/matchValidation.js'

const router = express.Router()

/**
 * GET /api/event-schedule/:sport
 * Get all matches for a sport
 * Year Filter: Accepts ?year=2026 parameter (defaults to active year)
 */
router.get(
  '/event-schedule/:sport',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { sport } = req.params
    const eventYear = await getEventYear(req.query.year ? parseInt(req.query.year) : null)
    const gender = req.query.gender // Optional: 'Male' or 'Female'

    // Build cache key with gender if provided
    const cacheKey = gender 
      ? `/api/event-schedule/${sport}?year=${eventYear}&gender=${gender}`
      : `/api/event-schedule/${sport}?year=${eventYear}`
    
    const cached = getCache(cacheKey)
    if (cached) {
      // Always use sendSuccessResponse for consistency, even for cached data
      return sendSuccessResponse(res, cached)
    }

    // Fetch all matches (gender will be derived from participants)
    const allMatches = await EventSchedule.find({
      sports_name: normalizeSportName(sport),
      event_year: eventYear
    }).sort({ match_number: 1 }).lean()

    // Derive gender for each match and filter if gender parameter provided
    const sportDoc = await findSportByNameAndYear(sport, eventYear).catch(() => null)
    const matchesWithGender = []
    
    for (const match of allMatches) {
      const matchGender = await getMatchGender(match, sportDoc)
      // Add gender to match object for frontend
      const matchWithGender = { ...match, gender: matchGender }
      
      // Filter by gender if provided
      if (!gender || (gender === 'Male' || gender === 'Female')) {
        if (!gender || matchGender === gender) {
          matchesWithGender.push(matchWithGender)
        }
      }
    }

    const result = { matches: matchesWithGender }

    // Cache the result
    setCache(cacheKey, result)

    return sendSuccessResponse(res, result)
  })
)

/**
 * GET /api/event-schedule/:sport/teams-players
 * Get teams/players list for a sport (for dropdown in form) (admin only)
 * Year Filter: Accepts ?year=2026 parameter (defaults to active year)
 * Get teams from Sports collection's teams_participated (filtered by year)
 * Get players from Sports collection's players_participated (filtered by year)
 * Exclude teams/players that have been knocked out in previous matches
 */
router.get(
  '/event-schedule/:sport/teams-players',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { sport } = req.params
    const decodedSport = decodeURIComponent(sport)
    const eventYear = await getEventYear(req.query.year ? parseInt(req.query.year) : null)
    const gender = req.query.gender // Required: 'Male' or 'Female'

    // Validate gender is provided
    if (!gender || (gender !== 'Male' && gender !== 'Female')) {
      return sendErrorResponse(res, 400, 'Gender parameter is required and must be "Male" or "Female"')
    }

    // Find sport by name and event_year
    const sportDoc = await findSportByNameAndYear(decodedSport, eventYear)
    
    if (!sportDoc) {
      return sendErrorResponse(res, 404, `Sport "${decodedSport}" not found for year ${eventYear}`)
    }

    // Get knocked out participants and participants in scheduled matches using utility functions
    let knockedOutParticipants = new Set()
    let participantsInScheduledMatches = new Set()
    
    try {
      knockedOutParticipants = await getKnockedOutParticipants(decodedSport, eventYear, gender, sportDoc)
      participantsInScheduledMatches = await getParticipantsInScheduledMatches(decodedSport, eventYear, gender, sportDoc)
    } catch (error) {
      logger.error('Error getting knocked out or scheduled participants:', error)
      return sendErrorResponse(res, 500, 'Error retrieving participant eligibility data')
    }

    if (sportDoc.type === 'dual_team' || sportDoc.type === 'multi_team') {
      // Get teams from teams_participated with gender information
      // Exclude: 1) knocked out teams, 2) teams already in scheduled knockout matches
      const eligibleTeams = (sportDoc.teams_participated || [])
        .filter(team => {
          const trimmedTeamName = (team.team_name || '').trim()
          return trimmedTeamName && !knockedOutParticipants.has(trimmedTeamName) && !participantsInScheduledMatches.has(trimmedTeamName)
        })
      
      // Get first player from each team to determine gender (teams already have same gender players)
      const teamPlayerRegNumbers = []
      const teamMap = new Map()
      
      eligibleTeams.forEach(team => {
        if (team.players && team.players.length > 0) {
          teamPlayerRegNumbers.push(team.players[0])
          teamMap.set(team.players[0], team.team_name)
        }
      })
      
      // Fetch gender for first player of each team
      const teamPlayers = await Player.find({
        reg_number: { $in: teamPlayerRegNumbers }
      })
        .select('reg_number gender')
        .lean()
      
      // Create teams list with gender information, filtered by requested gender
      const teams = eligibleTeams
        .map(team => {
          const firstPlayerRegNumber = team.players && team.players.length > 0 ? team.players[0] : null
          const playerData = teamPlayers.find(p => p.reg_number === firstPlayerRegNumber)
          return {
            team_name: team.team_name,
            gender: playerData ? playerData.gender : null
          }
        })
        .filter(team => team.gender === gender) // Filter by requested gender
        .sort((a, b) => a.team_name.localeCompare(b.team_name))

      return sendSuccessResponse(res, { teams, players: [] })
    } else {
      // Get players from players_participated
      // Exclude: 1) knocked out players, 2) players already in scheduled knockout matches
      const playerRegNumbers = (sportDoc.players_participated || [])
        .filter(regNumber => {
          const trimmedRegNumber = (regNumber || '').trim()
          return trimmedRegNumber && !knockedOutParticipants.has(trimmedRegNumber) && !participantsInScheduledMatches.has(trimmedRegNumber)
        })

      // Fetch player details
      const players = await Player.find({
        reg_number: { $in: playerRegNumbers }
      })
        .select('reg_number full_name gender')
        .lean()

      const playersList = players
        .filter(p => p.gender === gender) // Filter by requested gender
        .map(p => ({
          reg_number: p.reg_number,
          full_name: p.full_name,
          gender: p.gender
        }))

      return sendSuccessResponse(res, { teams: [], players: playersList })
    }
  })
)

/**
 * POST /api/event-schedule
 * Create a new match (admin only)
 * Year Required: event_year field required in request body (defaults to active year)
 */
router.post(
  '/event-schedule',
  authenticateToken,
  requireAdmin,
  requireEventPeriod,
  asyncHandler(async (req, res) => {
    const { match_type, sports_name, teams, players, match_date, event_year, number_of_participants } = req.body

    // Get event year (default to active year if not provided)
    const eventYear = await getEventYear(event_year ? parseInt(event_year) : null, { returnDoc: true })
    const eventYearDoc = eventYear.doc

    // Validate required fields (gender will be derived from participants)
    if (!match_type || !sports_name || !match_date) {
      return sendErrorResponse(res, 400, 'Missing required fields: match_type, sports_name, match_date')
    }

    // Validate match_date is within event date range
    if (!isMatchDateWithinEventRange(match_date, eventYearDoc)) {
      const eventStart = new Date(eventYearDoc.event_dates.start)
      const eventEnd = new Date(eventYearDoc.event_dates.end)
      const formatDate = (date) => {
        const d = new Date(date)
        const day = d.getDate()
        const month = d.toLocaleString('en-US', { month: 'short' })
        const year = d.getFullYear()
        const ordinal = day % 10 === 1 && day % 100 !== 11 ? day + 'st' : day % 10 === 2 && day % 100 !== 12 ? day + 'nd' : day % 10 === 3 && day % 100 !== 13 ? day + 'rd' : day + 'th'
        return `${ordinal} ${month} ${year}`
      }
      return sendErrorResponse(
        res,
        400,
        `Match date must be within event date range (${formatDate(eventStart)} to ${formatDate(eventEnd)})`
      )
    }

    // Find sport by name and event_year
    const sportDoc = await findSportByNameAndYear(sports_name, eventYear.year, { lean: false })

    // Declare variables for trimmed/unique participants (used later for knockout validation)
    let uniqueTeams = null
    let uniquePlayers = null
    let derivedGender = null // Will be set based on sport type (team or player)

    // Validate teams/players arrays based on sport type
    if (sportDoc.type === 'dual_team' || sportDoc.type === 'multi_team') {
      if (!teams || !Array.isArray(teams) || teams.length === 0) {
        return sendErrorResponse(res, 400, 'Teams array is required for team sports')
      }
      // Remove duplicates
      uniqueTeams = [...new Set(teams.map(t => t.trim()).filter(t => t))]
      if (sportDoc.type === 'dual_team' && uniqueTeams.length !== 2) {
        return sendErrorResponse(res, 400, 'dual_team sports require exactly 2 teams')
      }
      if (sportDoc.type === 'multi_team') {
        // Validate number_of_participants for multi_team
        if (number_of_participants !== undefined) {
          const num = parseInt(number_of_participants)
          if (isNaN(num) || num < 3 || num > 100) {
            return sendErrorResponse(res, 400, 'number_of_participants must be between 3 and 100')
          }
          if (uniqueTeams.length !== num) {
            return sendErrorResponse(res, 400, `Number of teams (${uniqueTeams.length}) does not match number_of_participants (${num})`)
          }
        }
        if (uniqueTeams.length <= 2) {
          return sendErrorResponse(res, 400, 'multi_team sports require more than 2 teams')
        }
        // Validate number of teams matches available teams count
        const availableTeamsCount = (sportDoc.teams_participated || []).length
        if (uniqueTeams.length > availableTeamsCount) {
          return sendErrorResponse(res, 400, `Cannot select ${uniqueTeams.length} teams. Only ${availableTeamsCount} team(s) available.`)
        }
      }
      // Validate teams exist in teams_participated
      const existingTeams = new Set((sportDoc.teams_participated || []).map(t => t.team_name))
      for (const team of uniqueTeams) {
        if (!existingTeams.has(team)) {
          return sendErrorResponse(res, 400, `Team "${team}" does not exist for ${sports_name}`)
        }
      }
      
      // Validate all teams have players of the same gender (for both dual_team and multi_team)
      // Since team creation already enforces same gender within a team, we only need to check one player per team
      const teamDetails = (sportDoc.teams_participated || []).filter(t => uniqueTeams.includes(t.team_name))
      
      // Get first player from each team (teams already have same gender players)
      const firstPlayerRegNumbers = teamDetails
        .map(team => team.players && team.players.length > 0 ? team.players[0] : null)
        .filter(Boolean)
      
      if (firstPlayerRegNumbers.length !== uniqueTeams.length) {
        return sendErrorResponse(res, 400, 'Some teams have no players')
      }
      
      // Fetch gender for first player of each team
      const playersList = await Player.find({ reg_number: { $in: firstPlayerRegNumbers } })
        .select('reg_number gender')
        .lean()
      
      if (playersList.length !== firstPlayerRegNumbers.length) {
        return sendErrorResponse(res, 400, 'Some players not found')
      }
      
      // Check if all teams have the same gender (gender is derived from participants, not provided)
      const teamGenders = playersList.map(p => p.gender).filter(Boolean)
      if (teamGenders.length > 0) {
        const firstGender = teamGenders[0]
        const genderMismatch = teamGenders.find(g => g !== firstGender)
        if (genderMismatch) {
          return sendErrorResponse(res, 400, 'All teams must have players of the same gender for team matches')
        }
        // Store derived gender for later use (for cache clearing, etc.)
        derivedGender = firstGender
      } else {
        return sendErrorResponse(res, 400, 'Could not determine gender for teams')
      }
    } else {
      if (!players || !Array.isArray(players) || players.length === 0) {
        return sendErrorResponse(res, 400, 'Players array is required for individual/cultural sports')
      }
      // Remove duplicates
      uniquePlayers = [...new Set(players.map(p => p.trim()).filter(p => p))]
      if (sportDoc.type === 'dual_player' && uniquePlayers.length !== 2) {
        return sendErrorResponse(res, 400, 'dual_player sports require exactly 2 players')
      }
      if (sportDoc.type === 'multi_player') {
        // Validate number_of_participants for multi_player
        if (number_of_participants !== undefined) {
          const num = parseInt(number_of_participants)
          if (isNaN(num) || num < 3 || num > 100) {
            return sendErrorResponse(res, 400, 'number_of_participants must be between 3 and 100')
          }
          if (uniquePlayers.length !== num) {
            return sendErrorResponse(res, 400, `Number of players (${uniquePlayers.length}) does not match number_of_participants (${num})`)
          }
        }
        if (uniquePlayers.length <= 2) {
          return sendErrorResponse(res, 400, 'multi_player sports require more than 2 players')
        }
        // Validate number of players matches available players count
        const availablePlayersCount = (sportDoc.players_participated || []).length
        if (uniquePlayers.length > availablePlayersCount) {
          return sendErrorResponse(res, 400, `Cannot select ${uniquePlayers.length} players. Only ${availablePlayersCount} player(s) available.`)
        }
      }
      // Validate players exist in players_participated
      const existingPlayers = new Set(sportDoc.players_participated || [])
      for (const player of uniquePlayers) {
        if (!existingPlayers.has(player)) {
          return sendErrorResponse(res, 400, `Player "${player}" is not registered for ${sports_name}`)
        }
      }
      // Validate all players have same gender (derive gender from participants)
      const playerDocs = await Player.find({ reg_number: { $in: uniquePlayers } }).select('gender').lean()
      if (playerDocs.length !== uniquePlayers.length) {
        return sendErrorResponse(res, 400, 'Some players not found')
      }
      const firstGender = playerDocs[0].gender
      if (!firstGender) {
        return sendErrorResponse(res, 400, 'Could not determine gender for players. Please ensure all players have a valid gender set.')
      }
      const genderMismatch = playerDocs.find(p => p.gender !== firstGender)
      if (genderMismatch) {
        return sendErrorResponse(res, 400, 'All players must have the same gender')
      }
      // Store derived gender for later use
      derivedGender = firstGender
    }

    // Validate match_type restrictions
    const matchTypeError = validateMatchTypeForSport(match_type, sportDoc.type)
    if (matchTypeError) {
      return sendErrorResponse(res, matchTypeError.statusCode, matchTypeError.message)
    }

    // Validate that all league matches are completed before scheduling knockout (applies to all sport types with gender filter)
    const allLeagueMatchesCompletedError = await validateAllLeagueMatchesCompletedBeforeKnockout(
      sports_name,
      eventYear.year,
      match_type,
      derivedGender,
      sportDoc
    )
    if (allLeagueMatchesCompletedError) {
      return sendErrorResponse(res, allLeagueMatchesCompletedError.statusCode, allLeagueMatchesCompletedError.message)
    }

    // Validate that all other matches are completed before scheduling final (applies to all sport types with gender filter)
    const allMatchesCompletedError = await validateAllMatchesCompletedBeforeFinal(
      sports_name,
      eventYear.year,
      match_type,
      derivedGender,
      sportDoc
    )
    if (allMatchesCompletedError) {
      return sendErrorResponse(res, allMatchesCompletedError.statusCode, allMatchesCompletedError.message)
    }

    // For knockout/final matches, validate that participants are not already in another scheduled knockout/final match
    // and that they have not been knocked out in previous completed knockout/final matches
    // Note: 'draw' and 'cancelled' matches don't block participants - they can be rescheduled
    if (match_type === 'knockout' || match_type === 'final') {
      // Use the trimmed/unique arrays that were created during validation above
      // This ensures consistent comparison with knocked-out participants (which are also trimmed)
      const participantsToCheck = sportDoc.type === 'dual_team' || sportDoc.type === 'multi_team' 
        ? (uniqueTeams || teams.map(t => t.trim()).filter(t => t))
        : (uniquePlayers || players.map(p => p.trim()).filter(p => p))
      
      // Get knocked out participants and participants in scheduled matches using utility functions
      const knockedOutParticipants = await getKnockedOutParticipants(sports_name, eventYear.year, derivedGender, sportDoc)
      const participantsInScheduledMatches = await getParticipantsInScheduledMatches(sports_name, eventYear.year, derivedGender, sportDoc)

      // Check if any participant in the new match is already in a scheduled knockout match or is knocked out
      const conflictingParticipants = participantsToCheck.filter(p => {
        const trimmedP = (p || '').trim()
        const inScheduled = participantsInScheduledMatches.has(trimmedP)
        const isKnockedOut = knockedOutParticipants.has(trimmedP)
        if (inScheduled || isKnockedOut) {
          logger.debug(`Participant "${trimmedP}" conflict: inScheduled=${inScheduled}, isKnockedOut=${isKnockedOut}`)
        }
        return inScheduled || isKnockedOut
      })
      if (conflictingParticipants.length > 0) {
        const participantType = sportDoc.type === 'dual_team' || sportDoc.type === 'multi_team' ? 'team(s)' : 'player(s)'
        // Check if conflict is due to scheduled match or knocked out
        const inScheduled = conflictingParticipants.filter(p => participantsInScheduledMatches.has((p || '').trim()))
        const isKnockedOut = conflictingParticipants.filter(p => knockedOutParticipants.has((p || '').trim()))
        
        const matchTypeLabel = match_type === 'final' ? 'final match' : 'knockout match'
        let errorMessage = `Cannot schedule ${matchTypeLabel}. `
        if (inScheduled.length > 0) {
          errorMessage += `The following ${participantType} are already in a scheduled knockout or final match: ${inScheduled.join(', ')}. `
        }
        if (isKnockedOut.length > 0) {
          errorMessage += `The following ${participantType} have been knocked out in previous knockout or final matches: ${isKnockedOut.join(', ')}. `
        }
        errorMessage += `Please select eligible participants.`
        
        return sendErrorResponse(res, 400, errorMessage)
      }
    }

    // Validate league vs knockout restrictions (gender will be derived)
    if (match_type === 'league') {
      // Check if any knockout match exists for this sport (gender will be derived)
      const allKnockoutMatches = await EventSchedule.find({
        sports_name: normalizeSportName(sports_name),
        event_year: eventYear.year,
        match_type: { $in: ['knockout', 'final'] },
        status: { $in: ['scheduled', 'completed', 'draw', 'cancelled'] }
      }).lean()

      // Check if any knockout match has the same derived gender
      for (const match of allKnockoutMatches) {
        const matchGender = await getMatchGender(match, sportDoc)
        if (matchGender === derivedGender) {
          return sendErrorResponse(res, 400, `Cannot schedule league matches. Knockout matches already exist for this sport and gender (${derivedGender}).`)
        }
      }
    } else if (match_type === 'knockout' || match_type === 'final') {
      // Check if any league match exists for this gender (gender will be derived)
      const allLeagueMatches = await EventSchedule.find({
        sports_name: normalizeSportName(sports_name),
        event_year: eventYear.year,
        match_type: 'league'
      }).sort({ match_date: -1 }).lean()

      // Filter by derived gender
      const leagueMatches = []
      for (const match of allLeagueMatches) {
        const matchGender = await getMatchGender(match, sportDoc)
        if (matchGender === derivedGender) {
          leagueMatches.push(match)
        }
      }

      if (leagueMatches.length > 0) {
        // Validate that match_date is not before all league matches (same date is allowed)
        const latestLeagueDate = new Date(leagueMatches[0].match_date)
        latestLeagueDate.setHours(0, 0, 0, 0)
        // Handle date-only format (YYYY-MM-DD) or datetime format
        const matchDateStr = match_date.includes('T') ? match_date : match_date + 'T00:00:00'
        const matchDateObj = new Date(matchDateStr)
        matchDateObj.setHours(0, 0, 0, 0)
        if (matchDateObj < latestLeagueDate) {
          return sendErrorResponse(
            res,
            400,
            `${match_type === 'knockout' ? 'Knockout' : 'Final'} match date cannot be before all league matches. Latest league match date: ${latestLeagueDate.toLocaleDateString()}`
          )
        }
      }

      // For final matches, also check knockout matches
      if (match_type === 'final') {
        const allKnockoutMatches = await EventSchedule.find({
          sports_name: normalizeSportName(sports_name),
          event_year: eventYear.year,
          match_type: 'knockout'
        }).sort({ match_date: -1 }).lean()

        // Filter by derived gender
        const knockoutMatches = []
        for (const match of allKnockoutMatches) {
          const matchGender = await getMatchGender(match, sportDoc)
          if (matchGender === derivedGender) {
            knockoutMatches.push(match)
          }
        }

        if (knockoutMatches.length > 0) {
          // Validate that match_date is not before all knockout matches (same date is allowed)
          const latestKnockoutDate = new Date(knockoutMatches[0].match_date)
          latestKnockoutDate.setHours(0, 0, 0, 0)
          const matchDateStr = match_date.includes('T') ? match_date : match_date + 'T00:00:00'
          const matchDateObj = new Date(matchDateStr)
          matchDateObj.setHours(0, 0, 0, 0)
          if (matchDateObj < latestKnockoutDate) {
            return sendErrorResponse(
              res,
              400,
              `Final match date cannot be before all knockout matches. Latest knockout match date: ${latestKnockoutDate.toLocaleDateString()}`
            )
          }
        }
      }
    }

    // Validate match_type: 'final' restrictions
    // Use the same logic as GET /api/event-schedule/:sport/teams-players to ensure consistency
    const finalMatchError = await validateFinalMatchRequirement(
      sportDoc,
      derivedGender,
      teams,
      players,
      match_type,
      sports_name,
      eventYear.year
    )
    if (finalMatchError) {
      return sendErrorResponse(res, finalMatchError.statusCode, finalMatchError.message)
    }

    // Prevent scheduling if 'final' match exists with status 'scheduled' or 'completed' for this gender
    // If final match is 'draw' or 'cancelled', another final match can be scheduled
    // Gender will be derived from matches
    const allFinalMatches = await EventSchedule.find({
      sports_name: normalizeSportName(sports_name),
      event_year: eventYear.year,
      match_type: 'final',
      status: { $in: ['scheduled', 'completed'] }
    }).lean()

    for (const match of allFinalMatches) {
      const matchGender = await getMatchGender(match, sportDoc)
      if (matchGender === derivedGender) {
        return sendErrorResponse(res, 400, `Cannot schedule new matches. A final match already exists for this sport and gender (${derivedGender}).`)
      }
    }

    // Validate match date (date-only comparison)
    // Handle date-only format (YYYY-MM-DD) or datetime format
    const matchDateStr = match_date.includes('T') ? match_date : match_date + 'T00:00:00'
    const matchDateObj = new Date(matchDateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    matchDateObj.setHours(0, 0, 0, 0)
    if (matchDateObj < today) {
      return sendErrorResponse(res, 400, 'Match date must be today or a future date')
    }

    // Get next match number for this sport and year
    // Match numbers must be unique per sport/year (not per gender) due to database index
    // So we find the highest match_number for this sport/year regardless of gender
    const lastMatch = await EventSchedule.findOne({
      sports_name: normalizeSportName(sports_name),
      event_year: eventYear.year
    })
      .sort({ match_number: -1 })
      .select('match_number')
      .lean()

    const match_number = lastMatch ? lastMatch.match_number + 1 : 1

    // Create new match (gender is not stored, will be derived from participants)
    const matchData = {
      event_year: eventYear.year,
      match_number,
      match_type,
      sports_name: normalizeSportName(sports_name),
      match_date: new Date(match_date.includes('T') ? match_date : match_date + 'T00:00:00'),
      status: 'scheduled'
    }

    if (sportDoc.type === 'dual_team' || sportDoc.type === 'multi_team') {
      matchData.teams = teams.map(t => t.trim())
      matchData.players = []
    } else {
      matchData.players = players.map(p => p.trim())
      matchData.teams = []
    }

    try {
      const newMatch = new EventSchedule(matchData)
      await newMatch.save()
      
      // Clear caches using helper function
      // derivedGender should be set by this point, but add safety check
      if (!derivedGender) {
        logger.error(`[EventSchedule] Error: derivedGender is not set for match creation. Sport: ${sports_name}, Year: ${eventYear.year}, Type: ${sportDoc.type}`)
        return sendErrorResponse(res, 500, 'Internal error: Could not determine match gender. Please contact administrator.')
      }
      
      try {
        clearNewMatchCaches(sports_name, eventYear.year, derivedGender, match_type)
      } catch (cacheError) {
        logger.error('[EventSchedule] Error clearing caches after match creation:', cacheError)
        // Don't fail the request if cache clearing fails, just log it
      }
      
      return sendSuccessResponse(res, { match: newMatch }, `Match #${match_number} scheduled successfully`)
    } catch (saveError) {
      logger.error('[EventSchedule] Error saving match:', saveError)
      logger.error('[EventSchedule] Match data:', matchData)
      logger.error('[EventSchedule] Error details:', {
        message: saveError.message,
        stack: saveError.stack,
        name: saveError.name
      })
      return sendErrorResponse(res, 500, `Error saving match: ${saveError.message || 'Unknown error'}`)
    }

  })
)

/**
 * PUT /api/event-schedule/:id
 * Update match result (admin only)
 * Handles winner for dual types, qualifiers for multi types
 * Updates points table for league matches
 */
router.put(
  '/event-schedule/:id',
  authenticateToken,
  requireAdmin,
  requireEventStatusUpdatePeriod,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { winner, qualifiers, status, match_date } = req.body

    // Find the match
    const match = await EventSchedule.findById(id)
    if (!match) {
      return handleNotFoundError(res, 'Match')
    }

    // Get event year document for date range validation
    const eventYearData = await getEventYear(match.event_year, { returnDoc: true })
    const eventYearDoc = eventYearData.doc

    // Get sport details
    const sportDoc = await findSportByNameAndYear(match.sports_name, match.event_year)

    // Initialize update data object
    const previousStatus = match.status
    const previousWinner = match.winner || null
    const updateData = {}

    // Validate match_date update if provided
    if (match_date !== undefined) {
      // Validate match_date is within event date range
      if (!isMatchDateWithinEventRange(match_date, eventYearDoc)) {
        const eventStart = new Date(eventYearDoc.event_dates.start)
        const eventEnd = new Date(eventYearDoc.event_dates.end)
        const formatDate = (date) => {
          const d = new Date(date)
          const day = d.getDate()
          const month = d.toLocaleString('en-US', { month: 'short' })
          const year = d.getFullYear()
          const ordinal = day % 10 === 1 && day % 100 !== 11 ? day + 'st' : day % 10 === 2 && day % 100 !== 12 ? day + 'nd' : day % 10 === 3 && day % 100 !== 13 ? day + 'rd' : day + 'th'
          return `${ordinal} ${month} ${year}`
        }
        return sendErrorResponse(
          res,
          400,
          `Match date must be within event date range (${formatDate(eventStart)} to ${formatDate(eventEnd)})`
        )
      }
      updateData.match_date = new Date(match_date.includes('T') ? match_date : match_date + 'T00:00:00')
    }

    // Check if match date is in the future (date-only comparison)
    let matchDateObj
    if (match_date !== undefined) {
      // match_date from request body is a string
      matchDateObj = new Date(match_date.includes('T') ? match_date : match_date + 'T00:00:00')
    } else {
      // match.match_date from database is a Date object
      matchDateObj = new Date(match.match_date)
    }
    const now = new Date()
    matchDateObj.setHours(0, 0, 0, 0)
    now.setHours(0, 0, 0, 0)
    const isFutureMatch = matchDateObj > now

    // Validate and set status
    if (status !== undefined) {
      if (isFutureMatch && status !== 'scheduled') {
        return sendErrorResponse(res, 400, 'Cannot update status for future matches. Please wait until the match date.')
      }
      if (!['completed', 'draw', 'cancelled', 'scheduled'].includes(status)) {
        return sendErrorResponse(res, 400, 'Invalid status')
      }
      
      // Prevent status changes from completed/draw/cancelled to other statuses
      if (['completed', 'draw', 'cancelled'].includes(match.status) && status !== match.status) {
        return sendErrorResponse(
          res,
          400,
          `Cannot change status from "${match.status}". Once a match is ${match.status}, the status cannot be changed.`
        )
      }
      
      // Validate status changes to completed/draw/cancelled only happen within event date range
      if (['completed', 'draw', 'cancelled'].includes(status)) {
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        const eventStart = new Date(eventYearDoc.event_dates.start)
        eventStart.setHours(0, 0, 0, 0)
        const eventEnd = new Date(eventYearDoc.event_dates.end)
        eventEnd.setHours(23, 59, 59, 999)
        
        if (now < eventStart || now > eventEnd) {
          const formatDate = (date) => {
            const d = new Date(date)
            const day = d.getDate()
            const month = d.toLocaleString('en-US', { month: 'short' })
            const year = d.getFullYear()
            const ordinal = day % 10 === 1 && day % 100 !== 11 ? day + 'st' : day % 10 === 2 && day % 100 !== 12 ? day + 'nd' : day % 10 === 3 && day % 100 !== 13 ? day + 'rd' : day + 'th'
            return `${ordinal} ${month} ${year}`
          }
          return sendErrorResponse(
            res,
            400,
            `Match status can only be set to "${status}" within event date range (${formatDate(eventStart)} to ${formatDate(eventEnd)})`
          )
        }
      }
      
      updateData.status = status

      // Clear winner/qualifiers when status changes away from completed
      if (status !== 'completed') {
        updateData.winner = null
        updateData.qualifiers = []
      }
    }

    // Handle winner for dual types
    if (winner !== undefined && (sportDoc.type === 'dual_team' || sportDoc.type === 'dual_player')) {
      if (isFutureMatch) {
        return sendErrorResponse(res, 400, 'Cannot declare winner for future matches. Please wait until the match date.')
      }

      const targetStatus = status || match.status
      if (targetStatus !== 'completed') {
        return sendErrorResponse(res, 400, 'Winner can only be set when match status is "completed"')
      }

      // Validate winner is one of the participants
      const participants = sportDoc.type === 'dual_team' ? match.teams : match.players
      const trimmedWinner = (winner || '').trim()
      // Check if winner (trimmed) matches any participant (trimmed)
      const participantMatches = participants && participants.some(p => (p || '').trim() === trimmedWinner)
      if (!participantMatches) {
        return sendErrorResponse(res, 400, 'Winner must be one of the participating teams/players')
      }

      // Store trimmed winner to ensure consistency
      updateData.winner = trimmedWinner
      updateData.qualifiers = [] // Clear qualifiers for dual types
      if (!updateData.status) {
        updateData.status = 'completed'
      }
    }

    // Handle qualifiers for multi types
    if (qualifiers !== undefined && (sportDoc.type === 'multi_team' || sportDoc.type === 'multi_player')) {
      if (isFutureMatch) {
        return sendErrorResponse(res, 400, 'Cannot set qualifiers for future matches. Please wait until the match date.')
      }

      const targetStatus = status || match.status
      if (targetStatus !== 'completed') {
        return sendErrorResponse(res, 400, 'Qualifiers can only be set when match status is "completed"')
      }

      if (!Array.isArray(qualifiers) || qualifiers.length === 0) {
        return sendErrorResponse(res, 400, 'Qualifiers array is required for multi_team and multi_player sports')
      }

      // Validate qualifiers positions are unique and sequential
      const positions = qualifiers.map(q => q.position).sort((a, b) => a - b)
      const uniquePositions = new Set(positions)
      if (positions.length !== uniquePositions.size) {
        return sendErrorResponse(res, 400, 'Qualifier positions must be unique')
      }

      // Validate positions are sequential starting from 1
      for (let i = 0; i < positions.length; i++) {
        if (positions[i] !== i + 1) {
          return sendErrorResponse(res, 400, 'Qualifier positions must be sequential (1, 2, 3, etc.)')
        }
      }

      // Validate qualifiers are from match participants
      const participants = sportDoc.type === 'multi_team' ? match.teams : match.players
      const participantSet = new Set(participants)
      for (const qualifier of qualifiers) {
        if (!participantSet.has(qualifier.participant)) {
          return sendErrorResponse(res, 400, `Qualifier "${qualifier.participant}" must be one of the match participants`)
        }
      }

      updateData.qualifiers = qualifiers
      updateData.winner = null // Clear winner for multi types
      if (!updateData.status) {
        updateData.status = 'completed'
      }
    }

    // Update match
    const updatedMatch = await EventSchedule.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )

    if (!updatedMatch) {
      return handleNotFoundError(res, 'Match')
    }

    // Update points table for league matches
    if (match.match_type === 'league') {
      await updatePointsTable(updatedMatch, previousStatus, previousWinner)
    }

    // Clear caches using helper function (reuse sportDoc from above)
    await clearMatchCaches(updatedMatch, null, sportDoc)

    return sendSuccessResponse(res, { match: updatedMatch }, 'Match updated successfully')
  })
)

/**
 * DELETE /api/event-schedule/:id
 * Delete a match (admin only)
 * Year Context: Match is already associated with event_year (use for points table cleanup)
 */
router.delete(
  '/event-schedule/:id',
  authenticateToken,
  requireAdmin,
  requireEventPeriod,
  asyncHandler(async (req, res) => {
    const { id } = req.params

    // Find the match
    const match = await EventSchedule.findById(id)
    if (!match) {
      return handleNotFoundError(res, 'Match')
    }

    // Only allow deletion of scheduled matches
    if (match.status !== 'scheduled') {
      return sendErrorResponse(
        res,
        400,
        `Cannot delete match with status "${match.status}". Only scheduled matches can be deleted.`
      )
    }

    // If it's a league match, clean up points table
    if (match.match_type === 'league') {
      // Points table cleanup will be handled by updatePointsTable when status changes
      // For deletion, we just delete the match (no points were added for scheduled matches)
    }

    // Derive gender before deletion for cache clearing
    const sportDoc = await findSportByNameAndYear(match.sports_name, match.event_year).catch(() => null)

    // Delete the match
    await EventSchedule.findByIdAndDelete(id)

    // Clear caches using helper function
    await clearMatchCaches(match, null, sportDoc)

    return sendSuccessResponse(res, {}, 'Match deleted successfully')
  })
)

export default router
