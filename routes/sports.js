/**
 * Sports Routes
 * Handles sports-related operations
 */

import express from 'express'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse } from '../utils/errorHandler.js'
import { TEAM_SPORTS, INDIVIDUAL_SPORTS, CULTURAL_SPORTS } from '../constants/index.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * GET /api/sports
 * Get team sports list (for captain assignment - admin only)
 */
router.get(
  '/sports',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    return sendSuccessResponse(res, { sports: TEAM_SPORTS })
  })
)

/**
 * GET /api/sports-counts
 * Get all sports counts at once (teams and participants)
 */
router.get(
  '/sports-counts',
  authenticateToken,
  asyncHandler(async (req, res) => {
    logger.api('Received request for all sports counts')

    const teamsCounts = {}
    const participantsCounts = {}

    // Fetch teams counts for all team sports in parallel
    const teamPromises = TEAM_SPORTS.map(async (sport) => {
      try {
        const playersInTeams = await Player.find({
          reg_number: { $ne: 'admin' },
          participated_in: {
            $elemMatch: {
              sport: sport,
              team_name: { $exists: true, $ne: null },
            },
          },
        })
          .select('-password')
          .lean()

        // Group by team name to count unique teams
        const teamsSet = new Set()
        for (const player of playersInTeams) {
          const participation = player.participated_in.find((p) => p.sport === sport && p.team_name)
          if (participation && participation.team_name) {
            teamsSet.add(participation.team_name)
          }
        }
        return { sport, count: teamsSet.size }
      } catch (error) {
        logger.error(`Error getting teams count for ${sport}:`, error)
        return { sport, count: 0 }
      }
    })

    // Fetch participants counts for all individual/cultural sports in parallel
    const allIndividualSports = [...INDIVIDUAL_SPORTS, ...CULTURAL_SPORTS]
    const participantPromises = allIndividualSports.map(async (sport) => {
      try {
        const result = await Player.aggregate([
          {
            $match: {
              reg_number: { $ne: 'admin' },
            },
          },
          {
            $unwind: '$participated_in',
          },
          {
            $match: {
              'participated_in.sport': sport,
              $or: [
                { 'participated_in.team_name': { $exists: false } },
                { 'participated_in.team_name': null },
                { 'participated_in.team_name': '' },
              ],
            },
          },
          {
            $count: 'total',
          },
        ])
        const count = result.length > 0 ? result[0].total : 0
        return { sport, count }
      } catch (error) {
        logger.error(`Error getting participants count for ${sport}:`, error)
        return { sport, count: 0 }
      }
    })

    // Wait for all promises to resolve
    const teamResults = await Promise.all(teamPromises)
    const participantResults = await Promise.all(participantPromises)

    // Build the counts objects
    teamResults.forEach(({ sport, count }) => {
      teamsCounts[sport] = count
    })

    participantResults.forEach(({ sport, count }) => {
      participantsCounts[sport] = count
    })

    logger.api('All sports counts fetched successfully')

    return sendSuccessResponse(res, {
      teams_counts: teamsCounts,
      participants_counts: participantsCounts,
    })
  })
)

export default router

