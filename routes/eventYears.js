import express from 'express'
import EventYear from '../models/EventYear.js'
import Sport from '../models/Sport.js'
import EventSchedule from '../models/EventSchedule.js'
import PointsTable from '../models/PointsTable.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { getCache, setCache, clearCache } from '../utils/cache.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { findActiveEventYear, shouldEventYearBeActive, validateDateRelationships, getUpdatableDateFields } from '../utils/yearHelpers.js'

const router = express.Router()

// Helper function to format date for display
function formatDate(date) {
  const d = new Date(date)
  const day = d.getDate()
  const month = d.toLocaleString('en-US', { month: 'short' })
  const year = d.getFullYear()
  const ordinal = getOrdinal(day)
  return `${ordinal} ${month} ${year}`
}

// Helper function to get ordinal suffix for day
function getOrdinal(day) {
  const j = day % 10
  const k = day % 100
  if (j === 1 && k !== 11) return day + 'st'
  if (j === 2 && k !== 12) return day + 'nd'
  if (j === 3 && k !== 13) return day + 'rd'
  return day + 'th'
}

// Debug middleware removed - no longer needed

/**
 * GET /api/event-years
 * Get all event years (admin only)
 * Includes computed is_active status based on dates
 */
router.get('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const eventYears = await EventYear.find()
    .sort({ event_year: -1 })
    .lean()
  
  // Add computed is_active status based on dates
  const eventYearsWithActiveStatus = eventYears.map(eventYear => ({
    ...eventYear,
    is_active: shouldEventYearBeActive(eventYear)
  }))
  
  return sendSuccessResponse(res, { eventYears: eventYearsWithActiveStatus })
}))

/**
 * GET /api/event-years/active
 * Get currently active event year (public)
 * Automatically determines active event year based on registration start and event end dates
 */
router.get('/active', asyncHandler(async (req, res) => {
  // Check cache first
  const cached = getCache('/api/event-years/active')
  if (cached) {
    // Verify cached event year is still active
    if (shouldEventYearBeActive(cached)) {
      return res.json({ success: true, eventYear: cached })
    } else {
      // Cache expired, clear it
      clearCache('/api/event-years/active')
    }
  }
  
  // Automatically find active event year based on dates
  const activeYear = await findActiveEventYear()
  
  if (!activeYear) {
    // Return success with null eventYear instead of 404 to allow frontend to handle gracefully
    return res.json({ success: true, eventYear: null, error: 'No active event year found' })
  }
  
  // Cache the result
  setCache('/api/event-years/active', activeYear)
  
  res.json({ success: true, eventYear: activeYear })
}))

/**
 * POST /api/event-years
 * Create new event year (admin only)
 * Validates date relationships: regStart < regEnd < eventStart < eventEnd
 * Validates that registration start date is not in the past
 * Note: requireRegistrationPeriod is not applied here to allow creation of first event year
 */
