/**
 * Export Routes
 * Handles data export operations using Sports collection
 */

import express from 'express'
import XLSX from 'xlsx'
import Player from '../models/Player.js'
import Sport from '../models/Sport.js'
import EventYear from '../models/EventYear.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendErrorResponse } from '../utils/errorHandler.js'
import { computePlayerParticipation, computeYearDisplay } from '../utils/playerHelpers.js'
import { getCache, setCache } from '../utils/cache.js'
import { ADMIN_REG_NUMBER } from '../constants/index.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * GET /api/export-excel
 * Export players data to Excel (admin only)
 * Year Filter: Accepts ?year=2026 parameter (defaults to active year)
 * Query Sports collection to get all sports dynamically (filtered by year)
 * Compute participation from Sports collection (filtered by year)
 * Use computeYearDisplay() helper to generate "1st Year (2025)" format from year_of_admission
 */
router.get(
  '/export-excel',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    let eventYear = req.query.year ? parseInt(req.query.year) : null

    // Get event year (default to active year if not provided)
    if (!eventYear) {
      const cachedActiveYear = getCache('/api/event-years/active')
      if (cachedActiveYear) {
        eventYear = cachedActiveYear.year
      } else {
        const activeYear = await EventYear.findOne({ is_active: true }).lean()
        if (activeYear) {
          eventYear = activeYear.year
          setCache('/api/event-years/active', activeYear)
        } else {
          return sendErrorResponse(res, 404, 'No active event year found')
        }
      }
    } else {
      // Validate year exists
      const yearExists = await EventYear.findOne({ year: eventYear })
      if (!yearExists) {
        return sendErrorResponse(res, 404, 'Event year not found')
      }
    }

    // Get all sports for this year
    const sports = await Sport.find({ event_year: eventYear })
      .sort({ category: 1, name: 1 })
      .lean()

    // Create sport columns dynamically
    const sportColumns = sports.map(sport => ({
      header: sport.name.toUpperCase(),
      sport: sport.name,
      type: sport.type,
      category: sport.category
    }))

    // Read all players (excluding admin)
    const nonAdminPlayers = await Player.find({ reg_number: { $ne: ADMIN_REG_NUMBER } })
      .select('-password')
      .lean()

    // Prepare data for Excel
    const excelData = await Promise.all(
      nonAdminPlayers.map(async (player) => {
        // Compute participation data for this player
        const participation = await computePlayerParticipation(player.reg_number, eventYear)
        
        // Compute year display format
        const yearDisplay = player.year_of_admission
          ? computeYearDisplay(player.year_of_admission, eventYear)
          : ''

        const row = {
          'REG Number': player.reg_number || '',
          'Full Name': player.full_name || '',
          Gender: player.gender || '',
          'Department/Branch': player.department_branch || '',
          Year: yearDisplay,
          'Mobile Number': player.mobile_number || '',
          'Email Id': player.email_id || '',
        }

        // Add sport columns dynamically
        sportColumns.forEach(({ header, sport, type }) => {
          const isTeamSport = type === 'dual_team' || type === 'multi_team'
          const isCaptain = participation.captain_in && participation.captain_in.includes(sport)
          const participationEntry = participation.participated_in.find(p => p.sport === sport)
          const isParticipant = !!participationEntry

          if (isTeamSport) {
            // Team sports: CAPTAIN, PARTICIPANT, or NA
            if (isCaptain) {
              row[header] = 'CAPTAIN'
            } else if (isParticipant) {
              row[header] = 'PARTICIPANT'
            } else {
              row[header] = 'NA'
            }

            // Add team name column for team sports
            const teamHeader = `${header}_TEAM`
            row[teamHeader] = participationEntry && participationEntry.team_name
              ? participationEntry.team_name
              : 'NA'
          } else {
            // Individual/Cultural sports: PARTICIPANT or NA
            if (isParticipant) {
              row[header] = 'PARTICIPANT'
            } else {
              row[header] = 'NA'
            }
          }
        })

        return row
      })
    )

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Players Report')

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    })

    // Set response headers
    const filename = `Players_Report_${eventYear}_${new Date().toISOString().split('T')[0]}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // Send Excel file
    res.send(excelBuffer)
  })
)

export default router
