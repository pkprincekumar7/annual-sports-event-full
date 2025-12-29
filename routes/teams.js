/**
 * Team Routes
 * Handles team management operations
 */

import express from 'express'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError, handleForbiddenError } from '../utils/errorHandler.js'
import { trimObjectFields } from '../utils/validation.js'
import { TEAM_SPORTS, MAX_PARTICIPATIONS, ADMIN_REG_NUMBER } from '../constants/index.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * POST /api/validate-participations
 * Validate participations before team registration
 */
router.post(
  '/validate-participations',
  authenticateToken,
  asyncHandler(async (req, res) => {
    let { reg_numbers, sport } = req.body

    // Trim fields
    sport = sport?.trim()
    if (Array.isArray(reg_numbers)) {
      reg_numbers = reg_numbers.map((rn) => rn?.trim()).filter((rn) => rn)
    }

    // Validate required fields
    if (!reg_numbers || !Array.isArray(reg_numbers) || reg_numbers.length === 0 || !sport) {
      return sendErrorResponse(res, 400, 'Registration numbers array and sport are required')
    }

    const errors = []

    // Fetch all players at once (optimized: single query)
    const players = await Player.find({ reg_number: { $in: reg_numbers } }).select('-password').lean()
    const playersMap = new Map(players.map((p) => [p.reg_number, p]))

    // Validate each player
    for (const reg_number of reg_numbers) {
      const player = playersMap.get(reg_number)
      if (!player) {
        errors.push(`Player with reg_number ${reg_number} not found`)
        continue
      }

      // Initialize participated_in array if it doesn't exist
      if (!player.participated_in) {
        player.participated_in = []
      }

      // Check if already participated in this sport
      const existingParticipation = player.participated_in.find((p) => p.sport === sport)
      if (existingParticipation) {
        if (existingParticipation.team_name) {
          const isCaptain = player.captain_in && Array.isArray(player.captain_in) && player.captain_in.includes(sport)
          if (isCaptain) {
            errors.push(
              `${player.full_name} (${reg_number}) is a captain and has already created a team (${existingParticipation.team_name}) for ${sport}. A captain cannot create multiple teams for the same sport.`
            )
          } else {
            errors.push(
              `${player.full_name} (${reg_number}) is already in a team (${existingParticipation.team_name}) for ${sport}. A player can only belong to one team per sport.`
            )
          }
        } else {
          errors.push(`${player.full_name} (${reg_number}) is already registered for ${sport}`)
        }
        continue
      }

      // Check for duplicate sport entries
      const sportSet = new Set(player.participated_in.map((p) => p.sport))
      if (sportSet.size !== player.participated_in.length) {
        errors.push(
          `${player.full_name} (${reg_number}) has duplicate sport entries in participated_in array. Please fix the data first.`
        )
        continue
      }

      // Check maximum limit
      const currentParticipationsCount = player.participated_in.length
      if (currentParticipationsCount >= MAX_PARTICIPATIONS) {
        errors.push(
          `${player.full_name} (${reg_number}) has reached maximum ${MAX_PARTICIPATIONS} participations (based on unique sport names). Please remove a participation first.`
        )
        continue
      }

      // Count non-team participations
      const nonTeamParticipations = player.participated_in.filter((p) => !p.team_name).length

      // Count team participations where sport IS in captain_in array
      const captainTeamParticipations = player.participated_in.filter(
        (p) =>
          p.team_name &&
          player.captain_in &&
          Array.isArray(player.captain_in) &&
          player.captain_in.includes(p.sport)
      ).length

      // Get captain count
      const captainCount = player.captain_in && Array.isArray(player.captain_in) ? player.captain_in.length : 0

      // Check if this is a team event where the player IS a captain for this sport
      const isCaptainForSport = player.captain_in && Array.isArray(player.captain_in) && player.captain_in.includes(sport)

      if (isCaptainForSport) {
        // Check: team participations (for captain sports) should not exceed captain_in length
        if (captainTeamParticipations >= captainCount) {
          errors.push(
            `${player.full_name} (${reg_number}) has reached maximum team participations for captain sports (${captainCount}). Maximum team participations allowed for sports in captain_in array is equal to captain roles (${captainCount}).`
          )
          continue
        }
      }
    }

    // Check for multiple captains in the same request
    const captainsInRequest = players.filter(
      (s) => s && s.captain_in && Array.isArray(s.captain_in) && s.captain_in.includes(sport)
    )

    if (captainsInRequest.length > 1) {
      const captainNames = captainsInRequest.map((s) => `${s.full_name} (${s.reg_number})`)
      errors.push(
        `Multiple captains found in the same team registration: ${captainNames.join(', ')}. A team can only have exactly one captain for ${sport}.`
      )
    }

    // Validate that exactly one captain is in the team
    if (captainsInRequest.length === 0) {
      errors.push(`Team must have exactly one captain for ${sport}. At least one player in the team must be assigned as captain for this sport.`)
    } else if (captainsInRequest.length !== 1) {
      errors.push(`Team must have exactly one captain for ${sport}. Found ${captainsInRequest.length} captains.`)
    }

    // Validate that the logged-in user is included in the team and is the captain
    const loggedInUserRegNumber = req.user?.reg_number
    if (loggedInUserRegNumber) {
      let loggedInUserInDatabase = playersMap.get(loggedInUserRegNumber)
      if (!loggedInUserInDatabase) {
        loggedInUserInDatabase = await Player.findOne({ reg_number: loggedInUserRegNumber }).select('-password').lean()
      }

      // Check if logged-in user is included in the team request
      const loggedInUserInRequest = reg_numbers.includes(loggedInUserRegNumber)
      if (!loggedInUserInRequest) {
        errors.push(`You must be included in the team to create it.`)
      }

      // Check if logged-in user is a captain for this sport
      const isLoggedInUserCaptain =
        loggedInUserInDatabase &&
        loggedInUserInDatabase.captain_in &&
        Array.isArray(loggedInUserInDatabase.captain_in) &&
        loggedInUserInDatabase.captain_in.includes(sport)

      if (!isLoggedInUserCaptain) {
        errors.push(
          `You can only create teams for sports where you are assigned as captain. You are not assigned as captain for ${sport}.`
        )
      }
    }

    if (errors.length > 0) {
      return sendErrorResponse(res, 400, errors.join('; '))
    }

    return sendSuccessResponse(res, {}, 'All players can participate')
  })
)

