/**
 * Batch Routes
 * Handles batch creation and player assignment using Batch collection
 */

import express from 'express'
import Batch from '../models/Batch.js'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { requireRegistrationPeriod } from '../middleware/dateRestrictions.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse, handleNotFoundError } from '../utils/errorHandler.js'
import { trimObjectFields } from '../utils/validation.js'
import { getCache, setCache, clearCache, clearCachePattern } from '../utils/cache.js'
import { getEventYear } from '../utils/yearHelpers.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * Validate batch assignment data
 * @param {Object} data - Batch assignment data
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
function validateBatchAssignment(data) {
  const errors = []

  if (!data.name || !data.name.trim()) {
    errors.push('Batch name is required')
  }

  if (!data.event_year) {
    errors.push('Event year is required')
  }

  if (!data.event_name || !data.event_name.trim()) {
    errors.push('Event name is required')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * POST /api/add-batch
 * Create a new batch (admin only)
 * Event Year Required: event_year field required in request body (defaults to active event year)
 */
router.post(
  '/add-batch',
  authenticateToken,
  requireAdmin,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const { createdBy, updatedBy, ...batchData } = trimmed // Exclude createdBy/updatedBy (set from token only)
    
    // Explicitly reject if user tries to send createdBy or updatedBy
    if (createdBy !== undefined || updatedBy !== undefined) {
      return sendErrorResponse(res, 400, 'createdBy and updatedBy fields cannot be set by user. They are automatically set from authentication token.')
    }
    
    const validation = validateBatchAssignment(batchData)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { name, event_year, event_name } = batchData

    // Get event year with document (event_name is now required via validation)
    const eventYearData = await getEventYear(parseInt(event_year), { requireYear: true, returnDoc: true, eventName: event_name.trim() })
    const eventYear = eventYearData.event_year
    const eventName = eventYearData.doc.event_name

    // Check if batch already exists
    const existingBatch = await Batch.findOne({
      name: name.trim(),
      event_year: eventYear,
      event_name: eventName
    })

    if (existingBatch) {
      return sendErrorResponse(res, 409, `Batch "${name}" already exists for event year ${eventYear} (${eventName})`)
    }

    // Create new batch
    const batch = new Batch({
      name: name.trim(),
      event_year: eventYear,
      event_name: eventName,
      players: [],
      createdBy: req.user.reg_number
    })

    await batch.save()

    // Clear cache
    clearCache(`/api/batches?event_year=${eventYear}&event_name=${encodeURIComponent(eventName)}`)

    return sendSuccessResponse(res, { batch }, `Batch "${name}" created successfully`)
  })
)

/**
 * DELETE /api/remove-batch
 * Delete a batch (admin only)
 * Event Year Required: event_year field required in request body (defaults to active event year)
 */
router.delete(
  '/remove-batch',
  authenticateToken,
  requireAdmin,
  requireRegistrationPeriod,
  asyncHandler(async (req, res) => {
    const trimmed = trimObjectFields(req.body)
    const validation = validateBatchAssignment(trimmed)

    if (!validation.isValid) {
      return sendErrorResponse(res, 400, validation.errors.join('; '))
    }

    const { name, event_year, event_name } = trimmed

    // Get event year with document (event_name is now required via validation)
    const eventYearData = await getEventYear(parseInt(event_year), { requireYear: true, returnDoc: true, eventName: event_name.trim() })
    const eventYear = eventYearData.event_year
    const eventName = eventYearData.doc.event_name

    // Find batch first to check if it has players
    const batch = await Batch.findOne({
      name: name.trim(),
      event_year: eventYear,
      event_name: eventName
    })

    if (!batch) {
      return handleNotFoundError(res, 'Batch')
    }

    // Check if batch has any players
    if (batch.players && batch.players.length > 0) {
      return sendErrorResponse(res, 400, `Cannot delete batch "${name}" because it has ${batch.players.length} player(s) assigned. Please remove all players from the batch before deleting it.`)
    }

    // Delete batch if no players
    await Batch.findOneAndDelete({
      name: name.trim(),
      event_year: eventYear,
      event_name: eventName
    })

    // Clear cache
    clearCache(`/api/batches?event_year=${eventYear}&event_name=${encodeURIComponent(eventName)}`)
    clearCachePattern('/api/players') // Player data changes (use pattern to clear all variations)

    return sendSuccessResponse(res, {}, `Batch "${name}" deleted successfully`)
  })
)

/**
 * GET /api/batches
 * Get all batches for an event year (public during registration period)
 * Event Year Filter: Accepts ?event_year=2026 parameter (defaults to active event year)
 * Note: This endpoint is public (no authentication required) to allow batch selection during registration
 */
router.get(
  '/batches',
  asyncHandler(async (req, res) => {
    // For optional event_year/event_name: either both must be provided, or neither
    // If one is provided, the other is also required for composite key filtering
    const hasEventYear = req.query.event_year !== undefined && req.query.event_year !== null && req.query.event_year !== ''
    const hasEventName = req.query.event_name !== undefined && req.query.event_name !== null && req.query.event_name !== '' && req.query.event_name.trim()
    
    if (hasEventYear && !hasEventName) {
      return sendErrorResponse(res, 400, 'event_name is required when event_year is provided')
    }
    if (hasEventName && !hasEventYear) {
      return sendErrorResponse(res, 400, 'event_year is required when event_name is provided')
    }
    
    let eventYearData
    try {
      // Extract event_name from query if provided for composite key filtering
      const eventNameQuery = hasEventName ? req.query.event_name.trim() : null
      eventYearData = await getEventYear(hasEventYear ? parseInt(req.query.event_year) : null, { returnDoc: true, eventName: eventNameQuery })
    } catch (error) {
      if (error.message === 'Event year not found' || error.message === 'No active event year found') {
        return sendSuccessResponse(res, { batches: [] })
      }
      throw error
    }

    const eventYear = eventYearData.event_year
    const eventName = eventYearData.doc.event_name

    // Check cache
    const cacheKey = `/api/batches?event_year=${eventYear}`
    const cached = getCache(cacheKey)
    if (cached) {
      return sendSuccessResponse(res, cached)
    }

    const batches = await Batch.find({
      event_year: eventYear,
      event_name: eventName
    }).sort({ name: 1 }).lean()

    // For public access, don't include player details (privacy)
    // Only return batch names
    const batchesList = batches.map(batch => ({
      _id: batch._id,
      name: batch.name,
      event_year: batch.event_year,
      event_name: batch.event_name,
      players: [] // Don't expose player details for public access
    }))

    const result = { batches: batchesList }
    setCache(cacheKey, result)
    return sendSuccessResponse(res, result)
  })
)

export default router
