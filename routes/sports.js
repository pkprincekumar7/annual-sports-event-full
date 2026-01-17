/**
 * Sports Routes
 * Handles sports-related operations with dynamic Sports collection
 */

import express from 'express'
import Sport from '../models/Sport.js'
import EventSchedule from '../models/EventSchedule.js'
import PointsTable from '../models/PointsTable.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireRegistrationPeriod } from '../middleware/dateRestrictions.js'
import { getCache, setCache, clearCache, clearCachePattern } from '../utils/cache.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse } from '../utils/errorHandler.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { isTeamSportType, validateTeamSize, normalizeSportName, findSportByNameAndId } from '../utils/sportHelpers.js'

const router = express.Router()

/**
 * GET /api/sports
 * Get all sports (admin only, or public for display)
 * Accepts ?event_id=2026-umang parameter (defaults to active event)
 * Filters by event_id
 * IMPORTANT: This route must come before /:name to avoid conflicts
 */
router.get('/sports', asyncHandler(async (req, res) => {
  const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
  
  let eventYearData
  
  try {
    // Try to get event year with document - if it doesn't exist, return empty array
    eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
  } catch (error) {
    // If event year not found, return empty array instead of error
    if (error.message === 'Event year not found' || error.message === 'No active event year found') {
      return res.json([])
    }
    // Re-throw other errors to be handled by asyncHandler
    throw error
  }
  
  const eventId = eventYearData.doc.event_id
  
  // Check cache
  const cacheKey = `/api/sports?event_id=${encodeURIComponent(eventId)}`
  const cached = getCache(cacheKey)
  if (cached) {
    return res.json(cached)
  }
  
  // Query database - filter by event_id
  const sports = await Sport.find({ event_id: eventId })
    .sort({ category: 1, name: 1 })
    .lean()
  
  // Cache the result
  setCache(cacheKey, sports)
  
  res.json(sports)
}))

/**
 * POST /api/sports
 * Create new sport (admin only)
 * event_id is REQUIRED in request body
 * Validates event_id exists in EventYear collection
 * Admin sets type, category, team_size
 * Validates team_size only for team sports
 */
router.post('/sports', authenticateToken, requireAdmin, requireRegistrationPeriod, asyncHandler(async (req, res) => {
    const { createdBy, updatedBy, ...bodyData } = req.body
    
    // Explicitly reject if user tries to send createdBy or updatedBy
    if (createdBy !== undefined || updatedBy !== undefined) {
      return sendErrorResponse(res, 400, 'createdBy and updatedBy fields cannot be set by user. They are automatically set from authentication token.')
    }
    
    const { name, event_id, type, category, team_size, imageUri } = bodyData
    
    if (!name || !name.trim()) {
    return sendErrorResponse(res, 400, 'Sport name is required')
    }
    
    if (!type || !['dual_team', 'multi_team', 'dual_player', 'multi_player'].includes(type)) {
    return sendErrorResponse(res, 400, 'Valid sport type is required')
    }
    
    if (!category || !['team events', 'individual events', 'literary and cultural activities'].includes(category)) {
    return sendErrorResponse(res, 400, 'Valid category is required')
    }
    
  if (!event_id || !String(event_id).trim()) {
    return sendErrorResponse(res, 400, 'event_id is required')
  }
  
  const eventYearData = await getEventYear(String(event_id).trim(), { requireId: true, returnDoc: true })
  const eventId = eventYearData.doc.event_id
    
    // Validate team_size
  const teamSizeValidation = validateTeamSize(team_size, type)
  if (!teamSizeValidation.isValid) {
    return sendErrorResponse(res, 400, teamSizeValidation.error)
      }
  const parsedTeamSize = teamSizeValidation.value
    
    // Check if sport with same name already exists for this event_id
    const existingSport = await Sport.findOne({ 
    name: normalizeSportName(name), 
      event_id: eventId
    })
    if (existingSport) {
    return sendErrorResponse(res, 409, 'Sport with this name already exists for this event year')
    }
    
    const sport = new Sport({
    name: normalizeSportName(name),
      event_id: eventId,
      type,
      category,
    team_size: isTeamSportType(type) ? parsedTeamSize : null,
      imageUri: imageUri?.trim() || null,
      createdBy: req.user.reg_number
    })
    
    await sport.save()
    
    // Clear sports cache
  clearCachePattern('/api/sports')
  clearCachePattern('/api/sports-counts')
    
  return sendSuccessResponse(res, sport, 'Sport created successfully', 201)
}))

/**
 * PUT /api/sports/:id
 * Update sport (admin only)
 * Accepts ?event_id=2026-umang parameter (defaults to active event if not provided)
 * Validates sport belongs to that event
 * Update within same event (cannot change event_id)
 * Validates team_size if updated
 */
