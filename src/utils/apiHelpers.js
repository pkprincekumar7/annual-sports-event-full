/**
 * API URL building utilities
 * Centralizes URL construction with proper encoding and year parameters
 */

/**
 * Build API URL for sport-specific endpoints
 * @param {string} endpoint - The endpoint name (e.g., 'teams', 'participants')
 * @param {string} sportName - The sport name
 * @param {number|null} eventYear - Optional event year
 * @returns {string} - The complete API URL
 */
export const buildSportApiUrl = (endpoint, sportName, eventYear = null) => {
  if (!sportName) return ''
  const encodedSport = encodeURIComponent(sportName)
  const yearParam = eventYear ? `?year=${eventYear}` : ''
  return `/api/${endpoint}/${encodedSport}${yearParam}`
}

/**
 * Build API URL for event schedule endpoints
 * @param {string} sportName - The sport name
 * @param {string} subPath - Optional sub-path (e.g., 'teams-players')
 * @param {number|null} eventYear - Optional event year
 * @returns {string} - The complete API URL
 */
export const buildEventScheduleApiUrl = (sportName, subPath = '', eventYear = null) => {
  if (!sportName) return ''
  const encodedSport = encodeURIComponent(sportName)
  const path = subPath ? `${encodedSport}/${subPath}` : encodedSport
  const yearParam = eventYear ? `?year=${eventYear}` : ''
  return `/api/event-schedule/${path}${yearParam}`
}

/**
 * Build API URL with year parameter
 * @param {string} baseUrl - The base URL (e.g., '/api/sports')
 * @param {number|null} eventYear - Optional event year
 * @returns {string} - The complete API URL with year parameter
 */
export const buildApiUrlWithYear = (baseUrl, eventYear = null) => {
  if (!baseUrl) return ''
  const yearParam = eventYear ? `?year=${eventYear}` : ''
  return `${baseUrl}${yearParam}`
}

