/**
 * Event Year Selector Component
 * Allows admin to switch between event years for viewing/managing
 */

import { useState, useEffect } from 'react'
import { fetchWithAuth } from '../utils/api'
import logger from '../utils/logger'
import { useEventYear } from '../hooks'

function EventYearSelector({ selectedEventYear, onEventYearChange, loggedInUser }) {
  const [eventYears, setEventYears] = useState([])
  const [loading, setLoading] = useState(false)
  const { eventYear: activeEventYear } = useEventYear()

  // Only show for admin users
  if (!loggedInUser || loggedInUser.reg_number !== 'admin') {
    return null
  }

  useEffect(() => {
    const fetchEventYears = async () => {
      setLoading(true)
      try {
        const response = await fetchWithAuth('/api/event-years')
        if (!response.ok) throw new Error('Failed to fetch event years')
        const data = await response.json()
        // Backend returns { success: true, eventYears: [...] }
        const eventYearsData = data.eventYears || (Array.isArray(data) ? data : [])
        setEventYears(Array.isArray(eventYearsData) ? eventYearsData.sort((a, b) => b.event_year - a.event_year) : [])
      } catch (error) {
        logger.error('Error fetching event years:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEventYears()
  }, [])

  const handleEventYearChange = (e) => {
    const selectedEventYearValue = e.target.value ? parseInt(e.target.value) : null
    if (onEventYearChange) {
      onEventYearChange(selectedEventYearValue)
    }
  }

  const activeEventYearData = eventYears.find(y => y.is_active)
  // Auto-select active event year if no event year is selected
  const currentEventYear = selectedEventYear || activeEventYearData?.event_year || activeEventYear

  // Auto-select active event year on initial load if not already selected
  useEffect(() => {
    if (eventYears.length > 0 && !selectedEventYear && activeEventYearData && onEventYearChange) {
      onEventYearChange(activeEventYearData.event_year)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventYears.length, activeEventYearData?.event_year])

  return (
    <div className="flex items-center gap-3 flex-wrap justify-center">
      <select
        value={currentEventYear || ''}
        onChange={handleEventYearChange}
        className="px-3 py-1.5 rounded-lg border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-sm outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)]"
        disabled={loading}
      >
        {eventYears.map((eventYear) => (
          <option key={eventYear._id} value={eventYear.event_year}>
            {eventYear.event_year} - {eventYear.event_name} {eventYear.is_active ? '(Active)' : ''}
          </option>
        ))}
      </select>
      {currentEventYear && currentEventYear !== activeEventYearData?.event_year && (
        <span className="text-xs text-[#f59e0b] font-semibold">
          Viewing: {currentEventYear}
        </span>
      )}
      {currentEventYear === activeEventYearData?.event_year && (
        <span className="text-xs text-[#22c55e] font-semibold">
          Active Event Year
        </span>
      )}
    </div>
  )
}

export default EventYearSelector
