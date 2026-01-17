/**
 * Points Table Routes
 * Handles points table operations for league matches
 */

import express from 'express'
import PointsTable from '../models/PointsTable.js'
import { authenticateToken } from '../middleware/auth.js'
import { getCache, setCache, clearCache } from '../utils/cache.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { normalizeSportName, findSportByNameAndId } from '../utils/sportHelpers.js'
import { requireAdminOrCoordinator } from '../utils/coordinatorHelpers.js'
import { getPointsEntryGender, getMatchGender } from '../utils/genderHelpers.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * GET /api/points-table/:sport
 * Get points table for a specific sport (sorted by points descending)
 * Event ID Filter: Accepts ?event_id=2026-umang parameter (defaults to active event)
 * Filter by event_id and sports_name
 */
router.get(
  '/points-table/:sport',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { sport } = req.params
    
    const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
    
    let eventYearData
    
    try {
      // Try to get event year with document - if it doesn't exist, return empty points table
      eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
    } catch (error) {
      // If event year not found, return empty points table instead of error
      if (error.message === 'Event year not found' || error.message === 'No active event year found') {
        const emptyResult = {
          sport: sport,
          points_table: [],
          total_participants: 0
        }
        return sendSuccessResponse(res, emptyResult)
      }
      // Re-throw other errors to be handled by asyncHandler
      throw error
    }

    const eventId = eventYearData.doc.event_id
    const gender = req.query.gender // Required: 'Male' or 'Female'

    // Validate gender is provided
    if (!gender || (gender !== 'Male' && gender !== 'Female')) {
      return sendErrorResponse(res, 400, 'Gender parameter is required and must be "Male" or "Female"')
    }

    // Check cache
    const cacheKey = `/api/points-table/${sport}?event_id=${encodeURIComponent(eventId)}&gender=${gender}`
    const cached = getCache(cacheKey)
    if (cached) {
      // Always use sendSuccessResponse for consistency, even for cached data
      // sendSuccessResponse will add success: true, overriding any existing success field
      return sendSuccessResponse(res, cached)
    }

    // Get all points table entries for this sport and event_id (gender will be derived)
    // Only returns teams/players who have played at least one league match
    const allPointsEntries = await PointsTable.find({
      sports_name: normalizeSportName(sport),
      event_id: eventId
    })
      .sort({ points: -1, matches_won: -1 })
      .lean()

    // Performance optimization: batch lookup sport document once (needed for gender derivation)
    const sportDoc = await findSportByNameAndId(sport, eventId).catch(() => null)

    // If no entries found, check if there are completed league matches that might need backfilling
    // Also check if there are any league matches at all for this gender
    if (allPointsEntries.length === 0) {
      const EventSchedule = (await import('../models/EventSchedule.js')).default
      
      // Check for completed league matches (might need backfilling) - filter by event_id
      const completedLeagueMatches = await EventSchedule.countDocuments({
        sports_name: normalizeSportName(sport),
        event_id: eventId,
        match_type: 'league',
        status: { $in: ['completed', 'draw', 'cancelled'] }
      })
      
      // Check for any league matches (completed or scheduled) for this gender - filter by event_id
      const allLeagueMatches = await EventSchedule.find({
        sports_name: normalizeSportName(sport),
        event_id: eventId,
        match_type: 'league'
      }).lean()
      
      // Derive gender for league matches to see if any match this gender
      let leagueMatchesForGender = 0
      for (const match of allLeagueMatches) {
        const matchGender = await getMatchGender(match, sportDoc)
        if (matchGender === gender) {
          leagueMatchesForGender++
        }
      }
      
      if (completedLeagueMatches > 0 && leagueMatchesForGender === 0) {
        // There are league matches but none for this gender - might be a filtering issue
        logger.warn(`[PointsTable] No points table entries found for ${sport} (${eventId}, ${gender}), but ${completedLeagueMatches} completed league matches exist. Consider running backfill.`)
      } else if (leagueMatchesForGender === 0) {
        // No league matches at all for this gender
        logger.info(`[PointsTable] No league matches found for ${sport} (${eventId}, ${gender}). Points table only tracks league matches, not knockout/final matches.`)
      }
    }

    // Derive gender for each entry and filter by requested gender
    const pointsEntries = []
    const entriesWithNullGender = []
    
    for (const entry of allPointsEntries) {
      const entryGender = await getPointsEntryGender(entry, sportDoc)
      if (entryGender === gender) {
        pointsEntries.push(entry)
      } else if (entryGender === null) {
        // Log entries where gender derivation failed for debugging
        entriesWithNullGender.push({
          participant: entry.participant,
          participant_type: entry.participant_type
        })
      }
    }
    
    // Log warning if gender derivation failed for some entries (for debugging)
    if (entriesWithNullGender.length > 0) {
      logger.warn(`[PointsTable] Could not derive gender for ${entriesWithNullGender.length} entries in ${sport} (${eventId}):`, entriesWithNullGender.slice(0, 5))
    }

    // Check if there are any league matches for this gender (for better error messaging)
    let hasLeagueMatchesForGender = false
    if (pointsEntries.length === 0) {
      const EventSchedule = (await import('../models/EventSchedule.js')).default
      const allLeagueMatches = await EventSchedule.find({
        sports_name: normalizeSportName(sport),
        event_id: eventId,
        match_type: 'league'
      }).lean()
      
      for (const match of allLeagueMatches) {
        const matchGender = await getMatchGender(match, sportDoc)
        if (matchGender === gender) {
          hasLeagueMatchesForGender = true
          break
        }
      }
    }

    const result = {
      sport: sport,
      points_table: pointsEntries,
      total_participants: pointsEntries.length,
      has_league_matches: hasLeagueMatchesForGender // Flag to help frontend show appropriate message
    }

    // Cache the result (without success field, as sendSuccessResponse adds it)
    setCache(cacheKey, result)

    return sendSuccessResponse(res, result)
  })
)

/**
 * POST /api/points-table/backfill/:sport
 * Backfill points table for a specific sport (admin or coordinator for that sport)
 * Useful when points table entries are missing for existing completed matches
 * Note: Backfill is a read-only recalculation operation and is allowed anytime
 * (not restricted by event period since it only recalculates from existing completed matches)
 */
router.post(
  '/points-table/backfill/:sport',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { sport } = req.params
    
    const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
    const eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
    const eventId = eventYearData.doc.event_id
    
    await requireAdminOrCoordinator(req.user.reg_number, sport, eventId)

    const { backfillPointsTableForSport } = await import('../utils/backfillPointsTable.js')
    const result = await backfillPointsTableForSport(sport, eventId)
    
    if (result.errors > 0 && result.processed === 0) {
      return sendErrorResponse(res, 500, result.message || 'Error backfilling points table')
    }
    
    // Clear cache after backfill
    clearCache(`/api/points-table/${sport}?event_id=${encodeURIComponent(eventId)}&gender=Male`)
    clearCache(`/api/points-table/${sport}?event_id=${encodeURIComponent(eventId)}&gender=Female`)
    
    return sendSuccessResponse(res, result, result.message || 'Points table backfilled successfully')
  })
)

export default router