/**
 * POST /api/update-team-participation
 * Update participated_in field for team events
 */
router.post(
  '/update-team-participation',
  authenticateToken,
  asyncHandler(async (req, res) => {
    let { reg_numbers, sport, team_name } = req.body

    // Trim fields
    const trimmed = trimObjectFields({ sport, team_name })
    sport = trimmed.sport
    team_name = trimmed.team_name

    // Validate required fields
    if (!reg_numbers || !Array.isArray(reg_numbers) || reg_numbers.length === 0 || !sport || !team_name) {
      return sendErrorResponse(res, 400, 'Registration numbers array, sport, and team name are required')
    }

    // Trim and validate team name
    if (team_name.length === 0) {
      return sendErrorResponse(res, 400, 'Team name cannot be empty')
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

    // Check if a team with the same name already exists for this sport
    const playersWithTeams = await Player.find({
      participated_in: {
        $elemMatch: {
          sport: sport,
          team_name: { $exists: true, $ne: null },
        },
      },
    })
      .select('participated_in')
      .lean()

    // Check for case-insensitive match
    const teamExists = playersWithTeams.some((player) =>
      player.participated_in?.some(
        (p) => p.sport === sport && p.team_name && p.team_name.toLowerCase() === team_name.toLowerCase()
      )
    )

    if (teamExists) {
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
    const playerData = []
    const errors = []

    for (const reg_number of reg_numbers) {
      const player = playersMap.get(reg_number)
      if (!player) {
        errors.push(`Player with reg_number ${reg_number} not found`)
        continue
      }
      playerData.push(player)
    }

    if (errors.length > 0) {
      return sendErrorResponse(res, 400, errors.join('; '))
    }

    // Check that all players have the same gender
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

      // Check that all players have the same year
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

    // Check for multiple captains in the same team
    const captainsInTeam = playerData.filter(
      (p) => p.captain_in && Array.isArray(p.captain_in) && p.captain_in.includes(sport)
    )

    if (captainsInTeam.length > 1) {
      const captainNames = captainsInTeam.map((p) => `${p.full_name} (${p.reg_number})`)
      return sendErrorResponse(
        res,
        400,
        `Multiple captains found in the same team: ${captainNames.join(', ')}. A team can only have exactly one captain for ${sport}.`
      )
    }

    // Validate that exactly one captain is in the team
    if (captainsInTeam.length === 0) {
      return sendErrorResponse(
        res,
        400,
        `Team must have exactly one captain for ${sport}. At least one player in the team must be assigned as captain for this sport.`
      )
    }

    // Validate that the logged-in user is included in the team and is the captain
    const loggedInUserRegNumber = req.user?.reg_number
    if (loggedInUserRegNumber) {
      const loggedInUserInDatabase = playersMap.get(loggedInUserRegNumber)
      if (!loggedInUserInDatabase) {
        return handleForbiddenError(res, `You must be included in the team to create it.`)
      }

      const loggedInUserInTeam = playerData.find((p) => p.reg_number === loggedInUserRegNumber)
      if (!loggedInUserInTeam) {
        return handleForbiddenError(res, `You must be included in the team to create it.`)
      }

      const isLoggedInUserCaptain =
        loggedInUserInDatabase.captain_in &&
        Array.isArray(loggedInUserInDatabase.captain_in) &&
        loggedInUserInDatabase.captain_in.includes(sport)

      if (!isLoggedInUserCaptain) {
        return handleForbiddenError(
          res,
          `You can only create teams for sports where you are assigned as captain. You are not assigned as captain for ${sport}.`
        )
      }
    }

    // Check if there's already a captain in the existing team
    const existingTeamMembers = await Player.find({
      participated_in: {
        $elemMatch: {
          sport: sport,
          team_name: team_name,
        },
      },
    })
      .select('-password')
      .lean()

    const existingCaptains = existingTeamMembers.filter(
      (s) => s.captain_in && Array.isArray(s.captain_in) && s.captain_in.includes(sport)
    )

    // If there's already a captain in the team, and we're trying to add another captain
    if (existingCaptains.length > 0 && captainsInTeam.length > 0) {
      const existingCaptainName = existingCaptains[0].full_name
      const newCaptainName = captainsInTeam[0].full_name
      return sendErrorResponse(
        res,
        400,
        `Team "${team_name}" already has a captain (${existingCaptainName}) for ${sport}. Cannot add another captain (${newCaptainName}). A team can only have one captain.`
      )
    }

    const updatedPlayers = []

    // Process each player
    for (const reg_number of reg_numbers) {
      const player = playersMap.get(reg_number)
      if (!player) {
        errors.push(`Player with reg_number ${reg_number} not found`)
        continue
      }

      // Initialize participated_in array if it doesn't exist
      if (!player.participated_in) {
        player.participated_in = []
      }

      // Check for duplicate sport entries
      const sportSet = new Set(player.participated_in.map((p) => p.sport))
      if (sportSet.size !== player.participated_in.length) {
        errors.push(
          `${player.full_name} (${reg_number}) has duplicate sport entries in participated_in array. Please fix the data first.`
        )
        continue
      }

      // Check maximum limit
      const currentParticipationsCount = player.participated_in.length
      if (currentParticipationsCount >= MAX_PARTICIPATIONS) {
        errors.push(
          `${player.full_name} (${reg_number}) has reached maximum ${MAX_PARTICIPATIONS} participations (based on unique sport names). Please remove a participation first.`
        )
        continue
      }

      // Check if already participated in this sport
      const existingParticipation = player.participated_in.find((p) => p.sport === sport)

      if (existingParticipation) {
        if (existingParticipation.team_name) {
          const isCaptain = player.captain_in && Array.isArray(player.captain_in) && player.captain_in.includes(sport)

          if (isCaptain) {
            errors.push(
              `${player.full_name} (${reg_number}) is a captain and has already created a team (${existingParticipation.team_name}) for ${sport}. A captain cannot create multiple teams for the same sport.`
            )
          } else {
            errors.push(
              `${player.full_name} (${reg_number}) is already in a team (${existingParticipation.team_name}) for ${sport}. A player can only belong to one team per sport.`
            )
          }
        } else {
          errors.push(`${player.full_name} (${reg_number}) is already registered for ${sport}`)
        }
        continue
      }

      // Check if this player is a captain for this sport
      const isCaptainForSport = player.captain_in && Array.isArray(player.captain_in) && player.captain_in.includes(sport)

      // Count team participations where sport IS in captain_in array
      const captainTeamParticipations = player.participated_in.filter(
        (p) =>
          p.team_name &&
          player.captain_in &&
          Array.isArray(player.captain_in) &&
          player.captain_in.includes(p.sport)
      ).length

      // Get captain count
      const captainCount = player.captain_in && Array.isArray(player.captain_in) ? player.captain_in.length : 0

      // Only check limit if this sport IS in captain_in array
      if (isCaptainForSport) {
        if (captainTeamParticipations >= captainCount) {
          errors.push(
            `${player.full_name} (${reg_number}) has reached maximum team participations for captain sports (${captainCount}). Maximum team participations allowed for sports in captain_in array is equal to captain roles (${captainCount}).`
          )
          continue
        }
      }

      // Add sport to participated_in array with team_name
      player.participated_in.push({ sport, team_name })
      await player.save()
      updatedPlayers.push(player.reg_number)
    }

    if (errors.length > 0) {
      return sendErrorResponse(res, 400, errors.join('; '), { updated_count: updatedPlayers.length })
    }

    return sendSuccessResponse(
      res,
      { updated_count: updatedPlayers.length },
      `Participation updated successfully for ${updatedPlayers.length} player(s)`
    )
  })
)

/**
 * GET /api/teams/:sport
 * Get all teams for a specific sport
 */
router.get(
  '/teams/:sport',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Decode the sport name from URL parameter
    let sport = decodeURIComponent(req.params.sport)
    // Received request for teams

    if (!sport) {
      return sendErrorResponse(res, 400, 'Sport name is required')
    }

    // Query directly for players who have participated in this sport with a team_name
    const playersInTeams = await Player.find({
      reg_number: { $ne: ADMIN_REG_NUMBER },
      participated_in: {
        $elemMatch: {
          sport: sport,
          team_name: { $exists: true, $ne: null },
        },
      },
    })
      .select('-password')
      .lean()

    // Group players by team name
    const teamsMap = new Map()

    for (const player of playersInTeams) {
      const participation = player.participated_in.find((p) => p.sport === sport && p.team_name)

      if (participation && participation.team_name) {
        const teamName = participation.team_name

        if (!teamsMap.has(teamName)) {
          teamsMap.set(teamName, [])
        }

        const { password: _, ...playerData } = player
        teamsMap.get(teamName).push(playerData)
      }
    }

    // Convert map to array of teams
    const teams = Array.from(teamsMap.entries()).map(([teamName, players]) => ({
      team_name: teamName,
      players: players,
      player_count: players.length,
    }))

    // Sort teams by team name
    teams.sort((a, b) => a.team_name.localeCompare(b.team_name))

    // Teams fetched successfully

    return sendSuccessResponse(res, {
      sport: sport,
      teams: teams,
      total_teams: teams.length,
    })
  })
)

