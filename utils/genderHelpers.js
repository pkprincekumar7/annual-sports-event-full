/**
 * Gender Helper Functions
 * Utility functions to derive gender from participants (teams/players)
 * Performance optimized with caching and batch operations
 */

import Player from '../models/Player.js'
import Sport from '../models/Sport.js'

// In-memory cache for gender lookups (cleared on server restart)
// Key format: 'team:{sportName}:{eventYear}:{teamName}' or 'player:{regNumber}'
const genderCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Helper to get cache key
const getCacheKey = (type, ...args) => `${type}:${args.join(':')}`

// Helper to check if cache entry is valid
const isCacheValid = (entry) => {
  if (!entry) return false
  return Date.now() - entry.timestamp < CACHE_TTL
}

/**
 * Get gender from a team by looking up the first player's gender
 * @param {string} teamName - Team name
 * @param {string} sportName - Sport name
 * @param {number} eventYear - Event year
 * @returns {Promise<string|null>} Gender ('Male' or 'Female') or null if not found
 */
export async function getTeamGender(teamName, sportName, eventYear) {
  try {
    // Check cache first
    const cacheKey = getCacheKey('team', sportName.toLowerCase().trim(), eventYear, teamName.trim())
    const cached = genderCache.get(cacheKey)
    if (isCacheValid(cached)) {
      return cached.value
    }

    // Find the sport to get team details
    const sportDoc = await Sport.findOne({
      name: sportName.toLowerCase().trim(),
      event_year: eventYear
    }).lean()

    if (!sportDoc || !sportDoc.teams_participated) {
      return null
    }

    // Find the team
    const team = sportDoc.teams_participated.find(
      t => t.team_name && t.team_name.trim() === teamName.trim()
    )

    if (!team || !team.players || team.players.length === 0) {
      return null
    }

    // Get first player's gender (teams have same-gender players)
    const firstPlayerRegNumber = team.players[0]
    const player = await Player.findOne({ reg_number: firstPlayerRegNumber })
      .select('gender')
      .lean()

    const gender = player ? player.gender : null
    
    // Cache the result
    if (gender) {
      genderCache.set(cacheKey, { value: gender, timestamp: Date.now() })
    }

    return gender
  } catch (error) {
    console.error('Error getting team gender:', error)
    return null
  }
}

/**
 * Get gender from a player reg_number
 * @param {string} regNumber - Player registration number
 * @returns {Promise<string|null>} Gender ('Male' or 'Female') or null if not found
 */
export async function getPlayerGender(regNumber) {
  try {
    // Check cache first
    const cacheKey = getCacheKey('player', regNumber.trim())
    const cached = genderCache.get(cacheKey)
    if (isCacheValid(cached)) {
      return cached.value
    }

    const player = await Player.findOne({ reg_number: regNumber.trim() })
      .select('gender')
      .lean()

    const gender = player ? player.gender : null
    
    // Cache the result
    if (gender) {
      genderCache.set(cacheKey, { value: gender, timestamp: Date.now() })
    }

    return gender
  } catch (error) {
    console.error('Error getting player gender:', error)
    return null
  }
}

/**
 * Get gender from match participants
 * @param {Object} match - EventSchedule match document
 * @param {Object} sportDoc - Sport document (optional, will be fetched if not provided)
 * @returns {Promise<string|null>} Gender ('Male' or 'Female') or null if not found
 */
export async function getMatchGender(match, sportDoc = null) {
  try {
    // If sportDoc not provided, fetch it
    if (!sportDoc) {
      sportDoc = await Sport.findOne({
        name: match.sports_name,
        event_year: match.event_year
      }).lean()
    }

    if (!sportDoc) {
      return null
    }

    // Determine participant type from sport type
    if (sportDoc.type === 'dual_team' || sportDoc.type === 'multi_team') {
      // For team sports, get gender from first team
      if (match.teams && match.teams.length > 0) {
        const firstTeamName = match.teams[0].trim()
        return await getTeamGender(firstTeamName, match.sports_name, match.event_year)
      }
    } else {
      // For player sports, get gender from first player
      if (match.players && match.players.length > 0) {
        const firstPlayerRegNumber = match.players[0].trim()
        return await getPlayerGender(firstPlayerRegNumber)
      }
    }

    return null
  } catch (error) {
    console.error('Error getting match gender:', error)
    return null
  }
}

/**
 * Get gender from points table participant
 * @param {Object} pointsEntry - PointsTable entry
 * @param {Object} sportDoc - Sport document (optional, will be fetched if not provided)
 * @returns {Promise<string|null>} Gender ('Male' or 'Female') or null if not found
 */
export async function getPointsEntryGender(pointsEntry, sportDoc = null) {
  try {
    // If sportDoc not provided, fetch it
    if (!sportDoc) {
      sportDoc = await Sport.findOne({
        name: pointsEntry.sports_name,
        event_year: pointsEntry.event_year
      }).lean()
    }

    if (!sportDoc) {
      return null
    }

    // Determine participant type
    if (pointsEntry.participant_type === 'team') {
      // For teams, get gender from first player in team
      return await getTeamGender(pointsEntry.participant, pointsEntry.sports_name, pointsEntry.event_year)
    } else {
      // For players, get gender directly
      return await getPlayerGender(pointsEntry.participant)
    }
  } catch (error) {
    console.error('Error getting points entry gender:', error)
    return null
  }
}

