import { useState, useEffect, useRef } from 'react'
import { Modal, LoadingSpinner, ErrorMessage, EmptyState } from './ui'
import { fetchWithAuth } from '../utils/api'
import { buildApiUrlWithYear } from '../utils/apiHelpers'
import { useEventYearWithFallback } from '../hooks'
import logger from '../utils/logger'

function PointsTableModal({ isOpen, onClose, sport, loggedInUser, embedded = false, selectedYear }) {
  const [pointsTable, setPointsTable] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const eventYear = useEventYearWithFallback(selectedYear)
  const abortControllerRef = useRef(null)
  const currentSportRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !sport) {
      setPointsTable([])
      setError(null)
      setLoading(false)
      currentSportRef.current = null
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      return
    }

    // Only fetch if sport or eventYear changed or we haven't fetched yet
    const currentKey = `${sport}-${eventYear}`
    if (currentSportRef.current === currentKey) {
      return
    }

    currentSportRef.current = currentKey

    // Abort previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    let isMounted = true
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const loadData = async () => {
      await fetchPointsTable(abortController.signal)
    }

    loadData()

    return () => {
      isMounted = false
      // Only abort if sport or eventYear changed
      const currentKey = `${sport}-${eventYear}`
      if (currentSportRef.current !== currentKey) {
        abortController.abort()
      }
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sport, eventYear])

  const fetchPointsTable = async (signal) => {
    if (!sport) {
      setError('Sport name is required')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    let isMounted = true

    try {
      const encodedSport = encodeURIComponent(sport)
      const url = buildApiUrlWithYear(`/api/points-table/${encodedSport}`, eventYear)

      const response = await fetchWithAuth(url, { signal })

      if (signal?.aborted) {
        isMounted = false
        return
      }

      if (!response.ok) {
        let errorMessage = 'Failed to fetch points table'
        try {
          const clonedResponse = response.clone()
          const errorData = await clonedResponse.json()
          errorMessage = errorData.error || errorData.details || errorMessage
          logger.error('API Error:', errorData)
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
          logger.error('Response parse error:', e)
        }
        if (isMounted) {
          setError(errorMessage)
          setLoading(false)
        }
        return
      }

      const data = await response.json()

      if (isMounted) {
        if (data.success) {
          setPointsTable(data.points_table || [])
        } else {
          setError(data.error || 'Failed to fetch points table')
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        isMounted = false
        return
      }
      logger.error('Error fetching points table:', err)
      if (isMounted) {
        setError(`Error while fetching points table: ${err.message || 'Please check your connection and try again.'}`)
      }
    } finally {
      if (isMounted) {
        setLoading(false)
      }
    }
  }

  if (!embedded) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${sport} - Points Table`}
        subtitle="League Match Standings"
        maxWidth="max-w-[900px]"
      >
        {loading && <LoadingSpinner />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && pointsTable.length === 0 && (
          <EmptyState message="No points table data available yet. Points are calculated automatically for league matches." />
        )}
        {!loading && !error && pointsTable.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[rgba(148,163,184,0.3)]">
                  <th className="px-4 py-3 text-left text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Rank</th>
                  <th className="px-4 py-3 text-left text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">
                    {pointsTable[0]?.participant_type === 'team' ? 'Team' : 'Player'}
                  </th>
                  <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Matches Played</th>
                  <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Won</th>
                  <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Lost</th>
                  <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Draw</th>
                  <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Cancelled</th>
                  <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Points</th>
                </tr>
              </thead>
              <tbody>
                {pointsTable.map((entry, index) => (
                  <tr key={entry._id || index} className="border-b border-[rgba(148,163,184,0.1)] hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="px-4 py-3 text-[#e5e7eb] font-semibold">{index + 1}</td>
                    <td className="px-4 py-3 text-[#e5e7eb]">{entry.participant}</td>
                    <td className="px-4 py-3 text-center text-[#e5e7eb]">{entry.matches_played || 0}</td>
                    <td className="px-4 py-3 text-center text-[#86efac]">{entry.matches_won || 0}</td>
                    <td className="px-4 py-3 text-center text-[#f87171]">{entry.matches_lost || 0}</td>
                    <td className="px-4 py-3 text-center text-[#fbbf24]">{entry.matches_draw || 0}</td>
                    <td className="px-4 py-3 text-center text-[#94a3b8]">{entry.matches_cancelled || 0}</td>
                    <td className="px-4 py-3 text-center text-[#ffe66d] font-bold text-[1.1rem]">{entry.points || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    )
  }

  // Embedded mode (inside SportDetailsModal)
  return (
    <div className="p-4">
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && pointsTable.length === 0 && (
        <EmptyState message="No points table data available yet. Points are calculated automatically for league matches." />
      )}
      {!loading && !error && pointsTable.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[rgba(148,163,184,0.3)]">
                <th className="px-4 py-3 text-left text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Rank</th>
                <th className="px-4 py-3 text-left text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">
                  {pointsTable[0]?.participant_type === 'team' ? 'Team' : 'Player'}
                </th>
                <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Matches Played</th>
                <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Won</th>
                <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Lost</th>
                <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Draw</th>
                <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Cancelled</th>
                <th className="px-4 py-3 text-center text-[0.85rem] font-bold text-[#ffe66d] uppercase tracking-[0.05em]">Points</th>
              </tr>
            </thead>
            <tbody>
              {pointsTable.map((entry, index) => (
                <tr key={entry._id || index} className="border-b border-[rgba(148,163,184,0.1)] hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="px-4 py-3 text-[#e5e7eb] font-semibold">{index + 1}</td>
                  <td className="px-4 py-3 text-[#e5e7eb]">{entry.participant}</td>
                  <td className="px-4 py-3 text-center text-[#e5e7eb]">{entry.matches_played || 0}</td>
                  <td className="px-4 py-3 text-center text-[#86efac]">{entry.matches_won || 0}</td>
                  <td className="px-4 py-3 text-center text-[#f87171]">{entry.matches_lost || 0}</td>
                  <td className="px-4 py-3 text-center text-[#fbbf24]">{entry.matches_draw || 0}</td>
                  <td className="px-4 py-3 text-center text-[#94a3b8]">{entry.matches_cancelled || 0}</td>
                  <td className="px-4 py-3 text-center text-[#ffe66d] font-bold text-[1.1rem]">{entry.points || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default PointsTableModal