/**
 * POST /api/update-team-player
 * Update/replace a player in a team (admin only)
 */
router.post(
  '/update-team-player',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    let { team_name, sport, old_reg_number, new_reg_number } = req.body

    // Trim fields
    const trimmed = trimObjectFields({ team_name, sport, old_reg_number, new_reg_number })
    sport = trimmed.sport
    team_name = trimmed.team_name
    old_reg_number = trimmed.old_reg_number
    new_reg_number = trimmed.new_reg_number

    // Validate required fields
    if (!team_name || !sport || !old_reg_number || !new_reg_number) {
      return sendErrorResponse(
        res,
        400,
        'Team name, sport, old registration number, and new registration number are required'
      )
    }

    // Find old player
    const oldPlayer = await Player.findOne({ reg_number: old_reg_number })
    if (!oldPlayer) {
      return handleNotFoundError(res, 'Old player')
    }

    // Find new player
    const newPlayer = await Player.findOne({ reg_number: new_reg_number })
    if (!newPlayer) {
      return handleNotFoundError(res, 'New player')
    }

    // Check if old player is in the team
    if (!oldPlayer.participated_in || !Array.isArray(oldPlayer.participated_in)) {
      return sendErrorResponse(res, 400, 'Old player is not registered for any sport')
    }

    const oldPlayerParticipation = oldPlayer.participated_in.find((p) => p.sport === sport && p.team_name === team_name)

    if (!oldPlayerParticipation) {
      return sendErrorResponse(res, 400, 'Old player is not in this team')
    }

    // Get all current team members (excluding the old player)
    const currentTeamMembers = await Player.find({
      participated_in: {
        $elemMatch: {
          sport: sport,
          team_name: team_name,
        },
      },
      reg_number: { $ne: old_reg_number },
    })
      .select('-password')
      .lean()

    // Check if new player is already in this team
    if (currentTeamMembers.some((m) => m.reg_number === new_reg_number)) {
      return sendErrorResponse(res, 400, 'New player is already in this team')
    }

    // Check if new player has already participated in this sport
    if (newPlayer.participated_in && Array.isArray(newPlayer.participated_in)) {
      const existingParticipation = newPlayer.participated_in.find((p) => p.sport === sport)
      if (existingParticipation) {
        if (existingParticipation.team_name) {
          return sendErrorResponse(
            res,
            400,
            `New player is already in a team (${existingParticipation.team_name}) for ${sport}. A player can only belong to one team per sport.`
          )
        } else {
          return sendErrorResponse(res, 400, `New player is already registered for ${sport}`)
        }
      }
    }

    // Check for duplicate sport entries
    if (newPlayer.participated_in && Array.isArray(newPlayer.participated_in)) {
      const sportSet = new Set(newPlayer.participated_in.map((p) => p.sport))
      if (sportSet.size !== newPlayer.participated_in.length) {
        return sendErrorResponse(
          res,
          400,
          'New player has duplicate sport entries in participated_in array. Please fix the data first.'
        )
      }

      // Check maximum limit
      if (newPlayer.participated_in.length >= MAX_PARTICIPATIONS) {
        return sendErrorResponse(
          res,
          400,
          `New player has reached maximum ${MAX_PARTICIPATIONS} participations (based on unique sport names). Please remove a participation first.`
        )
      }
    }

    // Count non-team participations
    const nonTeamParticipations =
      newPlayer.participated_in && Array.isArray(newPlayer.participated_in)
        ? newPlayer.participated_in.filter((p) => !p.team_name).length
        : 0

    // Check if new player is a captain for this sport
    const isNewPlayerCaptainForSport =
      newPlayer.captain_in && Array.isArray(newPlayer.captain_in) && newPlayer.captain_in.includes(sport)

    // Count team participations where sport IS in captain_in array
    const captainTeamParticipations =
      newPlayer.participated_in && Array.isArray(newPlayer.participated_in)
        ? newPlayer.participated_in.filter(
            (p) =>
              p.team_name &&
              newPlayer.captain_in &&
              Array.isArray(newPlayer.captain_in) &&
              newPlayer.captain_in.includes(p.sport)
          ).length
        : 0

    // Get captain count
    const captainCount = newPlayer.captain_in && Array.isArray(newPlayer.captain_in) ? newPlayer.captain_in.length : 0

    // Only check limit if new player IS a captain for this sport
    if (isNewPlayerCaptainForSport) {
      if (captainTeamParticipations >= captainCount) {
        return sendErrorResponse(
          res,
          400,
          `New player has reached maximum team participations for captain sports (${captainCount}). Maximum team participations allowed for sports in captain_in array is equal to captain roles (${captainCount}).`
        )
      }
    }

    // Check maximum limit: (captain_in length + non-team participated_in) should not exceed 10
    if (captainCount + nonTeamParticipations >= MAX_PARTICIPATIONS) {
      return sendErrorResponse(
        res,
        400,
        `New player has reached maximum limit. Total (captain roles + non-team participations) cannot exceed ${MAX_PARTICIPATIONS}. Current: ${captainCount} captain role(s) + ${nonTeamParticipations} non-team participation(s).`
      )
    }

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

      // Validate year match with team
      const teamYear = currentTeamMembers[0].year
      if (newPlayer.year !== teamYear) {
        return sendErrorResponse(
          res,
          400,
          `Year mismatch: New player must be in the same year (${teamYear}) as other team members.`
        )
      }
    }

    // Check for multiple captains in the team
    const isNewPlayerCaptain = newPlayer.captain_in && Array.isArray(newPlayer.captain_in) && newPlayer.captain_in.includes(sport)

    const existingCaptains = currentTeamMembers.filter(
      (s) => s.captain_in && Array.isArray(s.captain_in) && s.captain_in.includes(sport)
    )

    if (existingCaptains.length > 0 && isNewPlayerCaptain) {
      const existingCaptainName = existingCaptains[0].full_name
      return sendErrorResponse(
        res,
        400,
        `Team already has a captain (${existingCaptainName}) for ${sport}. Cannot add another captain. A team can only have one captain.`
      )
    }

    // Remove old player from team
    const oldPlayerPartIndex = oldPlayer.participated_in.findIndex((p) => p.sport === sport && p.team_name === team_name)
    if (oldPlayerPartIndex !== -1) {
      oldPlayer.participated_in.splice(oldPlayerPartIndex, 1)
      await oldPlayer.save()
    }

    // Add new player to team
    if (!newPlayer.participated_in) {
      newPlayer.participated_in = []
    }
    newPlayer.participated_in.push({ sport, team_name })
    await newPlayer.save()

    // Return updated data
    const newPlayerData = newPlayer.toObject()
    delete newPlayerData.password

    return sendSuccessResponse(
      res,
      {
        old_player: { reg_number: old_reg_number, full_name: oldPlayer.full_name },
        new_player: newPlayerData,
      },
      `Player updated successfully in team ${team_name}`
    )
  })
)

