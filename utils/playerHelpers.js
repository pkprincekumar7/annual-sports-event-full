/**
 * Player Helper Functions
 * Utility functions for player-related operations
 */

import EventYear from '../models/EventYear.js'
import Sport from '../models/Sport.js'
import { findActiveEventYear } from './yearHelpers.js'

/**
 * Compute player participation from Sports collection
 * @param {string} playerRegNumber - Player registration number
 * @param {number|null} eventYear - Event year (defaults to active event year if not provided)
 * @returns {Promise<{participated_in: Array, captain_in: Array}>} Participation data
 */
export async function computePlayerParticipation(playerRegNumber, eventYear = null) {
  // If eventYear not provided, get active event year
  if (!eventYear) {
    const activeYear = await findActiveEventYear()
    eventYear = activeYear ? activeYear.event_year : new Date().getFullYear()
  }
  
  // Find all sports where player is:
  // 1. An eligible captain (in eligible_captains array)
  // 2. A team captain (in teams_participated[].captain)
  // 3. A team member (in teams_participated[].players)
  // 4. An individual participant (in players_participated)
  // Filter by event_year
  const sports = await Sport.find({
    event_year: eventYear,
    $or: [
      { eligible_captains: playerRegNumber },
      { 'teams_participated.captain': playerRegNumber },
      { 'teams_participated.players': playerRegNumber },
      { players_participated: playerRegNumber }
    ]
  }).lean()
  
  const participated_in = []
  const captain_in = []
  
  sports.forEach(sport => {
    // Check if eligible captain (assigned by admin, may or may not have created team yet)
    const isEligibleCaptain = sport.eligible_captains && sport.eligible_captains.includes(playerRegNumber)
    
    // Check if team captain (has created a team)
    const captainTeam = sport.teams_participated.find(
      team => team.captain === playerRegNumber
    )
    
    if (captainTeam) {
      // Player is captain of an existing team
      captain_in.push(sport.name)
      participated_in.push({
        sport: sport.name,
        team_name: captainTeam.team_name
      })
    } else if (isEligibleCaptain) {
      // Player is eligible captain but hasn't created team yet
      captain_in.push(sport.name)
      // No participation entry yet (team not created)
    } else {
      // Check if team member (but not captain)
      const teamMember = sport.teams_participated.find(
        team => team.players && team.players.includes(playerRegNumber)
      )
      if (teamMember) {
        participated_in.push({
          sport: sport.name,
          team_name: teamMember.team_name
        })
      } else {
        // Check if individual participant
        if (sport.players_participated && sport.players_participated.includes(playerRegNumber)) {
          participated_in.push({
            sport: sport.name,
            team_name: null
          })
        }
      }
    }
  })
  
  return { participated_in, captain_in }
}

/**
 * Compute player participation for multiple players in batch (optimized)
 * @param {Array<string>} playerRegNumbers - Array of player registration numbers
 * @param {number|null} eventYear - Event year (defaults to active event year if not provided)
 * @returns {Promise<Object>} Map of reg_number -> {participated_in: Array, captain_in: Array}
 */
export async function computePlayersParticipationBatch(playerRegNumbers, eventYear = null) {
  if (!playerRegNumbers || playerRegNumbers.length === 0) {
    return {}
  }

  // If eventYear not provided, get active event year
  if (!eventYear) {
    const activeYear = await findActiveEventYear()
    eventYear = activeYear ? activeYear.event_year : new Date().getFullYear()
  }

  // Initialize result map
  const result = {}
  playerRegNumbers.forEach(regNumber => {
    result[regNumber] = {
      participated_in: [],
      captain_in: []
    }
  })

  // OPTIMIZATION: Single query to fetch all sports for all players
  const sports = await Sport.find({
    event_year: eventYear,
    $or: [
      { eligible_captains: { $in: playerRegNumbers } },
      { 'teams_participated.captain': { $in: playerRegNumbers } },
      { 'teams_participated.players': { $in: playerRegNumbers } },
      { players_participated: { $in: playerRegNumbers } }
    ]
  }).lean()

  // Process all sports and build participation data for all players
  sports.forEach(sport => {
    // Check teams first (captains and members)
    if (sport.teams_participated && Array.isArray(sport.teams_participated)) {
      sport.teams_participated.forEach(team => {
        // Check captain
        if (team.captain && result[team.captain]) {
          result[team.captain].captain_in.push(sport.name)
          result[team.captain].participated_in.push({
            sport: sport.name,
            team_name: team.team_name
          })
        }

        // Check team members
        if (team.players && Array.isArray(team.players)) {
          team.players.forEach(regNumber => {
            if (result[regNumber] && regNumber !== team.captain) {
              result[regNumber].participated_in.push({
                sport: sport.name,
                team_name: team.team_name
              })
            }
          })
        }
      })
    }

    // Check eligible captains (only if they don't have a team yet)
    if (sport.eligible_captains && Array.isArray(sport.eligible_captains)) {
      sport.eligible_captains.forEach(regNumber => {
        if (result[regNumber]) {
          // Only add if they're not already a captain (don't have a team)
          const hasTeam = result[regNumber].captain_in.includes(sport.name)
          if (!hasTeam) {
            result[regNumber].captain_in.push(sport.name)
          }
        }
      })
    }

    // Check individual participants (only if not in a team)
    if (sport.players_participated && Array.isArray(sport.players_participated)) {
      sport.players_participated.forEach(regNumber => {
        if (result[regNumber]) {
          // Only add if player is not already in a team for this sport
          const hasTeamInSport = result[regNumber].participated_in.some(
            p => p.sport === sport.name && p.team_name !== null
          )
          if (!hasTeamInSport) {
            result[regNumber].participated_in.push({
              sport: sport.name,
              team_name: null
            })
          }
        }
      })
    }
  })

  return result
}

/**
 * Validate department exists
 * @param {string} departmentName - Department name
 * @returns {Promise<{exists: boolean, department: Object|null}>}
 */
export async function validateDepartmentExists(departmentName) {
  try {
    const Department = (await import('../models/Department.js')).default
    const department = await Department.findOne({ name: departmentName.trim() }).lean()
    
    if (!department) {
      return { exists: false, department: null }
    }
    
    return {
      exists: true,
      department
    }
  } catch (error) {
    console.error('Error validating department:', error)
    return { exists: false, department: null }
  }
}

