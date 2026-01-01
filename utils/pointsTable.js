/**
 * Points Table Helper Functions
 * Utility functions for points table operations
 */

import PointsTable from '../models/PointsTable.js'

/**
 * Update points table when league match results change
 * @param {Object} match - EventSchedule match document (updated match)
 * @param {string} previousStatus - Previous status of the match
 * @param {string} previousWinner - Previous winner of the match (if any)
 * @returns {Promise<void>}
 */
export async function updatePointsTable(match, previousStatus, previousWinner = null) {
  // Only update points table for league matches
  if (match.match_type !== 'league') {
    return
  }

  // Only applicable for dual_team and dual_player sports
  const sportDoc = await (await import('../models/Sport.js')).default.findOne({
    name: match.sports_name,
    event_year: match.event_year
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

  // For each participant, update points table
  for (const participant of participants) {
    // Find or create points table entry
    let pointsEntry = await PointsTable.findOne({
      event_year: match.event_year,
      sports_name: match.sports_name,
      participant: participant
    })

    if (!pointsEntry) {
      pointsEntry = new PointsTable({
        event_year: match.event_year,
        sports_name: match.sports_name,
        participant: participant,
        participant_type: participantType,
        points: 0,
        matches_played: 0,
        matches_won: 0,
        matches_lost: 0,
        matches_draw: 0,
        matches_cancelled: 0
      })
    }

    // Revert previous status points (only if previousStatus was not 'scheduled')
    if (previousStatus === 'completed' && previousWinner) {
      // Previous status was completed with a winner
      if (previousWinner === participant) {
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

    // Apply new status points (only if new status is not 'scheduled')
    if (match.status === 'completed' && match.winner) {
      // New status is completed with a winner
      if (match.winner === participant) {
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

