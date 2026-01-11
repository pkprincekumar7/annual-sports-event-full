/**
 * Custom hook to fetch active event year
 * Fetches the currently active event year configuration
 */

import { useState, useEffect } from 'react'
import { fetchWithAuth } from '../utils/api'
import logger from '../utils/logger'

export function useEventYear() {
  const [eventYear, setEventYear] = useState(null)
  const [eventYearConfig, setEventYearConfig] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchActiveYear = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetchWithAuth('/api/event-years/active')
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.success) {
          if (data.eventYear) {
            setEventYearConfig(data.eventYear)
            setEventYear(data.eventYear.event_year)
          } else {
            // No active event year found - use current year as fallback
            logger.warn('No active event year found, using current year as fallback')
            const currentYear = new Date().getFullYear()
            setEventYear(currentYear)
            setEventYearConfig(null)
            setError(data.error || 'No active event year found')
          }
        } else {
          throw new Error(data.error || 'Failed to fetch active event year')
        }
      } catch (err) {
        logger.error('Error fetching active event year:', err)
        setError(err.message || 'Failed to fetch active event year')
        // Fallback to current year
        const currentYear = new Date().getFullYear()
        setEventYear(currentYear)
        setEventYearConfig(null)
      } finally {
        setLoading(false)
      }
    }

    fetchActiveYear()
  }, [])

  return { eventYear, eventYearConfig, loading, error }
}