router.put('/sports/:id', authenticateToken, requireAdmin, requireRegistrationPeriod, asyncHandler(async (req, res) => {
    const { id } = req.params
  const { createdBy, updatedBy, ...bodyData } = req.body
  
  // Explicitly reject if user tries to send createdBy or updatedBy
  if (createdBy !== undefined || updatedBy !== undefined) {
    return sendErrorResponse(res, 400, 'createdBy and updatedBy fields cannot be set by user. They are automatically set from authentication token.')
  }
  
  const { type, category, team_size, imageUri } = bodyData
    
    const sport = await Sport.findById(id)
    if (!sport) {
    return sendErrorResponse(res, 404, 'Sport not found')
    }
    
    // Get event_id parameter (defaults to active event if not provided)
    const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
    
    let requestedYearData
    try {
      requestedYearData = await getEventYear(eventIdQuery, { returnDoc: true })
    } catch (error) {
      // Provide more user-friendly error messages
      if (error.message === 'Event year not found') {
        return sendErrorResponse(res, 400, `Event year not found. Please ensure the event year parameter is valid.`)
      } else if (error.message === 'No active event year found') {
        return sendErrorResponse(res, 400, `No active event year found. Please configure an active event year first.`)
      }
      return sendErrorResponse(res, 400, error.message || 'Failed to get event year')
    }
    
    const requestedEventId = requestedYearData.doc.event_id
    
    // Validate sport belongs to the requested event
    if (sport.event_id !== requestedEventId) {
      return sendErrorResponse(res, 400, `Cannot update sport. This sport belongs to event ID ${sport.event_id}, but you are trying to update it for event ID ${requestedEventId}. Please select the correct event to update this sport.`)
    }
    
    // Cannot change event_id
    if (req.body.event_id !== undefined && req.body.event_id !== sport.event_id) {
    return sendErrorResponse(res, 400, 'Cannot change event_id. Create a new sport for a different event.')
    }
    
    // Update allowed fields
    if (type) {
      if (!['dual_team', 'multi_team', 'dual_player', 'multi_player'].includes(type)) {
      return sendErrorResponse(res, 400, 'Invalid sport type')
      }
      sport.type = type
    }
    
    if (category) {
      if (!['team events', 'individual events', 'literary and cultural activities'].includes(category)) {
      return sendErrorResponse(res, 400, 'Invalid category')
      }
      sport.category = category
    }
    
  // Validate team_size using utility function
  const finalType = type || sport.type
  const teamSizeValidation = validateTeamSize(team_size !== undefined ? team_size : sport.team_size, finalType)
  
    if (team_size !== undefined) {
    if (!teamSizeValidation.isValid) {
      return sendErrorResponse(res, 400, teamSizeValidation.error)
    }
    sport.team_size = teamSizeValidation.value
  } else if (isTeamSportType(finalType) && !sport.team_size) {
    // If it's a team sport and team_size is missing, require it
    return sendErrorResponse(res, 400, 'team_size is required for team sports (dual_team and multi_team)')
  } else if (type && type !== sport.type && isTeamSportType(sport.type) && !isTeamSportType(type)) {
    // If changing from team sport to non-team sport, clear team_size
    sport.team_size = null
    }
    
    // Update imageUri if provided
    if (imageUri !== undefined) {
      sport.imageUri = imageUri?.trim() || null
    }
    
    // Set updatedBy from token
    sport.updatedBy = req.user.reg_number
    
    await sport.save()
    
    // Clear sports cache
  clearCachePattern('/api/sports')
  clearCachePattern('/api/sports-counts')
    
  return sendSuccessResponse(res, sport, 'Sport updated successfully')
}))

/**
 * DELETE /api/sports/:id
 * Delete sport (admin only)
 * Accepts ?event_id=2026-umang parameter (defaults to active event if not provided)
 * Validates sport belongs to that event
 * Validates no matches or points table entries exist for this sport in the same event
 */
