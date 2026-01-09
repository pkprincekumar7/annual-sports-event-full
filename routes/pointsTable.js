/**
 * Points Table Routes
 * Handles points table operations for league matches
 */

import express from 'express'
import PointsTable from '../models/PointsTable.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireEventStatusUpdatePeriod } from '../middleware/dateRestrictions.js'
import { getCache, setCache, clearCache } from '../utils/cache.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { normalizeSportName, findSportByNameAndYear } from '../utils/sportHelpers.js'
import { getPointsEntryGender, getMatchGender } from '../utils/genderHelpers.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * GET /api/points-table/:sport
 * Get points table for a specific sport (sorted by points descending)
 * Year Filter: Accepts ?year=2026 parameter (defaults to active year)
 * Filter by event_year and sports_name
 */
router.get(
  '/points-table/:sport',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { sport } = req.params
    
    let eventYear
    
    try {
      // Try to get event year - if it doesn't exist, return empty points table
      eventYear = await getEventYear(req.query.year ? parseInt(req.query.year) : null)
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

    const gender = req.query.gender // Required: 'Male' or 'Female'

    // Validate gender is provided
    if (!gender || (gender !== 'Male' && gender !== 'Female')) {
      return sendErrorResponse(res, 400, 'Gender parameter is required and must be "Male" or "Female"')
    }

    // Check cache
    const cacheKey = `/api/points-table/${sport}?year=${eventYear}&gender=${gender}`
    const cached = getCache(cacheKey)
    if (cached) {
      // Always use sendSuccessResponse for consistency, even for cached data
      // sendSuccessResponse will add success: true, overriding any existing success field
      return sendSuccessResponse(res, cached)
    }

    // Get all points table entries for this sport and year (gender will be derived)
    // Only returns teams/players who have played at least one league match
    const allPointsEntries = await PointsTable.find({
      sports_name: normalizeSportName(sport),
      event_year: eventYear
    })
      .sort({ points: -1, matches_won: -1 })
      .lean()

    // Performance optimization: batch lookup sport document once (needed for gender derivation)
    const sportDoc = await findSportByNameAndYear(sport, eventYear).catch(() => null)

    // If no entries found, check if there are completed league matches that might need backfilling
    // Also check if there are any league matches at all for this gender
    if (allPointsEntries.length === 0) {
      const EventSchedule = (await import('../models/EventSchedule.js')).default
      
      // Check for completed league matches (might need backfilling)
      const completedLeagueMatches = await EventSchedule.countDocuments({
        sports_name: normalizeSportName(sport),
        event_year: eventYear,
        match_type: 'league',
        status: { $in: ['completed', 'draw', 'cancelled'] }
      })
      
      // Check for any league matches (completed or scheduled) for this gender
      const allLeagueMatches = await EventSchedule.find({
        sports_name: normalizeSportName(sport),
        event_year: eventYear,
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
        logger.warn(`[PointsTable] No points table entries found for ${sport} (${eventYear}, ${gender}), but ${completedLeagueMatches} completed league matches exist. Consider running backfill.`)
      } else if (leagueMatchesForGender === 0) {
        // No league matches at all for this gender
        logger.info(`[PointsTable] No league matches found for ${sport} (${eventYear}, ${gender}). Points table only tracks league matches, not knockout/final matches.`)
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
      logger.warn(`[PointsTable] Could not derive gender for ${entriesWithNullGender.length} entries in ${sport} (${eventYear}):`, entriesWithNullGender.slice(0, 5))
    }

    // Check if there are any league matches for this gender (for better error messaging)
    let hasLeagueMatchesForGender = false
    if (pointsEntries.length === 0) {
      const EventSchedule = (await import('../models/EventSchedule.js')).default
      const allLeagueMatches = await EventSchedule.find({
        sports_name: normalizeSportName(sport),
        event_year: eventYear,
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
 * GET /api/points-table/:sport/:participant
 * Get points for a specific participant in a sport
 * Year Filter: Accepts ?year=2026 parameter (defaults to active year)
 */
router.get(
  '/points-table/:sport/:participant',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { sport, participant } = req.params
    const eventYear = await getEventYear(req.query.year ? parseInt(req.query.year) : null)
    const gender = req.query.gender // Required: 'Male' or 'Female'

    // Validate gender is provided
    if (!gender || (gender !== 'Male' && gender !== 'Female')) {
      return sendErrorResponse(res, 400, 'Gender parameter is required and must be "Male" or "Female"')
    }

    // Get all points entries for this participant, sport, and year (gender will be derived)
    const allPointsEntries = await PointsTable.find({
      sports_name: normalizeSportName(sport),
      event_year: eventYear,
      participant: participant.trim()
    }).lean()

    if (allPointsEntries.length === 0) {
      return handleNotFoundError(res, 'Points entry')
    }

    // Derive gender for each entry and find the one matching requested gender
    // Performance optimization: batch lookup sport document once
    const sportDoc = await findSportByNameAndYear(sport, eventYear).catch(() => null)
    
    for (const entry of allPointsEntries) {
      const entryGender = await getPointsEntryGender(entry, sportDoc)
      if (entryGender === gender) {
        return sendSuccessResponse(res, entry)
      }
    }

    return handleNotFoundError(res, 'Points entry')
  })
)

/**
 * POST /api/points-table/backfill/:sport
 * Backfill points table for a specific sport (admin only)
 * Useful when points table entries are missing for existing completed matches
 * Allowed during event period (event start to event end)
 */
router.post(
  '/points-table/backfill/:sport',
  authenticateToken,
  requireAdmin,
  requireEventStatusUpdatePeriod,
  asyncHandler(async (req, res) => {
    const { sport } = req.params
    const eventYear = await getEventYear(req.query.year ? parseInt(req.query.year) : null)
    
    const { backfillPointsTableForSport } = await import('../utils/backfillPointsTable.js')
    const result = await backfillPointsTableForSport(sport, eventYear)
    
    if (result.errors > 0 && result.processed === 0) {
      return sendErrorResponse(res, 500, result.message || 'Error backfilling points table')
    }
    
    // Clear cache after backfill
    clearCache(`/api/points-table/${sport}?year=${eventYear}&gender=Male`)
    clearCache(`/api/points-table/${sport}?year=${eventYear}&gender=Female`)
    
    return sendSuccessResponse(res, result, result.message || 'Points table backfilled successfully')
  })
)

export default router

