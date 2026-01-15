/**
 * Event Year Selector Component
 * Allows authenticated users to switch between event years for viewing
 */

import { useEffect, useRef } from 'react'
import { useEventYear, useEventYears } from '../hooks'

function EventYearSelector({ selectedEventId, onEventYearChange, loggedInUser }) {
  const { eventYears, loading } = useEventYears()
  const { eventYearConfig } = useEventYear()

  // Only show for authenticated users
  if (!loggedInUser) {
    return null
  }

  const handleEventYearChange = (e) => {
    const selectedEventIdValue = e.target.value ? String(e.target.value) : null
    if (onEventYearChange) {
      onEventYearChange(selectedEventIdValue)
    }
  }

  const activeEventYearData = eventYears.find(y => y.is_active)
  const activeEventId = activeEventYearData?.event_id || eventYearConfig?.event_id || null
  const currentEventId = selectedEventId || activeEventId
  const currentEventData = currentEventId
    ? eventYears.find(ey => ey.event_id === currentEventId)
    : null

  // Auto-select active event year on initial load if not already selected
  // Use a ref to track if we've already auto-selected to prevent infinite loops
  const hasAutoSelectedRef = useRef(false)
  useEffect(() => {
    if (eventYears.length > 0 && !selectedEventId && activeEventYearData && onEventYearChange && !hasAutoSelectedRef.current) {
      hasAutoSelectedRef.current = true
      onEventYearChange(activeEventYearData.event_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventYears.length, activeEventYearData?.event_id, selectedEventId])

  return (
    <div className="flex items-center gap-3 flex-wrap justify-center">
      <select
        value={currentEventId || ''}
        onChange={handleEventYearChange}
        className="px-3 py-1.5 rounded-lg border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-sm outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)]"
        disabled={loading}
      >
        {eventYears.map((eventYear) => (
          <option key={eventYear._id} value={eventYear.event_id}>
            {eventYear.event_year} - {eventYear.event_name} {eventYear.is_active ? '(Active)' : ''}
          </option>
        ))}
      </select>
      {currentEventData?.event_year &&
        ((!activeEventYearData && currentEventId) ||
          (activeEventYearData?.event_id && currentEventData.event_id !== activeEventYearData.event_id)) && (
        <span className="text-xs text-[#f59e0b] font-semibold">
          Viewing
        </span>
      )}
      {activeEventYearData?.event_id && currentEventData?.event_id === activeEventYearData.event_id && (
        <span className="text-xs text-[#22c55e] font-semibold">
          Active
        </span>
      )}
    </div>
  )
}

export default EventYearSelector
