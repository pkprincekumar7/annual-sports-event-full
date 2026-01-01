/**
 * Custom hook to get event year with fallback
 * Returns selectedYear if provided, otherwise returns active event year
 * 
 * @param {number|null} selectedYear - Optional selected year (typically from admin)
 * @returns {number|null} - The event year to use
 */
import { useEventYear } from './useEventYear'

export function useEventYearWithFallback(selectedYear) {
  const { eventYear: activeEventYear } = useEventYear()
  return selectedYear || activeEventYear
}

