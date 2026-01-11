/**
 * Date Restrictions Middleware
 * Enforces date-based restrictions for various API operations
 */

import EventYear from '../models/EventYear.js'
import { sendErrorResponse } from '../utils/errorHandler.js'
import { getEventYear } from '../utils/yearHelpers.js'

/**
 * Check if current date is within registration date range
 * @param {number|null} eventYear - Optional event year (defaults to active year)
 * @returns {Promise<{isWithin: boolean, eventYearDoc: Object|null, message: string}>}
 */
async function checkRegistrationDateRange(eventYear = null) {
  try {
    const eventYearData = await getEventYear(eventYear, { returnDoc: true })
    const eventYearDoc = eventYearData.doc

    if (!eventYearDoc) {
      return {
        isWithin: false,
        eventYearDoc: null,
        message: 'No active event year found. Please contact administrator.'
      }
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const regStart = new Date(eventYearDoc.registration_dates.start)
    regStart.setHours(0, 0, 0, 0)

    const regEnd = new Date(eventYearDoc.registration_dates.end)
    regEnd.setHours(23, 59, 59, 999)

    const isWithin = now >= regStart && now <= regEnd

    return {
      isWithin,
      eventYearDoc,
      message: isWithin
        ? ''
        : `This operation is only allowed during registration period (${formatDate(regStart)} to ${formatDate(regEnd)}).`
    }
  } catch (error) {
    return {
      isWithin: false,
      eventYearDoc: null,
      message: 'Error checking registration date range. Please try again.'
    }
  }
}

/**
 * Check if current date is after registration end and before event end
 * @param {number|null} eventYear - Optional event year (defaults to active year)
 * @returns {Promise<{isWithin: boolean, eventYearDoc: Object|null, message: string}>}
 */
async function checkEventDateRange(eventYear = null) {
  try {
    const eventYearData = await getEventYear(eventYear, { returnDoc: true })
    const eventYearDoc = eventYearData.doc

    if (!eventYearDoc) {
      return {
        isWithin: false,
        eventYearDoc: null,
        message: 'No active event year found. Please contact administrator.'
      }
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const regEnd = new Date(eventYearDoc.registration_dates.end)
    regEnd.setHours(23, 59, 59, 999)

    const eventEnd = new Date(eventYearDoc.event_dates.end)
    eventEnd.setHours(23, 59, 59, 999)

    const isWithin = now > regEnd && now <= eventEnd

    return {
      isWithin,
      eventYearDoc,
      message: isWithin
        ? ''
        : `This operation is only allowed after registration period ends and before event ends (after ${formatDate(regEnd)} and before ${formatDate(eventEnd)}).`
    }
  } catch (error) {
    return {
      isWithin: false,
      eventYearDoc: null,
      message: 'Error checking event date range. Please try again.'
    }
  }
}

/**
 * Check if current date is after registration starts and before event ends
 * This allows event scheduling after registration period begins
 * @param {number|null} eventYear - Optional event year (defaults to active year)
 * @returns {Promise<{isWithin: boolean, eventYearDoc: Object|null, message: string}>}
 */
async function checkEventSchedulingDateRange(eventYear = null) {
  try {
    const eventYearData = await getEventYear(eventYear, { returnDoc: true })
    const eventYearDoc = eventYearData.doc

    if (!eventYearDoc) {
      return {
        isWithin: false,
        eventYearDoc: null,
        message: 'No active event year found. Please contact administrator.'
      }
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const regStart = new Date(eventYearDoc.registration_dates.start)
    regStart.setHours(0, 0, 0, 0)

    const eventEnd = new Date(eventYearDoc.event_dates.end)
    eventEnd.setHours(23, 59, 59, 999)

    const isWithin = now >= regStart && now <= eventEnd

    return {
      isWithin,
      eventYearDoc,
      message: isWithin
        ? ''
        : `Event scheduling is only allowed after registration starts and before event ends (after ${formatDate(regStart)} and before ${formatDate(eventEnd)}).`
    }
  } catch (error) {
    return {
      isWithin: false,
      eventYearDoc: null,
      message: 'Error checking event scheduling date range. Please try again.'
    }
  }
}

/**
 * Check if current date is between event start and event end
 * This allows event status updates during the event period
 * @param {number|null} eventYear - Optional event year (defaults to active year)
 * @returns {Promise<{isWithin: boolean, eventYearDoc: Object|null, message: string}>}
 */
async function checkEventStatusUpdateDateRange(eventYear = null) {
  try {
    const eventYearData = await getEventYear(eventYear, { returnDoc: true })
    const eventYearDoc = eventYearData.doc

    if (!eventYearDoc) {
      return {
        isWithin: false,
        eventYearDoc: null,
        message: 'No active event year found. Please contact administrator.'
      }
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const eventStart = new Date(eventYearDoc.event_dates.start)
    eventStart.setHours(0, 0, 0, 0)

    const eventEnd = new Date(eventYearDoc.event_dates.end)
    eventEnd.setHours(23, 59, 59, 999)

    const isWithin = now >= eventStart && now <= eventEnd

    return {
      isWithin,
      eventYearDoc,
      message: isWithin
        ? ''
        : `Event status updates are only allowed during event period (${formatDate(eventStart)} to ${formatDate(eventEnd)}).`
    }
  } catch (error) {
    return {
      isWithin: false,
      eventYearDoc: null,
      message: 'Error checking event status update date range. Please try again.'
    }
  }
}

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
 * Middleware to restrict operations to registration date range
 * Allows operations only within registration_dates.start and registration_dates.end
 */
export const requireRegistrationPeriod = async (req, res, next) => {
  try {
    // Try to get event_year from query, body, or params
    const eventYear = req.query.event_year || req.body.event_year || req.params.event_year || null
    const parsedYear = eventYear ? parseInt(eventYear) : null

    const check = await checkRegistrationDateRange(parsedYear)

    if (!check.isWithin) {
      return sendErrorResponse(res, 400, check.message)
    }

    // Attach eventYearDoc to request for use in route handlers
    req.eventYearDoc = check.eventYearDoc
    next()
  } catch (error) {
    return sendErrorResponse(res, 500, 'Error checking registration period. Please try again.')
  }
}

/**
 * Middleware to restrict operations to event date range (after registration ends, before event ends)
 * Allows operations only after registration_dates.end and before event_dates.end
 */
export const requireEventPeriod = async (req, res, next) => {
  try {
    // Try to get event_year from query, body, or params
    const eventYear = req.query.event_year || req.body.event_year || req.params.event_year || null
    const parsedYear = eventYear ? parseInt(eventYear) : null

    const check = await checkEventDateRange(parsedYear)

    if (!check.isWithin) {
      return sendErrorResponse(res, 400, check.message)
    }

    // Attach eventYearDoc to request for use in route handlers
    req.eventYearDoc = check.eventYearDoc
    next()
  } catch (error) {
    return sendErrorResponse(res, 500, 'Error checking event period. Please try again.')
  }
}

/**
 * Middleware to allow event scheduling after registration starts and before event ends
 * Allows scheduling operations after registration_dates.start and before event_dates.end
 */
export const requireEventSchedulingPeriod = async (req, res, next) => {
  try {
    // Try to get event_year from query, body, or params
    const eventYear = req.query.event_year || req.body.event_year || req.params.event_year || null
    const parsedYear = eventYear ? parseInt(eventYear) : null

    const check = await checkEventSchedulingDateRange(parsedYear)

    if (!check.isWithin) {
      return sendErrorResponse(res, 400, check.message)
    }

    // Attach eventYearDoc to request for use in route handlers
    req.eventYearDoc = check.eventYearDoc
    next()
  } catch (error) {
    return sendErrorResponse(res, 500, 'Error checking event scheduling period. Please try again.')
  }
}

/**
 * Middleware to allow event status updates during event period
 * Allows status updates between event_dates.start and event_dates.end
 */
export const requireEventStatusUpdatePeriod = async (req, res, next) => {
  try {
    // Try to get event_year from query, body, or params
    const eventYear = req.query.event_year || req.body.event_year || req.params.event_year || null
    const parsedYear = eventYear ? parseInt(eventYear) : null

    const check = await checkEventStatusUpdateDateRange(parsedYear)

    if (!check.isWithin) {
      return sendErrorResponse(res, 400, check.message)
    }

    // Attach eventYearDoc to request for use in route handlers
    req.eventYearDoc = check.eventYearDoc
    next()
  } catch (error) {
    return sendErrorResponse(res, 500, 'Error checking event status update period. Please try again.')
  }
}

/**
 * Helper function to validate match date is within event date range
 * @param {Date|string} matchDate - Match date to validate
 * @param {Object} eventYearDoc - Event year document
 * @returns {boolean} True if match date is within event date range
 */
export function isMatchDateWithinEventRange(matchDate, eventYearDoc) {
  if (!eventYearDoc || !matchDate) return false

  const match = new Date(matchDate)
  match.setHours(0, 0, 0, 0)

  const eventStart = new Date(eventYearDoc.event_dates.start)
  eventStart.setHours(0, 0, 0, 0)

  const eventEnd = new Date(eventYearDoc.event_dates.end)
  eventEnd.setHours(23, 59, 59, 999)

  return match >= eventStart && match <= eventEnd
}

