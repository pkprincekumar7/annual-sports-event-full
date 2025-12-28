import { useState, useEffect } from 'react'
import { fetchWithAuth, clearCache } from '../utils/api'
import logger from '../utils/logger'

function EventScheduleModal({ isOpen, onClose, sport, sportType, loggedInUser, onStatusPopup, embedded = false }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [expandedMatches, setExpandedMatches] = useState(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingMatchId, setDeletingMatchId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Form state
  const [matchType, setMatchType] = useState('league')
  const [teamOne, setTeamOne] = useState('')
  const [teamTwo, setTeamTwo] = useState('')
  const [playerOne, setPlayerOne] = useState('')
  const [playerTwo, setPlayerTwo] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [teamsList, setTeamsList] = useState([])
  const [playersList, setPlayersList] = useState([])
  const [allPlayersList, setAllPlayersList] = useState([]) // Store all players for gender filtering
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [updatingMatchId, setUpdatingMatchId] = useState(null) // Track which match is being updated
  const [updatingStatus, setUpdatingStatus] = useState(false) // Track status update in progress
  const [updatingWinner, setUpdatingWinner] = useState(false) // Track winner update in progress
  
  const isAdmin = loggedInUser?.reg_number === 'admin'

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
      setShowDeleteConfirm(false)
      setTeamOne('')
      setTeamTwo('')
      setPlayerOne('')
      setPlayerTwo('')
      setMatchDate('')
      setAllPlayersList([])
      setUpdatingMatchId(null)
      setUpdatingStatus(false)
      setUpdatingWinner(false)
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
    setShowDeleteConfirm(true)
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

    setUpdatingStatus(true)
    setUpdatingMatchId(matchId)
    
    try {
      const response = await fetchWithAuth(`/api/event-schedule/${matchId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const clonedResponse = response.clone()
        const errorText = await clonedResponse.text().catch(() => 'Unable to read error text')
        logger.error(`HTTP error! status: ${response.status}, response: ${errorText}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        if (onStatusPopup) {
          onStatusPopup(`✅ Match status updated to ${newStatus}!`, 'success', 2500)
        }
        // Clear cache and refresh matches
        const encodedSport = encodeURIComponent(sport)
        clearCache(`/api/event-schedule/${encodedSport}`)
        fetchMatches()
      } else {
        const errorMessage = data.error || 'Error updating match status. Please try again.'
        if (onStatusPopup) {
          onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
        }
      }
    } catch (err) {
      logger.error('Error updating match status:', err)
      if (onStatusPopup) {
        onStatusPopup('❌ Error updating match status. Please try again.', 'error', 2500)
      }
    } finally {
      setUpdatingStatus(false)
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

    setUpdatingWinner(true)
    setUpdatingMatchId(matchId)
    
    try {
      const response = await fetchWithAuth(`/api/event-schedule/${matchId}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          winner: winnerName,
          status: 'completed' // Ensure status is completed when winner is set
        }),
      })

      if (!response.ok) {
        const clonedResponse = response.clone()
        const errorText = await clonedResponse.text().catch(() => 'Unable to read error text')
        logger.error(`HTTP error! status: ${response.status}, response: ${errorText}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        if (onStatusPopup) {
          onStatusPopup(`✅ Winner updated successfully!`, 'success', 2500)
        }
        // Clear cache and refresh matches
        const encodedSport = encodeURIComponent(sport)
        clearCache(`/api/event-schedule/${encodedSport}`)
        fetchMatches()
      } else {
        const errorMessage = data.error || 'Error updating winner. Please try again.'
        if (onStatusPopup) {
          onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
        }
      }
    } catch (err) {
      logger.error('Error updating winner:', err)
      if (onStatusPopup) {
        onStatusPopup('❌ Error updating winner. Please try again.', 'error', 2500)
      }
    } finally {
      setUpdatingWinner(false)
      setUpdatingMatchId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingMatchId) return

    try {
      const response = await fetchWithAuth(`/api/event-schedule/${deletingMatchId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        // Clone response to read error text without consuming the original
        const clonedResponse = response.clone()
        const errorText = await clonedResponse.text().catch(() => 'Unable to read error text')
        logger.error(`HTTP error! status: ${response.status}, response: ${errorText}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        if (onStatusPopup) {
          onStatusPopup('✅ Match deleted successfully!', 'success', 2500)
        }
        // Clear cache for event-schedule endpoint to ensure fresh data
        const encodedSport = encodeURIComponent(sport)
        clearCache(`/api/event-schedule/${encodedSport}`)
        fetchMatches()
        setDeletingMatchId(null)
        setShowDeleteConfirm(false)
      } else {
        const errorMessage = data.error || 'Error deleting match. Please try again.'
        if (onStatusPopup) {
          onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
        }
      }
    } catch (err) {
      logger.error('Error deleting match:', err)
      if (onStatusPopup) {
        onStatusPopup('❌ Error deleting match. Please try again.', 'error', 2500)
      }
    }
  }

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
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

    setSubmitting(true)
    try {
      const response = await fetchWithAuth('/api/event-schedule', {
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
      })

      if (!response.ok) {
        // Clone response to read error text without consuming the original
        const clonedResponse = response.clone()
        const errorText = await clonedResponse.text().catch(() => 'Unable to read error text')
        logger.error(`HTTP error! status: ${response.status}, response: ${errorText}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
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
      } else {
        const errorMessage = data.error || 'Error scheduling match. Please try again.'
        if (onStatusPopup) {
          onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
        }
      }
    } catch (err) {
      logger.error('Error scheduling match:', err)
      if (onStatusPopup) {
        onStatusPopup('❌ Error scheduling match. Please try again.', 'error', 2500)
      }
    } finally {
      setSubmitting(false)
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

  if (!isOpen) return null

  const content = (
    <div className={`${embedded ? 'w-full' : 'max-w-[900px] w-full'} bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] ${embedded ? 'px-0 py-0' : 'px-[1.4rem] py-[1.6rem] pb-[1.5rem]'} border border-[rgba(255,255,255,0.12)] ${embedded ? '' : 'shadow-[0_22px_55px_rgba(0,0,0,0.8)]'} backdrop-blur-[20px] relative ${embedded ? '' : 'max-h-[90vh]'} ${embedded ? '' : 'overflow-y-auto'}`}>
      {!embedded && (
        <button
          type="button"
          className="absolute top-[10px] right-3 bg-transparent border-none text-[#e5e7eb] text-base cursor-pointer hover:text-[#ffe66d] transition-colors"
          onClick={onClose}
        >
          ✕
        </button>
      )}

      <div className={embedded ? 'px-[1.4rem] py-[1.6rem]' : ''}>
        <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">
          {isAdmin ? 'Admin Panel' : 'Event Schedule'}
        </div>
        <div className="text-[1.25rem] font-extrabold text-center uppercase tracking-[0.14em] text-[#ffe66d] mb-[0.7rem]">
          {sport} - Event Schedule
        </div>
        <div className="text-[0.85rem] text-center text-[#e5e7eb] mb-4">
          PCE, Purnea • Umang – 2026 Sports Fest
        </div>

        {isAdmin && !showAddForm && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={handleAddMatch}
              className="px-4 py-2 bg-[rgba(34,197,94,0.9)] hover:bg-[rgba(34,197,94,1)] text-white text-[0.85rem] font-bold rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Add Match
            </button>
          </div>
        )}

        {showAddForm && isAdmin && (
          <div className="mb-6 p-4 bg-[rgba(255,255,255,0.05)] rounded-lg border border-[rgba(255,255,255,0.1)]">
            <div className="text-[0.9rem] font-bold text-[#ffe66d] mb-3">Schedule New Match</div>
            <form onSubmit={handleSubmitMatch}>
              <div className="mb-3">
                <label className="block text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                  Match Type
                </label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value)}
                  className="w-full px-3 py-2 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-lg text-[#e5e7eb] focus:outline-none focus:border-[#ffe66d]"
                  required
                >
                  <option value="league">League</option>
                  <option value="knockout">Knockout</option>
                </select>
              </div>

              {sportType === 'team' ? (
                <>
                  <div className="mb-3">
                    <label className="block text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                      Team One
                    </label>
                    <select
                      value={teamOne}
                      onChange={(e) => {
                        setTeamOne(e.target.value)
                        // Reset team two if same team selected
                        if (e.target.value === teamTwo) {
                          setTeamTwo('')
                        }
                      }}
                      className="w-full px-3 py-2 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-lg text-[#e5e7eb] focus:outline-none focus:border-[#ffe66d]"
                      required
                      disabled={loadingOptions}
                    >
                      <option value="">Select Team</option>
                      {teamsList.filter(team => team !== teamTwo).map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="block text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                      Team Two
                    </label>
                    <select
                      value={teamTwo}
                      onChange={(e) => {
                        setTeamTwo(e.target.value)
                        // Reset team one if same team selected
                        if (e.target.value === teamOne) {
                          setTeamOne('')
                        }
                      }}
                      className="w-full px-3 py-2 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-lg text-[#e5e7eb] focus:outline-none focus:border-[#ffe66d]"
                      required
                      disabled={loadingOptions}
                    >
                      <option value="">Select Team</option>
                      {teamsList.filter(team => team !== teamOne).map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="block text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                      Player One
                    </label>
                    <select
                      value={playerOne}
                      onChange={(e) => {
                        const newPlayerOne = e.target.value
                        setPlayerOne(newPlayerOne)
                        // Reset player two if same player selected
                        if (newPlayerOne === playerTwo) {
                          setPlayerTwo('')
                        }
                      }}
                      className="w-full px-3 py-2 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-lg text-[#e5e7eb] focus:outline-none focus:border-[#ffe66d]"
                      required
                      disabled={loadingOptions}
                    >
                      <option value="">Select Player</option>
                      {(() => {
                        // If player two is selected first, use playersList (filtered by gender)
                        if (playerTwo && !playerOne) {
                          return playersList
                            .filter(player => player.reg_number !== playerTwo)
                            .map((player) => (
                              <option key={player.reg_number} value={player.reg_number}>
                                {player.full_name} ({player.reg_number})
                              </option>
                            ))
                        }
                        // Otherwise, show all players except player two
                        return allPlayersList
                          .filter(player => player.reg_number !== playerTwo)
                          .map((player) => (
                            <option key={player.reg_number} value={player.reg_number}>
                              {player.full_name} ({player.reg_number})
                            </option>
                          ))
                      })()}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="block text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                      Player Two
                    </label>
                    <select
                      value={playerTwo}
                      onChange={(e) => {
                        setPlayerTwo(e.target.value)
                        // Reset player one if same player selected
                        if (e.target.value === playerOne) {
                          setPlayerOne('')
                        }
                      }}
                      className="w-full px-3 py-2 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-lg text-[#e5e7eb] focus:outline-none focus:border-[#ffe66d]"
                      required
                      disabled={loadingOptions}
                    >
                      <option value="">Select Player</option>
                      {playersList
                        .filter(player => player.reg_number !== playerOne)
                        .map((player) => (
                        <option key={player.reg_number} value={player.reg_number}>
                          {player.full_name} ({player.reg_number})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="mb-4">
                <label className="block text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                  Match Date & Time
                </label>
                <input
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
                  className="w-full px-3 py-2 bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] rounded-lg text-[#e5e7eb] focus:outline-none focus:border-[#ffe66d]"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-2 py-2 bg-[rgba(34,197,94,0.9)] hover:bg-[rgba(34,197,94,1)] text-white text-[0.85rem] font-bold rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Scheduling...' : 'Schedule'}
                </button>
                <button
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
                  className="px-4 py-2 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-[#e5e7eb] text-[0.85rem] font-bold rounded-lg transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center text-[#e5e7eb] py-8">Loading matches...</div>
        ) : matches.length === 0 ? (
          <div className="text-center text-[#e5e7eb] py-8">No matches scheduled yet.</div>
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteClick(match._id)
                                }}
                                disabled={updatingStatus || updatingWinner}
                                className="px-2 py-1.5 rounded-[8px] text-[0.8rem] font-semibold uppercase tracking-[0.05em] transition-all bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer hover:shadow-[0_4px_12px_rgba(239,68,68,0.4)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Remove
                              </button>
                              {!isMatchInFuture(match.match_date) && (
                                <select
                                  value={match.status || 'scheduled'}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    handleStatusChange(match._id, e.target.value)
                                  }}
                                  disabled={updatingStatus || updatingMatchId === match._id}
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-2 py-1.5 rounded-[8px] text-[0.8rem] font-semibold uppercase tracking-[0.05em] bg-[rgba(59,130,246,0.8)] hover:bg-[rgba(59,130,246,1)] text-white cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Update Result"
                                >
                                  <option value="scheduled">Scheduled</option>
                                  <option value="completed">Completed</option>
                                  <option value="draw">Draw</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
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
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleWinnerSelect(match._id, match.team_one)
                                  }}
                                  disabled={updatingWinner || updatingMatchId === match._id}
                                  className="px-2 py-1 rounded text-[0.75rem] font-bold bg-[rgba(34,197,94,0.8)] hover:bg-[rgba(34,197,94,1)] text-white transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Winner
                                </button>
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
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const winnerName = `${match.player_one.name} (${match.player_one.reg_number})`
                                    handleWinnerSelect(match._id, winnerName)
                                  }}
                                  disabled={updatingWinner || updatingMatchId === match._id}
                                  className="px-2 py-1 rounded text-[0.75rem] font-bold bg-[rgba(34,197,94,0.8)] hover:bg-[rgba(34,197,94,1)] text-white transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Winner
                                </button>
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

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-[rgba(0,0,0,0.8)] flex items-center justify-center z-[300]">
            <div className="bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] p-6 border border-[rgba(255,255,255,0.12)] max-w-[400px] w-full mx-4">
              <div className="text-[1.1rem] font-bold text-[#ffe66d] mb-3 text-center">
                Confirm Delete
              </div>
              <div className="text-[0.9rem] text-[#e5e7eb] mb-4 text-center">
                Are you sure you want to delete this match? This action cannot be undone.
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 px-2 py-2 bg-[rgba(239,68,68,0.8)] hover:bg-[rgba(239,68,68,1)] text-white text-[0.85rem] font-bold rounded-lg transition-all duration-200"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="flex-1 px-4 py-2 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-[#e5e7eb] text-[0.85rem] font-bold rounded-lg transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (embedded) {
    return content
  }

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4">
      {content}
    </div>
  )
}

export default EventScheduleModal

