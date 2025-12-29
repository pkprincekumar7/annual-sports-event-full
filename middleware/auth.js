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
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required. Please login first.',
      })
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired token. Please login again.',
        })
      }

      // Verify that the user exists in the players database
      try {
        const userExists = await Player.findOne({ reg_number: decoded.reg_number }).select('-password')
        if (!userExists) {
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
  if (req.user?.reg_number !== ADMIN_REG_NUMBER) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    })
  }
  next()
}

