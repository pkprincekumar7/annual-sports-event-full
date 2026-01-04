/**
 * Match Validation Utilities
 * Centralized validation logic for match scheduling
 */

import EventSchedule from '../models/EventSchedule.js'
import Player from '../models/Player.js'
import { getMatchGender } from './genderHelpers.js'
import { normalizeSportName } from './sportHelpers.js'
import logger from './logger.js'

/**
 * Get knocked out participants from completed matches
 * @param {string} sportsName - Normalized sport name
 * @param {number} eventYear - Event year
 * @param {string} gender - Gender filter ('Male' or 'Female')
 * @param {Object} sportDoc - Sport document
 * @returns {Promise<Set<string>>} Set of knocked out participant names (trimmed)
 */
export async function getKnockedOutParticipants(sportsName, eventYear, gender, sportDoc) {
  if (!sportDoc) {
    logger.warn(`getKnockedOutParticipants: sportDoc is null for ${sportsName} (${eventYear})`)
    return new Set()
  }

  const allCompletedMatches = await EventSchedule.find({
    sports_name: normalizeSportName(sportsName),
    event_year: eventYear,
    status: 'completed'
  }).lean()

  // Filter by gender
  const completedMatches = []
  for (const match of allCompletedMatches) {
    try {
      const matchGender = await getMatchGender(match, sportDoc)
      if (matchGender === gender) {
        completedMatches.push(match)
      }
    } catch (error) {
      logger.error(`Error deriving gender for match ${match._id}:`, error)
      // Continue processing other matches
    }
  }

  const knockedOut = new Set()

  completedMatches.forEach(match => {
    if (match.match_type === 'knockout' || match.match_type === 'final') {
      if (sportDoc.type === 'dual_team' || sportDoc.type === 'dual_player') {
        // For dual types: loser is knocked out
        if (match.winner) {
          const trimmedWinner = (match.winner || '').trim()
          // Check teams array (for dual_team)
          if (match.teams && Array.isArray(match.teams) && match.teams.length > 0) {
            match.teams.forEach(team => {
              const trimmedTeam = (team || '').trim()
              if (trimmedTeam && trimmedTeam !== trimmedWinner) {
                knockedOut.add(trimmedTeam)
              }
            })
          }
          // Check players array (for dual_player)
          if (match.players && Array.isArray(match.players) && match.players.length > 0) {
            match.players.forEach(player => {
              const trimmedPlayer = (player || '').trim()
              if (trimmedPlayer && trimmedPlayer !== trimmedWinner) {
                knockedOut.add(trimmedPlayer)
              }
            })
          }
        }
      } else {
        // For multi types: participants not in qualifiers are knocked out
        if (match.qualifiers && match.qualifiers.length > 0) {
          const qualifierParticipants = new Set(match.qualifiers.map(q => (q.participant || '').trim()))
          if (match.teams && match.teams.length > 0) {
            match.teams.forEach(team => {
              const trimmedTeam = (team || '').trim()
              if (trimmedTeam && !qualifierParticipants.has(trimmedTeam)) {
                knockedOut.add(trimmedTeam)
              }
            })
          } else if (match.players && match.players.length > 0) {
            match.players.forEach(player => {
              const trimmedPlayer = (player || '').trim()
              if (trimmedPlayer && !qualifierParticipants.has(trimmedPlayer)) {
                knockedOut.add(trimmedPlayer)
              }
            })
          }
        } else {
          // If match is completed but has no qualifiers, mark all participants as knocked out
          if (match.teams && match.teams.length > 0) {
            match.teams.forEach(team => {
              const trimmedTeam = (team || '').trim()
              if (trimmedTeam) {
                knockedOut.add(trimmedTeam)
              }
            })
          } else if (match.players && match.players.length > 0) {
            match.players.forEach(player => {
              const trimmedPlayer = (player || '').trim()
              if (trimmedPlayer) {
                knockedOut.add(trimmedPlayer)
              }
            })
          }
        }
      }
    }
  })

  return knockedOut
}

/**
 * Get participants in scheduled matches
 * @param {string} sportsName - Normalized sport name
 * @param {number} eventYear - Event year
 * @param {string} gender - Gender filter ('Male' or 'Female')
 * @param {Object} sportDoc - Sport document
 * @returns {Promise<Set<string>>} Set of participant names in scheduled matches (trimmed)
 */
