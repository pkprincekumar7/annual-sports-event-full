/**
 * Points Table Helper Functions
 * Utility functions for points table operations
 */

import PointsTable from '../models/PointsTable.js'
import EventSchedule from '../models/EventSchedule.js'
import { normalizeSportName } from './sportHelpers.js'
import { getPointsEntryGender, getMatchGender } from './genderHelpers.js'

/**
 * Recalculate points table from scratch for a sport and gender
 * This recalculates all points based on completed league matches
 * @param {string} sportName - Sport name
 * @param {number} eventYear - Event year
 * @param {string} gender - Gender ('Male' or 'Female')
 * @returns {Promise<void>}
 */
export async function recalculatePointsTableForGender(sportName, eventId, gender) {
  // Find sport to verify it exists and is dual type
  const Sport = (await import('../models/Sport.js')).default
  const normalizedEventId = String(eventId).trim().toLowerCase()
  const sportDoc = await Sport.findOne({
    name: sportName,
    event_id: normalizedEventId
  }).lean()

  if (!sportDoc || (sportDoc.type !== 'dual_team' && sportDoc.type !== 'dual_player')) {
    return // Not applicable for this sport type
  }

  const normalizedSportsName = normalizeSportName(sportName)
  const participantType = (sportDoc.type === 'dual_team') ? 'team' : 'player'

  // Get all completed league matches for this sport and year
  const allLeagueMatches = await EventSchedule.find({
    sports_name: normalizedSportsName,
    event_id: normalizedEventId,
    match_type: 'league',
    status: { $in: ['completed', 'draw', 'cancelled'] }
  }).lean()

  // Filter matches by gender
  const leagueMatchesForGender = []
  for (const match of allLeagueMatches) {
    const matchGender = await getMatchGender(match, sportDoc)
    if (matchGender === gender) {
      leagueMatchesForGender.push(match)
    }
  }

  // Get all participants who have played league matches
  const participantsSet = new Set()
  leagueMatchesForGender.forEach(match => {
    const participants = (sportDoc.type === 'dual_team') ? match.teams : match.players
    if (participants && Array.isArray(participants)) {
      participants.forEach(p => {
        const trimmed = (p || '').trim()
        if (trimmed) {
          participantsSet.add(trimmed)
        }
      })
    }
  })

  // Initialize points table entries for all participants (reset to 0)
  const pointsMap = new Map()
  for (const participant of participantsSet) {
    pointsMap.set(participant, {
      participant: participant,
      points: 0,
      matches_played: 0,
      matches_won: 0,
      matches_lost: 0,
      matches_draw: 0,
      matches_cancelled: 0
    })
  }

  // Recalculate points from all matches
  for (const match of leagueMatchesForGender) {
    const participants = (sportDoc.type === 'dual_team') ? match.teams : match.players
    if (!participants || participants.length === 0) {
      continue
    }

    const trimmedWinner = match.winner ? match.winner.trim() : null

    for (const participant of participants) {
      const trimmedParticipant = (participant || '').trim()
      if (!trimmedParticipant) {
        continue
      }

      const entry = pointsMap.get(trimmedParticipant)
      if (!entry) {
        continue
      }

      entry.matches_played += 1

      if (match.status === 'completed' && trimmedWinner) {
        if (trimmedWinner === trimmedParticipant) {
          entry.points += 2
          entry.matches_won += 1
        } else {
          entry.matches_lost += 1
        }
      } else if (match.status === 'draw') {
        entry.points += 1
        entry.matches_draw += 1
      } else if (match.status === 'cancelled') {
        entry.points += 1
        entry.matches_cancelled += 1
      }
    }
  }

  // Update or create points table entries
  for (const [participant, stats] of pointsMap) {
    let pointsEntry = await PointsTable.findOne({
      event_id: sportDoc.event_id,
      sports_name: normalizedSportsName,
      participant: participant
    })

    if (!pointsEntry) {
      pointsEntry = new PointsTable({
        event_id: sportDoc.event_id,
        sports_name: normalizedSportsName,
        participant: participant,
        participant_type: participantType,
        points: 0,
        matches_played: 0,
        matches_won: 0,
        matches_lost: 0,
        matches_draw: 0,
        matches_cancelled: 0
        // Note: createdBy/updatedBy not set here as this is a utility function without user context
      })
    }

    // Update with recalculated values
    pointsEntry.points = stats.points
    pointsEntry.matches_played = stats.matches_played
    pointsEntry.matches_won = stats.matches_won
    pointsEntry.matches_lost = stats.matches_lost
    pointsEntry.matches_draw = stats.matches_draw
    pointsEntry.matches_cancelled = stats.matches_cancelled

    await pointsEntry.save()
  }
}

/**
 * Update points table when league match results change
 * This is used for incremental updates when a single match is updated
 * @param {Object} match - EventSchedule match document (updated match)
 * @param {string} previousStatus - Previous status of the match
 * @param {string} previousWinner - Previous winner of the match (if any)
 * @param {string} userRegNumber - User registration number for updatedBy field (optional)
 * @returns {Promise<void>}
 */
