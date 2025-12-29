/**
 * Export Routes
 * Handles data export operations
 */

import express from 'express'
import XLSX from 'xlsx'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendErrorResponse } from '../utils/errorHandler.js'
import { TEAM_SPORTS, ALL_SPORTS, ADMIN_REG_NUMBER } from '../constants/index.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * GET /api/export-excel
 * Export players data to Excel (admin only)
 */
router.get(
  '/export-excel',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    // Read existing data and filter out admin user
    const nonAdminPlayers = await Player.find({ reg_number: { $ne: ADMIN_REG_NUMBER } })
      .select('-password')
      .lean()

    // Define all sports in order with exact column headers as specified
    const sportColumns = [
      { header: 'CRICKET', sport: 'Cricket' },
      { header: 'VOLLEYBALL', sport: 'Volleyball' },
      { header: 'BADMINTON', sport: 'Badminton' },
      { header: 'TABLE TENNIS', sport: 'Table Tennis' },
      { header: 'KABADDI', sport: 'Kabaddi' },
      { header: 'RELAY 4×100 M', sport: 'Relay 4×100 m' },
      { header: 'RELAY 4×400 M', sport: 'Relay 4×400 m' },
      { header: 'CARROM', sport: 'Carrom' },
      { header: 'CHESS', sport: 'Chess' },
      { header: 'SPRINT 100 M', sport: 'Sprint 100 m' },
      { header: 'SPRINT 200 M', sport: 'Sprint 200 m' },
      { header: 'SPRINT 400 M', sport: 'Sprint 400 m' },
      { header: 'LONG JUMP', sport: 'Long Jump' },
      { header: 'HIGH JUMP', sport: 'High Jump' },
      { header: 'JAVELIN', sport: 'Javelin' },
      { header: 'SHOT PUT', sport: 'Shot Put' },
      { header: 'DISCUS THROW', sport: 'Discus Throw' },
      { header: 'ESSAY WRITING', sport: 'Essay Writing' },
      { header: 'STORY WRITING', sport: 'Story Writing' },
      { header: 'GROUP DISCUSSION', sport: 'Group Discussion' },
      { header: 'DEBATE', sport: 'Debate' },
      { header: 'EXTEMPORE', sport: 'Extempore' },
      { header: 'QUIZ', sport: 'Quiz' },
      { header: 'DUMB CHARADES', sport: 'Dumb Charades' },
      { header: 'PAINTING', sport: 'Painting' },
      { header: 'SINGING', sport: 'Singing' },
    ]

    // Prepare data for Excel
    const excelData = nonAdminPlayers.map((player) => {
      const row = {
        'REG Number': player.reg_number || '',
        'Full Name': player.full_name || '',
        Gender: player.gender || '',
        'Department/Branch': player.department_branch || '',
        Year: player.year || '',
        'Mobile Number': player.mobile_number || '',
        'Email Id': player.email_id || '',
      }

      // Add sport columns with exact headers as specified
      sportColumns.forEach(({ header, sport }) => {
        const isTeamSport = TEAM_SPORTS.includes(sport)
        const isCaptain =
          player.captain_in && Array.isArray(player.captain_in) && player.captain_in.includes(sport)
        const isParticipant =
          player.participated_in &&
          Array.isArray(player.participated_in) &&
          player.participated_in.some((p) => p.sport === sport)

        if (isTeamSport) {
          // Team sports: CAPTAIN, PARTICIPANT, or NA
          if (isCaptain) {
            row[header] = 'CAPTAIN'
          } else if (isParticipant) {
            row[header] = 'PARTICIPANT'
          } else {
            row[header] = 'NA'
          }

          // Add team name column for team sports (right after the sport column)
          const teamHeader = `${header}_TEAM`
          const teamParticipation =
            player.participated_in &&
            Array.isArray(player.participated_in) &&
            player.participated_in.find((p) => p.sport === sport && p.team_name)
          row[teamHeader] = teamParticipation && teamParticipation.team_name ? teamParticipation.team_name : 'NA'
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
    const filename = `Players_Report_${new Date().toISOString().split('T')[0]}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // Send Excel file
    res.send(excelBuffer)
  })
)

export default router