router.post('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { createdBy, updatedBy, ...bodyData } = req.body
  
  // Explicitly reject if user tries to send createdBy or updatedBy
  if (createdBy !== undefined || updatedBy !== undefined) {
    return sendErrorResponse(res, 400, 'createdBy and updatedBy fields cannot be set by user. They are automatically set from authentication token.')
  }
  
  const { event_year, event_name, event_dates, registration_dates, event_organizer, event_title, event_highlight } = bodyData
  
  if (!event_year || !event_name || !event_dates || !registration_dates) {
    return sendErrorResponse(res, 400, 'All required fields are required (event_year, event_name, event_dates, registration_dates)')
  }
  
  // Validate date relationships: regStart < regEnd < eventStart < eventEnd
  const dateValidation = validateDateRelationships(registration_dates, event_dates)
  if (!dateValidation.isValid) {
    return sendErrorResponse(res, 400, dateValidation.error)
  }
  
  // Validate registration start date is not in the past
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const regStart = new Date(registration_dates.start)
  regStart.setHours(0, 0, 0, 0)
  
  if (regStart < now) {
    return sendErrorResponse(res, 400, 'Registration start date cannot be in the past. Event creation is only allowed for current or future dates.')
  }
  
  // Validate event start date is not in the past
  const eventStart = new Date(event_dates.start)
  eventStart.setHours(0, 0, 0, 0)
  
  if (eventStart < now) {
    return sendErrorResponse(res, 400, 'Event start date cannot be in the past. Event creation is only allowed for current or future dates.')
  }
  
  // Validate event_year is a number
  const eventYearNum = parseInt(event_year)
  if (isNaN(eventYearNum)) {
    return sendErrorResponse(res, 400, 'event_year must be a valid number')
  }
  
  // Check if event year already exists
  const existingYear = await EventYear.findOne({ event_year: eventYearNum })
  if (existingYear) {
    return sendErrorResponse(res, 409, 'Event year already exists')
  }
  
  const eventYear = new EventYear({
    event_year: eventYearNum,
    event_name: event_name.trim(),
    event_dates,
    registration_dates,
    event_organizer: event_organizer ? event_organizer.trim() : undefined, // Will use default if not provided
    event_title: event_title ? event_title.trim() : undefined, // Will use default if not provided
    event_highlight: event_highlight ? event_highlight.trim() : undefined, // Will use default if not provided
    createdBy: req.user.reg_number
  })
  
  await eventYear.save()
  
  // Clear cache
  clearCache('/api/event-years/active')
  
  return sendSuccessResponse(res, eventYear, 'Event year created successfully', 201)
}))

/**
 * PUT /api/event-years/:event_year
 * Update event year configuration (admin only)
 * Validates date relationships and enforces update restrictions based on current date
 * Allows updates until registration end date (current date <= registration end date)
 */
router.put('/:event_year', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { event_year } = req.params
  const { createdBy, updatedBy, ...bodyData } = req.body
  
  // Explicitly reject if user tries to send createdBy or updatedBy
  if (createdBy !== undefined || updatedBy !== undefined) {
    return sendErrorResponse(res, 400, 'createdBy and updatedBy fields cannot be set by user. They are automatically set from authentication token.')
  }
  
  const { event_name, event_dates, registration_dates, event_organizer, event_title, event_highlight } = bodyData
  
  const eventYear = await EventYear.findOne({ event_year: parseInt(event_year) })
  if (!eventYear) {
    return handleNotFoundError(res, 'Event year')
  }

  // Check if update is allowed: must be before or on registration end date
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const regEnd = new Date(eventYear.registration_dates.end)
  regEnd.setHours(23, 59, 59, 999)
  
  if (now > regEnd) {
    return sendErrorResponse(res, 400, 
      `Cannot update event year. Updates are only allowed until registration end date (${formatDate(eventYear.registration_dates.end)}).`
    )
  }
  
  // Check if event has ended
  const eventEnd = new Date(eventYear.event_dates.end)
  eventEnd.setHours(23, 59, 59, 999)
  const eventHasEnded = now > eventEnd
  
  // Update non-date fields (not allowed after event ends)
  if (eventHasEnded && (event_name || event_organizer !== undefined || event_title !== undefined || event_highlight !== undefined)) {
    return sendErrorResponse(res, 400, 'Cannot update event configuration. The event has already ended.')
  }
  
  if (event_name) {
    eventYear.event_name = event_name.trim()
  }
  if (event_organizer !== undefined) {
    eventYear.event_organizer = event_organizer ? event_organizer.trim() : 'Events Community'
  }
  if (event_title !== undefined) {
    eventYear.event_title = event_title ? event_title.trim() : 'Community Entertainment'
  }
  if (event_highlight !== undefined) {
    eventYear.event_highlight = event_highlight ? event_highlight.trim() : 'Community Entertainment Fest'
  }
  
  // Handle date updates with restrictions
  const updatableFields = getUpdatableDateFields(eventYear)
  const finalRegDates = registration_dates ? { ...eventYear.registration_dates, ...registration_dates } : eventYear.registration_dates
  const finalEventDates = event_dates ? { ...eventYear.event_dates, ...event_dates } : eventYear.event_dates
  
  // Check if any restricted date fields are being updated
  if (registration_dates) {
    if (registration_dates.start !== undefined && !updatableFields.canUpdateRegStart) {
      return sendErrorResponse(res, 400, 'Cannot update registration start date. Registration has already started.')
    }
    if (registration_dates.end !== undefined && !updatableFields.canUpdateRegEnd) {
      return sendErrorResponse(res, 400, 'Cannot update registration end date. Registration has already ended.')
    }
  }
  
  if (event_dates) {
    if (event_dates.start !== undefined && !updatableFields.canUpdateEventStart) {
      return sendErrorResponse(res, 400, 'Cannot update event start date. Event has already started.')
    }
    if (event_dates.end !== undefined && !updatableFields.canUpdateEventEnd) {
      return sendErrorResponse(res, 400, 'Cannot update event end date. Event has already ended.')
    }
  }
  
  // If dates are being updated, validate the relationships
  if (registration_dates || event_dates) {
    const dateValidation = validateDateRelationships(finalRegDates, finalEventDates)
    if (!dateValidation.isValid) {
      return sendErrorResponse(res, 400, dateValidation.error)
    }
    
    // Apply date updates
    if (registration_dates) {
      eventYear.registration_dates = finalRegDates
    }
    if (event_dates) {
      eventYear.event_dates = finalEventDates
    }
  }
  
  // Set updatedBy from token
  eventYear.updatedBy = req.user.reg_number
  
  await eventYear.save()
  
  // Clear cache
  clearCache('/api/event-years/active')
  
  return sendSuccessResponse(res, eventYear, 'Event year updated successfully')
}))


