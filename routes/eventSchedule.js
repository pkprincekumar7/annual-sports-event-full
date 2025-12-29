/**
 * Event Schedule Routes
 * Handles event schedule/match management operations
 */

import express from 'express'
import Player from '../models/Player.js'
import EventSchedule from '../models/EventSchedule.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { MATCH_STATUSES, TEAM_SPORTS, ADMIN_REG_NUMBER } from '../constants/index.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * GET /api/event-schedule/:sport
 * Get all matches for a sport
 */
router.get(
  '/event-schedule/:sport',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { sport } = req.params
    const matches = await EventSchedule.find({ sport }).sort({ match_number: 1 }).lean()

    // Matches fetched successfully
    return sendSuccessResponse(res, { matches })
  })
)

/**
 * POST /api/event-schedule
 * Create a new match (admin only)
 */
router.post(
  '/event-schedule',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { match_type, sport, sport_type, team_one, team_two, player_one, player_two, match_date } = req.body

    // Validate required fields
    if (!match_type || !sport || !sport_type || !match_date) {
      return sendErrorResponse(res, 400, 'Missing required fields: match_type, sport, sport_type, match_date')
    }

    // Declare player objects outside the if/else block for later use
    let playerOneObj = null
    let playerTwoObj = null

    // Validate team/player fields based on sport_type
    if (sport_type === 'team') {
      if (!team_one || !team_two) {
        return sendErrorResponse(res, 400, 'team_one and team_two are required for team events')
      }
      // Validate that both teams are different
      if (team_one === team_two) {
        return sendErrorResponse(res, 400, 'team_one and team_two must be different')
      }
    } else {
      if (!player_one || !player_two) {
        return sendErrorResponse(res, 400, 'player_one and player_two are required for individual/cultural events')
      }
      // Validate that both players are different
      if (player_one === player_two) {
        return sendErrorResponse(res, 400, 'player_one and player_two must be different')
      }

      // Validate that both players have the same gender and fetch their names
      const player1 = await Player.findOne({ reg_number: player_one }).select('gender full_name').lean()
      const player2 = await Player.findOne({ reg_number: player_two }).select('gender full_name').lean()

      if (!player1) {
        return sendErrorResponse(res, 400, `Player with registration number ${player_one} not found`)
      }
      if (!player2) {
        return sendErrorResponse(res, 400, `Player with registration number ${player_two} not found`)
      }

      if (player1.gender !== player2.gender) {
        return sendErrorResponse(
          res,
          400,
          `Gender mismatch: Both players must have the same gender. Player one is ${player1.gender}, player two is ${player2.gender}.`
        )
      }

      // Prepare player objects with name and reg_number
      playerOneObj = {
        name: player1.full_name || '',
        reg_number: player_one,
      }
      playerTwoObj = {
        name: player2.full_name || '',
        reg_number: player_two,
      }
    }

    // Validate match date - must be today or after today
    const matchDateObj = new Date(match_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day for comparison
    matchDateObj.setHours(0, 0, 0, 0)

    if (matchDateObj < today) {
      return sendErrorResponse(res, 400, 'Match date must be today or a future date')
    }

    // Get next match number for this sport
    const lastMatch = await EventSchedule.findOne({ sport }).sort({ match_number: -1 }).lean()

    const match_number = lastMatch ? lastMatch.match_number + 1 : 1

    // Validate eligibility based on previous matches (per sport)
    // For knockout matches: check if participant lost any previous completed match IN THIS SPORT
    if (match_type === 'knockout') {
      // Check previous matches for team_one/player_one (only for this sport)
      const participantOne = sport_type === 'team' ? team_one : player_one
      const previousMatchesOne = await EventSchedule.find({
        sport, // Only check matches for the same sport
        match_type: 'knockout',
        $or: [
          { team_one: participantOne },
          { team_two: participantOne },
          { 'player_one.reg_number': participantOne },
          { 'player_two.reg_number': participantOne },
        ],
      }).lean()

      // Check if participant lost any completed match in this sport
      for (const match of previousMatchesOne) {
        const matchWinner = match.winner?.reg_number || match.winner
        if (match.status === 'completed' && matchWinner && matchWinner !== participantOne) {
          return sendErrorResponse(
            res,
            400,
            `${participantOne} cannot be added to ${sport}. They lost a previous knockout match in ${sport} (Match #${match.match_number}).`
          )
        }
      }

      // Check previous matches for team_two/player_two (only for this sport)
      const participantTwo = sport_type === 'team' ? team_two : player_two
      const previousMatchesTwo = await EventSchedule.find({
        sport, // Only check matches for the same sport
        match_type: 'knockout',
        $or: [
          { team_one: participantTwo },
          { team_two: participantTwo },
          { 'player_one.reg_number': participantTwo },
          { 'player_two.reg_number': participantTwo },
        ],
      }).lean()

      // Check if participant lost any completed match in this sport
      for (const match of previousMatchesTwo) {
        const matchWinner = match.winner?.reg_number || match.winner
        if (match.status === 'completed' && matchWinner && matchWinner !== participantTwo) {
          return sendErrorResponse(
            res,
            400,
            `${participantTwo} cannot be added to ${sport}. They lost a previous knockout match in ${sport} (Match #${match.match_number}).`
          )
        }
      }
    }
    // For league matches, no eligibility check needed - losers can be added

    // Create new match
    const matchData = {
      match_number,
      match_type,
      sport,
      sport_type,
      match_date: new Date(match_date),
      status: 'scheduled',
    }

    // Add team or player data based on sport type
    if (sport_type === 'team') {
      matchData.team_one = team_one
      matchData.team_two = team_two
      matchData.player_one = null
      matchData.player_two = null
    } else {
      matchData.player_one = playerOneObj
      matchData.player_two = playerTwoObj
      matchData.team_one = null
      matchData.team_two = null
    }

    const newMatch = new EventSchedule(matchData)

    await newMatch.save()

    // Match created successfully
    return sendSuccessResponse(res, { match: newMatch }, `Match #${match_number} scheduled successfully`)
  })
)

