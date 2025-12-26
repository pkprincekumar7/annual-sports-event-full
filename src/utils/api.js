import API_URL from '../config/api.js'
import logger from './logger.js'

// Cache configuration
const CACHE_TTL = {
  '/api/me': 30000, // 30 seconds for current user data
  '/api/players': 30000, // 30 seconds for players list
  '/api/sports': 300000, // 5 minutes for sports list (rarely changes)
  default: 10000, // 10 seconds default
}

// Request cache and deduplication
const requestCache = new Map()
const pendingRequests = new Map()

// Utility function to decode JWT token (without verification - for client-side use only)
export const decodeJWT = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    logger.error('Error decoding JWT:', error)
    return null
  }
}

// Helper function to build full API URL
const buildApiUrl = (endpoint) => {
  // If endpoint already starts with http, use it as-is
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint
  }
  // Otherwise, prepend API_URL
  return `${API_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`
}

// Get cache key from URL and options
const getCacheKey = (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase()
  // Only cache GET requests
  if (method !== 'GET') return null
  
  // Create cache key from URL
  return url
}

// Check if cached data is still valid
const isCacheValid = (cacheEntry, url) => {
  if (!cacheEntry) return false
  
  const ttl = CACHE_TTL[url] || CACHE_TTL.default
  const now = Date.now()
  return (now - cacheEntry.timestamp) < ttl
}

// Clear cache for a specific endpoint or all cache
export const clearCache = (url = null) => {
  if (url) {
    const cacheKey = getCacheKey(url)
    if (cacheKey) {
      requestCache.delete(cacheKey)
    }
  } else {
    requestCache.clear()
  }
}

// Utility function for authenticated API calls with caching and deduplication
export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('authToken')
  
  // Build full URL using API_URL config
  const fullUrl = buildApiUrl(url)
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Check cache for GET requests
  const cacheKey = getCacheKey(url, options)
  if (cacheKey) {
    const cached = requestCache.get(cacheKey)
    if (isCacheValid(cached, url)) {
      // Return cached response as a new Response-like object
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    // Check for pending request (deduplication)
    if (pendingRequests.has(cacheKey)) {
      // Wait for the pending request to complete
      return pendingRequests.get(cacheKey)
    }
  }

  // Use provided signal or create a new AbortController
  const abortController = options.signal ? null : new AbortController()
  const signal = options.signal || abortController.signal

  // Make the request
  const requestPromise = fetch(fullUrl, {
    ...options,
    headers,
    signal,
  }).then(async (response) => {
    // Handle token expiration (401 Unauthorized or 403 Forbidden)
    if (response.status === 401 || response.status === 403) {
      // Clear token only (user data is not stored in localStorage)
      localStorage.removeItem('authToken')
      // Clear cache on auth failure
      clearCache()
      
      // Only reload if explicitly requested (not during initial user fetch)
      // The calling code should handle the auth error appropriately
      if (options.reloadOnAuthError !== false && !window.location.pathname.includes('login')) {
        // Use setTimeout to allow the calling code to handle the error first
        setTimeout(() => {
          window.location.reload()
        }, 100)
      }
      return response
    }

    // Cache successful GET responses
    if (cacheKey && response.ok && response.status === 200) {
      try {
        // Clone response to read body without consuming it
        const clonedResponse = response.clone()
        const data = await clonedResponse.json()
        
        requestCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        })
      } catch (e) {
        // If response is not JSON, don't cache
        logger.warn('Response is not JSON, skipping cache:', url)
      }
    }

    // Remove from pending requests
    if (cacheKey) {
      pendingRequests.delete(cacheKey)
    }

    return response
  }).catch((error) => {
    // Remove from pending requests on error
    if (cacheKey) {
      pendingRequests.delete(cacheKey)
    }
    
    // Re-throw error
    throw error
  })

  // Store pending request for deduplication
  if (cacheKey) {
    pendingRequests.set(cacheKey, requestPromise)
  }

  return requestPromise
}

// Fetch current user data only (optimized - uses dedicated /api/me endpoint)
// Returns { user: userData, authError: boolean } to distinguish auth failures from other errors
export const fetchCurrentUser = async () => {
  const token = localStorage.getItem('authToken')
  if (!token) {
    return { user: null, authError: false }
  }

  try {
    const decoded = decodeJWT(token)
    if (!decoded || !decoded.reg_number) {
      // Invalid token format - this is an auth error
      return { user: null, authError: true }
    }

    // Fetch current user directly using dedicated endpoint (more efficient)
    // Don't reload on auth error during initial fetch - let App.jsx handle it
    const response = await fetchWithAuth('/api/me', { reloadOnAuthError: false })
    
    // Check for authentication errors
    if (response.status === 401 || response.status === 403) {
      // Token is invalid or expired - auth error
      return { user: null, authError: true }
    }
    
    if (response.ok) {
      const data = await response.json()
      if (data.success && data.player) {
        // Backend returns 'player' for /api/me endpoint
        const { password: _, ...userData } = data.player
        return { user: userData, authError: false }
      } else {
        logger.warn('Unexpected response structure from /api/me:', data)
        return { user: null, authError: false }
      }
    }
    
    // Other errors (network, server errors, etc.) - not auth errors
    logger.warn('API call failed with status:', response.status, 'for /api/me')
    return { user: null, authError: false }
  } catch (error) {
    // Network errors or other exceptions - not auth errors
    logger.error('Error fetching current user:', error)
    return { user: null, authError: false }
  }
}

// Export API_URL for direct use in components if needed
export { API_URL }

