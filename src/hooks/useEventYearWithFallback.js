/**
 * Custom hook to get event year with fallback
 * Returns selectedEventYear if provided, otherwise returns active event year
 * Also returns eventName from eventYears list (if selectedEventYear is provided) or from active event config
 * 
 * @param {number|null} selectedEventYear - Optional selected event year (typically from admin)
 * @returns {{ eventYear: number|null, eventName: string|null }} Object with eventYear and eventName
 */
import { useEventYear } from './useEventYear'
import { useEventYears } from './useEventYears'
import logger from '../utils/logger'

export function useEventYearWithFallback(selectedEventYear) {
  const { eventYear: activeEventYear, eventYearConfig } = useEventYear()
  const { eventYears, loading: eventYearsLoading } = useEventYears()
  
  const eventYear = selectedEventYear || activeEventYear
  
  // If selectedEventYear is provided, look it up in eventYears list to get the correct event_name
  // Otherwise, use the active event's event_name
  let eventName = null
  
  if (selectedEventYear && eventYears.length > 0) {
    const selectedEventYearData = eventYears.find(ey => ey.event_year === selectedEventYear)
    eventName = selectedEventYearData?.event_name || null
  }
  
  // Fall back to active event's event_name if not found in eventYears list
  if (!eventName && eventYearConfig) {
    eventName = eventYearConfig.event_name || null
  }
  
  // If still no eventName and we have eventYear, try to find it in eventYears list
  // This handles the case where eventYearConfig might not have event_name but eventYears list does
  if (!eventName && eventYear && eventYears.length > 0) {
    const eventYearData = eventYears.find(ey => ey.event_year === eventYear)
    eventName = eventYearData?.event_name || null
  }
  
  // Log warning if eventYear is set but eventName is missing (for debugging)
  if (eventYear && !eventName && !eventYearsLoading) {
    logger.warn(`useEventYearWithFallback: eventYear ${eventYear} found but eventName is missing. eventYearConfig:`, eventYearConfig, 'eventYears:', eventYears.length)
  }
  
  return { eventYear, eventName }
}

