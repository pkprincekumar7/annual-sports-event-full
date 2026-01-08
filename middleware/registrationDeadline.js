/**
 * Registration Deadline Middleware
 * Blocks non-GET requests after registration deadline
 * Fetches registration deadline from database (EventYear model)
 */

import EventYear from '../models/EventYear.js'
import { getCache, setCache } from '../utils/cache.js'
import logger from '../utils/logger.js'

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  const d = new Date(date)
  const day = d.getDate()
  const month = d.toLocaleString('en-US', { month: 'short' })
  const year = d.getFullYear()
  const ordinal = getOrdinal(day)
  return `${ordinal} ${month} ${year}`
}

/**
 * Get ordinal suffix for day
 * @param {number} day - Day number
 * @returns {string} Day with ordinal suffix
 */
function getOrdinal(day) {
  const j = day % 10
  const k = day % 100
  if (j === 1 && k !== 11) return day + 'st'
  if (j === 2 && k !== 12) return day + 'nd'
  if (j === 3 && k !== 13) return day + 'rd'
  return day + 'th'
}

/**
 * Get registration deadline from active event year
 * @returns {Promise<Date|null>} Registration deadline date or null if not found
 */
async function getRegistrationDeadline() {
  try {
    // Check cache first
    const cachedActiveYear = getCache('/api/event-years/active')
    if (cachedActiveYear && cachedActiveYear.registration_dates && cachedActiveYear.registration_dates.end) {
      return new Date(cachedActiveYear.registration_dates.end)
    }

    // Fetch from database
    const activeYear = await EventYear.findOne({ is_active: true }).lean()
    
    if (!activeYear) {
      logger.warn('No active event year found for registration deadline check')
      return null
    }

    if (!activeYear.registration_dates || !activeYear.registration_dates.end) {
      logger.warn('Active event year does not have registration_dates.end set')
      return null
    }

    // Cache the active year
    setCache('/api/event-years/active', activeYear)

    return new Date(activeYear.registration_dates.end)
  } catch (error) {
    logger.error('Error fetching registration deadline from database:', error)
    return null
  }
}

/**
 * Middleware to enforce registration deadline
 * Allows GET requests, login endpoint, and event scheduling after deadline
 * Fetches deadline from database - throws error if not available
 */
export const checkRegistrationDeadline = async (req, res, next) => {
  // Allow GET requests, login endpoint, and event scheduling to pass through without date check
  // Event scheduling has its own date validation (after registration starts, before event ends)
  if (req.method === 'GET' || req.path === '/login' || req.path === '/event-schedule') {
    return next()
  }

  try {
    const deadlineDate = await getRegistrationDeadline()

    // If deadline is not available in database, block the request with error
    if (!deadlineDate) {
      return res.status(500).json({
        success: false,
        error: 'Registration deadline is not configured. Please contact administrator to set up event year with registration dates.',
      })
    }

    const currentDate = new Date() // Uses server's local timezone
    currentDate.setHours(0, 0, 0, 0) // Reset time for date-only comparison
    const deadline = new Date(deadlineDate)
    deadline.setHours(0, 0, 0, 0) // Reset time for date-only comparison

    // If current date is after the registration deadline (date-only comparison)
    if (currentDate > deadline) {
      return res.status(400).json({
        success: false,
        error: `Registration for events closed on ${formatDate(deadlineDate)}.`,
      })
    }

    next()
  } catch (error) {
    logger.error('Error in registration deadline middleware:', error)
    return res.status(500).json({
      success: false,
      error: 'Error checking registration deadline. Please try again.',
    })
  }
}

