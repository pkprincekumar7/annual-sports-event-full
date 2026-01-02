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
import { normalizeSportName } from '../utils/sportHelpers.js'

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

    // Check cache
    const cacheKey = `/api/points-table/${sport}?year=${eventYear}`
    const cached = getCache(cacheKey)
    if (cached) {
      // Always use sendSuccessResponse for consistency, even for cached data
      // sendSuccessResponse will add success: true, overriding any existing success field
      return sendSuccessResponse(res, cached)
    }

    // Get points table entries for this sport and year
    const pointsEntries = await PointsTable.find({
      sports_name: normalizeSportName(sport),
      event_year: eventYear
    })
      .sort({ points: -1, matches_won: -1 })
      .lean()

    const result = {
      sport: sport,
      points_table: pointsEntries,
      total_participants: pointsEntries.length
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

    // Get points entry for this participant
    const pointsEntry = await PointsTable.findOne({
      sports_name: normalizeSportName(sport),
      event_year: eventYear,
      participant: participant.trim()
    }).lean()

    if (!pointsEntry) {
      return handleNotFoundError(res, 'Points entry')
    }

    return sendSuccessResponse(res, pointsEntry)
  })
)

export default router

