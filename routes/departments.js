import express from 'express'
import Department from '../models/Department.js'
import Player from '../models/Player.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { clearCache } from '../utils/cache.js'

const router = express.Router()

/**
 * GET /api/departments
 * Get all departments (public or authenticated)
 * Sort by display_order ascending
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const departments = await Department.find({})
      .sort({ display_order: 1, name: 1 })
      .lean()
    
    res.json(departments)
  } catch (error) {
    console.error('Error fetching departments:', error)
    res.status(500).json({ error: 'Failed to fetch departments' })
  }
})

/**
 * GET /api/departments/active
 * Get all departments (public, for dropdowns)
 * Sort by display_order ascending
 */
router.get('/active', async (req, res) => {
  try {
    const departments = await Department.find({})
      .sort({ display_order: 1, name: 1 })
      .lean()
    
    res.json(departments)
  } catch (error) {
    console.error('Error fetching departments:', error)
    res.status(500).json({ error: 'Failed to fetch departments' })
  }
})

/**
 * POST /api/departments
 * Create new department (admin only)
 * Validation: Department name must be unique
 * Note: Department creation is not restricted by registration period
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, code, display_order } = req.body
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' })
    }
    
    // Check if department with same name already exists
    const existingDepartment = await Department.findOne({ name: name.trim() })
    if (existingDepartment) {
      return res.status(409).json({ error: 'Department with this name already exists' })
    }
    
    const department = new Department({
      name: name.trim(),
      code: code?.trim() || '',
      display_order: display_order || 0,
      created_by: req.user.reg_number
    })
    
    await department.save()
    
    // Clear department cache
    clearCache('/api/departments')
    clearCache('/api/departments/active')
    
    res.status(201).json(department)
  } catch (error) {
    console.error('Error creating department:', error)
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Department with this name already exists' })
    }
    res.status(500).json({ error: 'Failed to create department' })
  }
})

/**
 * PUT /api/departments/:id
 * Update department (admin only)
 * Restriction: Only display_order field can be updated
 * Validation: Reject update if trying to modify name or code (these are immutable)
 * Note: Department updates are not restricted by registration period
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { display_order } = req.body
    
    // Check if trying to update immutable fields
    if (req.body.name !== undefined || req.body.code !== undefined) {
      return res.status(400).json({ 
        error: 'Department name and code cannot be modified. Only display_order can be updated.' 
      })
    }
    
    const department = await Department.findById(id)
    if (!department) {
      return res.status(404).json({ error: 'Department not found' })
    }
    
    // Only update allowed fields
    if (display_order !== undefined) {
      department.display_order = display_order
    }
    
    await department.save()
    
    // Clear department cache
    clearCache('/api/departments')
    clearCache('/api/departments/active')
    
    res.json(department)
  } catch (error) {
    console.error('Error updating department:', error)
    res.status(500).json({ error: 'Failed to update department' })
  }
})

/**
 * DELETE /api/departments/:id
 * Delete department (admin only)
 * Validation: Check if any players have this department
 * If players exist, reject deletion with error message
 * If no players, allow hard delete
 * Note: Department deletion is not restricted by registration period
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    const department = await Department.findById(id)
    if (!department) {
      return res.status(404).json({ error: 'Department not found' })
    }
    
    // Check if any players have this department
    const playersCount = await Player.countDocuments({ department_branch: department.name })
    
    if (playersCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete department. ${playersCount} player(s) are registered with this department.` 
      })
    }
    
    await Department.findByIdAndDelete(id)
    
    // Clear department cache
    clearCache('/api/departments')
    clearCache('/api/departments/active')
    
    res.json({ message: 'Department deleted successfully' })
  } catch (error) {
    console.error('Error deleting department:', error)
    res.status(500).json({ error: 'Failed to delete department' })
  }
})

export default router

