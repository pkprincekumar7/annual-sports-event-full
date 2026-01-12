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
import { getCache, setCache, clearCache } from '../utils/cache.js'
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

    const { name, event_year } = batchData

    // Get event year with document (default to active event year if not provided)
    // Extract event_name from body if provided for composite key filtering
    const eventNameBody = req.body.event_name ? req.body.event_name.trim() : null
    const eventYearData = await getEventYear(event_year ? parseInt(event_year) : null, { returnDoc: true, eventName: eventNameBody })
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
    clearCache(`/api/batches?event_year=${eventYear}`)

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

    const { name, event_year } = trimmed

    // Get event year with document (default to active event year if not provided)
    // Extract event_name from body if provided for composite key filtering
    const eventNameBody = req.body.event_name ? req.body.event_name.trim() : null
    const eventYearData = await getEventYear(event_year ? parseInt(event_year) : null, { returnDoc: true, eventName: eventNameBody })
    const eventYear = eventYearData.event_year
    const eventName = eventYearData.doc.event_name

    // Find and delete batch
    const batch = await Batch.findOneAndDelete({
      name: name.trim(),
      event_year: eventYear,
      event_name: eventName
    })

    if (!batch) {
      return handleNotFoundError(res, 'Batch')
    }

    // Clear cache
    clearCache(`/api/batches?event_year=${eventYear}`)
    clearCache('/api/players') // Player year data changes

    return sendSuccessResponse(res, {}, `Batch "${name}" deleted successfully`)
  })
)

/**
 * GET /api/batches
 * Get all batches for an event year (admin only)
 * Event Year Filter: Accepts ?event_year=2026 parameter (defaults to active event year)
 */
router.get(
  '/batches',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    let eventYearData
    try {
      // Extract event_name from query if provided for composite key filtering
      const eventNameQuery = req.query.event_name ? req.query.event_name.trim() : null
      eventYearData = await getEventYear(req.query.event_year ? parseInt(req.query.event_year) : null, { returnDoc: true, eventName: eventNameQuery })
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

    // Populate player details
    const batchesWithPlayers = await Promise.all(
      batches.map(async (batch) => {
        const players = await Player.find({ reg_number: { $in: batch.players } })
          .select('reg_number full_name gender department_branch mobile_number email_id')
          .lean()
        
        return {
          ...batch,
          players: players
        }
      })
    )

    const result = { batches: batchesWithPlayers }
    setCache(cacheKey, result)
    return sendSuccessResponse(res, result)
  })
)

export default router
