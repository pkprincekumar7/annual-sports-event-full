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
  const yearParam = eventYear ? `?year=${eventYear}` : ''
  
  clearCache(`/api/teams/${encodedSport}${yearParam}`)
  clearCache(`/api/participants/${encodedSport}${yearParam}`)
  clearCache(`/api/participants-count/${encodedSport}${yearParam}`)
  clearCache(`/api/event-schedule/${encodedSport}${yearParam}`)
  clearCache(`/api/event-schedule/${encodedSport}/teams-players${yearParam}`)
  clearCache(`/api/sports-counts${yearParam}`)
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
  const yearParam = eventYear ? `?year=${eventYear}` : ''
  clearCache(`/api/sports${yearParam}`)
  clearCache(`/api/sports-counts${yearParam}`)
}

