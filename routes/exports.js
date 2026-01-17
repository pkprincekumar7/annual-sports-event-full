/**
 * Export Routes
 * Handles data export operations using Sports collection
 */

import express from 'express'
import XLSX from 'xlsx'
import Player from '../models/Player.js'
import Sport from '../models/Sport.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendErrorResponse } from '../utils/errorHandler.js'
import { computePlayerParticipation } from '../utils/playerHelpers.js'
import { getPlayersBatchNames } from '../utils/batchHelpers.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { ADMIN_REG_NUMBER } from '../constants/index.js'

const router = express.Router()

/**
 * GET /api/export-excel
 * Export players data to Excel (admin only)
 * Event ID Filter: Accepts ?event_id=2026-umang parameter (defaults to active event)
 * Query Sports collection to get all sports dynamically (filtered by event_id)
 * Compute participation from Sports collection (filtered by event_id)
 * Use year field directly from Player model (already formatted as "1st Year (2025)") - this is academic year, not event year
 */
router.get(
  '/export-excel',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null

    // Get event year with document (defaults to active event if not provided)
    let eventYearDoc = null
    let eventId = null
    try {
      const eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
      eventYearDoc = eventYearData.doc
      eventId = eventYearDoc.event_id
    } catch (error) {
      if (error.message === 'Event year not found' || error.message === 'No active event year found') {
        eventYearDoc = null
        eventId = null
      } else {
        throw error
      }
    }

    // Validate event has event_id
    // Get all sports for this event
    const sports = eventId
      ? await Sport.find({ event_id: eventId }).sort({ category: 1, name: 1 }).lean()
      : []

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

    // Filter players and compute participation data in one pass (optimization: compute once per player)
    const playersWithParticipation = []
    for (const player of nonAdminPlayers) {
      let participation = { participated_in: [], captain_in: [], coordinator_in: [] }
      if (eventId) {
        // Compute participation data for this player (only once)
        participation = await computePlayerParticipation(player.reg_number, eventId)
      }
      
      // Always include players; when eventId is provided, participation may be empty
      const hasParticipation = (participation.participated_in && participation.participated_in.length > 0) ||
                               (participation.captain_in && participation.captain_in.length > 0)
      
      playersWithParticipation.push({
        ...player,
        _participation: participation // Store participation data for later use
      })
    }

    const batchMap = eventId
      ? await getPlayersBatchNames(playersWithParticipation.map(p => p.reg_number), eventId)
      : {}

    // Prepare data for Excel (reuse pre-computed participation data)
    const excelData = playersWithParticipation.map((player) => {
      // Use pre-computed participation data (no need to recompute)
      const participation = player._participation
      
      // Use batch name as year display (year field removed)
      const yearDisplay = batchMap[player.reg_number] || ''

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
    const eventYearLabel = eventYearDoc?.event_year ? eventYearDoc.event_year : 'no-event'
    const filename = `Players_Report_${eventYearLabel}_${new Date().toISOString().split('T')[0]}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // Send Excel file
    res.send(excelBuffer)
  })
)

export default router
