/**
 * Event Schedule Routes
 * Handles event schedule/match management operations using new schema
 */

import express from 'express'
import EventSchedule from '../models/EventSchedule.js'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireEventPeriod, isMatchDateWithinEventRange } from '../middleware/dateRestrictions.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { getCache, setCache, clearCache } from '../utils/cache.js'
import { updatePointsTable } from '../utils/pointsTable.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { findSportByNameAndYear, normalizeSportName } from '../utils/sportHelpers.js'

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

    // Check cache
    const cacheKey = `/api/event-schedule/${sport}?year=${eventYear}`
    const cached = getCache(cacheKey)
    if (cached) {
      // Always use sendSuccessResponse for consistency, even for cached data
      return sendSuccessResponse(res, cached)
    }

    const matches = await EventSchedule.find({
      sports_name: normalizeSportName(sport),
      event_year: eventYear
    }).sort({ match_number: 1 }).lean()

    const result = { matches }

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

    // Find sport by name and event_year
    const sportDoc = await findSportByNameAndYear(decodedSport, eventYear)

    // Get all completed matches for this sport to determine knocked out participants
    const completedMatches = await EventSchedule.find({
      sports_name: normalizeSportName(decodedSport),
      event_year: eventYear,
      status: 'completed'
    }).lean()

    const knockedOutParticipants = new Set()

    // Determine knocked out participants from completed matches
    completedMatches.forEach(match => {
      if (match.match_type === 'knockout' || match.match_type === 'final') {
        if (sportDoc.type === 'dual_team' || sportDoc.type === 'dual_player') {
          // For dual types: loser is knocked out
          if (match.winner && match.teams) {
            match.teams.forEach(team => {
              if (team !== match.winner) {
                knockedOutParticipants.add(team)
              }
            })
          } else if (match.winner && match.players) {
            match.players.forEach(player => {
              if (player !== match.winner) {
                knockedOutParticipants.add(player)
              }
            })
          }
        } else {
          // For multi types: participants not in qualifiers are knocked out
          if (match.qualifiers && match.qualifiers.length > 0) {
            const qualifierParticipants = new Set(match.qualifiers.map(q => q.participant))
            if (match.teams) {
              match.teams.forEach(team => {
                if (!qualifierParticipants.has(team)) {
                  knockedOutParticipants.add(team)
                }
              })
            } else if (match.players) {
              match.players.forEach(player => {
                if (!qualifierParticipants.has(player)) {
                  knockedOutParticipants.add(player)
                }
              })
            }
          }
        }
      }
    })

    if (sportDoc.type === 'dual_team' || sportDoc.type === 'multi_team') {
      // Get teams from teams_participated
      const teams = (sportDoc.teams_participated || [])
        .map(team => team.team_name)
        .filter(teamName => !knockedOutParticipants.has(teamName))
        .sort()

      return sendSuccessResponse(res, { teams, players: [] })
    } else {
      // Get players from players_participated
      const playerRegNumbers = (sportDoc.players_participated || [])
        .filter(regNumber => !knockedOutParticipants.has(regNumber))

      // Fetch player details
      const players = await Player.find({
        reg_number: { $in: playerRegNumbers }
      })
        .select('reg_number full_name gender')
        .lean()

      const playersList = players.map(p => ({
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

    // Validate required fields
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

    // Validate teams/players arrays based on sport type
    if (sportDoc.type === 'dual_team' || sportDoc.type === 'multi_team') {
      if (!teams || !Array.isArray(teams) || teams.length === 0) {
        return sendErrorResponse(res, 400, 'Teams array is required for team sports')
      }
      // Remove duplicates
      const uniqueTeams = [...new Set(teams.map(t => t.trim()).filter(t => t))]
      if (sportDoc.type === 'dual_team' && uniqueTeams.length !== 2) {
        return sendErrorResponse(res, 400, 'dual_team sports require exactly 2 teams')
      }
      if (sportDoc.type === 'multi_team') {
        // Validate number_of_participants for multi_team
        if (number_of_participants !== undefined) {
          const num = parseInt(number_of_participants)
          if (isNaN(num) || num < 2 || num > 20) {
            return sendErrorResponse(res, 400, 'number_of_participants must be between 2 and 20')
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
      
      // Check if all teams have the same gender
      const teamGenders = playersList.map(p => p.gender).filter(Boolean)
      if (teamGenders.length > 0) {
        const firstGender = teamGenders[0]
        const genderMismatch = teamGenders.find(g => g !== firstGender)
        if (genderMismatch) {
          return sendErrorResponse(res, 400, 'All teams must have players of the same gender for team matches')
        }
      }
    } else {
      if (!players || !Array.isArray(players) || players.length === 0) {
        return sendErrorResponse(res, 400, 'Players array is required for individual/cultural sports')
      }
      // Remove duplicates
      const uniquePlayers = [...new Set(players.map(p => p.trim()).filter(p => p))]
      if (sportDoc.type === 'dual_player' && uniquePlayers.length !== 2) {
        return sendErrorResponse(res, 400, 'dual_player sports require exactly 2 players')
      }
      if (sportDoc.type === 'multi_player') {
        // Validate number_of_participants for multi_player
        if (number_of_participants !== undefined) {
          const num = parseInt(number_of_participants)
          if (isNaN(num) || num < 2 || num > 20) {
            return sendErrorResponse(res, 400, 'number_of_participants must be between 2 and 20')
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
      // Validate all players have same gender
      const playerDocs = await Player.find({ reg_number: { $in: uniquePlayers } }).select('gender').lean()
      if (playerDocs.length !== uniquePlayers.length) {
        return sendErrorResponse(res, 400, 'Some players not found')
      }
      const firstGender = playerDocs[0].gender
      const genderMismatch = playerDocs.find(p => p.gender !== firstGender)
      if (genderMismatch) {
        return sendErrorResponse(res, 400, 'All players must have the same gender')
      }
    }

    // Validate match_type restrictions
    if (sportDoc.type === 'multi_team' || sportDoc.type === 'multi_player') {
      if (match_type === 'league') {
        return sendErrorResponse(res, 400, 'match_type "league" is not allowed for multi_team and multi_player sports')
      }
    }

    // Validate league vs knockout restrictions
    if (match_type === 'league') {
      // Check if any knockout match exists for this sport
      const knockoutMatch = await EventSchedule.findOne({
        sports_name: normalizeSportName(sports_name),
        event_year: eventYear.year,
        match_type: { $in: ['knockout', 'final'] },
        status: { $in: ['scheduled', 'completed', 'draw', 'cancelled'] }
      })
      if (knockoutMatch) {
        return sendErrorResponse(res, 400, 'Cannot schedule league matches. Knockout matches already exist for this sport.')
      }
    } else if (match_type === 'knockout' || match_type === 'final') {
      // Check if any league match exists
      const leagueMatches = await EventSchedule.find({
        sports_name: normalizeSportName(sports_name),
        event_year: eventYear.year,
        match_type: 'league'
      }).sort({ match_date: -1 }).lean()

      if (leagueMatches.length > 0) {
        // Validate that match_date is after all league matches (date-only comparison)
        const latestLeagueDate = new Date(leagueMatches[0].match_date)
        latestLeagueDate.setHours(0, 0, 0, 0)
        // Handle date-only format (YYYY-MM-DD) or datetime format
        const matchDateStr = match_date.includes('T') ? match_date : match_date + 'T00:00:00'
        const matchDateObj = new Date(matchDateStr)
        matchDateObj.setHours(0, 0, 0, 0)
        if (matchDateObj <= latestLeagueDate) {
          return sendErrorResponse(
            res,
            400,
            `Knockout match date must be after all league matches. Latest league match date: ${latestLeagueDate.toLocaleDateString()}`
          )
        }
      }
    }

    // Validate match_type: 'final' restrictions
    if (sportDoc.type === 'dual_team' || sportDoc.type === 'dual_player') {
      // Get eligible participants (not knocked out)
      const eligibleParticipants = sportDoc.type === 'dual_team'
        ? (sportDoc.teams_participated || []).map(t => t.team_name)
        : (sportDoc.players_participated || [])

      // Get knocked out participants from completed matches
      const completedMatches = await EventSchedule.find({
        sports_name: normalizeSportName(sports_name),
        event_year: eventYear.year,
        status: 'completed',
        match_type: { $in: ['knockout', 'final'] }
      }).lean()

      const knockedOut = new Set()
      completedMatches.forEach(match => {
        if (match.winner && match.teams) {
          match.teams.forEach(team => {
            if (team !== match.winner) knockedOut.add(team)
          })
        } else if (match.winner && match.players) {
          match.players.forEach(player => {
            if (player !== match.winner) knockedOut.add(player)
          })
        }
      })

      const activeParticipants = eligibleParticipants.filter(p => !knockedOut.has(p))
      const participantsInMatch = sportDoc.type === 'dual_team' ? teams : players

      // If exactly 2 eligible participants are in the match, it MUST be 'final'
      if (activeParticipants.length === 2 && participantsInMatch.length === 2) {
        if (match_type !== 'final') {
          return sendErrorResponse(
            res,
            400,
            'match_type must be "final" when exactly 2 eligible participants are in the match'
          )
        }
      }
    }

    // Prevent scheduling if 'final' match is already completed
    const completedFinalMatch = await EventSchedule.findOne({
      sports_name: normalizeSportName(sports_name),
      event_year: eventYear.year,
      match_type: 'final',
      status: 'completed'
    })
    if (completedFinalMatch) {
      return sendErrorResponse(res, 400, 'Cannot schedule new matches. Final match is already completed for this sport.')
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
    const lastMatch = await EventSchedule.findOne({
      sports_name: normalizeSportName(sports_name),
      event_year: eventYear
    }).sort({ match_number: -1 }).lean()

    const match_number = lastMatch ? lastMatch.match_number + 1 : 1

    // Create new match
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

    const newMatch = new EventSchedule(matchData)
    await newMatch.save()

    // Clear cache
    clearCache(`/api/event-schedule/${sports_name}?year=${eventYear.year}`)
    clearCache(`/api/event-schedule/${sports_name}/teams-players?year=${eventYear.year}`)

    return sendSuccessResponse(res, { match: newMatch }, `Match #${match_number} scheduled successfully`)
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
  requireEventPeriod,
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
    const currentMatchDate = match_date !== undefined ? match_date : match.match_date
    const matchDateObj = new Date(currentMatchDate.includes('T') ? currentMatchDate : currentMatchDate + 'T00:00:00')
    const now = new Date()
    matchDateObj.setHours(0, 0, 0, 0)
    now.setHours(0, 0, 0, 0)
    const isFutureMatch = matchDateObj > now

    const previousStatus = match.status
    const previousWinner = match.winner || null
    const updateData = {}

    // Validate and set status
    if (status !== undefined) {
      if (isFutureMatch && status !== 'scheduled') {
        return sendErrorResponse(res, 400, 'Cannot update status for future matches. Please wait until the match date.')
      }
      if (!['completed', 'draw', 'cancelled', 'scheduled'].includes(status)) {
        return sendErrorResponse(res, 400, 'Invalid status')
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
      
      // Prevent status change from 'completed' to another status if winner/qualifiers are set
      if (match.status === 'completed' && status !== 'completed') {
        if (match.winner) {
          return sendErrorResponse(res, 400, 'Cannot change status when winner is set. Please clear the winner first.')
        }
        if (match.qualifiers && match.qualifiers.length > 0) {
          return sendErrorResponse(res, 400, 'Cannot change status when qualifiers are set. Please clear the qualifiers first.')
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
      if (!participants || !participants.includes(winner)) {
        return sendErrorResponse(res, 400, 'Winner must be one of the participating teams/players')
      }

      updateData.winner = winner
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

    // Clear cache
    clearCache(`/api/event-schedule/${match.sports_name}?year=${match.event_year}`)
    clearCache(`/api/event-schedule/${match.sports_name}/teams-players?year=${match.event_year}`)
    // Clear points table cache if it's a league match
    if (match.match_type === 'league') {
      clearCache(`/api/points-table/${match.sports_name}?year=${match.event_year}`)
    }

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

    // Delete the match
    await EventSchedule.findByIdAndDelete(id)

    // Clear cache
    clearCache(`/api/event-schedule/${match.sports_name}?year=${match.event_year}`)
    clearCache(`/api/event-schedule/${match.sports_name}/teams-players?year=${match.event_year}`)

    return sendSuccessResponse(res, {}, 'Match deleted successfully')
  })
)

export default router
