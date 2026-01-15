/**
 * Event Year Helper Functions (Backend)
 * Centralized utilities for event year resolution and validation
 */

import EventYear from '../models/EventYear.js'
import { getCache, setCache, clearCache } from './cache.js'
import { sendErrorResponse } from './errorHandler.js'

/**
 * Get event year with caching and validation
 * @param {string|null} eventId - Optional event_id value (from query/body)
 * @param {Object} options - Options object
 * @param {boolean} options.requireId - If true, event_id must be provided (default: false)
 * @param {boolean} options.returnDoc - If true, returns both event_id and document (default: false)
 * @returns {Promise<string|Object>} Returns event_id, or { event_id, doc } if returnDoc is true
 * @throws {Error} Throws error if event year validation fails (should be caught by asyncHandler)
 */
export async function getEventYear(eventId = null, options = {}) {
  const { requireId = false, returnDoc = false } = options

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

  // If eventId is provided, validate it exists
  if (eventId !== null && eventId !== undefined && eventId !== '') {
    const normalizedEventId = String(eventId).trim().toLowerCase()
    if (!normalizedEventId) {
      throw new Error('Event ID must be a valid string')
    }

    const eventYearDoc = await EventYear.findOne({ event_id: normalizedEventId }).lean()
    if (!eventYearDoc) {
      throw new Error('Event year not found')
    }

    return returnDoc ? { event_id: eventYearDoc.event_id, doc: eventYearDoc } : eventYearDoc.event_id
  }

  // If eventId is required but not provided
  if (requireId) {
    throw new Error('Event ID is required')
  }

  // Use active event (with event_id)
  if (!activeEventYearDoc) {
    throw new Error('No active event year found')
  }

  return returnDoc ? { event_id: activeEventYearDoc.event_id, doc: activeEventYearDoc } : activeEventYearDoc.event_id
}

/**
 * Validate that an event year exists
 * @param {string} eventId - Event ID to validate
 * @returns {Promise<boolean>} True if event year exists
 */
export async function validateEventYearExists(eventId) {
  if (!eventId) return false
  const normalizedEventId = String(eventId).trim().toLowerCase()
  if (!normalizedEventId) return false
  
  const eventYearDoc = await EventYear.findOne({ event_id: normalizedEventId }).lean()
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