/**
 * PUT /api/event-schedule/:id
 * Update match winner and status (admin only)
 */
router.put(
  '/event-schedule/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { winner, status } = req.body

    // First, find the match to validate
    const match = await EventSchedule.findById(id)

    if (!match) {
      return handleNotFoundError(res, 'Match')
    }

    // Check if match date is in the future
    const matchDateObj = new Date(match.match_date)
    const now = new Date()
    matchDateObj.setHours(0, 0, 0, 0)
    now.setHours(0, 0, 0, 0)
    const isFutureMatch = matchDateObj > now

    const updateData = {}

    // Validate and set status
    if (status !== undefined) {
      // Prevent status updates for future matches
      if (isFutureMatch) {
        return sendErrorResponse(res, 400, 'Cannot update status for future matches. Please wait until the match date.')
      }
      if (!MATCH_STATUSES.includes(status)) {
        return sendErrorResponse(
          res,
          400,
          `Invalid status. Must be one of: ${MATCH_STATUSES.join(', ')}`
        )
      }
      updateData.status = status

      // If status is being changed from completed and winner exists, clear winner
      if (match.status === 'completed' && status !== 'completed' && match.winner) {
        updateData.winner = null
      }
    }

    // Validate and set winner
    if (winner !== undefined) {
      // Prevent winner selection for future matches
      if (isFutureMatch) {
        return sendErrorResponse(res, 400, 'Cannot declare winner for future matches. Please wait until the match date.')
      }

      // Winner can only be set if status is completed
      const targetStatus = status || match.status
      if (targetStatus !== 'completed') {
        return sendErrorResponse(res, 400, 'Winner can only be set when match status is "completed"')
      }

      // Validate winner matches one of the teams/players
      let isValidWinner = false
      if (match.sport_type === 'team') {
        isValidWinner = winner === match.team_one || winner === match.team_two
      } else {
        // For non-team events, winner should match player_one or player_two format
        const playerOneName =
          match.player_one && match.player_one.name
            ? `${match.player_one.name} (${match.player_one.reg_number})`
            : null
        const playerTwoName =
          match.player_two && match.player_two.name
            ? `${match.player_two.name} (${match.player_two.reg_number})`
            : null
        isValidWinner = winner === playerOneName || winner === playerTwoName
      }

      if (!isValidWinner) {
        return sendErrorResponse(res, 400, 'Winner must be one of the participating teams/players')
      }

      updateData.winner = winner
      // Ensure status is completed when winner is set
      if (!updateData.status) {
        updateData.status = 'completed'
      }
    }

    // If winner is being cleared (set to null or empty), allow it
    if (winner === null || winner === '') {
      updateData.winner = null
    }

    const updatedMatch = await EventSchedule.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true })

    if (!updatedMatch) {
      return handleNotFoundError(res, 'Match')
    }

    // Match updated successfully
    return sendSuccessResponse(res, { match: updatedMatch }, 'Match updated successfully')
  })
)

