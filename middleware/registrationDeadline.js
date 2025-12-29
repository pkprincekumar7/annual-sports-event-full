/**
 * Registration Deadline Middleware
 * Blocks non-GET requests after registration deadline
 */

import { REGISTRATION_DEADLINE } from '../constants/index.js'

const deadlineDate = new Date(REGISTRATION_DEADLINE)

/**
 * Middleware to enforce registration deadline
 * Allows GET requests and login endpoint after deadline
 */
export const checkRegistrationDeadline = (req, res, next) => {
  const currentDate = new Date() // Uses server's local timezone

  // If current date is after the registration deadline
  if (currentDate >= deadlineDate) {
    // Allow GET requests and login endpoint
    if (req.method !== 'GET' && req.path !== '/login') {
      return res.status(400).json({
        success: false,
        error: 'Registration for events closed on January 6th, 2026.',
      })
    }
  }

  next()
}

