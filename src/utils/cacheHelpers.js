/**
 * Cache clearing utilities for consistent cache management
 */

import { clearCache } from './api'
import { buildApiUrlWithYear } from './apiHelpers'

/**
 * Clear all caches related to a specific sport and event year
 * @param {string} sportName - The sport name
 * @param {number|null} eventYear - The event year
 * @param {string|null} eventName - The event name (for composite key filtering)
 */
export const clearSportCaches = (sportName, eventYear, eventName = null) => {
  if (!sportName) return
  
  const encodedSport = encodeURIComponent(sportName)
  
  clearCache(buildApiUrlWithYear(`/api/teams/${encodedSport}`, eventYear, null, eventName))
  clearCache(buildApiUrlWithYear(`/api/participants/${encodedSport}`, eventYear, null, eventName))
  clearCache(buildApiUrlWithYear(`/api/participants-count/${encodedSport}`, eventYear, null, eventName))
  clearCache(buildApiUrlWithYear(`/api/event-schedule/${encodedSport}`, eventYear, null, eventName))
  clearCache(buildApiUrlWithYear(`/api/event-schedule/${encodedSport}/teams-players`, eventYear, null, eventName))
  clearCache(buildApiUrlWithYear('/api/sports-counts', eventYear, null, eventName))
}

/**
 * Clear caches after team participation changes
 * @param {string} sportName - The sport name
 * @param {number|null} eventYear - The event year
 * @param {string|null} eventName - The event name (for composite key filtering)
 */
export const clearTeamParticipationCaches = (sportName, eventYear, eventName = null) => {
  clearSportCaches(sportName, eventYear, eventName)
  clearCache('/api/me') // Current user's participation data changes
}

/**
 * Clear caches after individual participation changes
 * @param {string} sportName - The sport name
 * @param {number|null} eventYear - The event year
 * @param {string|null} eventName - The event name (for composite key filtering)
 */
export const clearIndividualParticipationCaches = (sportName, eventYear, eventName = null) => {
  clearSportCaches(sportName, eventYear, eventName)
  clearCache('/api/me') // Current user's participation data changes
}

/**
 * Clear caches after sport changes (create/update/delete)
 * @param {number|null} eventYear - The event year
 * @param {string|null} eventName - The event name (for composite key filtering)
 */
export const clearSportManagementCaches = (eventYear, eventName = null) => {
  clearCache(buildApiUrlWithYear('/api/sports', eventYear, null, eventName))
  clearCache(buildApiUrlWithYear('/api/sports-counts', eventYear, null, eventName))
}