/**
 * DELETE /api/event-years/:event_year
 * Delete event year (admin only, only if no data exists and not active)
 * Allows deletion only before registration start date
 */
router.delete('/:event_year', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { event_year } = req.params
  const eventYear = parseInt(event_year)
  
  const yearDoc = await EventYear.findOne({ event_year: eventYear })
  if (!yearDoc) {
    return handleNotFoundError(res, 'Event year')
  }

  // Check if deletion is allowed: must be before registration start date
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const regStart = new Date(yearDoc.registration_dates.start)
  regStart.setHours(0, 0, 0, 0)
  
  if (now >= regStart) {
    return sendErrorResponse(res, 400, 
      `Cannot delete event year. Deletion is only allowed before registration start date (${formatDate(yearDoc.registration_dates.start)}).`
    )
  }
  
  // Prevent deletion of active event year (based on dates) - additional safety check
  if (shouldEventYearBeActive(yearDoc)) {
    return sendErrorResponse(res, 400, 
      'Cannot delete the active event year. The event is currently active based on its registration and event dates.'
    )
  }
  
  // Check if any data exists for this event year and event name
  // Note: Sport, EventSchedule, PointsTable models may not exist yet during initial implementation
  // We'll check dynamically
  const eventName = yearDoc.event_name
  let sportsCount = 0
  let schedulesCount = 0
  let pointsCount = 0
  
  try {
    const Sport = (await import('../models/Sport.js')).default
    sportsCount = await Sport.countDocuments({ event_year: eventYear, event_name: eventName })
  } catch (e) {
    // Model doesn't exist yet, skip
  }
  
  try {
    const EventSchedule = (await import('../models/EventSchedule.js')).default
    schedulesCount = await EventSchedule.countDocuments({ event_year: eventYear, event_name: eventName })
  } catch (e) {
    // Model doesn't exist yet, skip
  }
  
  try {
    const PointsTable = (await import('../models/PointsTable.js')).default
    pointsCount = await PointsTable.countDocuments({ event_year: eventYear, event_name: eventName })
  } catch (e) {
    // Model doesn't exist yet, skip
  }
  
  if (sportsCount > 0 || schedulesCount > 0 || pointsCount > 0) {
    return sendErrorResponse(res, 400, 
      `Cannot delete event year. Data exists: ${sportsCount} sports, ${schedulesCount} schedules, ${pointsCount} points entries.`
    )
  }
  
  await EventYear.findByIdAndDelete(yearDoc._id)
  
  // Clear cache
  clearCache('/api/event-years/active')
  
  return sendSuccessResponse(res, {}, 'Event year deleted successfully')
}))

export default router

