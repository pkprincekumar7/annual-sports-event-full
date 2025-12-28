import { useState, useEffect, useRef } from 'react'
import { fetchWithAuth, clearCache } from '../utils/api'
import logger from '../utils/logger'

function RemoveCaptainModal({ isOpen, onClose, onStatusPopup }) {
  const [captainsBySport, setCaptainsBySport] = useState({})
  const [expandedSports, setExpandedSports] = useState({})
  const [removing, setRemoving] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [captainToRemove, setCaptainToRemove] = useState(null)
  const isRefreshingRef = useRef(false) // Track if we're refreshing after removal

  // Fetch captains by sport
  useEffect(() => {
    if (isOpen) {
      fetchWithAuth('/api/captains-by-sport')
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`)
          }
          return res.json()
        })
        .then((data) => {
          if (data.success) {
            setCaptainsBySport(data.captainsBySport || {})
          } else {
            setCaptainsBySport({})
            // Don't show error if we're refreshing after removal
            if (!isRefreshingRef.current && onStatusPopup) {
              onStatusPopup(`❌ ${data.error || 'Error fetching captains. Please try again.'}`, 'error', 2500)
            }
          }
        })
        .catch((err) => {
          logger.error('Error fetching captains by sport:', err)
          setCaptainsBySport({})
          // Don't show error if we're refreshing after removal
          if (!isRefreshingRef.current && onStatusPopup) {
            onStatusPopup('❌ Error fetching captains. Please try again.', 'error', 2500)
          }
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]) // Removed onStatusPopup from dependencies

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setExpandedSports({})
      setRemoving(false)
      setShowConfirmModal(false)
      setCaptainToRemove(null)
    }
  }, [isOpen])

  const toggleSport = (sport) => {
    setExpandedSports(prev => ({
      ...prev,
      [sport]: !prev[sport]
    }))
  }

  const handleRemoveClick = (regNumber, sport, captainName) => {
    setCaptainToRemove({ regNumber, sport, captainName })
    setShowConfirmModal(true)
  }

  const handleConfirmRemove = async () => {
    if (!captainToRemove || removing) return

    setRemoving(true)
    setShowConfirmModal(false)
    try {
      const response = await fetchWithAuth('/api/remove-captain', {
        method: 'DELETE',
        body: JSON.stringify({
          reg_number: captainToRemove.regNumber,
          sport: captainToRemove.sport,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        onStatusPopup(
          `✅ ${captainToRemove.captainName} has been removed as captain for ${captainToRemove.sport}!`,
          'success',
          3000
        )
        // Refresh the captains list silently
        isRefreshingRef.current = true
        clearCache('/api/captains-by-sport')
        clearCache('/api/players') // captain_in field changes
        clearCache('/api/me') // In case current user is updated
        
        fetchWithAuth('/api/captains-by-sport')
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`)
            }
            return res.json()
          })
          .then((data) => {
            if (data.success) {
              setCaptainsBySport(data.captainsBySport || {})
            } else {
              logger.warn('Failed to refresh captains list:', data.error)
              // Don't show error popup here, just log it
            }
          })
          .catch((err) => {
            logger.error('Error refreshing captains:', err)
            // Don't show error popup here, just log it - the removal was successful
          })
          .finally(() => {
            isRefreshingRef.current = false
          })
        setCaptainToRemove(null)
      } else {
        const errorMessage = data.error || 'Error removing captain. Please try again.'
        onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
        setCaptainToRemove(null)
      }
    } catch (err) {
      logger.error('Error removing captain:', err)
      onStatusPopup('❌ Error removing captain. Please try again.', 'error', 2500)
      setCaptainToRemove(null)
    } finally {
      setRemoving(false)
    }
  }

  const handleCancelRemove = () => {
    setShowConfirmModal(false)
    setCaptainToRemove(null)
  }

  if (!isOpen) return null

  const teamSports = [
    'Cricket',
    'Volleyball',
    'Badminton',
    'Table Tennis',
    'Kabaddi',
    'Relay 4×100 m',
    'Relay 4×400 m',
  ]

  const hasAnyCaptains = teamSports.some(sport => 
    captainsBySport[sport] && captainsBySport[sport].length > 0
  )

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4"
    >
      <aside className="max-w-[700px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] pb-[1.5rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          className="absolute top-[10px] right-3 bg-transparent border-none text-[#e5e7eb] text-base cursor-pointer"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">
          Admin Panel
        </div>
        <div className="text-[1.25rem] font-extrabold text-center uppercase tracking-[0.14em] text-[#ffe66d] mb-[0.7rem]">
          Remove Captain
        </div>
        <div className="text-[0.85rem] text-center text-[#e5e7eb] mb-4">
          PCE, Purnea • Umang – 2026 Sports Fest
        </div>

        {!hasAnyCaptains ? (
          <div className="text-center py-8 text-[#cbd5ff] text-[0.9rem]">
            No captains found. Add captains first.
          </div>
        ) : (
          <div className="space-y-2">
            {teamSports.map((sport) => {
              const captains = captainsBySport[sport] || []
              if (captains.length === 0) return null

              const isExpanded = expandedSports[sport]

              return (
                <div
                  key={sport}
                  className="border border-[rgba(148,163,184,0.6)] rounded-[10px] bg-[rgba(15,23,42,0.9)] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleSport(sport)}
                    className="w-full px-[10px] py-3 flex items-center justify-between text-left hover:bg-[rgba(148,163,184,0.1)] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[#ffe66d] text-lg">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <span className="text-[#e2e8f0] text-[0.95rem] font-semibold">
                        {sport}
                      </span>
                      <span className="text-[#cbd5ff] text-[0.8rem]">
                        ({captains.length} captain{captains.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[rgba(148,163,184,0.3)] bg-[rgba(15,23,42,0.7)]">
                      {captains.map((captain) => {
                        // Check if captain has a team for this sport
                        const hasTeam = captain.participated_in && 
                          Array.isArray(captain.participated_in) &&
                          captain.participated_in.some(p => 
                            p.sport === sport && p.team_name
                          )
                        const teamName = hasTeam 
                          ? captain.participated_in.find(p => p.sport === sport && p.team_name)?.team_name
                          : null

                        return (
                          <div
                            key={captain.reg_number}
                            className="px-[10px] py-3 border-b border-[rgba(148,163,184,0.2)] last:border-b-0"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-[#e2e8f0] text-[0.9rem] font-semibold">
                                  {captain.full_name}
                                </div>
                                <div className="text-[#cbd5ff] text-[0.8rem]">
                                  Reg. No: {captain.reg_number}
                                </div>
                                {hasTeam && (
                                  <div className="text-[#ff6b6b] text-[0.75rem] mt-1">
                                    ⚠️ Has team: {teamName}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveClick(captain.reg_number, sport, captain.full_name)}
                                disabled={removing || hasTeam}
                                className={`px-4 py-1.5 rounded-[8px] text-[0.8rem] font-semibold uppercase tracking-[0.05em] transition-all ${
                                  hasTeam
                                    ? 'bg-[rgba(148,163,184,0.2)] text-[rgba(148,163,184,0.5)] cursor-not-allowed'
                                    : removing
                                    ? 'bg-[rgba(239,68,68,0.3)] text-[rgba(239,68,68,0.6)] cursor-not-allowed'
                                    : 'bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer hover:shadow-[0_4px_12px_rgba(239,68,68,0.4)] hover:-translate-y-0.5'
                                }`}
                                title={hasTeam ? 'Cannot remove: Team already created' : 'Remove Captain'}
                              >
                                {removing ? 'Removing...' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-[0.6rem] mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-[rgba(148,163,184,0.7)] py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.9)]"
          >
            Close
          </button>
        </div>
      </aside>

      {/* Remove Captain Confirmation Modal */}
      {showConfirmModal && captainToRemove && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.75)] flex items-center justify-center z-[300]">
          <div className="max-w-[420px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative">
            <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">
              Confirm Removal
            </div>
            <div className="text-[1.1rem] font-extrabold text-center text-[#ffe66d] mb-4">
              Remove Captain
            </div>
            <div className="text-center text-[#e5e7eb] mb-6">
              Are you sure you want to remove <span className="font-semibold text-[#ffe66d]">{captainToRemove.captainName}</span> as captain for <span className="font-semibold text-[#ffe66d]">{captainToRemove.sport}</span>?
              <br />
              <span className="text-[0.9rem] text-red-400 mt-2 block">This action cannot be undone.</span>
            </div>
            <div className="flex gap-[0.6rem] mt-[0.8rem]">
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={removing}
                className="flex-1 rounded-full border-none py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white shadow-[0_10px_24px_rgba(239,68,68,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(239,68,68,0.75)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {removing ? 'Removing...' : 'Remove'}
              </button>
              <button
                type="button"
                onClick={handleCancelRemove}
                disabled={removing}
                className="flex-1 rounded-full border border-[rgba(148,163,184,0.7)] py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.9)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RemoveCaptainModal