/**
 * DELETE /api/delete-team
 * Delete a team (remove all players' associations to the team) (admin only)
 */
router.delete(
  '/delete-team',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    let { team_name, sport } = req.body

    // Trim fields
    const trimmed = trimObjectFields({ team_name, sport })
    sport = trimmed.sport
    team_name = trimmed.team_name

    // Validate required fields
    if (!team_name || !sport) {
      return sendErrorResponse(res, 400, 'Team name and sport are required')
    }

    // Find all players who are in this team
    const playersInTeam = await Player.find({
      participated_in: {
        $elemMatch: {
          sport: sport,
          team_name: team_name,
        },
      },
    }).select('-password')

    if (playersInTeam.length === 0) {
      return handleNotFoundError(res, 'Team')
    }

    const teamMembers = []
    let deletedCount = 0

    // Remove participation from each player
    for (const player of playersInTeam) {
      if (!player.participated_in || !Array.isArray(player.participated_in)) {
        continue
      }

      const participationIndex = player.participated_in.findIndex((p) => p.sport === sport && p.team_name === team_name)

      if (participationIndex !== -1) {
        player.participated_in.splice(participationIndex, 1)
        await player.save()
        teamMembers.push({
          reg_number: player.reg_number,
          full_name: player.full_name,
        })
        deletedCount++
      }
    }

    return sendSuccessResponse(
      res,
      {
        deleted_count: deletedCount,
        team_members: teamMembers,
      },
      `Team "${team_name}" deleted successfully. Removed ${deletedCount} player(s) from the team.`
    )
  })
)

export default router

