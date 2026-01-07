/**
 * Cache Helper Utilities
 * Centralized cache clearing functions for event schedule and related endpoints
 */

import { clearCache } from './cache.js'
import { normalizeSportName } from './sportHelpers.js'
import { getMatchGender } from './genderHelpers.js'

/**
 * Clear all caches related to a match (event schedule, teams-players, points table)
 * @param {Object} match - Match object (must have sports_name, event_year, match_type)
 * @param {string} gender - Gender ('Male' or 'Female') - optional, will be derived if not provided
 * @param {Object} sportDoc - Sport document (optional, will be fetched if not provided)
 */
export async function clearMatchCaches(match, gender = null, sportDoc = null) {
  const normalizedSportsName = normalizeSportName(match.sports_name)
  const eventYear = match.event_year

  // Clear base cache (without gender for backward compatibility)
  clearCache(`/api/event-schedule/${normalizedSportsName}?year=${eventYear}`)

  // Derive gender if not provided
  let matchGender = gender
  if (!matchGender) {
    matchGender = await getMatchGender(match, sportDoc)
  }

  if (matchGender) {
    // Clear gender-specific caches
    clearCache(`/api/event-schedule/${normalizedSportsName}?year=${eventYear}&gender=${matchGender}`)
    clearCache(`/api/event-schedule/${normalizedSportsName}/teams-players?year=${eventYear}&gender=${matchGender}`)
    
    // Clear points table cache if it's a league match
    if (match.match_type === 'league') {
      clearCache(`/api/points-table/${normalizedSportsName}?year=${eventYear}&gender=${matchGender}`)
    }
  }
}

/**
 * Clear caches for a new match being created
 * @param {string} sportsName - Sport name
 * @param {number} eventYear - Event year
 * @param {string} gender - Gender ('Male' or 'Female')
 * @param {string} matchType - Match type ('league', 'knockout', 'final')
 */
export function clearNewMatchCaches(sportsName, eventYear, gender, matchType) {
  const normalizedSportsName = normalizeSportName(sportsName)

  // Clear base cache (without gender for backward compatibility)
  clearCache(`/api/event-schedule/${normalizedSportsName}?year=${eventYear}`)

  if (gender) {
    // Clear gender-specific caches
    clearCache(`/api/event-schedule/${normalizedSportsName}?year=${eventYear}&gender=${gender}`)
    clearCache(`/api/event-schedule/${normalizedSportsName}/teams-players?year=${eventYear}&gender=${gender}`)
    
    // Clear points table cache if it's a league match
    if (matchType === 'league') {
      clearCache(`/api/points-table/${normalizedSportsName}?year=${eventYear}&gender=${gender}`)
    }
  }
}

