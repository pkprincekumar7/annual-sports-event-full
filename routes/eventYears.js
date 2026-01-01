import express from 'express'
import EventYear from '../models/EventYear.js'
import Sport from '../models/Sport.js'
import EventSchedule from '../models/EventSchedule.js'
import PointsTable from '../models/PointsTable.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireRegistrationPeriod } from '../middleware/dateRestrictions.js'
import { getCache, setCache, clearCache } from '../utils/cache.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'

const router = express.Router()

// Debug middleware removed - no longer needed

/**
 * GET /api/event-years
 * Get all event years (admin only)
 */
router.get('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const eventYears = await EventYear.find()
    .sort({ year: -1 })
    .lean()
  
  return sendSuccessResponse(res, { eventYears })
}))

/**
 * GET /api/event-years/active
 * Get currently active year (public)
 */
router.get('/active', asyncHandler(async (req, res) => {
  // Check cache first
  const cached = getCache('/api/event-years/active')
  if (cached) {
    return res.json({ success: true, eventYear: cached })
  }
  
  const activeYear = await EventYear.findOne({ is_active: true }).lean()
  
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
 */
router.post('/', authenticateToken, requireAdmin, requireRegistrationPeriod, asyncHandler(async (req, res) => {
  const { year, event_name, event_dates, registration_dates, event_organizer, event_title, event_highlight } = req.body
  
  if (!year || !event_name || !event_dates || !registration_dates) {
    return sendErrorResponse(res, 400, 'All required fields are required')
  }
  
  // Check if year already exists
  const existingYear = await EventYear.findOne({ year })
  if (existingYear) {
    return sendErrorResponse(res, 409, 'Event year already exists')
  }
  
  const eventYear = new EventYear({
    year,
    event_name: event_name.trim(),
    event_dates,
    registration_dates,
    event_organizer: event_organizer ? event_organizer.trim() : undefined, // Will use default if not provided
    event_title: event_title ? event_title.trim() : undefined, // Will use default if not provided
    event_highlight: event_highlight ? event_highlight.trim() : undefined, // Will use default if not provided
    is_active: false, // New years are inactive by default
    created_by: req.user.reg_number
  })
  
  await eventYear.save()
  
  // Clear cache
  clearCache('/api/event-years/active')
  
  return sendSuccessResponse(res, eventYear, 'Event year created successfully', 201)
}))

/**
 * PUT /api/event-years/:year
 * Update event year configuration (admin only)
 */
router.put('/:year', authenticateToken, requireAdmin, requireRegistrationPeriod, asyncHandler(async (req, res) => {
  const { year } = req.params
  const { event_name, event_dates, registration_dates, event_organizer, event_title, event_highlight } = req.body
  
  const eventYear = await EventYear.findOne({ year: parseInt(year) })
  if (!eventYear) {
    return handleNotFoundError(res, 'Event year')
  }
  
  if (event_name) {
    eventYear.event_name = event_name.trim()
  }
  if (event_dates) {
    eventYear.event_dates = event_dates
  }
  if (registration_dates) {
    eventYear.registration_dates = registration_dates
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
  
  await eventYear.save()
  
  // Clear cache
  clearCache('/api/event-years/active')
  
  return sendSuccessResponse(res, eventYear, 'Event year updated successfully')
}))

/**
 * PUT /api/event-years/:year/activate
 * Set year as active (admin only, deactivates others)
 */
router.put('/:year/activate', authenticateToken, requireAdmin, requireRegistrationPeriod, asyncHandler(async (req, res) => {
  const { year } = req.params
  
  const eventYear = await EventYear.findOne({ year: parseInt(year) })
  if (!eventYear) {
    return handleNotFoundError(res, 'Event year')
  }
  
  // Deactivate all other years
  await EventYear.updateMany(
    { _id: { $ne: eventYear._id } },
    { $set: { is_active: false } }
  )
  
  // Activate this year
  eventYear.is_active = true
  await eventYear.save()
  
  // Clear cache
  clearCache('/api/event-years/active')
  
  return sendSuccessResponse(res, eventYear, 'Event year activated successfully')
}))

/**
 * DELETE /api/event-years/:year
 * Delete event year (admin only, only if no data exists and not active)
 */
router.delete('/:year', authenticateToken, requireAdmin, requireRegistrationPeriod, asyncHandler(async (req, res) => {
  const { year } = req.params
  const eventYear = parseInt(year)
  
  const yearDoc = await EventYear.findOne({ year: eventYear })
  if (!yearDoc) {
    return handleNotFoundError(res, 'Event year')
  }
  
  // Prevent deletion of active event year
  if (yearDoc.is_active) {
    return sendErrorResponse(res, 400, 
      'Cannot delete the active event year. Please activate another event year first before deleting this one.'
    )
  }
  
  // Check if any data exists for this year
  // Note: Sport, EventSchedule, PointsTable models may not exist yet during initial implementation
  // We'll check dynamically
  let sportsCount = 0
  let schedulesCount = 0
  let pointsCount = 0
  
  try {
    const Sport = (await import('../models/Sport.js')).default
    sportsCount = await Sport.countDocuments({ event_year: eventYear })
  } catch (e) {
    // Model doesn't exist yet, skip
  }
  
  try {
    const EventSchedule = (await import('../models/EventSchedule.js')).default
    schedulesCount = await EventSchedule.countDocuments({ event_year: eventYear })
  } catch (e) {
    // Model doesn't exist yet, skip
  }
  
  try {
    const PointsTable = (await import('../models/PointsTable.js')).default
    pointsCount = await PointsTable.countDocuments({ event_year: eventYear })
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

