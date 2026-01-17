/**
 * Registration Deadline Middleware
 * Blocks non-GET requests after registration deadline
 * Fetches registration deadline from database (EventYear model)
 */

import EventYear from '../models/EventYear.js'
import { getCache, setCache } from '../utils/cache.js'
import logger from '../utils/logger.js'
import { findActiveEventYear } from '../utils/yearHelpers.js'

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

    // Fetch from database using automatic detection
    const activeYear = await findActiveEventYear()
    
    if (!activeYear) {
      logger.warn('No active event year found for registration deadline check')
      return null
    }

    if (!activeYear.registration_dates || !activeYear.registration_dates.end) {
      logger.warn('Active event year does not have registration_dates.end set')
      return null
    }

    // Cache the active event year
    setCache('/api/event-years/active', activeYear)

    return new Date(activeYear.registration_dates.end)
  } catch (error) {
    logger.error('Error fetching registration deadline from database:', error)
    return null
  }
}

/**
 * Middleware to enforce registration deadline
 * Allows GET requests, login endpoint, event scheduling/updates, points table operations, and event year management after deadline
 * Fetches deadline from database - throws error if not available
 */
export const checkRegistrationDeadline = async (req, res, next) => {
  // Allow GET requests, login endpoint, password management, event scheduling/updates, points table operations, event year management, and department management to pass through without date check
  // Event scheduling (POST) has its own date validation (requireEventPeriod: after registration end, before event end)
  // Event updates (PUT) have their own date validation (requireEventStatusUpdatePeriod: event start to event end)
  // Points table refresh (POST backfill) has its own date validation (requireEventStatusUpdatePeriod: event start to event end)
  // Event year management (POST/PUT/DELETE) should be allowed even when no active event year exists (chicken-and-egg problem)
  // Department management (POST/PUT/DELETE) is not event-year dependent and should always be allowed
  // Password management (change-password, reset-password) should be allowed anytime as it's not event-year dependent
  if (req.method === 'GET' || req.path === '/login' || req.path === '/change-password' || req.path === '/reset-password' || req.path.startsWith('/event-schedule') || req.path.startsWith('/points-table') || req.path.startsWith('/event-years') || req.path.startsWith('/departments')) {
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

