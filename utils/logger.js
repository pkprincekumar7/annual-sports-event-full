// Logging utility for backend (Node.js)
// In production, only errors are logged. In development, all logs are shown.

const isDevelopment = process.env.NODE_ENV !== 'production'

const logger = {
  /**
   * Log debug information (only in development)
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args)
    }
  },

  /**
   * Log informational messages (only in development)
   */
  info: (...args) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args)
    }
  },

  /**
   * Log warnings (only in development)
   */
  warn: (...args) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args)
    }
  },

  /**
   * Log errors (always logged, even in production)
   * In production, you might want to send these to an error tracking service
   */
  error: (...args) => {
    if (isDevelopment) {
      console.error('[ERROR]', ...args)
    } else {
      // In production, you could send errors to a logging service
      // Example: sendToErrorTrackingService(...args)
      console.error('[ERROR]', ...args) // Still log errors in production for debugging
    }
  },

  /**
   * Log API-related debug information (only in development)
   */
  api: (...args) => {
    if (isDevelopment) {
      console.log('[API]', ...args)
    }
  },

  /**
   * Log server startup messages (always logged)
   */
  server: (...args) => {
    console.log('[SERVER]', ...args)
  },
}

export default logger

