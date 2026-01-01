/**
 * Player Helper Functions
 * Utility functions for player-related operations
 */

import EventYear from '../models/EventYear.js'
import Sport from '../models/Sport.js'

/**
 * Compute year display format from year_of_admission
 * @param {number} yearOfAdmission - Year of admission (e.g., 2025, 2024)
 * @param {number|null} currentYear - Current year (defaults to current year if not provided)
 * @returns {string} Display format like "1st Year (2025)" or "5th Year (2021)"
 */
export function computeYearDisplay(yearOfAdmission, currentYear = null) {
  // If currentYear not provided, use current year
  if (!currentYear) {
    currentYear = new Date().getFullYear()
  }
  
  // Calculate year difference
  const yearDifference = currentYear - yearOfAdmission
  
  // Map to display format (supports up to 5th year, but can display beyond)
  const yearLabels = {
    1: '1st Year',
    2: '2nd Year',
    3: '3rd Year',
    4: '4th Year',
    5: '5th Year'
  }
  
  const label = yearLabels[yearDifference] || `${yearDifference}th Year`
  
  return `${label} (${yearOfAdmission})`
}

/**
 * Check if player can participate in events (1st to 5th year students only)
 * @param {number} yearOfAdmission - Year of admission (e.g., 2025, 2024)
 * @param {number|null} currentYear - Current year (defaults to current year if not provided)
 * @returns {boolean} True if player is in 1st to 5th year, false otherwise
 */
export function canParticipateInEvents(yearOfAdmission, currentYear = null) {
  // If currentYear not provided, use current year
  if (!currentYear) {
    currentYear = new Date().getFullYear()
  }
  
  // Calculate year difference
  const yearDifference = currentYear - yearOfAdmission
  
  // Only 1st to 5th year students can participate
  return yearDifference >= 1 && yearDifference <= 5
}

/**
 * Compute player participation from Sports collection
 * @param {string} playerRegNumber - Player registration number
 * @param {number|null} eventYear - Event year (defaults to active year if not provided)
 * @returns {Promise<{participated_in: Array, captain_in: Array}>} Participation data
 */
export async function computePlayerParticipation(playerRegNumber, eventYear = null) {
  // If eventYear not provided, get active year
  if (!eventYear) {
    const activeYear = await EventYear.findOne({ is_active: true }).lean()
    eventYear = activeYear ? activeYear.year : new Date().getFullYear()
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

