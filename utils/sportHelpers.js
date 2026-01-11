/**
 * Sport Helper Functions (Backend)
 * Utility functions for sport-related operations
 */

import Sport from '../models/Sport.js'

/**
 * Check if a sport type is a team sport
 * @param {string} type - Sport type
 * @returns {boolean} True if team sport
 */
export function isTeamSportType(type) {
  return type === 'dual_team' || type === 'multi_team'
}

/**
 * Check if a sport type is an individual sport
 * @param {string} type - Sport type
 * @returns {boolean} True if individual sport
 */
export function isIndividualSportType(type) {
  return type === 'dual_player' || type === 'multi_player'
}

/**
 * Validate and parse team size for team sports
 * @param {any} team_size - Team size value (can be string or number)
 * @param {string} type - Sport type
 * @returns {Object} { isValid: boolean, value: number|null, error: string|null }
 */
export function validateTeamSize(team_size, type) {
  const isTeamSport = isTeamSportType(type)
  
  if (isTeamSport) {
    // Team size is REQUIRED for team sports
    if (team_size === undefined || team_size === null || team_size === '') {
      return {
        isValid: false,
        value: null,
        error: 'team_size is required for team sports (dual_team and multi_team)'
      }
    }
    
    // Convert string to number if needed
    let teamSizeValue = team_size
    if (typeof team_size === 'string' && team_size.trim() !== '') {
      teamSizeValue = parseInt(team_size, 10)
      if (isNaN(teamSizeValue)) {
        return {
          isValid: false,
          value: null,
          error: 'team_size must be a valid number'
        }
      }
    }
    
    if (!Number.isInteger(teamSizeValue) || teamSizeValue <= 0) {
      return {
        isValid: false,
        value: null,
        error: 'team_size must be a positive integer'
      }
    }
    
    return {
      isValid: true,
      value: teamSizeValue,
      error: null
    }
  } else {
    // For non-team sports, team_size should not be provided
    if (team_size !== undefined && team_size !== null && team_size !== '') {
      return {
        isValid: false,
        value: null,
        error: 'team_size is only applicable for dual_team and multi_team types'
      }
    }
    
    return {
      isValid: true,
      value: null,
      error: null
    }
  }
}

/**
 * Normalize sport name to lowercase
 * @param {string} name - Sport name
 * @returns {string} Normalized sport name
 */
export function normalizeSportName(name) {
  return name?.trim().toLowerCase() || ''
}

/**
 * Find sport by name, event year, and event name
 * @param {string} sportName - Sport name (will be normalized)
 * @param {number} eventYear - Event year
 * @param {string} eventName - Event name (optional for backward compatibility, but recommended)
 * @param {Object} options - Query options
 * @param {boolean} options.lean - Use lean() for read-only queries (default: true)
 * @param {string} options.select - Fields to select
 * @returns {Promise<Object|null>} Sport document or null if not found
 * @throws {Error} Throws error if sport not found (should be caught by asyncHandler)
 */
export async function findSportByNameAndYear(sportName, eventYear, eventName = null, options = {}) {
  const { lean = true, select = null } = options

  if (!sportName || !eventYear) {
    throw new Error('Sport name and event year are required')
  }

  const normalizedName = normalizeSportName(sportName)
  const yearNum = parseInt(eventYear)
  
  if (isNaN(yearNum)) {
    throw new Error('Event year must be a valid number')
  }

  // Build query with event_year and optionally event_name
  const queryFilter = {
    name: normalizedName,
    event_year: yearNum
  }
  
  // If event_name is provided, include it in the filter
  if (eventName) {
    queryFilter.event_name = eventName
  }

  let query = Sport.findOne(queryFilter)

  if (select) {
    query = query.select(select)
  }

  if (lean) {
    query = query.lean()
  }

  const sportDoc = await query

  if (!sportDoc) {
    const eventInfo = eventName ? `event year ${yearNum} (${eventName})` : `event year ${yearNum}`
    throw new Error(`Sport "${sportName}" not found for ${eventInfo}`)
  }

  return sportDoc
}

