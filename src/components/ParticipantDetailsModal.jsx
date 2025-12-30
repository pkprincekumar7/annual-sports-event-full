import { useState, useEffect, useRef } from 'react'
import { Modal, Button, ConfirmationDialog, LoadingSpinner, ErrorMessage, EmptyState } from './ui'
import { useApi, useModal, useEventYearWithFallback } from '../hooks'
import { fetchWithAuth } from '../utils/api'
import { clearIndividualParticipationCaches } from '../utils/cacheHelpers'
import logger from '../utils/logger'
import { EVENT_INFO } from '../constants/app'
import { computeYearDisplay } from '../utils/yearHelpers'

function ParticipantDetailsModal({ isOpen, onClose, sport, loggedInUser, onStatusPopup, embedded = false, selectedYear }) {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedParticipants, setExpandedParticipants] = useState(new Set())
  const [participantToDelete, setParticipantToDelete] = useState(null)
  const currentSportRef = useRef(null)
  const abortControllerRef = useRef(null)
  const { loading: deleting, execute } = useApi()
  const eventYear = useEventYearWithFallback(selectedYear)
  const deleteConfirmModal = useModal(false)

  useEffect(() => {
    if (!isOpen || !sport) {
      // Reset state when modal closes
      setParticipants([])
      setExpandedParticipants(new Set())
      setError(null)
      deleteConfirmModal.close()
      setParticipantToDelete(null)
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
      const url = `/api/participants/${encodedSport}${eventYear ? `?year=${eventYear}` : ''}`
      // Fetching participants for sport
      
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
      // Participant data received

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
    deleteConfirmModal.open()
  }

  const handleConfirmDelete = async () => {
    if (!participantToDelete) return

    deleteConfirmModal.close()
    try {
      await execute(
        () => fetchWithAuth('/api/remove-participation', {
          method: 'DELETE',
          body: JSON.stringify({
            reg_number: participantToDelete.reg_number,
            sport: sport,
            event_year: eventYear,
          }),
        }),
        {
          onSuccess: (data) => {
            if (onStatusPopup) {
              onStatusPopup(
                `✅ ${participantToDelete.full_name}'s participation in ${sport} has been removed!`,
                'success',
                3000
              )
            }
            // Clear cache before refreshing to ensure we get fresh data
            clearIndividualParticipationCaches(sport, eventYear)
            // Remove deleted participant from expanded participants if it was expanded
            setExpandedParticipants(prev => {
              const newSet = new Set(prev)
              newSet.delete(participantToDelete.reg_number)
              return newSet
            })
            // Refresh the participants list (no signal needed for manual refresh)
            fetchParticipantDetails(null)
            setParticipantToDelete(null)
          },
          onError: (err) => {
            // The useApi hook extracts the error message from the API response
            const errorMessage = err?.message || err?.error || 'Error removing participation. Please try again.'
            if (onStatusPopup) {
              onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            }
            setParticipantToDelete(null)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      // Don't show duplicate error message - onError should have handled it
      logger.error('Error removing participation:', err)
      setParticipantToDelete(null)
      setParticipantToDelete(null)
    }
  }

  const handleCancelDelete = () => {
    deleteConfirmModal.close()
    setParticipantToDelete(null)
  }

  const isAdmin = loggedInUser?.reg_number === 'admin'

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Participant Details"
        subtitle={sport ? `${sport.toUpperCase()} • ${EVENT_INFO.fullName}` : undefined}
        embedded={embedded}
        maxWidth="max-w-[700px]"
      >
        {loading && (
          <LoadingSpinner message="Loading participant details..." />
        )}

        {error && (
          <ErrorMessage message={error} />
        )}

        {!loading && !error && participants.length === 0 && (
          <EmptyState message="No participants registered for this sport yet." className="py-8" />
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
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClick(participant)
                          }}
                          disabled={deleting}
                          variant="danger"
                          className="self-start mt-2 mb-2 ml-4 md:mt-0 md:mb-0 md:ml-2 md:mr-2 md:self-auto px-4 py-1.5 text-[0.8rem] font-semibold uppercase tracking-[0.05em] rounded-[8px]"
                          title="Remove Participation"
                        >
                          {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-[rgba(148,163,184,0.2)]">
                        <div className="text-[#cbd5ff] text-[0.85rem] ml-6 space-y-1">
                          <div>Department: <span className="text-[#e5e7eb]">{participant.department_branch}</span></div>
                          <div>Year: <span className="text-[#e5e7eb]">{participant.year || (participant.year_of_admission ? computeYearDisplay(participant.year_of_admission, eventYear) : '')}</span></div>
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
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmModal.isOpen && participantToDelete !== null}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Remove Participation"
        message={
          participantToDelete ? (
            <>
              Are you sure you want to remove <span className="font-semibold text-[#ffe66d]">{participantToDelete.full_name}</span>'s participation in <span className="font-semibold text-[#ffe66d]">{sport}</span>?
              <br />
              <span className="text-[0.9rem] text-red-400 mt-2 block">This action cannot be undone.</span>
            </>
          ) : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
        embedded={embedded}
      />
    </>
  )
}

export default ParticipantDetailsModal

