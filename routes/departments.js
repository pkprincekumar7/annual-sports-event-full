import express from 'express'
import Department from '../models/Department.js'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { asyncHandler, sendSuccessResponse, sendErrorResponse } from '../utils/errorHandler.js'
import logger from '../utils/logger.js'
import { clearCache } from '../utils/cache.js'

const router = express.Router()

/**
 * GET /api/departments
 * Get all departments (public or authenticated)
 * Sort by display_order ascending
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const departments = await Department.find({})
    .sort({ display_order: 1, name: 1 })
    .lean()
  
  return sendSuccessResponse(res, { departments })
}))

/**
 * GET /api/departments/active
 * Get all departments (public, for dropdowns)
 * Sort by display_order ascending
 */
router.get('/active', asyncHandler(async (req, res) => {
  const departments = await Department.find({})
    .sort({ display_order: 1, name: 1 })
    .lean()
  
  return sendSuccessResponse(res, { departments })
}))

/**
 * POST /api/departments
 * Create new department (admin only)
 * Validation: Department name must be unique
 * Note: Department creation is not restricted by registration period
 */
router.post('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { createdBy, updatedBy, ...bodyData } = req.body
  
  // Explicitly reject if user tries to send createdBy or updatedBy
  if (createdBy !== undefined || updatedBy !== undefined) {
    return sendErrorResponse(res, 400, 'createdBy and updatedBy fields cannot be set by user. They are automatically set from authentication token.')
  }
  
  const { name, code, display_order } = bodyData
  
  if (!name || !name.trim()) {
    return sendErrorResponse(res, 400, 'Department name is required')
  }
  
  // Check if department with same name already exists
  const existingDepartment = await Department.findOne({ name: name.trim() })
  if (existingDepartment) {
    return sendErrorResponse(res, 409, 'Department with this name already exists')
  }
  
  const department = new Department({
    name: name.trim(),
    code: code?.trim() || '',
    display_order: display_order || 0,
    createdBy: req.user.reg_number
  })
  
  await department.save()
  
  // Clear department cache
  clearCache('/api/departments')
  clearCache('/api/departments/active')
  
  return sendSuccessResponse(res, department, 'Department created successfully', 201)
}))

/**
 * PUT /api/departments/:id
 * Update department (admin only)
 * Restriction: Only display_order field can be updated
 * Validation: Reject update if trying to modify name or code (these are immutable)
 * Note: Department updates are not restricted by registration period
 */
router.put('/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { createdBy, updatedBy, ...bodyData } = req.body
  
  // Explicitly reject if user tries to send createdBy or updatedBy
  if (createdBy !== undefined || updatedBy !== undefined) {
    return sendErrorResponse(res, 400, 'createdBy and updatedBy fields cannot be set by user. They are automatically set from authentication token.')
  }
  
  const { display_order } = bodyData
  
  // Check if trying to update immutable fields
  if (req.body.name !== undefined || req.body.code !== undefined) {
    return sendErrorResponse(res, 400, 'Department name and code cannot be modified. Only display_order can be updated.')
  }
  
  const department = await Department.findById(id)
  if (!department) {
    return sendErrorResponse(res, 404, 'Department not found')
  }
  
  // Only update allowed fields
  if (display_order !== undefined) {
    department.display_order = display_order
  }
  
  // Set updatedBy from token
  department.updatedBy = req.user.reg_number
  
  await department.save()
  
  // Clear department cache
  clearCache('/api/departments')
  clearCache('/api/departments/active')
  
  return sendSuccessResponse(res, department, 'Department updated successfully')
}))

/**
 * DELETE /api/departments/:id
 * Delete department (admin only)
 * Validation: Check if any players have this department
 * If players exist, reject deletion with error message
 * If no players, allow hard delete
 * Note: Department deletion is not restricted by registration period
 */
router.delete('/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  
  const department = await Department.findById(id)
  if (!department) {
    return sendErrorResponse(res, 404, 'Department not found')
  }
  
  // Check if any players have this department
  const playersCount = await Player.countDocuments({ department_branch: department.name })
  
  if (playersCount > 0) {
    return sendErrorResponse(res, 400, `Cannot delete department. ${playersCount} player(s) are registered with this department.`)
  }
  
  await Department.findByIdAndDelete(id)
  
  // Clear department cache
  clearCache('/api/departments')
  clearCache('/api/departments/active')
  
  return sendSuccessResponse(res, {}, 'Department deleted successfully')
}))

export default router

