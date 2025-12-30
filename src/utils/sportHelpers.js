/**
 * Sport Helper Functions (Frontend)
 * Utility functions for sport-related operations
 */

/**
 * Check if a sport type is a team sport
 * @param {string} sportType - Sport type (e.g., 'dual_team', 'multi_team', 'dual_player', 'multi_player')
 * @returns {boolean} True if team sport, false otherwise
 */
export function isTeamSport(sportType) {
  return sportType === 'dual_team' || sportType === 'multi_team'
}

/**
 * Get the original sport type from a sport object
 * Handles both sportType and type fields for backward compatibility
 * @param {Object} sport - Sport object
 * @returns {string|null} Sport type or null
 */
export function getSportType(sport) {
  return sport?.sportType || sport?.type || null
}

/**
 * Normalize sport name to lowercase for comparison
 * Sport names are stored in lowercase in the database
 * @param {string} sportName - Sport name
 * @returns {string} Normalized sport name
 */
export function normalizeSportName(sportName) {
  return sportName?.toLowerCase() || ''
}

/**
 * Check if a user is a captain for a specific sport
 * @param {Object} user - User object with captain_in array
 * @param {string} sportName - Sport name to check
 * @returns {boolean} True if user is captain for the sport
 */
export function isCaptainForSport(user, sportName) {
  if (!user || !sportName) return false
  
  const normalizedSportName = normalizeSportName(sportName)
  return user.captain_in && 
    Array.isArray(user.captain_in) && 
    user.captain_in.some(captainSport => 
      normalizeSportName(captainSport) === normalizedSportName
    )
}

/**
 * Check if a user is enrolled in a team event
 * @param {Object} user - User object with participated_in array
 * @param {string} sportName - Sport name to check
 * @returns {boolean} True if user is enrolled in a team for the sport
 */
export function isEnrolledInTeamEvent(user, sportName) {
  if (!user || !sportName) return false
  
  return user.participated_in && 
    Array.isArray(user.participated_in) &&
    user.participated_in.some(p => 
      p.sport === sportName && p.team_name
    )
}

/**
 * Check if a user has participated in an individual event
 * @param {Object} user - User object with participated_in array
 * @param {string} sportName - Sport name to check
 * @returns {boolean} True if user has participated in the individual sport
 */
export function hasParticipatedInIndividual(user, sportName) {
  if (!user || !sportName) return false
  
  return user.participated_in && 
    Array.isArray(user.participated_in) &&
    user.participated_in.some(p => 
      p.sport === sportName && !p.team_name
    )
}

/**
 * Get team size from sport object
 * Handles both 'players' field (from SportsSection) and 'team_size' field (from database)
 * @param {Object} sport - Sport object
 * @returns {number} Team size or 0
 */
export function getTeamSize(sport) {
  if (!sport) return 0
  return sport.players || sport.team_size || 0
}

