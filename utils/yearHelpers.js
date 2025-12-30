/**
 * Year Helper Functions (Backend)
 * Centralized utilities for event year resolution and validation
 */

import EventYear from '../models/EventYear.js'
import { getCache, setCache } from './cache.js'
import { sendErrorResponse } from './errorHandler.js'

/**
 * Get event year with caching and validation
 * @param {number|null} year - Optional year value (from query/body)
 * @param {Object} options - Options object
 * @param {boolean} options.requireYear - If true, year must be provided (default: false)
 * @param {boolean} options.returnDoc - If true, returns both year and document (default: false)
 * @returns {Promise<number|Object>} Returns year number, or { year, doc } if returnDoc is true
 * @throws {Error} Throws error if year validation fails (should be caught by asyncHandler)
 */
export async function getEventYear(year = null, options = {}) {
  const { requireYear = false, returnDoc = false } = options

  // If year is provided, validate it exists
  if (year !== null && year !== undefined) {
    const yearNum = parseInt(year)
    if (isNaN(yearNum)) {
      throw new Error('Event year must be a valid number')
    }

    const yearDoc = await EventYear.findOne({ year: yearNum }).lean()
    if (!yearDoc) {
      throw new Error('Event year not found')
    }

    return returnDoc ? { year: yearNum, doc: yearDoc } : yearNum
  }

  // If year is required but not provided
  if (requireYear) {
    throw new Error('Event year is required')
  }

  // Get active year (with caching)
  const cachedActiveYear = getCache('/api/event-years/active')
  if (cachedActiveYear) {
    return returnDoc ? { year: cachedActiveYear.year, doc: cachedActiveYear } : cachedActiveYear.year
  }

  const activeYear = await EventYear.findOne({ is_active: true }).lean()
  if (!activeYear) {
    throw new Error('No active event year found')
  }

  // Cache the active year
  setCache('/api/event-years/active', activeYear)

  return returnDoc ? { year: activeYear.year, doc: activeYear } : activeYear.year
}

/**
 * Validate that an event year exists
 * @param {number} year - Year to validate
 * @returns {Promise<boolean>} True if year exists
 */
export async function validateEventYearExists(year) {
  if (!year) return false
  const yearNum = parseInt(year)
  if (isNaN(yearNum)) return false
  
  const yearDoc = await EventYear.findOne({ year: yearNum }).lean()
  return !!yearDoc
}