export async function getParticipantsInScheduledMatches(sportsName, eventYear, gender, sportDoc) {
  if (!sportDoc) {
    logger.warn(`getParticipantsInScheduledMatches: sportDoc is null for ${sportsName} (${eventYear})`)
    return new Set()
  }

  const allScheduledMatches = await EventSchedule.find({
    sports_name: normalizeSportName(sportsName),
    event_year: eventYear,
    match_type: { $in: ['knockout', 'final'] },
    status: 'scheduled'
  }).lean()

  // Filter by gender
  const scheduledMatches = []
  for (const match of allScheduledMatches) {
    try {
      const matchGender = await getMatchGender(match, sportDoc)
      if (matchGender === gender) {
        scheduledMatches.push(match)
      }
    } catch (error) {
      logger.error(`Error deriving gender for scheduled match ${match._id}:`, error)
      // Continue processing other matches
    }
  }

  const participantsInScheduled = new Set()
  scheduledMatches.forEach(match => {
    if (match.teams && match.teams.length > 0) {
      match.teams.forEach(team => {
        const trimmedTeam = (team || '').trim()
        if (trimmedTeam) {
          participantsInScheduled.add(trimmedTeam)
        }
      })
    }
    if (match.players && match.players.length > 0) {
      match.players.forEach(player => {
        const trimmedPlayer = (player || '').trim()
        if (trimmedPlayer) {
          participantsInScheduled.add(trimmedPlayer)
        }
      })
    }
  })

  return participantsInScheduled
}

/**
 * Get active participants (eligible for new matches) for a sport and gender
 * @param {Object} sportDoc - Sport document
 * @param {string} gender - Gender filter ('Male' or 'Female')
 * @param {Set<string>} knockedOut - Set of knocked out participants
 * @param {Set<string>} inScheduled - Set of participants in scheduled matches
 * @returns {Promise<Array<string>>} Array of active participant names/reg_numbers
 */
export async function getActiveParticipants(sportDoc, gender, knockedOut, inScheduled) {
  let activeParticipants = []

  if (sportDoc.type === 'dual_team' || sportDoc.type === 'multi_team') {
    // Get teams from teams_participated
    const eligibleTeams = (sportDoc.teams_participated || [])
      .filter(team => {
        const trimmedTeamName = (team.team_name || '').trim()
        return trimmedTeamName && !knockedOut.has(trimmedTeamName) && !inScheduled.has(trimmedTeamName)
      })
    
    // Get first player from each team to determine gender
    const teamPlayerRegNumbers = []
    const teamMap = new Map()
    
    eligibleTeams.forEach(team => {
      if (team.players && team.players.length > 0) {
        teamPlayerRegNumbers.push(team.players[0])
        teamMap.set(team.players[0], team.team_name)
      }
    })
    
    // Fetch gender for first player of each team
    if (teamPlayerRegNumbers.length > 0) {
      const teamPlayers = await Player.find({
        reg_number: { $in: teamPlayerRegNumbers }
      })
        .select('reg_number gender')
        .lean()
      
      // Filter by gender and create active participants list
      teamPlayers.forEach(player => {
        if (player.gender === gender) {
          const teamName = teamMap.get(player.reg_number)
          if (teamName) {
            activeParticipants.push(teamName)
          }
        }
      })
    }
  } else {
    // Get players from players_participated
    const playerRegNumbers = (sportDoc.players_participated || [])
      .filter(regNumber => {
        const trimmedRegNumber = (regNumber || '').trim()
        return trimmedRegNumber && !knockedOut.has(trimmedRegNumber) && !inScheduled.has(trimmedRegNumber)
      })

    // Fetch player details
    if (playerRegNumbers.length > 0) {
      const players = await Player.find({
        reg_number: { $in: playerRegNumbers }
      })
        .select('reg_number gender')
        .lean()

      // Filter by gender
      activeParticipants = players
        .filter(p => p.gender === gender)
        .map(p => p.reg_number)
    }
  }

  return activeParticipants
}

/**
 * Validate that match type is allowed for sport type
 * @param {string} matchType - Match type ('league', 'knockout', 'final')
 * @param {string} sportType - Sport type ('dual_team', 'multi_team', 'dual_player', 'multi_player')
 * @returns {Object|null} Error object if validation fails, null otherwise
 */