export async function updatePointsTable(match, previousStatus, previousWinner = null, userRegNumber = null) {
  // Only update points table for league matches
  if (match.match_type !== 'league') {
    return
  }

  // Only applicable for dual_team and dual_player sports
  const sportDoc = await (await import('../models/Sport.js')).default.findOne({
    name: match.sports_name,
    event_id: match.event_id
  }).lean()

  if (!sportDoc || (sportDoc.type !== 'dual_team' && sportDoc.type !== 'dual_player')) {
    return
  }

  // Get participants from match (determine from sport type)
  const participants = (sportDoc.type === 'dual_team') ? match.teams : match.players
  if (!participants || participants.length === 0) {
    return
  }

  // Determine participant type from sport type
  const participantType = (sportDoc.type === 'dual_team') ? 'team' : 'player'

  // Normalize sports_name for consistent matching
  const normalizedSportsName = normalizeSportName(match.sports_name)

  // Derive gender from match participants (performance: do once before loop)
  const matchGender = await getMatchGender(match, sportDoc)
  if (!matchGender) {
    // If gender cannot be determined, skip points table update
    return
  }

  // For each participant, update points table
  for (const participant of participants) {
    // Trim participant name for consistent matching
    const trimmedParticipant = (participant || '').trim()
    if (!trimmedParticipant) {
      continue // Skip empty participants
    }

    // Find or create points table entry (gender is not stored, will be derived when querying)
    // Use participant and sport/year as unique key (gender is derived)
    let pointsEntry = await PointsTable.findOne({
      event_id: match.event_id,
      sports_name: normalizedSportsName,
      participant: trimmedParticipant
    })

    if (!pointsEntry) {
      pointsEntry = new PointsTable({
        event_id: match.event_id,
        sports_name: normalizedSportsName,
        participant: trimmedParticipant,
        participant_type: participantType,
        points: 0,
        matches_played: 0,
        matches_won: 0,
        matches_lost: 0,
        matches_draw: 0,
        matches_cancelled: 0,
        createdBy: userRegNumber || null
      })
    } else {
      // Set updatedBy if entry exists
      if (userRegNumber) {
        pointsEntry.updatedBy = userRegNumber
      }
    }

    // Trim previousWinner for consistent comparison
    const trimmedPreviousWinner = previousWinner ? previousWinner.trim() : null

    // Revert previous status points (only if previousStatus was not 'scheduled')
    if (previousStatus === 'completed' && trimmedPreviousWinner) {
      // Previous status was completed with a winner
      if (trimmedPreviousWinner === trimmedParticipant) {
        // Was winner: remove 2 points
        pointsEntry.points = Math.max(0, pointsEntry.points - 2)
        pointsEntry.matches_won = Math.max(0, pointsEntry.matches_won - 1)
      } else {
        // Was loser: remove 0 points (no change needed, but decrement matches_lost)
        pointsEntry.matches_lost = Math.max(0, pointsEntry.matches_lost - 1)
      }
      pointsEntry.matches_played = Math.max(0, pointsEntry.matches_played - 1)
    } else if (previousStatus === 'draw') {
      // Previous status was draw: remove 1 point each
      pointsEntry.points = Math.max(0, pointsEntry.points - 1)
      pointsEntry.matches_draw = Math.max(0, pointsEntry.matches_draw - 1)
      pointsEntry.matches_played = Math.max(0, pointsEntry.matches_played - 1)
    } else if (previousStatus === 'cancelled') {
      // Previous status was cancelled: remove 1 point each
      pointsEntry.points = Math.max(0, pointsEntry.points - 1)
      pointsEntry.matches_cancelled = Math.max(0, pointsEntry.matches_cancelled - 1)
      pointsEntry.matches_played = Math.max(0, pointsEntry.matches_played - 1)
    }
    // If previousStatus is 'scheduled', no points were added, so nothing to revert

    // Trim match.winner for consistent comparison
    const trimmedWinner = match.winner ? match.winner.trim() : null

    // Apply new status points (only if new status is not 'scheduled')
    if (match.status === 'completed' && trimmedWinner) {
      // New status is completed with a winner
      if (trimmedWinner === trimmedParticipant) {
        // Is winner: add 2 points
        pointsEntry.points += 2
        pointsEntry.matches_won += 1
      } else {
        // Is loser: add 0 points
        pointsEntry.matches_lost += 1
      }
      pointsEntry.matches_played += 1
    } else if (match.status === 'draw') {
      // New status is draw: add 1 point each
      pointsEntry.points += 1
      pointsEntry.matches_draw += 1
      pointsEntry.matches_played += 1
    } else if (match.status === 'cancelled') {
      // New status is cancelled: add 1 point each
      pointsEntry.points += 1
      pointsEntry.matches_cancelled += 1
      pointsEntry.matches_played += 1
    }
    // If status is 'scheduled', no points are added

    await pointsEntry.save()
  }
}
