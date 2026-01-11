/**
 * Batch Helper Functions
 * Utilities for batch-related operations
 */

import Batch from '../models/Batch.js'

/**
 * Get batch name for a player for a specific event year and event name
 * @param {string} regNumber - Player registration number
 * @param {number} eventYear - Event year
 * @param {string} eventName - Event name
 * @returns {Promise<string|null>} Batch name or null if player is not in any batch
 */
export async function getPlayerBatchName(regNumber, eventYear, eventName) {
  if (!regNumber || !eventYear || !eventName) {
    return null
  }

  try {
    const batch = await Batch.findOne({
      event_year: eventYear,
      event_name: eventName,
      players: regNumber
    }).lean()

    return batch ? batch.name : null
  } catch (error) {
    return null
  }
}

/**
 * Get batch names for multiple players for a specific event year and event name
 * @param {Array<string>} regNumbers - Array of player registration numbers
 * @param {number} eventYear - Event year
 * @param {string} eventName - Event name
 * @returns {Promise<Object>} Map of reg_number -> batch_name (or null)
 */
export async function getPlayersBatchNames(regNumbers, eventYear, eventName) {
  if (!regNumbers || regNumbers.length === 0 || !eventYear || !eventName) {
    return {}
  }

  try {
    const batches = await Batch.find({
      event_year: eventYear,
      event_name: eventName,
      players: { $in: regNumbers }
    }).lean()

    // Create a map of reg_number -> batch_name
    const batchMap = {}
    for (const batch of batches) {
      for (const regNumber of batch.players) {
        if (regNumbers.includes(regNumber)) {
          batchMap[regNumber] = batch.name
        }
      }
    }

    return batchMap
  } catch (error) {
    return {}
  }
}

/**
 * Get all players in a batch for a specific event year and event name
 * @param {string} batchName - Batch name
 * @param {number} eventYear - Event year
 * @param {string} eventName - Event name
 * @returns {Promise<Array<string>>} Array of player registration numbers
 */
export async function getBatchPlayers(batchName, eventYear, eventName) {
  if (!batchName || !eventYear || !eventName) {
    return []
  }

  try {
    const batch = await Batch.findOne({
      name: batchName,
      event_year: eventYear,
      event_name: eventName
    }).lean()

    return batch ? (batch.players || []) : []
  } catch (error) {
    return []
  }
}