export function validateMatchTypeForSport(matchType, sportType) {
  if ((sportType === 'multi_team' || sportType === 'multi_player') && matchType === 'league') {
    return {
      statusCode: 400,
      message: 'match_type "league" is not allowed for multi_team and multi_player sports'
    }
  }
  return null
}

/**
 * Validate final match requirement when only 2 participants remain
 * @param {Object} sportDoc - Sport document
 * @param {string} derivedGender - Derived gender from participants
 * @param {Array} teams - Teams array from request
 * @param {Array} players - Players array from request
 * @param {string} matchType - Match type
 * @param {string} sportsName - Sport name
 * @param {number} eventYear - Event year
 * @returns {Promise<Object|null>} Error object if validation fails, null otherwise
 */
export async function validateFinalMatchRequirement(sportDoc, derivedGender, teams, players, matchType, sportsName, eventYear) {
  // Only validate for dual_team and dual_player sports
  if (sportDoc.type !== 'dual_team' && sportDoc.type !== 'dual_player') {
    return null
  }

  // Get knocked out participants and participants in scheduled matches
  const knockedOut = await getKnockedOutParticipants(sportsName, eventYear, derivedGender, sportDoc)
  const inScheduled = await getParticipantsInScheduledMatches(sportsName, eventYear, derivedGender, sportDoc)

  // Get active participants
  const activeParticipants = await getActiveParticipants(sportDoc, derivedGender, knockedOut, inScheduled)
  
  const participantsInMatch = sportDoc.type === 'dual_team' ? teams : players

  // If exactly 2 eligible participants are available for this gender and both are in the match, it MUST be 'final'
  if (activeParticipants.length === 2 && participantsInMatch.length === 2) {
    // Check if both participants in match are in the active participants list (with trimming)
    const trimmedActiveParticipants = activeParticipants.map(p => (p || '').trim()).filter(Boolean)
    const trimmedParticipantsInMatch = participantsInMatch.map(p => (p || '').trim()).filter(Boolean)
    
    const allActiveInMatch = trimmedParticipantsInMatch.every(p => {
      return trimmedActiveParticipants.includes(p)
    })
    
    if (allActiveInMatch) {
      if (matchType !== 'final') {
        logger.debug(`Final validation: Only 2 participants remain for ${sportsName} (${derivedGender}), but match_type is ${matchType}`)
        return {
          statusCode: 400,
          message: `Cannot schedule ${matchType} match. Only 2 eligible participants remain for this gender. This match must be a final match.`
        }
      }
    }
  }

  return null
}

/**
 * Validate that all other matches (league and knockout) are completed/draw/cancelled before scheduling final
 * This applies to all four sport types (dual_team, multi_team, dual_player, multi_player)
 * @param {string} sportsName - Sport name
 * @param {number} eventYear - Event year
 * @param {string} matchType - Match type
 * @param {string} derivedGender - Derived gender from participants
 * @param {Object} sportDoc - Sport document
 * @returns {Promise<Object|null>} Error object if validation fails, null otherwise
 */
export async function validateAllMatchesCompletedBeforeFinal(sportsName, eventYear, matchType, derivedGender, sportDoc) {
  // Only validate for final matches
  if (matchType !== 'final') {
    return null
  }

  // Find all matches for this sport and year that are league or knockout
  const allOtherMatches = await EventSchedule.find({
    sports_name: normalizeSportName(sportsName),
    event_year: eventYear,
    match_type: { $in: ['league', 'knockout'] }
  }).lean()

  // Filter by gender
  const otherMatches = []
  for (const match of allOtherMatches) {
    try {
      const matchGender = await getMatchGender(match, sportDoc)
      if (matchGender === derivedGender) {
        otherMatches.push(match)
      }
    } catch (error) {
      logger.error(`Error deriving gender for match ${match._id}:`, error)
      // Continue processing other matches
    }
  }

  // Check if any match has status 'scheduled'
  const scheduledMatches = otherMatches.filter(match => match.status === 'scheduled')
  
  if (scheduledMatches.length > 0) {
    // Get match details for error message
    const matchTypes = scheduledMatches.map(m => m.match_type)
    const uniqueMatchTypes = [...new Set(matchTypes)]
    const matchTypeLabel = uniqueMatchTypes.length === 1 
      ? uniqueMatchTypes[0] 
      : 'league or knockout'
    
    return {
      statusCode: 400,
      message: `Cannot schedule final match. There are ${scheduledMatches.length} scheduled ${matchTypeLabel} match(es) that must be completed, drawn, or cancelled first. All matches must be finished before scheduling the final.`
    }
  }

  // Check if any completed match is missing winner/qualifiers
  const completedMatches = otherMatches.filter(match => match.status === 'completed')
  const incompleteMatches = []
  
  for (const match of completedMatches) {
    if (sportDoc.type === 'dual_team' || sportDoc.type === 'dual_player') {
      // For dual types: must have winner
      if (!match.winner || (match.winner || '').trim() === '') {
        incompleteMatches.push(`${match.match_type} Match #${match.match_number}`)
      }
    } else {
      // For multi types: must have qualifiers
      if (!match.qualifiers || !Array.isArray(match.qualifiers) || match.qualifiers.length === 0) {
        incompleteMatches.push(`${match.match_type} Match #${match.match_number}`)
      }
    }
  }
  
  if (incompleteMatches.length > 0) {
    return {
      statusCode: 400,
      message: `Cannot schedule final match. The following completed match(es) are missing ${sportDoc.type === 'dual_team' || sportDoc.type === 'dual_player' ? 'winner' : 'qualifiers'}: ${incompleteMatches.join(', ')}. All completed matches must have ${sportDoc.type === 'dual_team' || sportDoc.type === 'dual_player' ? 'a winner declared' : 'qualifiers declared'} before scheduling the final.`
    }
  }

  return null
}

