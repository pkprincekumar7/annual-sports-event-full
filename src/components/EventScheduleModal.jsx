import { useState, useEffect } from 'react'
import { Modal, Button, Input, ConfirmationDialog, LoadingSpinner, ErrorMessage, EmptyState } from './ui'
import { useApi, useModal } from '../hooks'
import { fetchWithAuth, clearCache } from '../utils/api'
import logger from '../utils/logger'
import { EVENT_INFO } from '../constants/app'

function EventScheduleModal({ isOpen, onClose, sport, sportType, loggedInUser, onStatusPopup, embedded = false }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [expandedMatches, setExpandedMatches] = useState(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingMatchId, setDeletingMatchId] = useState(null)
  
  // Form state
  const [matchType, setMatchType] = useState('league')
  const [teamOne, setTeamOne] = useState('')
  const [teamTwo, setTeamTwo] = useState('')
  const [playerOne, setPlayerOne] = useState('')
  const [playerTwo, setPlayerTwo] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [teamsList, setTeamsList] = useState([])
  const [playersList, setPlayersList] = useState([])
  const [allPlayersList, setAllPlayersList] = useState([]) // Store all players for gender filtering
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [updatingMatchId, setUpdatingMatchId] = useState(null) // Track which match is being updated
  
  const isAdmin = loggedInUser?.reg_number === 'admin'
  const { loading: submitting, execute: executeSubmit } = useApi()
  const { loading: updatingStatus, execute: executeStatusUpdate } = useApi()
  const { loading: updatingWinner, execute: executeWinnerUpdate } = useApi()
  const { loading: deleting, execute: executeDelete } = useApi()
  const deleteConfirmModal = useModal(false)

  // Helper function to check if match date is in the future
  const isMatchInFuture = (matchDate) => {
    if (!matchDate) return false
    const matchDateObj = new Date(matchDate)
    const now = new Date()
    // Compare dates (ignore time for date comparison)
    matchDateObj.setHours(0, 0, 0, 0)
    now.setHours(0, 0, 0, 0)
    return matchDateObj > now
  }

  useEffect(() => {
    if (!isOpen || !sport) {
      setMatches([])
      setExpandedMatches(new Set())
      setShowAddForm(false)
      setDeletingMatchId(null)
      deleteConfirmModal.close()
      setTeamOne('')
      setTeamTwo('')
      setPlayerOne('')
      setPlayerTwo('')
      setMatchDate('')
      setAllPlayersList([])
      setUpdatingMatchId(null)
      return
    }

    // Fetch data when modal opens or sport changes
    const loadData = async () => {
      try {
        await fetchMatches()
        if (isAdmin) {
          await fetchTeamsPlayers()
        }
      } catch (err) {
        // Errors are already handled in fetchMatches and fetchTeamsPlayers
        // This catch prevents unhandled promise rejection
        logger.error('Error in loadData:', err)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sport])
  
  // Reset form when modal closes or sport changes
  useEffect(() => {
    if (!isOpen || !showAddForm) {
      setTeamOne('')
      setTeamTwo('')
      setPlayerOne('')
      setPlayerTwo('')
      setMatchDate('')
    }
  }, [isOpen, showAddForm])

  const fetchMatches = async () => {
    if (!sport) return
    
    setLoading(true)
    try {
      const encodedSport = encodeURIComponent(sport)
      const response = await fetchWithAuth(`/api/event-schedule/${encodedSport}`)
      
      if (!response.ok) {
        // Clone response to read error text without consuming the original
        const clonedResponse = response.clone()
        const errorText = await clonedResponse.text().catch(() => 'Unable to read error text')
        logger.error(`HTTP error! status: ${response.status}, response: ${errorText}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.success) {
        setMatches(data.matches || [])
      } else {
        setMatches([])
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        logger.api('Request aborted for fetchMatches')
        return
      }
      logger.error('Error fetching matches:', err)
      setMatches([])
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamsPlayers = async () => {
    if (!sport) return
    
    setLoadingOptions(true)
    try {
      const encodedSport = encodeURIComponent(sport)
      logger.api(`Fetching teams/players for sport: ${sport} (encoded: ${encodedSport})`)
      const response = await fetchWithAuth(`/api/event-schedule/${encodedSport}/teams-players`)
      
      if (!response.ok) {
        // Clone response to read error text without consuming the original
        const clonedResponse = response.clone()
        const errorText = await clonedResponse.text().catch(() => 'Unable to read error text')
        logger.error(`HTTP error! status: ${response.status}, response: ${errorText}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      logger.api('Teams/players response:', data)
      if (data.success) {
        setTeamsList(data.teams || [])
        // Store all players for gender filtering
        if (data.players) {
          setAllPlayersList(data.players || [])
          // Initially show all players, will filter based on selection
          setPlayersList(data.players || [])
        } else {
          setAllPlayersList([])
          setPlayersList([])
        }
        logger.api(`Set teams list (${(data.teams || []).length} items):`, data.teams)
        logger.api(`Set players list (${(data.players || []).length} items):`, data.players)
      } else {
        logger.warn('Failed to fetch teams/players:', data.error)
        setTeamsList([])
        setPlayersList([])
        setAllPlayersList([])
      }
    } catch (err) {
      logger.error('Error fetching teams/players:', err)
      setTeamsList([])
      setPlayersList([])
      setAllPlayersList([])
    } finally {
      setLoadingOptions(false)
    }
  }
  
  // Filter players for dropdowns based on selected player's gender
  // This updates playersList which is used by Player Two dropdown
  useEffect(() => {
    if (sportType !== 'team' && allPlayersList.length > 0) {
      if (playerOne) {
        // Player One is selected - filter Player Two dropdown by same gender
        const selectedPlayer = allPlayersList.find(p => p.reg_number === playerOne)
        if (selectedPlayer && selectedPlayer.gender) {
          const filteredPlayers = allPlayersList.filter(p => 
            p.reg_number !== playerOne && p.gender === selectedPlayer.gender
          )
          setPlayersList(filteredPlayers)
        } else {
          setPlayersList(allPlayersList.filter(p => p.reg_number !== playerOne))
        }
      } else if (playerTwo && !playerOne) {
        // Player Two is selected first - filter Player One dropdown by same gender
        const selectedPlayer = allPlayersList.find(p => p.reg_number === playerTwo)
        if (selectedPlayer && selectedPlayer.gender) {
          const filteredPlayers = allPlayersList.filter(p => 
            p.reg_number !== playerTwo && p.gender === selectedPlayer.gender
          )
          setPlayersList(filteredPlayers)
        } else {
          setPlayersList(allPlayersList.filter(p => p.reg_number !== playerTwo))
        }
      } else {
        // No selection yet, show all players
        setPlayersList(allPlayersList)
      }
    }
  }, [playerOne, playerTwo, allPlayersList, sportType])

  const toggleMatch = (matchId) => {
    const newExpanded = new Set(expandedMatches)
    if (newExpanded.has(matchId)) {
      newExpanded.delete(matchId)
    } else {
      newExpanded.add(matchId)
    }
    setExpandedMatches(newExpanded)
  }

  const handleDeleteClick = (matchId) => {
    setDeletingMatchId(matchId)
    deleteConfirmModal.open()
  }

  const handleStatusChange = async (matchId, newStatus) => {
    if (!newStatus || newStatus === '') {
      return
    }

    // Find the match to check if it's in the future
    const match = matches.find(m => m._id === matchId)
    if (match && isMatchInFuture(match.match_date)) {
      if (onStatusPopup) {
        onStatusPopup('❌ Cannot update status for future matches. Please wait until the match date.', 'error', 3000)
      }
      return
    }

    setUpdatingMatchId(matchId)
    
    try {
      await executeStatusUpdate(
        () => fetchWithAuth(`/api/event-schedule/${matchId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus }),
        }),
        {
          onSuccess: (data) => {
            if (onStatusPopup) {
              onStatusPopup(`✅ Match status updated to ${newStatus}!`, 'success', 2500)
            }
            // Clear cache and refresh matches
            const encodedSport = encodeURIComponent(sport)
            clearCache(`/api/event-schedule/${encodedSport}`)
            fetchMatches()
            setUpdatingMatchId(null)
          },
          onError: (err) => {
            const errorMessage = err.message || 'Error updating match status. Please try again.'
            if (onStatusPopup) {
              onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            }
            setUpdatingMatchId(null)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      logger.error('Error updating match status:', err)
      if (onStatusPopup) {
        onStatusPopup('❌ Error updating match status. Please try again.', 'error', 2500)
      }
      setUpdatingMatchId(null)
    }
  }

  const handleWinnerSelect = async (matchId, winnerName) => {
    if (!winnerName) {
      return
    }

    // Find the match to check if it's in the future
    const match = matches.find(m => m._id === matchId)
    if (match && isMatchInFuture(match.match_date)) {
      if (onStatusPopup) {
        onStatusPopup('❌ Cannot declare winner for future matches. Please wait until the match date.', 'error', 3000)
      }
      return
    }

    setUpdatingMatchId(matchId)
    
    try {
      await executeWinnerUpdate(
        () => fetchWithAuth(`/api/event-schedule/${matchId}`, {
          method: 'PUT',
          body: JSON.stringify({ 
            winner: winnerName,
            status: 'completed' // Ensure status is completed when winner is set
          }),
        }),
        {
          onSuccess: (data) => {
            if (onStatusPopup) {
              onStatusPopup(`✅ Winner updated successfully!`, 'success', 2500)
            }
            // Clear cache and refresh matches
            const encodedSport = encodeURIComponent(sport)
            clearCache(`/api/event-schedule/${encodedSport}`)
            fetchMatches()
            setUpdatingMatchId(null)
          },
          onError: (err) => {
            const errorMessage = err.message || 'Error updating winner. Please try again.'
            if (onStatusPopup) {
              onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            }
            setUpdatingMatchId(null)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      logger.error('Error updating winner:', err)
      if (onStatusPopup) {
        onStatusPopup('❌ Error updating winner. Please try again.', 'error', 2500)
      }
      setUpdatingMatchId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingMatchId) return

    deleteConfirmModal.close()
    
    try {
      await executeDelete(
        () => fetchWithAuth(`/api/event-schedule/${deletingMatchId}`, {
          method: 'DELETE',
        }),
        {
          onSuccess: (data) => {
            if (onStatusPopup) {
              onStatusPopup('✅ Match deleted successfully!', 'success', 2500)
            }
            // Clear cache for event-schedule endpoint to ensure fresh data
            const encodedSport = encodeURIComponent(sport)
            clearCache(`/api/event-schedule/${encodedSport}`)
            fetchMatches()
            setDeletingMatchId(null)
          },
          onError: (err) => {
            const errorMessage = err.message || 'Error deleting match. Please try again.'
            if (onStatusPopup) {
              onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            }
            setDeletingMatchId(null)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      logger.error('Error deleting match:', err)
      if (onStatusPopup) {
        onStatusPopup('❌ Error deleting match. Please try again.', 'error', 2500)
      }
      setDeletingMatchId(null)
    }
  }

  const handleCancelDelete = () => {
    deleteConfirmModal.close()
    setDeletingMatchId(null)
  }

  const handleAddMatch = () => {
    setShowAddForm(true)
    // Reset form
    setMatchType('league')
    setTeamOne('')
    setTeamTwo('')
    setPlayerOne('')
    setPlayerTwo('')
    setMatchDate('')
  }

  const handleSubmitMatch = async (e) => {
    e.preventDefault()
    
    if (!matchDate) {
      if (onStatusPopup) {
        onStatusPopup('❌ Please select match date.', 'error', 2500)
      }
      return
    }

    // Validate match date - must be today or after today
    const matchDateObj = new Date(matchDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day for comparison
    matchDateObj.setHours(0, 0, 0, 0)
    
    if (matchDateObj < today) {
      if (onStatusPopup) {
        onStatusPopup('❌ Match date must be today or a future date.', 'error', 2500)
      }
      return
    }

    if (sportType === 'team') {
      if (!teamOne || !teamTwo) {
        if (onStatusPopup) {
          onStatusPopup('❌ Please select both teams.', 'error', 2500)
        }
        return
      }
      if (teamOne === teamTwo) {
        if (onStatusPopup) {
          onStatusPopup('❌ Please select different teams.', 'error', 2500)
        }
        return
      }
    } else {
      if (!playerOne || !playerTwo) {
        if (onStatusPopup) {
          onStatusPopup('❌ Please select both players.', 'error', 2500)
        }
        return
      }
      if (playerOne === playerTwo) {
        if (onStatusPopup) {
          onStatusPopup('❌ Please select different players.', 'error', 2500)
        }
        return
      }
      
      // Validate gender match for non-team events
      const player1Data = allPlayersList.find(p => p.reg_number === playerOne)
      const player2Data = allPlayersList.find(p => p.reg_number === playerTwo)
      
      if (player1Data && player2Data && player1Data.gender && player2Data.gender) {
        if (player1Data.gender !== player2Data.gender) {
          if (onStatusPopup) {
            onStatusPopup(`❌ Gender mismatch: Both players must have the same gender. Player one is ${player1Data.gender}, player two is ${player2Data.gender}.`, 'error', 4000)
          }
          return
        }
      }
    }

    try {
      await executeSubmit(
        () => fetchWithAuth('/api/event-schedule', {
          method: 'POST',
          body: JSON.stringify({
            match_type: matchType,
            sport: sport,
            sport_type: sportType,
            team_one: sportType === 'team' ? teamOne : null,
            team_two: sportType === 'team' ? teamTwo : null,
            player_one: sportType !== 'team' ? playerOne : null,
            player_two: sportType !== 'team' ? playerTwo : null,
            match_date: matchDate,
          }),
        }),
        {
          onSuccess: (data) => {
            if (onStatusPopup) {
              onStatusPopup(`✅ ${data.message || 'Match scheduled successfully!'}`, 'success', 2500)
            }
            setShowAddForm(false)
            // Clear cache for event-schedule endpoint to ensure fresh data
            const encodedSport = encodeURIComponent(sport)
            clearCache(`/api/event-schedule/${encodedSport}`)
            fetchMatches()
            // Reset form
            setMatchType('league')
            setTeamOne('')
            setTeamTwo('')
            setPlayerOne('')
            setPlayerTwo('')
            setMatchDate('')
          },
          onError: (err) => {
            const errorMessage = err.message || 'Error scheduling match. Please try again.'
            if (onStatusPopup) {
              onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            }
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      logger.error('Error scheduling match:', err)
      if (onStatusPopup) {
        onStatusPopup('❌ Error scheduling match. Please try again.', 'error', 2500)
      }
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${sport} - Event Schedule`}
        subtitle={EVENT_INFO.fullName}
        embedded={embedded}
        maxWidth="max-w-[900px]"
      >
        {isAdmin && !showAddForm && (
          <div className="mb-4 flex justify-center">
            <Button
              type="button"
              onClick={handleAddMatch}
              variant="success"
              className="px-4 py-2 text-[0.85rem] font-bold rounded-lg"
            >
              Add Match
            </Button>
          </div>
        )}

        {showAddForm && isAdmin && (
          <div className="mb-6 p-4 bg-[rgba(255,255,255,0.05)] rounded-lg border border-[rgba(255,255,255,0.1)]">
            <div className="text-[0.9rem] font-bold text-[#ffe66d] mb-3">Schedule New Match</div>
            <form onSubmit={handleSubmitMatch}>
              <Input
                label="Match Type"
                type="select"
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
                required
                options={[
                  { value: 'league', label: 'League' },
                  { value: 'knockout', label: 'Knockout' },
                ]}
                className="mb-3"
              />

              {sportType === 'team' ? (
                <>
                  <Input
                    label="Team One"
                    type="select"
                    value={teamOne}
                    onChange={(e) => {
                      setTeamOne(e.target.value)
                      // Reset team two if same team selected
                      if (e.target.value === teamTwo) {
                        setTeamTwo('')
                      }
                    }}
                    required
                    disabled={loadingOptions}
                    options={[
                      { value: '', label: 'Select Team' },
                      ...teamsList.filter(team => team !== teamTwo).map((team) => ({
                        value: team,
                        label: team
                      }))
                    ]}
                    className="mb-3"
                  />
                  <Input
                    label="Team Two"
                    type="select"
                    value={teamTwo}
                    onChange={(e) => {
                      setTeamTwo(e.target.value)
                      // Reset team one if same team selected
                      if (e.target.value === teamOne) {
                        setTeamOne('')
                      }
                    }}
                    required
                    disabled={loadingOptions}
                    options={[
                      { value: '', label: 'Select Team' },
                      ...teamsList.filter(team => team !== teamOne).map((team) => ({
                        value: team,
                        label: team
                      }))
                    ]}
                    className="mb-3"
                  />
                </>
              ) : (
                <>
                  <Input
                    label="Player One"
                    type="select"
                    value={playerOne}
                    onChange={(e) => {
                      const newPlayerOne = e.target.value
                      setPlayerOne(newPlayerOne)
                      // Reset player two if same player selected
                      if (newPlayerOne === playerTwo) {
                        setPlayerTwo('')
                      }
                    }}
                    required
                    disabled={loadingOptions}
                    options={(() => {
                      const baseOptions = [{ value: '', label: 'Select Player' }]
                      // If player two is selected first, use playersList (filtered by gender)
                      if (playerTwo && !playerOne) {
                        return [
                          ...baseOptions,
                          ...playersList
                            .filter(player => player.reg_number !== playerTwo)
                            .map((player) => ({
                              value: player.reg_number,
                              label: `${player.full_name} (${player.reg_number})`
                            }))
                        ]
                      }
                      // Otherwise, show all players except player two
                      return [
                        ...baseOptions,
                        ...allPlayersList
                          .filter(player => player.reg_number !== playerTwo)
                          .map((player) => ({
                            value: player.reg_number,
                            label: `${player.full_name} (${player.reg_number})`
                          }))
                      ]
                    })()}
                    className="mb-3"
                  />
                  <Input
                    label="Player Two"
                    type="select"
                    value={playerTwo}
                    onChange={(e) => {
                      setPlayerTwo(e.target.value)
                      // Reset player one if same player selected
                      if (e.target.value === playerOne) {
                        setPlayerOne('')
                      }
                    }}
                    required
                    disabled={loadingOptions}
                    options={[
                      { value: '', label: 'Select Player' },
                      ...playersList
                        .filter(player => player.reg_number !== playerOne)
                        .map((player) => ({
                          value: player.reg_number,
                          label: `${player.full_name} (${player.reg_number})`
                        }))
                    ]}
                    className="mb-3"
                  />
                </>
              )}

              <Input
                label="Match Date & Time"
                type="datetime-local"
                value={matchDate}
                onChange={(e) => {
                  setMatchDate(e.target.value)
                  // Use setTimeout to blur after the value is set, which closes the date picker
                  setTimeout(() => {
                    e.target.blur()
                  }, 100)
                }}
                min={new Date().toISOString().slice(0, 16)}
                required
                className="mb-4"
              />

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  loading={submitting}
                  variant="success"
                  className="flex-1 px-2 py-2 text-[0.85rem] font-bold rounded-lg"
                >
                  {submitting ? 'Scheduling...' : 'Schedule'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setMatchType('league')
                    setTeamOne('')
                    setTeamTwo('')
                    setPlayerOne('')
                    setPlayerTwo('')
                    setMatchDate('')
                  }}
                  variant="secondary"
                  className="px-4 py-2 text-[0.85rem] font-bold rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <LoadingSpinner message="Loading matches..." />
        ) : matches.length === 0 ? (
          <EmptyState message="No matches scheduled yet." className="py-8" />
        ) : (
          <div className="space-y-2">
            {matches.map((match) => {
              const isExpanded = expandedMatches.has(match._id)
              return (
                <div
                  key={match._id}
                  className="bg-[rgba(255,255,255,0.05)] rounded-lg border border-[rgba(255,255,255,0.1)] overflow-hidden"
                >
                  <div
                    className="flex flex-col md:flex-row md:items-center md:justify-between p-3 cursor-pointer hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                    onClick={() => toggleMatch(match._id)}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[#ffe66d] font-bold">Match #{match.match_number}</span>
                      <span className="text-[0.75rem] text-[#cbd5ff] uppercase">
                        {match.match_type}
                      </span>
                      <span className="text-[0.75rem] text-[#e5e7eb]">
                        {formatDate(match.match_date)}
                      </span>
                      {match.status && (
                        <span className={`text-[0.75rem] px-2 py-1 rounded ${
                          match.status === 'completed' ? 'bg-[rgba(34,197,94,0.3)] text-[#86efac]' :
                          match.status === 'draw' ? 'bg-[rgba(251,191,36,0.3)] text-[#fde047]' :
                          match.status === 'cancelled' ? 'bg-[rgba(239,68,68,0.3)] text-[#fca5a5]' :
                          'bg-[rgba(59,130,246,0.3)] text-[#93c5fd]'
                        }`}>
                          {match.status}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 md:mt-0">
                      {isAdmin && (
                        <>
                          {match.status === 'scheduled' && (
                            <>
                              <Button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteClick(match._id)
                                }}
                                disabled={updatingStatus || updatingWinner}
                                variant="danger"
                                className="px-2 py-1.5 text-[0.8rem] font-semibold uppercase tracking-[0.05em] rounded-[8px]"
                              >
                                Remove
                              </Button>
                              {!isMatchInFuture(match.match_date) && (
                                <Input
                                  type="select"
                                  value={match.status || 'scheduled'}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    handleStatusChange(match._id, e.target.value)
                                  }}
                                  disabled={updatingStatus || updatingMatchId === match._id}
                                  onClick={(e) => e.stopPropagation()}
                                  title="Update Result"
                                  options={[
                                    { value: 'scheduled', label: 'Scheduled' },
                                    { value: 'completed', label: 'Completed' },
                                    { value: 'draw', label: 'Draw' },
                                    { value: 'cancelled', label: 'Cancelled' },
                                  ]}
                                  className="px-2 py-1.5 text-[0.8rem] font-semibold uppercase tracking-[0.05em] rounded-[8px] bg-[rgba(59,130,246,0.8)] hover:bg-[rgba(59,130,246,1)] text-white"
                                />
                              )}
                            </>
                          )}
                        </>
                      )}
                      <span className="text-[#e5e7eb]">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 border-t border-[rgba(148,163,184,0.2)]">
                      <div className="text-[#cbd5ff] text-[0.85rem] space-y-1.5">
                        <div>
                          <span className="text-[#ffe66d]">Match Number:</span>{' '}
                          <span className="text-[#e5e7eb]">{match.match_number || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[#ffe66d]">Match Type:</span>{' '}
                          <span className="text-[#e5e7eb] capitalize">{match.match_type || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[#ffe66d]">Sport Type:</span>{' '}
                          <span className="text-[#e5e7eb] capitalize">{match.sport_type || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[#ffe66d]">Match Date & Time:</span>{' '}
                          <span className="text-[#e5e7eb]">{formatDateTime(match.match_date)}</span>
                        </div>
                        <div>
                          <span className="text-[#ffe66d]">Status:</span>{' '}
                          <span className={`capitalize ${
                            match.status === 'completed' ? 'text-[#86efac]' :
                            match.status === 'draw' ? 'text-[#fde047]' :
                            match.status === 'cancelled' ? 'text-[#fca5a5]' :
                            'text-[#93c5fd]'
                          }`}>
                            {match.status || 'N/A'}
                          </span>
                        </div>
                        {match.sport_type === 'team' ? (
                          <>
                            <div className="flex items-center gap-2">
                              <div>
                                <span className="text-[#ffe66d]">Team One:</span>{' '}
                                <span className="text-[#e5e7eb]">{match.team_one || 'N/A'}</span>
                              </div>
                              {isAdmin && match.status === 'completed' && !match.winner && !isMatchInFuture(match.match_date) && (
                                <Button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleWinnerSelect(match._id, match.team_one)
                                  }}
                                  disabled={updatingWinner || updatingMatchId === match._id}
                                  variant="success"
                                  className="px-2 py-1 text-[0.75rem] font-bold rounded"
                                >
                                  Winner
                                </Button>
                              )}
                              {match.status === 'completed' && match.winner && (
                                <span className={`px-2 py-1 rounded text-[0.75rem] font-bold ${
                                  match.winner === match.team_one
                                    ? 'bg-[rgba(34,197,94,0.8)] text-white'
                                    : 'bg-[rgba(239,68,68,0.8)] text-white'
                                }`}>
                                  {match.winner === match.team_one ? 'Winner' : 'Loser'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div>
                                <span className="text-[#ffe66d]">Team Two:</span>{' '}
                                <span className="text-[#e5e7eb]">{match.team_two || 'N/A'}</span>
                              </div>
                              {isAdmin && match.status === 'completed' && !match.winner && !isMatchInFuture(match.match_date) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleWinnerSelect(match._id, match.team_two)
                                  }}
                                  disabled={updatingWinner || updatingMatchId === match._id}
                                  className="px-2 py-1 rounded text-[0.75rem] font-bold bg-[rgba(34,197,94,0.8)] hover:bg-[rgba(34,197,94,1)] text-white transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Winner
                                </button>
                              )}
                              {match.status === 'completed' && match.winner && (
                                <span className={`px-2 py-1 rounded text-[0.75rem] font-bold ${
                                  match.winner === match.team_two
                                    ? 'bg-[rgba(34,197,94,0.8)] text-white'
                                    : 'bg-[rgba(239,68,68,0.8)] text-white'
                                }`}>
                                  {match.winner === match.team_two ? 'Winner' : 'Loser'}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <div>
                                <span className="text-[#ffe66d]">Player One:</span>{' '}
                                <span className="text-[#e5e7eb]">
                                  {match.player_one && match.player_one.name
                                    ? `${match.player_one.name} (${match.player_one.reg_number})`
                                    : 'N/A'}
                                </span>
                              </div>
                              {isAdmin && match.status === 'completed' && !match.winner && match.player_one && match.player_one.name && !isMatchInFuture(match.match_date) && (
                                <Button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const winnerName = `${match.player_one.name} (${match.player_one.reg_number})`
                                    handleWinnerSelect(match._id, winnerName)
                                  }}
                                  disabled={updatingWinner || updatingMatchId === match._id}
                                  variant="success"
                                  className="px-2 py-1 text-[0.75rem] font-bold rounded"
                                >
                                  Winner
                                </Button>
                              )}
                              {match.status === 'completed' && match.winner && match.player_one && match.player_one.name && (
                                <span className={`px-2 py-1 rounded text-[0.75rem] font-bold ${
                                  match.winner === `${match.player_one.name} (${match.player_one.reg_number})`
                                    ? 'bg-[rgba(34,197,94,0.8)] text-white'
                                    : 'bg-[rgba(239,68,68,0.8)] text-white'
                                }`}>
                                  {match.winner === `${match.player_one.name} (${match.player_one.reg_number})` ? 'Winner' : 'Loser'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div>
                                <span className="text-[#ffe66d]">Player Two:</span>{' '}
                                <span className="text-[#e5e7eb]">
                                  {match.player_two && match.player_two.name
                                    ? `${match.player_two.name} (${match.player_two.reg_number})`
                                    : 'N/A'}
                                </span>
                              </div>
                              {isAdmin && match.status === 'completed' && !match.winner && match.player_two && match.player_two.name && !isMatchInFuture(match.match_date) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const winnerName = `${match.player_two.name} (${match.player_two.reg_number})`
                                    handleWinnerSelect(match._id, winnerName)
                                  }}
                                  disabled={updatingWinner || updatingMatchId === match._id}
                                  className="px-2 py-1 rounded text-[0.75rem] font-bold bg-[rgba(34,197,94,0.8)] hover:bg-[rgba(34,197,94,1)] text-white transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Winner
                                </button>
                              )}
                              {match.status === 'completed' && match.winner && match.player_two && match.player_two.name && (
                                <span className={`px-2 py-1 rounded text-[0.75rem] font-bold ${
                                  match.winner === `${match.player_two.name} (${match.player_two.reg_number})`
                                    ? 'bg-[rgba(34,197,94,0.8)] text-white'
                                    : 'bg-[rgba(239,68,68,0.8)] text-white'
                                }`}>
                                  {match.winner === `${match.player_two.name} (${match.player_two.reg_number})` ? 'Winner' : 'Loser'}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                        {match.winner && match.status !== 'completed' && (
                          <div>
                            <span className="text-[#ffe66d]">Winner:</span>{' '}
                            <span className="text-[#86efac] font-bold">{match.winner}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmModal.isOpen && deletingMatchId !== null}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Confirm Delete"
        message="Are you sure you want to delete this match? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
        embedded={embedded}
      />
    </>
  )
}

export default EventScheduleModal

