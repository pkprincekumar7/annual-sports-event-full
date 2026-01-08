/**
 * Year Helper Functions (Backend)
 * Centralized utilities for event year resolution and validation
 */

import EventYear from '../models/EventYear.js'
import { getCache, setCache, clearCache } from './cache.js'
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
    // Verify cached year is still active
    if (shouldEventYearBeActive(cachedActiveYear)) {
      return returnDoc ? { year: cachedActiveYear.year, doc: cachedActiveYear } : cachedActiveYear.year
    } else {
      // Cache expired, clear it
      clearCache('/api/event-years/active')
    }
  }

  // Use automatic detection instead of is_active field
  const activeYear = await findActiveEventYear()
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

/**
 * Check if an event year should be active based on current date
 * Event is active if: current date >= registration_dates.start AND current date <= event_dates.end
 * @param {Object} eventYearDoc - Event year document
 * @returns {boolean} True if event should be active
 */
export function shouldEventYearBeActive(eventYearDoc) {
  if (!eventYearDoc || !eventYearDoc.registration_dates || !eventYearDoc.event_dates) {
    return false
  }

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const regStart = new Date(eventYearDoc.registration_dates.start)
  regStart.setHours(0, 0, 0, 0)

  const eventEnd = new Date(eventYearDoc.event_dates.end)
  eventEnd.setHours(23, 59, 59, 999)

  return now >= regStart && now <= eventEnd
}

/**
 * Find the active event year automatically based on dates
 * If multiple events are in their active period, returns the one with the most recent year
 * @returns {Promise<Object|null>} Active event year document or null
 */
export async function findActiveEventYear() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // Get all event years
  const allEventYears = await EventYear.find().sort({ year: -1 }).lean()

  // Find event years that should be active
  const activeCandidates = allEventYears.filter(yearDoc => shouldEventYearBeActive(yearDoc))

  if (activeCandidates.length === 0) {
    return null
  }

  // If multiple candidates, return the one with the most recent year (already sorted)
  return activeCandidates[0]
}

/**
 * Validate date relationships for event year
 * Must satisfy: registration_dates.start < registration_dates.end < event_dates.start < event_dates.end
 * @param {Object} registration_dates - Registration dates object with start and end
 * @param {Object} event_dates - Event dates object with start and end
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export function validateDateRelationships(registration_dates, event_dates) {
  if (!registration_dates || !event_dates) {
    return { isValid: false, error: 'Registration dates and event dates are required' }
  }

  const regStart = new Date(registration_dates.start)
  regStart.setHours(0, 0, 0, 0)

  const regEnd = new Date(registration_dates.end)
  regEnd.setHours(23, 59, 59, 999)

  const eventStart = new Date(event_dates.start)
  eventStart.setHours(0, 0, 0, 0)

  const eventEnd = new Date(event_dates.end)
  eventEnd.setHours(23, 59, 59, 999)

  if (regStart >= regEnd) {
    return { isValid: false, error: 'Registration start date must be before registration end date' }
  }

  if (regEnd >= eventStart) {
    return { isValid: false, error: 'Registration end date must be before event start date' }
  }

  if (eventStart >= eventEnd) {
    return { isValid: false, error: 'Event start date must be before event end date' }
  }

  return { isValid: true, error: null }
}

/**
 * Determine which date fields can be updated based on current date and existing event year dates
 * @param {Object} existingEventYear - Existing event year document
 * @returns {Object} Object indicating which dates can be updated
 */
export function getUpdatableDateFields(existingEventYear) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const regStart = new Date(existingEventYear.registration_dates.start)
  regStart.setHours(0, 0, 0, 0)

  const regEnd = new Date(existingEventYear.registration_dates.end)
  regEnd.setHours(23, 59, 59, 999)

  const eventStart = new Date(existingEventYear.event_dates.start)
  eventStart.setHours(0, 0, 0, 0)

  const eventEnd = new Date(existingEventYear.event_dates.end)
  eventEnd.setHours(23, 59, 59, 999)

  // After event ends: nothing can be updated
  if (now > eventEnd) {
    return {
      canUpdateRegStart: false,
      canUpdateRegEnd: false,
      canUpdateEventStart: false,
      canUpdateEventEnd: false
    }
  }

  // After event starts: only event end can be updated
  if (now >= eventStart) {
    return {
      canUpdateRegStart: false,
      canUpdateRegEnd: false,
      canUpdateEventStart: false,
      canUpdateEventEnd: true
    }
  }

  // After registration ends: only event dates can be updated
  if (now >= regEnd) {
    return {
      canUpdateRegStart: false,
      canUpdateRegEnd: false,
      canUpdateEventStart: true,
      canUpdateEventEnd: true
    }
  }

  // After registration starts: reg end and event dates can be updated
  if (now >= regStart) {
    return {
      canUpdateRegStart: false,
      canUpdateRegEnd: true,
      canUpdateEventStart: true,
      canUpdateEventEnd: true
    }
  }

  // Before registration starts: all dates can be updated
  return {
    canUpdateRegStart: true,
    canUpdateRegEnd: true,
    canUpdateEventStart: true,
    canUpdateEventEnd: true
  }
}
