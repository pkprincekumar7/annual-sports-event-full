import { useState, useEffect, useRef } from 'react'
import { fetchWithAuth } from '../utils/api'
import logger from '../utils/logger'

function ParticipantDetailsModal({ isOpen, onClose, sport, loggedInUser, onStatusPopup, embedded = false }) {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedParticipants, setExpandedParticipants] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [participantToDelete, setParticipantToDelete] = useState(null)
  const currentSportRef = useRef(null)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !sport) {
      // Reset state when modal closes
      setParticipants([])
      setExpandedParticipants(new Set())
      setError(null)
      setShowDeleteConfirm(false)
      setParticipantToDelete(null)
      setDeleting(false)
      currentSportRef.current = null
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      return
    }

    // Only fetch if sport changed or we haven't fetched yet
    if (currentSportRef.current === sport) {
      return
    }

    currentSportRef.current = sport

    // Abort previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    let isMounted = true
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const loadData = async () => {
      await fetchParticipantDetails(abortController.signal)
    }

    loadData()

    return () => {
      isMounted = false
      // Only abort if sport changed
      if (currentSportRef.current !== sport) {
        abortController.abort()
      }
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sport])

  const fetchParticipantDetails = async (signal) => {
    if (!sport) {
      setError('Sport name is required')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    let isMounted = true
    
    try {
      // URL encode the sport name to handle special characters
      const encodedSport = encodeURIComponent(sport)
      const url = `/api/participants/${encodedSport}`
      logger.api('Fetching participants for sport:', sport, 'URL:', url)
      
      const response = await fetchWithAuth(url, { signal })
      
      if (signal?.aborted) {
        isMounted = false
        return
      }
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to fetch participant details'
        try {
          // Clone response to read error without consuming the original
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
      logger.api('Participant data received:', data)

      if (isMounted) {
        if (data.success) {
          setParticipants(data.participants || [])
        } else {
          setError(data.error || 'Failed to fetch participant details')
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        isMounted = false
        return
      }
      logger.error('Error fetching participant details:', err)
      if (isMounted) {
        setError(`Error while fetching participant details: ${err.message || 'Please check your connection and try again.'}`)
      }
    } finally {
      if (isMounted) {
        setLoading(false)
      }
    }
  }

  const toggleParticipant = (regNumber) => {
    const newExpanded = new Set(expandedParticipants)
    if (newExpanded.has(regNumber)) {
      newExpanded.delete(regNumber)
    } else {
      newExpanded.add(regNumber)
    }
    setExpandedParticipants(newExpanded)
  }

  const handleDeleteClick = (participant) => {
    setParticipantToDelete(participant)
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    if (!participantToDelete || deleting) return

    setDeleting(true)
    setShowDeleteConfirm(false)
    try {
      const response = await fetchWithAuth('/api/remove-participation', {
        method: 'DELETE',
        body: JSON.stringify({
          reg_number: participantToDelete.reg_number,
          sport: sport,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        if (onStatusPopup) {
          onStatusPopup(
            `✅ ${participantToDelete.full_name}'s participation in ${sport} has been removed!`,
            'success',
            3000
          )
        }
        // Refresh the participants list (no signal needed for manual refresh)
        await fetchParticipantDetails(null)
        setParticipantToDelete(null)
      } else {
        const errorMessage = data.error || 'Error removing participation. Please try again.'
        if (onStatusPopup) {
          onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
        }
        setParticipantToDelete(null)
      }
    } catch (err) {
      logger.error('Error removing participation:', err)
      if (onStatusPopup) {
        onStatusPopup('❌ Error removing participation. Please try again.', 'error', 2500)
      }
      setParticipantToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
    setParticipantToDelete(null)
  }

  const isAdmin = loggedInUser?.reg_number === 'admin'

  if (!isOpen) return null

  const content = (
    <aside className={`${embedded ? 'w-full' : 'max-w-[700px] w-full'} bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] ${embedded ? 'px-0 py-0' : 'px-[1.4rem] py-[1.6rem] pb-[1.5rem]'} border border-[rgba(255,255,255,0.12)] ${embedded ? '' : 'shadow-[0_22px_55px_rgba(0,0,0,0.8)]'} backdrop-blur-[20px] relative ${embedded ? '' : 'max-h-[90vh]'} ${embedded ? '' : 'overflow-y-auto'}`}>
      {!embedded && (
        <button
          type="button"
          className="absolute top-[10px] right-3 bg-transparent border-none text-[#e5e7eb] text-base cursor-pointer hover:text-[#ffe66d] transition-colors"
          onClick={onClose}
        >
          ✕
        </button>
      )}

        <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">
          Admin Panel
        </div>
        <div className="text-[1.25rem] font-extrabold text-center uppercase tracking-[0.14em] text-[#ffe66d] mb-[0.7rem]">
          Participant Details
        </div>
        <div className="text-[0.85rem] text-center text-[#e5e7eb] mb-4">
          {sport ? sport.toUpperCase() : 'Sport'} • PCE, Purnea • Umang – 2026 Sports Fest
        </div>

        {loading && (
          <div className="text-center py-8 text-[#a5b4fc]">
            Loading participant details...
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && participants.length === 0 && (
          <div className="text-center py-8 text-[#a5b4fc]">
            No participants registered for this sport yet.
          </div>
        )}

        {!loading && !error && participants.length > 0 && (
          <div className="space-y-3">
            <div className="text-[0.9rem] text-[#cbd5ff] mb-4 text-center">
              Total Participants: <span className="text-[#ffe66d] font-bold">{participants.length}</span>
            </div>
            <div className="space-y-2">
              {participants.map((participant, index) => {
                const isExpanded = expandedParticipants.has(participant.reg_number)
                return (
                  <div
                    key={participant.reg_number}
                    className="border border-[rgba(148,163,184,0.3)] rounded-[12px] bg-[rgba(15,23,42,0.6)] overflow-hidden"
                  >
                    <div className="flex flex-col md:flex-row md:items-center">
                      <button
                        type="button"
                        onClick={() => toggleParticipant(participant.reg_number)}
                        className="flex-1 px-4 py-3 flex items-center justify-between hover:bg-[rgba(255,230,109,0.1)] transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[#ffe66d] text-lg">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          <span className="text-[#ffe66d] font-bold text-[0.85rem]">
                            {index + 1}.
                          </span>
                          <span className="text-[#e5e7eb] font-semibold text-[0.95rem]">
                            {participant.full_name}
                          </span>
                          <span className="text-[#a5b4fc] text-[0.8rem]">
                            ({participant.reg_number})
                          </span>
                        </div>
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClick(participant)
                          }}
                          disabled={deleting}
                          className={`self-start mt-2 mb-2 ml-4 md:mt-0 md:mb-0 md:ml-2 md:mr-2 md:self-auto px-4 py-1.5 rounded-[8px] text-[0.8rem] font-semibold uppercase tracking-[0.05em] transition-all ${
                            deleting
                              ? 'bg-[rgba(239,68,68,0.3)] text-[rgba(239,68,68,0.6)] cursor-not-allowed'
                              : 'bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer hover:shadow-[0_4px_12px_rgba(239,68,68,0.4)] hover:-translate-y-0.5'
                          }`}
                          title="Remove Participation"
                        >
                          {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-[rgba(148,163,184,0.2)]">
                        <div className="text-[#cbd5ff] text-[0.85rem] ml-6 space-y-1">
                          <div>Department: <span className="text-[#e5e7eb]">{participant.department_branch}</span></div>
                          <div>Year: <span className="text-[#e5e7eb]">{participant.year}</span></div>
                          <div>Gender: <span className="text-[#e5e7eb]">{participant.gender}</span></div>
                          <div>Mobile: <span className="text-[#e5e7eb]">{participant.mobile_number}</span></div>
                          <div>Email: <span className="text-[#e5e7eb]">{participant.email_id}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-full border border-[rgba(148,163,184,0.7)] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.9)]"
          >
            Close
          </button>
        </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && participantToDelete && (
        <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 bg-[rgba(0,0,0,0.75)] flex items-center justify-center z-[300]`}>
          <div className="max-w-[420px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative">
            <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">
              Confirm Deletion
            </div>
            <div className="text-[1.1rem] font-extrabold text-center text-[#ffe66d] mb-4">
              Remove Participation
            </div>
            <div className="text-center text-[#e5e7eb] mb-6">
              Are you sure you want to remove <span className="font-semibold text-[#ffe66d]">{participantToDelete.full_name}</span>'s participation in <span className="font-semibold text-[#ffe66d]">{sport}</span>?
              <br />
              <span className="text-[0.9rem] text-red-400 mt-2 block">This action cannot be undone.</span>
            </div>
            <div className="flex gap-[0.6rem] mt-[0.8rem]">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 rounded-full border-none py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white shadow-[0_10px_24px_rgba(239,68,68,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(239,68,68,0.75)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Removing...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={deleting}
                className="flex-1 rounded-full border border-[rgba(148,163,184,0.7)] py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.9)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )

  if (embedded) {
    return content
  }

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4"
    >
      {content}
    </div>
  )
}

export default ParticipantDetailsModal

