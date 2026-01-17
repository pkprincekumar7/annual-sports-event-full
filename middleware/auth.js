/**
 * Authentication Middleware
 * Handles JWT token verification and user authentication
 */

import jwt from 'jsonwebtoken'
import Player from '../models/Player.js'
import logger from '../utils/logger.js'
import { ADMIN_REG_NUMBER } from '../constants/index.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

/**
 * Authenticate JWT token and verify user exists in database
 * Attaches user info to req.user
 */
export const authenticateToken = async (req, res, next) => {
  try {
    console.log('[auth] authenticateToken middleware - Path:', req.path, 'Original URL:', req.originalUrl)
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      console.log('[auth] No token provided - returning 401')
      return res.status(401).json({
        success: false,
        error: 'Access token required. Please login first.',
      })
    }
    
    console.log('[auth] Token found, verifying...')

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        console.log('[auth] Token verification failed:', err.message)
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired token. Please login again.',
        })
      }

      console.log('[auth] Token decoded successfully, reg_number:', decoded.reg_number)
      
      // Verify that the user exists in the players database
      try {
        const userExists = await Player.findOne({ reg_number: decoded.reg_number }).select('-password')
        if (!userExists) {
          console.log('[auth] User not found in database:', decoded.reg_number)
          return res.status(403).json({
            success: false,
            error: 'User not found in database. Please login again.',
          })
        }

        // Attach user info to request (from database, not just token)
        req.user = {
          reg_number: decoded.reg_number,
          full_name: decoded.full_name,
          isAdmin: decoded.isAdmin,
        }
        console.log('[auth] User authenticated, calling next()')
        next()
      } catch (error) {
        logger.error('Error verifying user in database:', error)
        return res.status(500).json({
          success: false,
          error: 'Failed to verify user. Please try again.',
        })
      }
    })
  } catch (error) {
    logger.error('Error in authenticateToken middleware:', error)
    return res.status(500).json({
      success: false,
      error: 'Authentication error. Please try again.',
    })
  }
}

/**
 * Require admin access (must be used after authenticateToken)
 */
export const requireAdmin = (req, res, next) => {
  console.log('[auth] requireAdmin middleware - User reg_number:', req.user?.reg_number, 'ADMIN_REG_NUMBER:', ADMIN_REG_NUMBER)
  if (req.user?.reg_number !== ADMIN_REG_NUMBER) {
    console.log('[auth] Admin check failed - returning 403')
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    })
  }
  console.log('[auth] Admin check passed, calling next()')
  next()
}

/**
 * Require admin or coordinator access for a specific sport
 * Must be used after authenticateToken
 * Expects sport name in req.body.sport or req.params.sport
 * Also requires event_id in req.body.event_id, req.query.event_id, or req.params.event_id
 */
export const requireAdminOrCoordinator = async (req, res, next) => {
  const userRegNumber = req.user?.reg_number
  
  // Admin always has access
  if (userRegNumber === ADMIN_REG_NUMBER) {
    return next()
  }

  // Get sport name from body or params
  const sportName = req.body?.sport || req.params?.sport || req.query?.sport
  if (!sportName) {
    return res.status(400).json({
      success: false,
      error: 'Sport name is required for coordinator check',
    })
  }

  // Get event_id from body, query, or params
  const eventId = req.body?.event_id || req.query?.event_id || req.params?.event_id
  if (!eventId || !String(eventId).trim()) {
    return res.status(400).json({
      success: false,
      error: 'Event ID is required for coordinator check',
    })
  }

  try {
    // Import Sport model dynamically to avoid circular dependencies
    const Sport = (await import('../models/Sport.js')).default
    const { normalizeSportName } = await import('../utils/sportHelpers.js')
    
    // Check if user is coordinator for this sport
    const sport = await Sport.findOne({
      name: normalizeSportName(sportName),
      event_id: String(eventId).trim().toLowerCase(),
      eligible_coordinators: userRegNumber
    }).lean()

    if (!sport) {
      return res.status(403).json({
        success: false,
        error: 'Admin or coordinator access required for this sport',
      })
    }

    // User is coordinator for this sport, allow access
    next()
  } catch (error) {
    logger.error('Error checking coordinator access:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to verify coordinator access',
    })
  }
}
