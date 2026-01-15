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

  if (!data.event_id || !String(data.event_id).trim()) {
    errors.push('Event ID is required')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * POST /api/add-batch
 * Create a new batch (admin only)
 * Event ID Required: event_id field required in request body (defaults to active event)
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

    const { name, event_id } = batchData

    // Get event year with document
    const eventYearData = await getEventYear(String(event_id).trim(), { requireId: true, returnDoc: true })
    const eventId = eventYearData.doc.event_id
    const eventYear = eventYearData.doc.event_year
    const eventName = eventYearData.doc.event_name

    // Check if batch already exists
    const existingBatch = await Batch.findOne({
      name: name.trim(),
      event_id: eventId
    })

    if (existingBatch) {
      return sendErrorResponse(res, 409, `Batch "${name}" already exists for event year ${eventYear} (${eventName})`)
    }

    // Create new batch
    const batch = new Batch({
      name: name.trim(),
      event_id: eventId,
      players: [],
      createdBy: req.user.reg_number
    })

    await batch.save()

    // Clear cache
    clearCache(`/api/batches?event_id=${encodeURIComponent(eventId)}`)

    return sendSuccessResponse(res, { batch }, `Batch "${name}" created successfully`)
  })
)

/**
 * DELETE /api/remove-batch
 * Delete a batch (admin only)
 * Event ID Required: event_id field required in request body (defaults to active event)
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

    const { name, event_id } = trimmed

    // Get event year with document
    const eventYearData = await getEventYear(String(event_id).trim(), { requireId: true, returnDoc: true })
    const eventId = eventYearData.doc.event_id
    const eventYear = eventYearData.doc.event_year
    const eventName = eventYearData.doc.event_name

    // Find batch first to check if it has players
    const batch = await Batch.findOne({
      name: name.trim(),
      event_id: eventId
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
      event_id: eventId
    })

    // Clear cache
    clearCache(`/api/batches?event_id=${encodeURIComponent(eventId)}`)
    clearCachePattern('/api/players') // Player data changes (use pattern to clear all variations)

    return sendSuccessResponse(res, {}, `Batch "${name}" deleted successfully`)
  })
)

/**
 * GET /api/batches
 * Get all batches for an event year (public during registration period)
 * Event ID Filter: Accepts ?event_id=2026-umang parameter (defaults to active event)
 * Note: This endpoint is public (no authentication required) to allow batch selection during registration
 */
router.get(
  '/batches',
  asyncHandler(async (req, res) => {
    const eventIdQuery = req.query.event_id ? String(req.query.event_id).trim() : null
    
    let eventYearData
    try {
      eventYearData = await getEventYear(eventIdQuery, { returnDoc: true })
    } catch (error) {
      if (error.message === 'Event year not found' || error.message === 'No active event year found') {
        return sendSuccessResponse(res, { batches: [] })
      }
      throw error
    }

    const eventId = eventYearData.doc.event_id

    // Check cache
    const cacheKey = `/api/batches?event_id=${encodeURIComponent(eventId)}`
    const cached = getCache(cacheKey)
    if (cached) {
      return sendSuccessResponse(res, cached)
    }

    const batches = await Batch.find({
      event_id: eventId
    }).sort({ name: 1 }).lean()

    // Return batches with their players array
    // Players array contains registration numbers (strings) which are needed for:
    // 1. BatchManagementModal to check if batch can be deleted
    // 2. Displaying player count and list in the UI
    const batchesList = batches.map(batch => ({
      _id: batch._id,
      name: batch.name,
      event_id: batch.event_id,
      players: batch.players || [] // Return actual players array (array of registration numbers)
    }))

    const result = { batches: batchesList }
    setCache(cacheKey, result)
    return sendSuccessResponse(res, result)
  })
)

export default router
