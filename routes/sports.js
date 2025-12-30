/**
 * Sports Routes
 * Handles sports-related operations with dynamic Sports collection
 */

import express from 'express'
import Sport from '../models/Sport.js'
import EventSchedule from '../models/EventSchedule.js'
import PointsTable from '../models/PointsTable.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { getCache, setCache, clearCache, clearCachePattern } from '../utils/cache.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse } from '../utils/errorHandler.js'
import { getEventYear } from '../utils/yearHelpers.js'
import { isTeamSportType, validateTeamSize, normalizeSportName, findSportByNameAndYear } from '../utils/sportHelpers.js'

const router = express.Router()

/**
 * GET /api/sports
 * Get all sports (admin only, or public for display)
 * Accepts ?year=2026 parameter (defaults to active year)
 * Filters by event_year
 * IMPORTANT: This route must come before /:name to avoid conflicts
 */
router.get('/sports', asyncHandler(async (req, res) => {
  const eventYear = await getEventYear(req.query.year ? parseInt(req.query.year) : null)
    
    // Check cache
    const cacheKey = `/api/sports?year=${eventYear}`
    const cached = getCache(cacheKey)
    if (cached) {
      return res.json(cached)
    }
    
    const sports = await Sport.find({ event_year: eventYear })
      .sort({ category: 1, name: 1 })
      .lean()
    
    // Cache the result
    setCache(cacheKey, sports)
    
    res.json(sports)
}))

/**
 * POST /api/sports
 * Create new sport (admin only)
 * event_year is REQUIRED in request body
 * Validates event_year exists in EventYear collection
 * Admin sets type, category, team_size
 * Validates team_size only for team sports
 */
router.post('/sports', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { name, event_year, type, category, team_size, imageUri } = req.body
    
    if (!name || !name.trim()) {
    return sendErrorResponse(res, 400, 'Sport name is required')
    }
    
    if (!type || !['dual_team', 'multi_team', 'dual_player', 'multi_player'].includes(type)) {
    return sendErrorResponse(res, 400, 'Valid sport type is required')
    }
    
    if (!category || !['team events', 'individual events', 'literary and cultural activities'].includes(category)) {
    return sendErrorResponse(res, 400, 'Valid category is required')
    }
    
  // event_year is now REQUIRED
  if (!event_year) {
    return sendErrorResponse(res, 400, 'event_year is required')
  }
  
  const eventYear = await getEventYear(parseInt(event_year), { requireYear: true })
    
    // Validate team_size
  const teamSizeValidation = validateTeamSize(team_size, type)
  if (!teamSizeValidation.isValid) {
    return sendErrorResponse(res, 400, teamSizeValidation.error)
      }
  const parsedTeamSize = teamSizeValidation.value
    
    // Check if sport with same name already exists for this year
    const existingSport = await Sport.findOne({ 
    name: normalizeSportName(name), 
      event_year: eventYear 
    })
    if (existingSport) {
    return sendErrorResponse(res, 409, 'Sport with this name already exists for this year')
    }
    
    const sport = new Sport({
    name: normalizeSportName(name),
      event_year: eventYear,
      type,
      category,
    team_size: isTeamSportType(type) ? parsedTeamSize : null,
      imageUri: imageUri?.trim() || null
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
 * Update within same year (cannot change event_year)
 * Validates team_size if updated
 */
router.put('/sports/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params
  const { type, category, team_size, imageUri } = req.body
    
    const sport = await Sport.findById(id)
    if (!sport) {
    return sendErrorResponse(res, 404, 'Sport not found')
    }
    
    // Cannot change event_year
    if (req.body.event_year !== undefined && req.body.event_year !== sport.event_year) {
    return sendErrorResponse(res, 400, 'Cannot change event_year. Create a new sport for a different year.')
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
    
    await sport.save()
    
    // Clear sports cache
  clearCachePattern('/api/sports')
  clearCachePattern('/api/sports-counts')
    
  return sendSuccessResponse(res, sport, 'Sport updated successfully')
}))

/**
 * DELETE /api/sports/:id
 * Delete sport (admin only)
 * Validates no matches or points table entries exist for this sport in the same year
 */
router.delete('/sports/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params
    
    const sport = await Sport.findById(id)
    if (!sport) {
    return sendErrorResponse(res, 404, 'Sport not found')
    }
    
    // Check if any matches exist for this sport
    const schedulesCount = await EventSchedule.countDocuments({ 
      sports_name: sport.name, 
      event_year: sport.event_year 
    })
    
    // Check if any points table entries exist
    const pointsCount = await PointsTable.countDocuments({ 
      sports_name: sport.name, 
      event_year: sport.event_year 
    })
    
    if (schedulesCount > 0 || pointsCount > 0) {
    return sendErrorResponse(res, 400, 
      `Cannot delete sport. Data exists: ${schedulesCount} matches, ${pointsCount} points entries.`
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
 * Query Sports collection, filter by event_year
 * IMPORTANT: This route must come BEFORE /:name to avoid route conflicts
 */
router.get('/sports-counts', authenticateToken, asyncHandler(async (req, res) => {
  const eventYear = await getEventYear(req.query.year ? parseInt(req.query.year) : null)
    
    // Check cache
    const cacheKey = `/api/sports-counts?year=${eventYear}`
    const cached = getCache(cacheKey)
    if (cached) {
      return res.json(cached)
    }
    
    const sports = await Sport.find({ event_year: eventYear }).lean()
    
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
 * Accepts ?year=2026 parameter (defaults to active year)
 * Queries by name and event_year
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
  
  const eventYear = await getEventYear(req.query.year ? parseInt(req.query.year) : null)
  
  const sport = await findSportByNameAndYear(name, eventYear)
  
  res.json(sport)
}))

export default router
