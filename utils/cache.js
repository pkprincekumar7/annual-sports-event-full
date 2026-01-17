/**
 * Cache Utility
 * Simple in-memory cache for backend API responses
 * Can be replaced with Redis for production
 */

// In-memory cache
const cache = new Map()

// Cache TTL configuration (in milliseconds)
const CACHE_TTL = {
  '/api/departments': 10000, // 10 seconds
  '/api/event-years/active': 10000, // 10 seconds
  '/api/sports': 10000, // 10 seconds
  '/api/sports-counts': 10000, // 10 seconds
  default: 5000, // 5 seconds default
}

/**
 * Get cache key from URL
 */
const getCacheKey = (url) => {
  return url
}

/**
 * Check if cached data is still valid
 */
const isCacheValid = (cacheEntry, url) => {
  if (!cacheEntry) return false
  
  const ttl = CACHE_TTL[url] || CACHE_TTL.default
  const now = Date.now()
  return (now - cacheEntry.timestamp) < ttl
}

/**
 * Get cached data
 */
export const getCache = (url) => {
  const cacheKey = getCacheKey(url)
  const cached = cache.get(cacheKey)
  
  if (cached && isCacheValid(cached, url)) {
    return cached.data
  }
  
  // Remove expired cache entry
  if (cached) {
    cache.delete(cacheKey)
  }
  
  return null
}

/**
 * Set cache data
 */
export const setCache = (url, data) => {
  const cacheKey = getCacheKey(url)
  cache.set(cacheKey, {
    data,
    timestamp: Date.now()
  })
}

/**
 * Clear cache for a specific endpoint or all cache
 */
export const clearCache = (url = null) => {
  if (url) {
    const cacheKey = getCacheKey(url)
    cache.delete(cacheKey)
  } else {
    cache.clear()
  }
}

/**
 * Clear all caches matching a pattern
 */
export const clearCachePattern = (pattern) => {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key)
    }
  }
}

export default {
  getCache,
  setCache,
  clearCache,
  clearCachePattern
}