/**
 * DELETE /api/event-schedule/:id
 * Delete a match (admin only)
 */
router.delete(
  '/event-schedule/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params

    // First, find the match to check its status
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

    // Delete the match
    await EventSchedule.findByIdAndDelete(id)

    // Match deleted successfully
    return sendSuccessResponse(res, {}, 'Match deleted successfully')
  })
)

/**
 * GET /api/event-schedule/:sport/teams-players
 * Get teams/players list for a sport (for dropdown in form) (admin only)
 */
router.get(
  '/event-schedule/:sport/teams-players',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { sport } = req.params
    // Decode the sport name in case it's URL encoded
    const decodedSport = decodeURIComponent(sport)

    // Fetching teams/players for sport

    // Get sport type from existing matches or determine from sport name
    const existingMatch = await EventSchedule.findOne({ sport: decodedSport }).lean()
    const sportType = existingMatch
      ? existingMatch.sport_type
      : TEAM_SPORTS.includes(decodedSport)
        ? 'team'
        : 'individual'

    // Sport type determined

    if (sportType === 'team') {
      // Get all unique team names for this sport
      const players = await Player.find({
        reg_number: { $ne: ADMIN_REG_NUMBER },
        'participated_in.sport': decodedSport,
        'participated_in.team_name': { $exists: true, $ne: null, $ne: '' },
      })
        .select('participated_in')
        .lean()

      // Found players with teams

      const teamsSet = new Set()
      players.forEach((player) => {
        if (player.participated_in && Array.isArray(player.participated_in)) {
          const participation = player.participated_in.find((p) => p.sport === decodedSport && p.team_name)
          if (participation && participation.team_name) {
            teamsSet.add(participation.team_name)
          }
        }
      })

      const teamsArray = Array.from(teamsSet).sort()
      // Found unique teams
      return sendSuccessResponse(res, { teams: teamsArray, players: [] })
    } else {
      // Get all players who participated in this sport (individual/cultural)
      const players = await Player.find({
        reg_number: { $ne: ADMIN_REG_NUMBER },
        participated_in: {
          $elemMatch: {
            sport: decodedSport,
            $or: [{ team_name: { $exists: false } }, { team_name: null }, { team_name: '' }],
          },
        },
      })
        .select('reg_number full_name gender')
        .lean()

      // Found individual participants

      const playersList = players.map((p) => ({
        reg_number: p.reg_number,
        full_name: p.full_name,
        gender: p.gender,
      }))

      // Players list prepared
      return sendSuccessResponse(res, { teams: [], players: playersList })
    }
  })
)

export default router

