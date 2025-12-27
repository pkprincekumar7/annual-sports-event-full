import { useState, useEffect } from 'react'
import { fetchWithAuth } from '../utils/api'
import logger from '../utils/logger'

function TeamDetailsModal({ isOpen, onClose, sport, loggedInUser, onStatusPopup }) {
  const [teams, setTeams] = useState([])
  const [totalTeams, setTotalTeams] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expandedTeams, setExpandedTeams] = useState(new Set())
  const [error, setError] = useState(null)
  const [players, setPlayers] = useState([])
  const [editingPlayer, setEditingPlayer] = useState(null) // { team_name, old_reg_number }
  const [selectedReplacementPlayer, setSelectedReplacementPlayer] = useState('')
  const [updating, setUpdating] = useState(false)
  const [deletingTeam, setDeletingTeam] = useState(null) // team_name being deleted
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const isAdmin = loggedInUser?.reg_number === 'admin'
  const isCaptain = !isAdmin && loggedInUser?.captain_in && 
    Array.isArray(loggedInUser.captain_in) && 
    loggedInUser.captain_in.includes(sport)
  
  // Check if user is enrolled in this team event (non-captain participant)
  const isEnrolledInTeam = !isAdmin && !isCaptain && loggedInUser?.participated_in && 
    Array.isArray(loggedInUser.participated_in) &&
    loggedInUser.participated_in.some(p => 
      p.sport === sport && p.team_name
    )
  
  // User should see only their team if they are captain or enrolled participant
  const shouldShowOnlyUserTeam = isCaptain || isEnrolledInTeam

  useEffect(() => {
    if (!isOpen || !sport) {
      // Reset state when modal closes
      setTeams([])
      setTotalTeams(0)
      setExpandedTeams(new Set())
      setError(null)
      setEditingPlayer(null)
      setSelectedReplacementPlayer('')
      setDeletingTeam(null)
      setShowDeleteConfirm(false)
      return
    }

    let isMounted = true
    const abortController = new AbortController()

    const loadData = async () => {
      await fetchTeamDetails(abortController.signal)
      if (isAdmin && isMounted) {
        await fetchPlayers(abortController.signal)
      }
    }

    loadData()

    return () => {
      isMounted = false
      abortController.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sport, isCaptain, loggedInUser])

  const fetchPlayers = async (signal) => {
    try {
      const response = await fetchWithAuth('/api/players', { signal })
      const data = await response.json()
      if (data.success) {
        // Filter out admin user
        const filteredPlayers = (data.players || []).filter(
          p => p.reg_number !== 'admin'
        )
        setPlayers(filteredPlayers)
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      logger.error('Error fetching players:', err)
    }
  }

  const fetchTeamDetails = async (signal) => {
    if (!sport) {
      setError('Sport name is required')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      // URL encode the sport name to handle special characters like ×
      const encodedSport = encodeURIComponent(sport)
      const url = `/api/teams/${encodedSport}`
      logger.api('Fetching teams for sport:', sport, 'URL:', url)
      
      const response = await fetchWithAuth(url, signal ? { signal } : {})
      
      if (signal?.aborted) return
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to fetch team details'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.details || errorMessage
          logger.error('API Error:', errorData)
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
          logger.error('Response parse error:', e)
        }
        setError(errorMessage)
        setLoading(false)
        return
      }

      const data = await response.json()
      logger.api('Team data received:', data)

      if (data.success) {
        // Store total teams count from API response
        setTotalTeams(data.total_teams || 0)
        
        let teamsToShow = data.teams || []
        
        // If captain or enrolled participant, filter to show only their team
        if (shouldShowOnlyUserTeam && loggedInUser && teamsToShow.length > 0) {
          // Find the team that the user belongs to
          const userTeam = teamsToShow.find(team => 
            team.players.some(player => player.reg_number === loggedInUser.reg_number)
          )
          
          if (userTeam) {
            // Show only the user's team
            teamsToShow = [userTeam]
            // Auto-expand the user's team
            setExpandedTeams(new Set([userTeam.team_name]))
          } else {
            // User is not in any team (shouldn't happen, but handle gracefully)
            teamsToShow = []
          }
        }
        
        setTeams(teamsToShow)
      } else {
        setError(data.error || 'Failed to fetch team details')
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      logger.error('Error fetching team details:', err)
      setError(`Error while fetching team details: ${err.message || 'Please check your connection and try again.'}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleTeam = (teamName) => {
    const newExpanded = new Set(expandedTeams)
    if (newExpanded.has(teamName)) {
      newExpanded.delete(teamName)
    } else {
      newExpanded.add(teamName)
    }
    setExpandedTeams(newExpanded)
  }

  const handleEditPlayer = (teamName, regNumber) => {
    setEditingPlayer({ team_name: teamName, old_reg_number: regNumber })
    setSelectedReplacementPlayer('')
  }

  const handleCancelEdit = () => {
    setEditingPlayer(null)
    setSelectedReplacementPlayer('')
  }

  const handleUpdatePlayer = async () => {
    if (!selectedReplacementPlayer) {
      if (onStatusPopup) {
        onStatusPopup('❌ Please select a replacement player.', 'error', 2500)
      }
      return
    }

    if (selectedReplacementPlayer === editingPlayer.old_reg_number) {
      if (onStatusPopup) {
        onStatusPopup('❌ Please select a different player.', 'error', 2500)
      }
      return
    }

    // Get current team to validate
    const currentTeam = teams.find(t => t.team_name === editingPlayer.team_name)
    if (!currentTeam) {
      if (onStatusPopup) {
        onStatusPopup('❌ Team not found.', 'error', 2500)
      }
      return
    }

    // Get new player data
    const newPlayer = players.find(p => p.reg_number === selectedReplacementPlayer)
    if (!newPlayer) {
      if (onStatusPopup) {
        onStatusPopup('❌ Selected player not found.', 'error', 2500)
      }
      return
    }

    // Validate gender match
    if (currentTeam.players.length > 0) {
      const teamGender = currentTeam.players[0].gender
      if (newPlayer.gender !== teamGender) {
        if (onStatusPopup) {
          onStatusPopup(`❌ Gender mismatch: New player must have the same gender (${teamGender}) as other team members.`, 'error', 4000)
        }
        return
      }

      // Validate year match
      const teamYear = currentTeam.players[0].year
      if (newPlayer.year !== teamYear) {
        if (onStatusPopup) {
          onStatusPopup(`❌ Year mismatch: New player must be in the same year (${teamYear}) as other team members.`, 'error', 4000)
        }
        return
      }
    }

    // Check for duplicate (new player already in team)
    const isDuplicate = currentTeam.players.some(p => p.reg_number === selectedReplacementPlayer)
    if (isDuplicate) {
      if (onStatusPopup) {
        onStatusPopup('❌ This player is already in the team.', 'error', 2500)
      }
      return
    }

    setUpdating(true)
    try {
      const response = await fetchWithAuth('/api/update-team-player', {
        method: 'POST',
        body: JSON.stringify({
          team_name: editingPlayer.team_name,
          sport: sport,
          old_reg_number: editingPlayer.old_reg_number,
          new_reg_number: selectedReplacementPlayer,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        if (onStatusPopup) {
          onStatusPopup(`✅ Player updated successfully!`, 'success', 2500)
        }
        // Refresh team data
        await fetchTeamDetails()
        setEditingPlayer(null)
        setSelectedReplacementPlayer('')
      } else {
        const errorMessage = data.error || 'Failed to update player. Please try again.'
        if (onStatusPopup) {
          onStatusPopup(`❌ ${errorMessage}`, 'error', 4000)
        }
      }
    } catch (err) {
      logger.error('Error updating player:', err)
      if (onStatusPopup) {
        onStatusPopup('❌ Error updating player. Please try again.', 'error', 3000)
      }
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteTeam = async (teamName) => {
    setUpdating(true)
    try {
      const response = await fetchWithAuth('/api/delete-team', {
        method: 'DELETE',
        body: JSON.stringify({
          team_name: teamName,
          sport: sport,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        if (onStatusPopup) {
          onStatusPopup(`✅ Team "${teamName}" deleted successfully! ${data.deleted_count} player(s) removed.`, 'success', 3000)
        }
        // Refresh team data
        await fetchTeamDetails()
        setShowDeleteConfirm(false)
        setDeletingTeam(null)
      } else {
        const errorMessage = data.error || 'Failed to delete team. Please try again.'
        if (onStatusPopup) {
          onStatusPopup(`❌ ${errorMessage}`, 'error', 4000)
        }
        setShowDeleteConfirm(false)
        setDeletingTeam(null)
      }
    } catch (err) {
      logger.error('Error deleting team:', err)
      if (onStatusPopup) {
        onStatusPopup('❌ Error deleting team. Please try again.', 'error', 3000)
      }
      setShowDeleteConfirm(false)
      setDeletingTeam(null)
    } finally {
      setUpdating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4"
    >
      <aside className="max-w-[700px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] pb-[1.5rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          className="absolute top-[10px] right-3 bg-transparent border-none text-[#e5e7eb] text-base cursor-pointer hover:text-[#ffe66d] transition-colors"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">
          {isAdmin ? 'Admin Panel' : shouldShowOnlyUserTeam ? (isCaptain ? 'Captain View' : 'Team Details') : 'Team Details'}
        </div>
        <div className="text-[1.25rem] font-extrabold text-center uppercase tracking-[0.14em] text-[#ffe66d] mb-[0.7rem]">
          Team Details
        </div>
        <div className="text-[0.85rem] text-center text-[#e5e7eb] mb-4">
          {sport ? sport.toUpperCase() : 'Sport'} • PCE, Purnea • Umang – 2026 Sports Fest
        </div>

        {loading && (
          <div className="text-center py-8 text-[#a5b4fc]">
            Loading team details...
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="text-[0.9rem] text-[#cbd5ff] mb-4 text-center">
              Total Teams Participated: <span className="text-[#ffe66d] font-bold">{totalTeams}</span>
            </div>
            {teams.length === 0 && (
              <div className="text-center py-8 text-[#a5b4fc]">
                {shouldShowOnlyUserTeam 
                  ? (isCaptain 
                      ? "You haven't created a team for this sport yet. Please register a team first."
                      : "You are not enrolled in any team for this sport yet.")
                  : "No teams registered for this sport yet."
                }
              </div>
            )}
          </>
        )}

        {!loading && !error && teams.length > 0 && (
          <div className="space-y-3">
            {teams.map((team) => {
              const isExpanded = expandedTeams.has(team.team_name)
              // Check if this is the user's team (captain or enrolled participant)
              const isUserTeam = shouldShowOnlyUserTeam && loggedInUser && 
                team.players.some(player => player.reg_number === loggedInUser.reg_number)
              return (
                <div
                  key={team.team_name}
                  className={`border rounded-[12px] overflow-hidden ${
                    isUserTeam 
                      ? 'border-[rgba(255,230,109,0.5)] bg-[rgba(255,230,109,0.05)]' 
                      : 'border-[rgba(148,163,184,0.3)] bg-[rgba(15,23,42,0.6)]'
                  }`}
                >
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => toggleTeam(team.team_name)}
                      className="flex-1 px-4 py-3 flex items-center justify-between hover:bg-[rgba(255,230,109,0.1)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[#ffe66d] text-lg">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                        <span className="text-[#e5e7eb] font-semibold text-[0.95rem]">
                          {team.team_name}
                        </span>
                        {isUserTeam && (
                          <span className="px-2 py-0.5 rounded text-[0.7rem] font-bold bg-[rgba(255,230,109,0.2)] text-[#ffe66d] border border-[rgba(255,230,109,0.4)]">
                            YOUR TEAM
                          </span>
                        )}
                        <span className="text-[#a5b4fc] text-[0.8rem]">
                          ({team.player_count} {team.player_count === 1 ? 'player' : 'players'})
                        </span>
                      </div>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingTeam(team.team_name)
                          setShowDeleteConfirm(true)
                        }}
                        disabled={(updating && deletingTeam === team.team_name) || (showDeleteConfirm && deletingTeam === team.team_name)}
                        className={`ml-2 mr-2 px-4 py-1.5 rounded-[8px] text-[0.8rem] font-semibold uppercase tracking-[0.05em] transition-all ${
                          (updating && deletingTeam === team.team_name) || (showDeleteConfirm && deletingTeam === team.team_name)
                            ? 'bg-[rgba(239,68,68,0.3)] text-[rgba(239,68,68,0.6)] cursor-not-allowed'
                            : 'bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer hover:shadow-[0_4px_12px_rgba(239,68,68,0.4)] hover:-translate-y-0.5'
                        }`}
                      >
                        {updating && deletingTeam === team.team_name ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-[rgba(148,163,184,0.2)]">
                      <div className="space-y-2">
                        {team.players.map((player, index) => {
                          const isEditing = isAdmin && editingPlayer && 
                            editingPlayer.team_name === team.team_name && 
                            editingPlayer.old_reg_number === player.reg_number
                          
                          // Get other selected reg_numbers in the team (for filtering dropdown)
                          const otherSelectedRegNumbers = team.players
                            .filter(p => p.reg_number !== player.reg_number)
                            .map(p => p.reg_number)
                          
                          // Get team gender and year for filtering
                          const teamGender = team.players.length > 0 ? team.players[0].gender : null
                          const teamYear = team.players.length > 0 ? team.players[0].year : null

                          return (
                            <div
                              key={player.reg_number}
                              className="px-3 py-2 rounded-[8px] bg-[rgba(15,23,42,0.8)] border border-[rgba(148,163,184,0.15)]"
                            >
                              {!isEditing ? (
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[#ffe66d] font-bold text-[0.85rem]">
                                        {index + 1}.
                                      </span>
                                      <span className="text-[#e5e7eb] font-semibold text-[0.9rem]">
                                        {player.full_name}
                                      </span>
                                      {player.captain_in && Array.isArray(player.captain_in) && player.captain_in.includes(sport) && (
                                        <span className="px-2 py-0.5 rounded text-[0.7rem] font-bold bg-[rgba(255,230,109,0.2)] text-[#ffe66d] border border-[rgba(255,230,109,0.4)]">
                                          CAPTAIN
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[#cbd5ff] text-[0.8rem] ml-6 space-y-0.5">
                                      <div>Reg. No: <span className="text-[#e5e7eb]">{player.reg_number}</span></div>
                                      <div>Department: <span className="text-[#e5e7eb]">{player.department_branch}</span></div>
                                      <div>Year: <span className="text-[#e5e7eb]">{player.year}</span></div>
                                      <div>Gender: <span className="text-[#e5e7eb]">{player.gender}</span></div>
                                    </div>
                                  </div>
                                  {isAdmin && !(player.captain_in && Array.isArray(player.captain_in) && player.captain_in.includes(sport)) && (
                                    <button
                                      type="button"
                                      onClick={() => handleEditPlayer(team.team_name, player.reg_number)}
                                      className="ml-3 px-3 py-1.5 rounded-[6px] text-[0.8rem] font-semibold bg-[rgba(255,230,109,0.2)] text-[#ffe66d] border border-[rgba(255,230,109,0.4)] hover:bg-[rgba(255,230,109,0.3)] transition-colors"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="text-[#cbd5ff] text-[0.85rem] mb-2">
                                    Replace <span className="text-[#ffe66d] font-semibold">{player.full_name} ({player.reg_number})</span> with:
                                  </div>
                                  <div className="flex flex-col">
                                    <label className="text-[0.75rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                                      Select Replacement Player *
                                    </label>
                                    <select
                                      value={selectedReplacementPlayer}
                                      onChange={(e) => setSelectedReplacementPlayer(e.target.value)}
                                      className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
                                    >
                                      <option value="">Select Player</option>
                                      {players
                                        .filter((player) => 
                                          player.reg_number !== 'admin' && 
                                          player.gender === teamGender &&
                                          player.year === teamYear &&
                                          (player.reg_number === selectedReplacementPlayer || !otherSelectedRegNumbers.includes(player.reg_number))
                                        )
                                        .map((player) => (
                                          <option key={player.reg_number} value={player.reg_number}>
                                            {player.full_name} ({player.reg_number})
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={handleUpdatePlayer}
                                      disabled={updating || !selectedReplacementPlayer}
                                      className="flex-1 px-4 py-2 rounded-[8px] text-[0.85rem] font-semibold bg-gradient-to-r from-[#ffe66d] to-[#ff9f1c] text-[#111827] border-none disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_4px_12px_rgba(250,204,21,0.4)] transition-all"
                                    >
                                      {updating ? 'Updating...' : 'Update'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEdit}
                                      disabled={updating}
                                      className="flex-1 px-4 py-2 rounded-[8px] text-[0.85rem] font-semibold bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] border border-[rgba(148,163,184,0.7)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[rgba(15,23,42,1)] transition-all"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
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
      </aside>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingTeam && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.75)] flex items-center justify-center z-[300]">
          <div className="max-w-[420px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative">
            <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">
              Confirm Deletion
            </div>
            <div className="text-[1.1rem] font-extrabold text-center text-[#ffe66d] mb-4">
              Delete Team
            </div>
            <div className="text-center text-[#e5e7eb] mb-6">
              Are you sure you want to delete team <span className="font-semibold text-[#ffe66d]">"{deletingTeam}"</span>?
              <br />
              <span className="text-[0.9rem] text-red-400 mt-2 block">This will remove all players from this team. This action cannot be undone.</span>
            </div>
            <div className="flex gap-[0.6rem] mt-[0.8rem]">
              <button
                type="button"
                onClick={() => handleDeleteTeam(deletingTeam)}
                disabled={updating}
                className="flex-1 rounded-full border-none py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-red-600 to-red-700 text-white shadow-[0_10px_24px_rgba(239,68,68,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(239,68,68,0.75)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingTeam(null)
                }}
                disabled={updating}
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

export default TeamDetailsModal

