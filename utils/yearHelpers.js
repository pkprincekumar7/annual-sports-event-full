/**
 * Event Year Helper Functions (Backend)
 * Centralized utilities for event year resolution and validation
 */

import EventYear from '../models/EventYear.js'
import { getCache, setCache, clearCache } from './cache.js'
import { sendErrorResponse } from './errorHandler.js'

/**
 * Get event year with caching and validation
 * @param {number|null} eventYear - Optional event year value (from query/body)
 * @param {Object} options - Options object
 * @param {boolean} options.requireYear - If true, event year must be provided (default: false)
 * @param {boolean} options.returnDoc - If true, returns both event_year and document (default: false)
 * @param {string|null} options.eventName - Optional event name for composite key filtering
 * @returns {Promise<number|Object>} Returns event year number, or { event_year, doc } if returnDoc is true
 * @throws {Error} Throws error if event year validation fails (should be caught by asyncHandler)
 */
export async function getEventYear(eventYear = null, options = {}) {
  const { requireYear = false, returnDoc = false, eventName = null } = options

  // Get active event year first (needed for fallback)
  let activeEventYearDoc = null
  const cachedActiveYear = getCache('/api/event-years/active')
  if (cachedActiveYear && shouldEventYearBeActive(cachedActiveYear)) {
    activeEventYearDoc = cachedActiveYear
  } else {
    if (cachedActiveYear) {
      clearCache('/api/event-years/active')
    }
    activeEventYearDoc = await findActiveEventYear()
    if (activeEventYearDoc) {
      setCache('/api/event-years/active', activeEventYearDoc)
    }
  }

  // If eventYear is provided, validate it exists
  if (eventYear !== null && eventYear !== undefined) {
    const eventYearNum = parseInt(eventYear)
    if (isNaN(eventYearNum)) {
      throw new Error('Event year must be a valid number')
    }

    // Build query with both event_year and event_name
    // If eventName is not provided, use active event's event_name for consistency
    const query = { event_year: eventYearNum }
    const eventNameToUse = eventName ? eventName.trim() : (activeEventYearDoc ? activeEventYearDoc.event_name : null)
    if (eventNameToUse) {
      query.event_name = eventNameToUse
    }

    const eventYearDoc = await EventYear.findOne(query).lean()
    if (!eventYearDoc) {
      throw new Error('Event year not found')
    }

    return returnDoc ? { event_year: eventYearNum, doc: eventYearDoc } : eventYearNum
  }

  // If eventYear is required but not provided
  if (requireYear) {
    throw new Error('Event year is required')
  }

  // Use active event year (with both event_year and event_name)
  if (!activeEventYearDoc) {
    throw new Error('No active event year found')
  }

  return returnDoc ? { event_year: activeEventYearDoc.event_year, doc: activeEventYearDoc } : activeEventYearDoc.event_year
}

/**
 * Validate that an event year exists
 * @param {number} eventYear - Event year to validate
 * @returns {Promise<boolean>} True if event year exists
 */
export async function validateEventYearExists(eventYear) {
  if (!eventYear) return false
  const eventYearNum = parseInt(eventYear)
  if (isNaN(eventYearNum)) return false
  
  const eventYearDoc = await EventYear.findOne({ event_year: eventYearNum }).lean()
  return !!eventYearDoc
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
 * If multiple events are in their active period, returns the one with the most recent event_year
 * @returns {Promise<Object|null>} Active event year document or null
 */
export async function findActiveEventYear() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // Get all event years
  const allEventYears = await EventYear.find().sort({ event_year: -1 }).lean()

  // Find event years that should be active
  const activeCandidates = allEventYears.filter(eventYearDoc => shouldEventYearBeActive(eventYearDoc))

  if (activeCandidates.length === 0) {
    return null
  }

  // If multiple candidates, return the one with the most recent event_year (already sorted)
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
