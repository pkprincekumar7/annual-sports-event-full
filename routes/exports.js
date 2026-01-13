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
import { getEventYear } from '../utils/yearHelpers.js'
import { ADMIN_REG_NUMBER } from '../constants/index.js'

const router = express.Router()

/**
 * GET /api/export-excel
 * Export players data to Excel (admin only)
 * Event Year Filter: Accepts ?event_year=2026 parameter (defaults to active event year)
 * Query Sports collection to get all sports dynamically (filtered by event year)
 * Compute participation from Sports collection (filtered by event year)
 * Use year field directly from Player model (already formatted as "1st Year (2025)") - this is academic year, not event year
 */
router.get(
  '/export-excel',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    // For optional event_year/event_name: either both must be provided, or neither
    // If one is provided, the other is also required for composite key filtering
    const hasEventYear = req.query.event_year !== undefined && req.query.event_year !== null && req.query.event_year !== ''
    const hasEventName = req.query.event_name !== undefined && req.query.event_name !== null && req.query.event_name !== '' && req.query.event_name.trim()
    
    if (hasEventYear && !hasEventName) {
      return sendErrorResponse(res, 400, 'event_name is required when event_year is provided')
    }
    if (hasEventName && !hasEventYear) {
      return sendErrorResponse(res, 400, 'event_year is required when event_name is provided')
    }
    
    // Extract event_year and event_name from query (defaults to active event if not provided)
    const eventYearQuery = hasEventYear ? parseInt(req.query.event_year) : null
    const eventNameQuery = hasEventName ? req.query.event_name.trim() : null

    // Validate year parameter if provided
    if (eventYearQuery !== null && (isNaN(eventYearQuery) || eventYearQuery <= 0)) {
      return sendErrorResponse(res, 400, 'Invalid event year parameter. Event year must be a positive number.')
    }

    // Get event year with document (defaults to active event year if not provided)
    // getEventYear will use active event's event_name if eventNameQuery is not provided
    let eventYearData
    try {
      eventYearData = await getEventYear(eventYearQuery, { returnDoc: true, eventName: eventNameQuery })
    } catch (error) {
      if (error.message === 'Event year not found' || error.message === 'No active event year found') {
        return sendErrorResponse(res, 400, error.message === 'No active event year found' 
          ? 'No active event year found. Please configure an active event year or provide a valid event year parameter.'
          : `Event year ${eventYearQuery}${eventNameQuery ? ` with event name "${eventNameQuery}"` : ''} not found. Please provide a valid event year.`)
      }
      throw error
    }

    const eventYear = eventYearData.event_year
    const eventYearDoc = eventYearData.doc
    const eventName = eventYearDoc.event_name

    // Ensure eventYear is valid before proceeding
    if (!eventYear || isNaN(eventYear) || !eventYearDoc) {
      return sendErrorResponse(res, 400, 'Invalid event year. Unable to process export request.')
    }

    // Validate event year has event_name
    if (!eventName || !eventName.trim()) {
      return sendErrorResponse(res, 400, 'Event year is missing event name. Please configure the event name for the event year.')
    }

    // Get all sports for this event year and event name
    const sports = await Sport.find({ event_year: eventYear, event_name: eventName })
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

    // Filter players and compute participation data in one pass (optimization: compute once per player)
    const playersWithParticipation = []
    for (const player of nonAdminPlayers) {
      // Compute participation data for this player (only once)
      const participation = await computePlayerParticipation(player.reg_number, eventYear)
      
      // Check if player has any participation (as participant or captain) for this year
      const hasParticipation = (participation.participated_in && participation.participated_in.length > 0) ||
                               (participation.captain_in && participation.captain_in.length > 0)
      
      // Only include players who have participation or captain status for this year
      // Store participation data with player to avoid recomputation
      if (hasParticipation) {
        playersWithParticipation.push({
          ...player,
          _participation: participation // Store participation data for later use
        })
      }
    }

    // Prepare data for Excel (reuse pre-computed participation data)
    const excelData = playersWithParticipation.map((player) => {
      // Use pre-computed participation data (no need to recompute)
      const participation = player._participation
      
      // Year is already stored directly
      const yearDisplay = player.year || ''

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
    const filename = `Players_Report_${eventYear}_${new Date().toISOString().split('T')[0]}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // Send Excel file
    res.send(excelBuffer)
  })
)

export default router
