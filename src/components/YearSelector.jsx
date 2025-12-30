/**
 * Year Selector Component
 * Allows admin to switch between event years for viewing/managing
 */

import { useState, useEffect } from 'react'
import { fetchWithAuth } from '../utils/api'
import logger from '../utils/logger'
import { useEventYear } from '../hooks'

function YearSelector({ selectedYear, onYearChange, loggedInUser }) {
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
        const years = data.eventYears || (Array.isArray(data) ? data : [])
        setEventYears(Array.isArray(years) ? years.sort((a, b) => b.year - a.year) : [])
      } catch (error) {
        logger.error('Error fetching event years:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEventYears()
  }, [])

  const handleYearChange = (e) => {
    const year = e.target.value ? parseInt(e.target.value) : null
    if (onYearChange) {
      onYearChange(year)
    }
  }

  const activeYear = eventYears.find(y => y.is_active)
  // Auto-select active year if no year is selected
  const currentYear = selectedYear || activeYear?.year || activeEventYear

  // Auto-select active year on initial load if not already selected
  useEffect(() => {
    if (eventYears.length > 0 && !selectedYear && activeYear && onYearChange) {
      onYearChange(activeYear.year)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventYears.length, activeYear?.year])

  return (
    <div className="flex items-center gap-3 flex-wrap justify-center">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-[#ffe66d] uppercase tracking-wide">
          View Year:
        </span>
        {activeYear && (
          <span className="text-xs text-[#94a3b8]">
            (Active: {activeYear.year})
          </span>
        )}
      </div>
      <select
        value={currentYear || ''}
        onChange={handleYearChange}
        className="px-3 py-1.5 rounded-lg border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-sm outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)]"
        disabled={loading}
      >
        {eventYears.map((year) => (
          <option key={year._id} value={year.year}>
            {year.year} - {year.event_name} {year.is_active ? '(Active)' : ''}
          </option>
        ))}
      </select>
      {currentYear && currentYear !== activeYear?.year && (
        <span className="text-xs text-[#f59e0b] font-semibold">
          Viewing: {currentYear}
        </span>
      )}
      {currentYear === activeYear?.year && (
        <span className="text-xs text-[#22c55e] font-semibold">
          Active Year
        </span>
      )}
    </div>
  )
}

export default YearSelector
