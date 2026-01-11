/**
 * Coordinator Helper Functions
 * Utility functions for checking coordinator access
 */

import Sport from '../models/Sport.js'
import { normalizeSportName } from './sportHelpers.js'
import { ADMIN_REG_NUMBER } from '../constants/index.js'

/**
 * Check if user is admin or coordinator for a specific sport
 * @param {string} userRegNumber - User registration number
 * @param {string} sportName - Sport name
 * @param {number} eventYear - Event year
 * @param {string} eventName - Event name
 * @returns {Promise<boolean>} True if user is admin or coordinator for this sport
 */
export async function isAdminOrCoordinator(userRegNumber, sportName, eventYear, eventName) {
  // Admin always has access
  if (userRegNumber === ADMIN_REG_NUMBER) {
    return true
  }

  // Check if user is coordinator for this sport
  const sport = await Sport.findOne({
    name: normalizeSportName(sportName),
    event_year: eventYear,
    event_name: eventName,
    eligible_coordinators: userRegNumber
  }).lean()

  return !!sport
}

/**
 * Check if user is admin or coordinator and throw error if not
 * @param {string} userRegNumber - User registration number
 * @param {string} sportName - Sport name
 * @param {number} eventYear - Event year
 * @param {string} eventName - Event name
 * @throws {Error} If user is not admin or coordinator
 */
export async function requireAdminOrCoordinator(userRegNumber, sportName, eventYear, eventName) {
  const hasAccess = await isAdminOrCoordinator(userRegNumber, sportName, eventYear, eventName)
  if (!hasAccess) {
    throw new Error('Admin or coordinator access required for this sport')
  }
}
