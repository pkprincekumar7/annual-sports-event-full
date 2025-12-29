import { useState, useEffect, useRef } from 'react'
import { Modal, Button, ConfirmationDialog, EmptyState } from './ui'
import { useApi, useModal } from '../hooks'
import { fetchWithAuth, clearCache } from '../utils/api'
import logger from '../utils/logger'

function RemoveCaptainModal({ isOpen, onClose, onStatusPopup }) {
  const [captainsBySport, setCaptainsBySport] = useState({})
  const [expandedSports, setExpandedSports] = useState({})
  const [captainToRemove, setCaptainToRemove] = useState(null)
  const isRefreshingRef = useRef(false) // Track if we're refreshing after removal
  const { loading, execute } = useApi()
  const confirmModal = useModal(false)

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
      confirmModal.close()
      setCaptainToRemove(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]) // confirmModal is stable from useModal hook, no need to include it

  const toggleSport = (sport) => {
    setExpandedSports(prev => ({
      ...prev,
      [sport]: !prev[sport]
    }))
  }

  const handleRemoveClick = (regNumber, sport, captainName) => {
    setCaptainToRemove({ regNumber, sport, captainName })
    confirmModal.open()
  }

  const handleConfirmRemove = async () => {
    if (!captainToRemove) return

    confirmModal.close()
    try {
      await execute(
        () => fetchWithAuth('/api/remove-captain', {
          method: 'DELETE',
          body: JSON.stringify({
            reg_number: captainToRemove.regNumber,
            sport: captainToRemove.sport,
          }),
        }),
        {
          onSuccess: (data) => {
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
          },
          onError: (err) => {
            const errorMessage = err.message || 'Error removing captain. Please try again.'
            onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            setCaptainToRemove(null)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      logger.error('Error removing captain:', err)
      const errorMessage = err.message || 'Error removing captain. Please try again.'
      onStatusPopup(`❌ ${errorMessage}`, 'error', 2500)
      setCaptainToRemove(null)
    }
  }

  const handleCancelRemove = () => {
    confirmModal.close()
    setCaptainToRemove(null)
  }

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

        <div className="flex gap-[0.6rem] mt-6">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            fullWidth
          >
            Close
          </Button>
        </div>
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

