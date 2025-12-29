/**
 * Error Handler Utilities
 * Centralized error handling for Express routes
 */

import logger from './logger.js'

/**
 * Standard error response format
 */
export const sendErrorResponse = (res, statusCode, message, details = null) => {
  const response = {
    success: false,
    error: message,
  }

  if (details && process.env.NODE_ENV === 'development') {
    response.details = details
  }

  return res.status(statusCode).json(response)
}

/**
 * Standard success response format
 */
export const sendSuccessResponse = (res, data = {}, message = null, statusCode = 200) => {
  const response = {
    success: true,
    ...data,
  }

  if (message) {
    response.message = message
  }

  return res.status(statusCode).json(response)
}

/**
 * Async route handler wrapper
 * Catches errors and sends appropriate error responses
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Unhandled error in route handler:', error)
      sendErrorResponse(
        res,
        500,
        'An unexpected error occurred. Please try again.',
        process.env.NODE_ENV === 'development' ? error.message : null
      )
    })
  }
}

/**
 * Handle validation errors
 */
export const handleValidationError = (res, errors) => {
  const errorMessage = Array.isArray(errors) ? errors.join('; ') : errors
  return sendErrorResponse(res, 400, errorMessage)
}

/**
 * Handle not found errors
 */
export const handleNotFoundError = (res, resource = 'Resource') => {
  return sendErrorResponse(res, 404, `${resource} not found`)
}

/**
 * Handle unauthorized errors
 */
export const handleUnauthorizedError = (res, message = 'Unauthorized access') => {
  return sendErrorResponse(res, 401, message)
}

/**
 * Handle forbidden errors
 */
export const handleForbiddenError = (res, message = 'Access forbidden') => {
  return sendErrorResponse(res, 403, message)
}

