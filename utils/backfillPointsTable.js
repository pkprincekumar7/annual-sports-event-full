/**
 * Backfill Points Table Utility
 * Recalculates points table from scratch for existing completed league matches
 * Useful when points table entries are incorrect or missing
 */

import EventSchedule from '../models/EventSchedule.js'
import { recalculatePointsTableForGender } from './pointsTable.js'
import { findSportByNameAndYear } from './sportHelpers.js'

/**
 * Backfill points table for a specific sport and year
 * Recalculates points table from scratch for both genders
 * @param {string} sportName - Sport name
 * @param {number} eventYear - Event year
 * @returns {Promise<{processed: number, created: number, errors: number, message: string}>}
 */
export async function backfillPointsTableForSport(sportName, eventYear) {
  try {
    // Find sport to verify it exists and is dual type
    const sportDoc = await findSportByNameAndYear(sportName, eventYear)
    
    if (!sportDoc || (sportDoc.type !== 'dual_team' && sportDoc.type !== 'dual_player')) {
      return {
        processed: 0,
        created: 0,
        errors: 0,
        message: 'Sport not found or not applicable for points table (must be dual_team or dual_player)'
      }
    }

    // Recalculate points table for both genders from scratch
    // This ensures accurate recalculation instead of incremental updates
    let errors = 0
    let created = 0

    try {
      // Recalculate for Male
      await recalculatePointsTableForGender(sportName, eventYear, 'Male')
      created++
    } catch (error) {
      console.error(`Error recalculating points table for Male:`, error)
      errors++
    }

    try {
      // Recalculate for Female
      await recalculatePointsTableForGender(sportName, eventYear, 'Female')
      created++
    } catch (error) {
      console.error(`Error recalculating points table for Female:`, error)
      errors++
    }

    // Count how many matches were processed
    const completedMatches = await EventSchedule.find({
      sports_name: sportName.toLowerCase().trim(),
      event_year: eventYear,
      match_type: 'league',
      status: { $in: ['completed', 'draw', 'cancelled'] }
    }).countDocuments()

    return {
      processed: completedMatches,
      created: created * 2, // Both genders processed
      errors,
      message: `Recalculated points table for ${completedMatches} matches (both genders), ${errors} errors`
    }
  } catch (error) {
    console.error('Error in backfillPointsTableForSport:', error)
    return {
      processed: 0,
      created: 0,
      errors: 1,
      message: `Error: ${error.message}`
    }
  }
}

/**
 * Backfill points table for all sports in a year
 * @param {number} eventYear - Event year
 * @returns {Promise<Object>} Summary of backfill operations
 */
export async function backfillPointsTableForYear(eventYear) {
  try {
    const Sport = (await import('../models/Sport.js')).default
    
    // Get all dual_team and dual_player sports for this year
    const sports = await Sport.find({
      event_year: eventYear,
      type: { $in: ['dual_team', 'dual_player'] }
    }).select('name type').lean()

    const results = {}
    let totalProcessed = 0
    let totalCreated = 0
    let totalErrors = 0

    for (const sport of sports) {
      const result = await backfillPointsTableForSport(sport.name, eventYear)
      results[sport.name] = result
      totalProcessed += result.processed
      totalCreated += result.created
      totalErrors += result.errors
    }

    return {
      sportsProcessed: sports.length,
      totalMatchesProcessed: totalProcessed,
      totalEntriesCreated: totalCreated,
      totalErrors,
      details: results
    }
  } catch (error) {
    console.error('Error in backfillPointsTableForYear:', error)
    return {
      sportsProcessed: 0,
      totalMatchesProcessed: 0,
      totalEntriesCreated: 0,
      totalErrors: 1,
      error: error.message
    }
  }
}
