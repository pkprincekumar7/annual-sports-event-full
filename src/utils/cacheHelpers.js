/**
 * Cache clearing utilities for consistent cache management
 */

import { clearCache, clearCachePattern } from './api'
import { buildApiUrlWithYear } from './apiHelpers'

/**
 * Clear all caches related to a specific sport and event
 * @param {string} sportName - The sport name
 * @param {string|null} eventId - The event_id
 */
export const clearSportCaches = (sportName, eventId = null) => {
  if (!sportName) return
  
  const encodedSport = encodeURIComponent(sportName)
  
  clearCache(buildApiUrlWithYear(`/api/teams/${encodedSport}`, eventId))
  clearCache(buildApiUrlWithYear(`/api/participants/${encodedSport}`, eventId))
  clearCache(buildApiUrlWithYear(`/api/participants-count/${encodedSport}`, eventId))
  clearCache(buildApiUrlWithYear(`/api/event-schedule/${encodedSport}`, eventId))
  clearCache(buildApiUrlWithYear(`/api/event-schedule/${encodedSport}/teams-players`, eventId))
  clearCache(buildApiUrlWithYear('/api/sports-counts', eventId))
}

/**
 * Clear caches after team participation changes
 * @param {string} sportName - The sport name
 * @param {string|null} eventId - The event_id
 */
export const clearTeamParticipationCaches = (sportName, eventId = null) => {
  clearSportCaches(sportName, eventId)
  clearCachePattern('/api/me') // Current user's participation data changes (clear all variations)
}

/**
 * Clear caches after individual participation changes
 * @param {string} sportName - The sport name
 * @param {string|null} eventId - The event_id
 */
export const clearIndividualParticipationCaches = (sportName, eventId = null) => {
  clearSportCaches(sportName, eventId)
  clearCachePattern('/api/me') // Current user's participation data changes (clear all variations)
}

/**
 * Clear caches after sport changes (create/update/delete)
 * @param {string|null} eventId - The event_id
 */
export const clearSportManagementCaches = (eventId = null) => {
  clearCache(buildApiUrlWithYear('/api/sports', eventId))
  clearCache(buildApiUrlWithYear('/api/sports-counts', eventId))
}

