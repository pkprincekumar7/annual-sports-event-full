/**
 * Custom hook to get event year with fallback
 * Returns selectedEventYear if provided, otherwise returns active event year
 * Also returns eventName from eventYearConfig for composite key filtering
 * 
 * @param {number|null} selectedEventYear - Optional selected event year (typically from admin)
 * @returns {{ eventYear: number|null, eventName: string|null }} Object with eventYear and eventName
 */
import { useEventYear } from './useEventYear'

export function useEventYearWithFallback(selectedEventYear) {
  const { eventYear: activeEventYear, eventYearConfig } = useEventYear()
  const eventYear = selectedEventYear || activeEventYear
  const eventName = eventYearConfig?.event_name || null
  return { eventYear, eventName }
}