/**
 * Batch get genders for multiple participants (performance optimized)
 * @param {Array<string>} participants - Array of team names or player reg_numbers
 * @param {string} participantType - 'team' or 'player'
 * @param {string} sportName - Sport name (required for teams)
 * @param {number} eventYear - Event year (required for teams)
 * @returns {Promise<Map<string, string>>} Map of participant -> gender
 */
export async function getParticipantsGender(participants, participantType, sportName = null, eventYear = null) {
  const genderMap = new Map()
  const uncachedParticipants = []

  if (participantType === 'team') {
    // For teams, check cache first, then batch fetch uncached
    if (!sportName || !eventYear) {
      return genderMap
    }

    try {
      // Check cache for each team
      participants.forEach(teamName => {
        const cacheKey = getCacheKey('team', sportName.toLowerCase().trim(), eventYear, teamName.trim())
        const cached = genderCache.get(cacheKey)
        if (isCacheValid(cached)) {
          genderMap.set(teamName.trim(), cached.value)
        } else {
          uncachedParticipants.push(teamName)
        }
      })

      if (uncachedParticipants.length === 0) {
        return genderMap // All from cache
      }

      // Fetch sport document once for all uncached teams
      const sportDoc = await Sport.findOne({
        name: sportName.toLowerCase().trim(),
        event_year: eventYear
      }).lean()

      if (!sportDoc || !sportDoc.teams_participated) {
        return genderMap
      }

      // Get first player reg_number for each uncached team
      const teamPlayerMap = new Map()
      const playerRegNumbers = []

      uncachedParticipants.forEach(teamName => {
        const team = sportDoc.teams_participated.find(
          t => t.team_name && t.team_name.trim() === teamName.trim()
        )
        if (team && team.players && team.players.length > 0) {
          const firstPlayerRegNumber = team.players[0]
          teamPlayerMap.set(teamName.trim(), firstPlayerRegNumber)
          playerRegNumbers.push(firstPlayerRegNumber)
        }
      })

      // Batch fetch all players at once
      if (playerRegNumbers.length > 0) {
        const players = await Player.find({ reg_number: { $in: playerRegNumbers } })
          .select('reg_number gender')
          .lean()

        // Map team names to genders and cache results
        uncachedParticipants.forEach(teamName => {
          const firstPlayerRegNumber = teamPlayerMap.get(teamName.trim())
          if (firstPlayerRegNumber) {
            const player = players.find(p => p.reg_number === firstPlayerRegNumber)
            if (player && player.gender) {
              const trimmedTeamName = teamName.trim()
              genderMap.set(trimmedTeamName, player.gender)
              // Cache the result
              const cacheKey = getCacheKey('team', sportName.toLowerCase().trim(), eventYear, trimmedTeamName)
              genderCache.set(cacheKey, { value: player.gender, timestamp: Date.now() })
            }
          }
        })
      }
    } catch (error) {
      console.error('Error batch getting team genders:', error)
    }
  } else {
    // For players, check cache first, then batch fetch uncached
    try {
      // Check cache for each player
      participants.forEach(regNumber => {
        const cacheKey = getCacheKey('player', regNumber.trim())
        const cached = genderCache.get(cacheKey)
        if (isCacheValid(cached)) {
          genderMap.set(regNumber.trim(), cached.value)
        } else {
          uncachedParticipants.push(regNumber)
        }
      })

      if (uncachedParticipants.length === 0) {
        return genderMap // All from cache
      }

      // Batch fetch all uncached players at once
      const players = await Player.find({ reg_number: { $in: uncachedParticipants.map(p => p.trim()) } })
        .select('reg_number gender')
        .lean()

      uncachedParticipants.forEach(regNumber => {
        const player = players.find(p => p.reg_number === regNumber.trim())
        if (player && player.gender) {
          const trimmedRegNumber = regNumber.trim()
          genderMap.set(trimmedRegNumber, player.gender)
          // Cache the result
          const cacheKey = getCacheKey('player', trimmedRegNumber)
          genderCache.set(cacheKey, { value: player.gender, timestamp: Date.now() })
        }
      })
    } catch (error) {
      console.error('Error batch getting player genders:', error)
    }
  }

  return genderMap
}

/**
 * Clear gender cache for a specific player
 * @param {string} regNumber - Player registration number
 */
export function clearPlayerGenderCache(regNumber) {
  const cacheKey = getCacheKey('player', regNumber.trim())
  genderCache.delete(cacheKey)
}

/**
 * Clear gender cache for a specific team
 * @param {string} teamName - Team name
 * @param {string} sportName - Sport name
 * @param {number} eventYear - Event year
 */
export function clearTeamGenderCache(teamName, sportName, eventYear) {
  const cacheKey = getCacheKey('team', sportName.toLowerCase().trim(), eventYear, teamName.trim())
  genderCache.delete(cacheKey)
}

/**
 * Clear all gender cache entries for a sport (when team composition changes)
 * @param {string} sportName - Sport name
 * @param {number} eventYear - Event year
 */
export function clearSportGenderCache(sportName, eventYear) {
  const prefix = `team:${sportName.toLowerCase().trim()}:${eventYear}:`
  for (const key of genderCache.keys()) {
    if (key.startsWith(prefix)) {
      genderCache.delete(key)
    }
  }
}

/**
 * Clear all gender cache (use sparingly, e.g., on server restart or major data migration)
 */
export function clearAllGenderCache() {
  genderCache.clear()
}