router.delete('/sports/:id', authenticateToken, requireAdmin, requireRegistrationPeriod, asyncHandler(async (req, res) => {
    const { id } = req.params
    
    const sport = await Sport.findById(id)
    if (!sport) {
    return sendErrorResponse(res, 404, 'Sport not found')
    }
    
    // Get event_id parameter (defaults to active event if not provided)
    const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
    
    let requestedYearData
    try {
      requestedYearData = await getEventYear(eventIdQuery, { returnDoc: true })
    } catch (error) {
      // Provide more user-friendly error messages
      if (error.message === 'Event year not found') {
        return sendErrorResponse(res, 400, `Event year not found. Please ensure the event year parameter is valid.`)
      } else if (error.message === 'No active event year found') {
        return sendErrorResponse(res, 400, `No active event year found. Please configure an active event year first.`)
      }
      return sendErrorResponse(res, 400, error.message || 'Failed to get event year')
    }
    
    const requestedEventId = requestedYearData.doc.event_id
    
    // Validate sport belongs to the requested event
    if (sport.event_id !== requestedEventId) {
      return sendErrorResponse(res, 400, `Cannot delete sport. This sport belongs to event ID ${sport.event_id}, but you are trying to delete it for event ID ${requestedEventId}. Please select the correct event to delete this sport.`)
    }
    
    // Check if any teams have participated
    const teamsCount = sport.teams_participated?.length || 0
    
    // Check if any players have participated (individual events)
    const playersCount = sport.players_participated?.length || 0
    
    // Check if any matches exist for this sport
    const schedulesCount = await EventSchedule.countDocuments({ 
      sports_name: sport.name, 
      event_id: sport.event_id
    })
    
    // Check if any points table entries exist
    const pointsCount = await PointsTable.countDocuments({ 
      sports_name: sport.name, 
      event_id: sport.event_id
    })
    
    // Build error message with all participation data
    const participationErrors = []
    if (teamsCount > 0) {
      participationErrors.push(`${teamsCount} team(s)`)
    }
    if (playersCount > 0) {
      participationErrors.push(`${playersCount} player(s)`)
    }
    if (schedulesCount > 0) {
      participationErrors.push(`${schedulesCount} match(es)`)
    }
    if (pointsCount > 0) {
      participationErrors.push(`${pointsCount} points entry/entries`)
    }
    
    if (participationErrors.length > 0) {
      return sendErrorResponse(res, 400, 
        `Cannot delete sport. ${participationErrors.join(', ')} ${participationErrors.length === 1 ? 'has' : 'have'} participated. Please remove all participation before deleting.`
      )
    }
    
    await Sport.findByIdAndDelete(id)
    
    // Clear sports cache
  clearCachePattern('/api/sports')
  clearCachePattern('/api/sports-counts')
    
  return sendSuccessResponse(res, {}, 'Sport deleted successfully')
}))

/**
 * GET /api/sports-counts
 * Get sports counts (teams and participants)
 * Query Sports collection, filter by event_id
 * IMPORTANT: This route must come BEFORE /:name to avoid route conflicts
 */
router.get('/sports-counts', authenticateToken, asyncHandler(async (req, res) => {
  const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
  
  let eventYearData
  
  try {
    // Try to get event year with document - if it doesn't exist, return empty arrays
    eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
  } catch (error) {
    // If event year not found, return empty arrays instead of error
    if (error.message === 'Event year not found' || error.message === 'No active event year found') {
      const emptyResult = {
        teams_counts: [],
        participants_counts: []
      }
      return res.json(emptyResult)
    }
    // Re-throw other errors to be handled by asyncHandler
    throw error
  }
  
  const eventId = eventYearData.doc.event_id
  
  // Check cache
  const cacheKey = `/api/sports-counts?event_id=${encodeURIComponent(eventId)}`
  const cached = getCache(cacheKey)
  if (cached) {
    return res.json(cached)
  }
  
  // Query database - filter by event_id
  const sports = await Sport.find({ event_id: eventId }).lean()
  
  const teamsCounts = {}
  const participantsCounts = {}
  
  sports.forEach(sport => {
    if (sport.type === 'dual_team' || sport.type === 'multi_team') {
      // Count teams
      teamsCounts[sport.name] = sport.teams_participated ? sport.teams_participated.length : 0
    } else {
      // Count participants
      participantsCounts[sport.name] = sport.players_participated ? sport.players_participated.length : 0
    }
  })
  
  const result = {
    teams_counts: teamsCounts,
    participants_counts: participantsCounts
  }
  
  // Cache the result
  setCache(cacheKey, result)
  
  res.json(result)
}))

/**
 * GET /api/sports/:name
 * Get sport by name
 * Accepts ?event_id=2026-umang parameter (defaults to active event)
 * Queries by name and event_id
 * IMPORTANT: This route must come AFTER /sports-counts to avoid route conflicts
 * Also exclude 'sports-counts' from matching this route
 */
router.get('/sports/:name', asyncHandler(async (req, res) => {
  // Prevent 'sports-counts' from matching this route (should be handled by /sports-counts route above)
  if (req.params.name === 'sports-counts') {
    return sendErrorResponse(res, 404, 'Route not found')
  }
  
  // Additional safeguard: if name is empty or just whitespace, it shouldn't match
  const { name } = req.params
  if (!name || !name.trim()) {
    return sendErrorResponse(res, 404, 'Route not found')
  }
  
  // event_id is optional; defaults to active event if not provided
  // If one is provided, the other is also required for composite key filtering
  // event_id is optional; defaults to active event if not provided
  
  let eventYearData
  
  try {
  // Try to get event year with document - if it doesn't exist, return 400 error
  const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
  eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
  } catch (error) {
    // If event year not found, return 400 error
    if (error.message === 'Event year not found' || error.message === 'No active event year found') {
      return sendErrorResponse(res, 400, error.message)
    }
    // Re-throw other errors to be handled by asyncHandler
    throw error
  }
  
  const eventId = eventYearData.doc.event_id
  
  try {
    const sport = await findSportByNameAndId(name, eventId)
    res.json(sport)
  } catch (error) {
    // If sport not found, return 404 error
    if (error.message.includes('not found')) {
      return sendErrorResponse(res, 404, error.message)
    }
    // Re-throw other errors to be handled by asyncHandler
    throw error
  }
}))

export default router