/**
 * Validate that all league matches are completed/draw/cancelled before scheduling knockout
 * This applies to all four sport types (dual_team, multi_team, dual_player, multi_player)
 * @param {string} sportsName - Sport name
 * @param {number} eventYear - Event year
 * @param {string} matchType - Match type
 * @param {string} derivedGender - Derived gender from participants
 * @param {Object} sportDoc - Sport document
 * @returns {Promise<Object|null>} Error object if validation fails, null otherwise
 */
export async function validateAllLeagueMatchesCompletedBeforeKnockout(sportsName, eventYear, matchType, derivedGender, sportDoc) {
  // Only validate for knockout matches
  if (matchType !== 'knockout') {
    return null
  }

  // Find all league matches for this sport and year
  const allLeagueMatches = await EventSchedule.find({
    sports_name: normalizeSportName(sportsName),
    event_year: eventYear,
    match_type: 'league'
  }).lean()

  // Filter by gender
  const leagueMatches = []
  for (const match of allLeagueMatches) {
    try {
      const matchGender = await getMatchGender(match, sportDoc)
      if (matchGender === derivedGender) {
        leagueMatches.push(match)
      }
    } catch (error) {
      logger.error(`Error deriving gender for league match ${match._id}:`, error)
      // Continue processing other matches
    }
  }

  // Check if any league match has status 'scheduled'
  const scheduledLeagueMatches = leagueMatches.filter(match => match.status === 'scheduled')
  
  if (scheduledLeagueMatches.length > 0) {
    return {
      statusCode: 400,
      message: `Cannot schedule knockout match. There are ${scheduledLeagueMatches.length} scheduled league match(es) that must be completed, drawn, or cancelled first. All league matches must be finished before scheduling knockout matches.`
    }
  }

  // Check if any completed league match is missing winner/qualifiers
  const completedLeagueMatches = leagueMatches.filter(match => match.status === 'completed')
  const incompleteMatches = []
  
  for (const match of completedLeagueMatches) {
    if (sportDoc.type === 'dual_team' || sportDoc.type === 'dual_player') {
      // For dual types: must have winner
      if (!match.winner || (match.winner || '').trim() === '') {
        incompleteMatches.push(`Match #${match.match_number}`)
      }
    } else {
      // For multi types: must have qualifiers
      if (!match.qualifiers || !Array.isArray(match.qualifiers) || match.qualifiers.length === 0) {
        incompleteMatches.push(`Match #${match.match_number}`)
      }
    }
  }
  
  if (incompleteMatches.length > 0) {
    return {
      statusCode: 400,
      message: `Cannot schedule knockout match. The following completed league match(es) are missing ${sportDoc.type === 'dual_team' || sportDoc.type === 'dual_player' ? 'winner' : 'qualifiers'}: ${incompleteMatches.join(', ')}. All completed league matches must have ${sportDoc.type === 'dual_team' || sportDoc.type === 'dual_player' ? 'a winner declared' : 'qualifiers declared'} before scheduling knockout matches.`
    }
  }

  return null
}

