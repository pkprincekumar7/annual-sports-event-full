/**
 * No-Cache Middleware
 * Prevents caching of API responses
 */

/**
 * Middleware to disable caching for all API responses
 */
export const noCache = (req, res, next) => {
  // Remove conditional request headers that cause 304 responses
  delete req.headers['if-modified-since']
  delete req.headers['if-none-match']
  delete req.headers['if-match']
  delete req.headers['if-unmodified-since']

  // Remove any existing ETag or Last-Modified headers from response
  res.removeHeader('ETag')
  res.removeHeader('Last-Modified')

  // Set no-cache headers to prevent 304 responses
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
  })

  next()
}

