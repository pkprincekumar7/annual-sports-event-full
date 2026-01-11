/**
 * Cache clearing utilities for consistent cache management
 */

import { clearCache } from './api'

/**
 * Clear all caches related to a specific sport and event year
 * @param {string} sportName - The sport name
 * @param {number|null} eventYear - The event year
 */
export const clearSportCaches = (sportName, eventYear) => {
  if (!sportName) return
  
  const encodedSport = encodeURIComponent(sportName)
  const eventYearParam = eventYear ? `?event_year=${eventYear}` : ''
  
  clearCache(`/api/teams/${encodedSport}${eventYearParam}`)
  clearCache(`/api/participants/${encodedSport}${eventYearParam}`)
  clearCache(`/api/participants-count/${encodedSport}${eventYearParam}`)
  clearCache(`/api/event-schedule/${encodedSport}${eventYearParam}`)
  clearCache(`/api/event-schedule/${encodedSport}/teams-players${eventYearParam}`)
  clearCache(`/api/sports-counts${eventYearParam}`)
}

/**
 * Clear caches after team participation changes
 * @param {string} sportName - The sport name
 * @param {number|null} eventYear - The event year
 */
export const clearTeamParticipationCaches = (sportName, eventYear) => {
  clearSportCaches(sportName, eventYear)
  clearCache('/api/me') // Current user's participation data changes
}

/**
 * Clear caches after individual participation changes
 * @param {string} sportName - The sport name
 * @param {number|null} eventYear - The event year
 */
export const clearIndividualParticipationCaches = (sportName, eventYear) => {
  clearSportCaches(sportName, eventYear)
  clearCache('/api/me') // Current user's participation data changes
}

/**
 * Clear caches after sport changes (create/update/delete)
 * @param {number|null} eventYear - The event year
 */
export const clearSportManagementCaches = (eventYear) => {
  const eventYearParam = eventYear ? `?event_year=${eventYear}` : ''
  clearCache(`/api/sports${eventYearParam}`)
  clearCache(`/api/sports-counts${eventYearParam}`)
}

