import { useState, useEffect, useRef } from 'react'
import { Modal, Button, ConfirmationDialog, EmptyState } from './ui'
import { useApi, useModal, useEventYearWithFallback } from '../hooks'
import { fetchWithAuth, clearCache } from '../utils/api'
import { buildApiUrlWithYear } from '../utils/apiHelpers'

function RemoveCaptainModal({ isOpen, onClose, onStatusPopup, selectedYear }) {
  const [captainsBySport, setCaptainsBySport] = useState({})
  const [expandedSports, setExpandedSports] = useState({})
  const [captainToRemove, setCaptainToRemove] = useState(null)
  const isRefreshingRef = useRef(false) // Track if we're refreshing after removal
  const { loading, execute } = useApi()
  const eventYear = useEventYearWithFallback(selectedYear)
  const confirmModal = useModal(false)

  // Fetch captains by sport
  useEffect(() => {
    if (isOpen && eventYear) {
      fetchWithAuth(buildApiUrlWithYear('/api/captains-by-sport', eventYear))
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
          setCaptainsBySport({})
          // Don't show error if we're refreshing after removal
          if (!isRefreshingRef.current && onStatusPopup) {
            onStatusPopup('❌ Error fetching captains. Please try again.', 'error', 2500)
          }
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventYear]) // Removed onStatusPopup from dependencies

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setExpandedSports({})
      confirmModal.close()
      setCaptainToRemove(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]) // confirmModal is stable from useModal hook, no need to include it

  const toggleSport = (sport) => {
    setExpandedSports(prev => {
      // If clicking on an already expanded sport, collapse it
      if (prev[sport]) {
        const newState = { ...prev }
        delete newState[sport]
        return newState
      }
      // Otherwise, expand this sport and collapse all others
      return { [sport]: true }
    })
  }

  const handleRemoveClick = (regNumber, sport, captainName) => {
    setCaptainToRemove({ regNumber, sport, captainName })
    confirmModal.open()
  }

  const handleConfirmRemove = async () => {
    if (!captainToRemove) return

    // Store values before async operations to avoid closure issues
    const { regNumber, sport, captainName } = captainToRemove
    confirmModal.close()
    
    try {
      await execute(
        () => fetchWithAuth('/api/remove-captain', {
          method: 'DELETE',
          body: JSON.stringify({
            reg_number: regNumber,
            sport: sport,
            event_year: eventYear,
          }),
        }),
        {
          onSuccess: (data) => {
            onStatusPopup(
              `✅ ${captainName} has been removed as captain for ${sport}!`,
              'success',
              3000
            )
            // Refresh the captains list silently
            isRefreshingRef.current = true
            // Clear cache with year parameter to match the API call
            clearCache(buildApiUrlWithYear('/api/captains-by-sport', eventYear))
            clearCache('/api/players') // captain_in field changes
            clearCache('/api/me') // In case current user is updated
            
            // Fetch updated captains list
            fetchWithAuth(`/api/captains-by-sport${eventYear ? `?year=${eventYear}` : ''}`, { skipCache: true })
              .then((res) => {
                if (!res.ok) {
                  throw new Error(`HTTP error! status: ${res.status}`)
                }
                return res.json()
              })
              .then((data) => {
                if (data.success) {
                  setCaptainsBySport(data.captainsBySport || {})
                  // Reset expanded state for the sport if it has no captains left
                  const updatedCaptains = data.captainsBySport?.[sport] || []
                  if (updatedCaptains.length === 0) {
                    setExpandedSports(prev => {
                      const newState = { ...prev }
                      delete newState[sport]
                      return newState
                    })
                  }
                }
              })
              .catch((err) => {
                // Don't show error popup here - the removal was successful
              })
              .finally(() => {
                isRefreshingRef.current = false
              })
            setCaptainToRemove(null)
          },
          onError: (err) => {
            // The useApi hook extracts the error message from the API response
            const errorMessage = err?.message || err?.error || 'Error removing captain. Please try again.'
            onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            setCaptainToRemove(null)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      // Don't show duplicate error message - onError should have handled it
      logger.error('Error removing captain:', err)
      setCaptainToRemove(null)
    }
  }

  const handleCancelRemove = () => {
    confirmModal.close()
    setCaptainToRemove(null)
  }

  // Get all sports that have captains (dynamic from API response)
  const sportsWithCaptains = Object.keys(captainsBySport).filter(sport => 
    captainsBySport[sport] && captainsBySport[sport].length > 0
  )
  
  const hasAnyCaptains = sportsWithCaptains.length > 0

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Remove Captain"
        maxWidth="max-w-[700px]"
      >
        {!hasAnyCaptains ? (
          <EmptyState message="No captains found. Add captains first." className="py-8 text-[0.9rem]" />
        ) : (
          <div className="space-y-2">
            {sportsWithCaptains.map((sport) => {
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
                              <Button
                                type="button"
                                onClick={() => handleRemoveClick(captain.reg_number, sport, captain.full_name)}
                                disabled={loading || hasTeam}
                                variant="danger"
                                className="px-4 py-1.5 text-[0.8rem] font-semibold uppercase tracking-[0.05em]"
                                title={hasTeam ? 'Cannot remove: Team already created' : 'Remove Captain'}
                              >
                                {loading ? 'Removing...' : 'Remove'}
                              </Button>
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
      </Modal>

      {/* Remove Captain Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmModal.isOpen && captainToRemove !== null}
        onClose={handleCancelRemove}
        onConfirm={handleConfirmRemove}
        title="Remove Captain"
        message={
          captainToRemove ? (
            <>
              Are you sure you want to remove <span className="font-semibold text-[#ffe66d]">{captainToRemove.captainName}</span> as captain for <span className="font-semibold text-[#ffe66d]">{captainToRemove.sport}</span>?
              <br />
              <span className="text-[0.9rem] text-red-400 mt-2 block">This action cannot be undone.</span>
            </>
          ) : ''
        }
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        loading={loading}
      />
    </>
  )
}

export default RemoveCaptainModal

