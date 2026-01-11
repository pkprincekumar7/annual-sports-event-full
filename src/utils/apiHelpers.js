/**
 * API URL building utilities
 * Centralizes URL construction with proper encoding and event_year/event_name parameters
 */

/**
 * Build API URL for sport-specific endpoints
 * @param {string} endpoint - The endpoint name (e.g., 'teams', 'participants')
 * @param {string} sportName - The sport name
 * @param {number|null} eventYear - Optional event year
 * @param {string|null} eventName - Optional event name for composite key filtering
 * @returns {string} - The complete API URL
 */
export const buildSportApiUrl = (endpoint, sportName, eventYear = null, eventName = null) => {
  if (!sportName) return ''
  const encodedSport = encodeURIComponent(sportName)
  const params = []
  if (eventYear) params.push(`event_year=${eventYear}`)
  if (eventName) params.push(`event_name=${encodeURIComponent(eventName)}`)
  const queryString = params.length > 0 ? `?${params.join('&')}` : ''
  return `/api/${endpoint}/${encodedSport}${queryString}`
}

/**
 * Build API URL for event schedule endpoints
 * @param {string} sportName - The sport name
 * @param {string} subPath - Optional sub-path (e.g., 'teams-players')
 * @param {number|null} eventYear - Optional event year
 * @param {string|null} gender - Optional gender ('Male' or 'Female')
 * @param {string|null} eventName - Optional event name for composite key filtering
 * @returns {string} - The complete API URL
 */
export const buildEventScheduleApiUrl = (sportName, subPath = '', eventYear = null, gender = null, eventName = null) => {
  if (!sportName) return ''
  const encodedSport = encodeURIComponent(sportName)
  const path = subPath ? `${encodedSport}/${subPath}` : encodedSport
  const params = []
  if (eventYear) params.push(`event_year=${eventYear}`)
  if (eventName) params.push(`event_name=${encodeURIComponent(eventName)}`)
  if (gender && (gender === 'Male' || gender === 'Female')) params.push(`gender=${encodeURIComponent(gender)}`)
  const queryString = params.length > 0 ? `?${params.join('&')}` : ''
  return `/api/event-schedule/${path}${queryString}`
}

/**
 * Build API URL with event_year and event_name parameters
 * @param {string} baseUrl - The base URL (e.g., '/api/sports')
 * @param {number|null} eventYear - Optional event year
 * @param {string|null} gender - Optional gender ('Male' or 'Female')
 * @param {string|null} eventName - Optional event name for composite key filtering
 * @returns {string} - The complete API URL with event_year and event_name parameters
 */
export const buildApiUrlWithYear = (baseUrl, eventYear = null, gender = null, eventName = null) => {
  if (!baseUrl) return ''
  const params = []
  if (eventYear) params.push(`event_year=${eventYear}`)
  if (eventName) params.push(`event_name=${encodeURIComponent(eventName)}`)
  if (gender && (gender === 'Male' || gender === 'Female')) params.push(`gender=${encodeURIComponent(gender)}`)
  const queryString = params.length > 0 ? `?${params.join('&')}` : ''
  return `${baseUrl}${queryString}`
}

