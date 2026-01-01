import { useState, useEffect } from 'react'
import { Modal, Button, Input, DatePickerInput, ConfirmationDialog, LoadingSpinner, ErrorMessage, EmptyState } from './ui'
import { useApi, useModal, useEventYearWithFallback, useEventYear } from '../hooks'
import { fetchWithAuth, clearCache } from '../utils/api'
import { buildSportApiUrl, buildEventScheduleApiUrl } from '../utils/apiHelpers'
import logger from '../utils/logger'

function EventScheduleModal({ isOpen, onClose, sport, sportType, loggedInUser, onStatusPopup, embedded = false, selectedYear }) {
  const { eventYearConfig } = useEventYear()
  const eventHighlight = eventYearConfig?.event_highlight || 'Community Entertainment Fest'
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [expandedMatches, setExpandedMatches] = useState(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingMatchId, setDeletingMatchId] = useState(null)
  const [sportDetails, setSportDetails] = useState(null) // Store sport details to know exact type
  
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
  
  // Multi team/player state
  const [numberOfParticipants, setNumberOfParticipants] = useState('')
  const [multiTeams, setMultiTeams] = useState([]) // Array for multi team selections
  const [multiPlayers, setMultiPlayers] = useState([]) // Array for multi player selections
  
  // Qualifier selection state (for multi_team and multi_player)
  const [pendingQualifiers, setPendingQualifiers] = useState({}) // { matchId: [{ participant, position }] }
  
  const isAdmin = loggedInUser?.reg_number === 'admin'
  const { loading: submitting, execute: executeSubmit } = useApi()
  const { loading: updatingStatus, execute: executeStatusUpdate } = useApi()
  const { loading: updatingWinner, execute: executeWinnerUpdate } = useApi()
  const { loading: updatingQualifiers, execute: executeQualifiersUpdate } = useApi()
  const { loading: deleting, execute: executeDelete } = useApi()
  const eventYear = useEventYearWithFallback(selectedYear)
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
      setSportDetails(null)
      setPendingQualifiers({})
      return
    }

    // Fetch data when modal opens or sport changes
    const loadData = async () => {
      try {
        // Fetch sport details to know exact type
        if (sport && eventYear) {
          await fetchSportDetails()
        }
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
  }, [isOpen, sport, eventYear])
  
  // Reset form when modal closes or sport changes
  useEffect(() => {
    if (!isOpen || !showAddForm) {
      setTeamOne('')
      setTeamTwo('')
      setPlayerOne('')
      setPlayerTwo('')
      setMatchDate('')
      setNumberOfParticipants('')
      setMultiTeams([])
      setMultiPlayers([])
    }
  }, [isOpen, showAddForm])

  const fetchSportDetails = async () => {
    if (!sport || !eventYear) return
    
    try {
      const response = await fetchWithAuth(buildSportApiUrl('sports', sport, eventYear))
      
      if (response.ok) {
        const data = await response.json()
        // API returns sport object directly
        if (data && data.name) {
          setSportDetails(data)
        }
      }
    } catch (err) {
      logger.error('Error fetching sport details:', err)
      setSportDetails(null)
    }
  }

  const fetchMatches = async () => {
    if (!sport) return
    
    setLoading(true)
    try {
      const response = await fetchWithAuth(buildEventScheduleApiUrl(sport, '', eventYear))
      
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
        // Request aborted
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
      // Fetching teams/players for sport
      const response = await fetchWithAuth(buildEventScheduleApiUrl(sport, 'teams-players', eventYear))
      
      if (!response.ok) {
        // Clone response to read error text without consuming the original
        const clonedResponse = response.clone()
        const errorText = await clonedResponse.text().catch(() => 'Unable to read error text')
        logger.error(`HTTP error! status: ${response.status}, response: ${errorText}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      // Teams/players response received
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
        // Teams and players lists set
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
    setExpandedMatches(prev => {
      // If clicking on an already expanded match, collapse it
      if (prev.has(matchId)) {
        const newExpanded = new Set(prev)
        newExpanded.delete(matchId)
        return newExpanded
      }
      // Otherwise, expand this match and collapse all others
      return new Set([matchId])
    })
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
            clearCache(buildEventScheduleApiUrl(sport, '', eventYear))
            fetchMatches()
            setUpdatingMatchId(null)
          },
          onError: (err) => {
            // The useApi hook extracts the error message from the API response
            const errorMessage = err?.message || err?.error || 'Error updating match status. Please try again.'
            if (onStatusPopup) {
              onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            }
            setUpdatingMatchId(null)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      // Don't show duplicate error message - onError should have handled it
      logger.error('Error updating match status:', err)
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
            clearCache(buildEventScheduleApiUrl(sport, '', eventYear))
            fetchMatches()
            setUpdatingMatchId(null)
          },
          onError: (err) => {
            // The useApi hook extracts the error message from the API response
            const errorMessage = err?.message || err?.error || 'Error updating winner. Please try again.'
            if (onStatusPopup) {
              onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            }
            setUpdatingMatchId(null)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      // Don't show duplicate error message - onError should have handled it
      logger.error('Error updating winner:', err)
      setUpdatingMatchId(null)
    }
  }

  // Handle clicking "Qualified" button next to a participant
  const handleQualifyParticipant = (matchId, participant) => {
    // Find the match to check if it's in the future
    const match = matches.find(m => m._id === matchId)
    if (match && isMatchInFuture(match.match_date)) {
      if (onStatusPopup) {
        onStatusPopup('❌ Cannot set qualifiers for future matches. Please wait until the match date.', 'error', 3000)
      }
      return
    }

    // Get current pending qualifiers for this match
    const currentQualifiers = pendingQualifiers[matchId] || []
    
    // Check if participant is already qualified
    if (currentQualifiers.some(q => q.participant === participant)) {
      return // Already qualified, do nothing
    }

    // Add participant with next position
    const nextPosition = currentQualifiers.length + 1
    const newQualifiers = [...currentQualifiers, { participant, position: nextPosition }]
    
    setPendingQualifiers({
      ...pendingQualifiers,
      [matchId]: newQualifiers
    })
  }

  // Handle freezing qualifiers (send to backend)
  const handleFreezeQualifiers = async (matchId) => {
    const qualifiers = pendingQualifiers[matchId] || []
    
    if (qualifiers.length === 0) {
      if (onStatusPopup) {
        onStatusPopup('❌ Please select at least one qualifier before freezing.', 'error', 3000)
      }
      return
    }

    setUpdatingMatchId(matchId)
    
    try {
      await executeQualifiersUpdate(
        () => fetchWithAuth(`/api/event-schedule/${matchId}`, {
          method: 'PUT',
          body: JSON.stringify({ 
            qualifiers: qualifiers,
            status: 'completed' // Ensure status is completed when qualifiers are set
          }),
        }),
        {
          onSuccess: (data) => {
            if (onStatusPopup) {
              onStatusPopup(`✅ Qualifiers updated successfully!`, 'success', 2500)
            }
            // Clear pending qualifiers for this match
            const newPendingQualifiers = { ...pendingQualifiers }
            delete newPendingQualifiers[matchId]
            setPendingQualifiers(newPendingQualifiers)
            // Clear cache and refresh matches
            clearCache(buildEventScheduleApiUrl(sport, '', eventYear))
            fetchMatches()
            setUpdatingMatchId(null)
          },
          onError: (err) => {
            // The useApi hook extracts the error message from the API response
            const errorMessage = err?.message || err?.error || 'Error updating qualifiers. Please try again.'
            if (onStatusPopup) {
              onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            }
            setUpdatingMatchId(null)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      // Don't show duplicate error message - onError should have handled it
      logger.error('Error updating qualifiers:', err)
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
            clearCache(buildEventScheduleApiUrl(sport, '', eventYear))
            fetchMatches()
            setDeletingMatchId(null)
          },
          onError: (err) => {
            // The useApi hook extracts the error message from the API response
            const errorMessage = err?.message || err?.error || 'Error deleting match. Please try again.'
            if (onStatusPopup) {
              onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            }
            setDeletingMatchId(null)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      // Don't show duplicate error message - onError should have handled it
      logger.error('Error deleting match:', err)
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
    setNumberOfParticipants('')
    setMultiTeams([])
    setMultiPlayers([])
  }
  
  // Handle number of participants change for multi sports
  const handleNumberOfParticipantsChange = (value) => {
    const num = parseInt(value) || 0
    setNumberOfParticipants(value)
    
    // Initialize arrays with empty strings
    if (sportDetails && (sportDetails.type === 'multi_team' || sportDetails.type === 'multi_player')) {
      if (sportDetails.type === 'multi_team') {
        setMultiTeams(Array(num).fill(''))
      } else {
        setMultiPlayers(Array(num).fill(''))
      }
    }
  }
  
  // Handle multi team selection change
  const handleMultiTeamChange = (index, value) => {
    const newTeams = [...multiTeams]
    newTeams[index] = value
    setMultiTeams(newTeams)
  }
  
  // Handle multi player selection change
  const handleMultiPlayerChange = (index, value) => {
    const newPlayers = [...multiPlayers]
    newPlayers[index] = value
    setMultiPlayers(newPlayers)
  }
  
  // Check if sport is multi type
  const isMultiSport = sportDetails && (sportDetails.type === 'multi_team' || sportDetails.type === 'multi_player')

  const handleSubmitMatch = async (e) => {
    e.preventDefault()
    
    if (!matchDate) {
      if (onStatusPopup) {
        onStatusPopup('❌ Please select match date.', 'error', 2500)
      }
      return
    }

    // Validate match date - must be today or after today (date-only comparison)
    const matchDateObj = new Date(matchDate + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day for comparison
    matchDateObj.setHours(0, 0, 0, 0)
    
    if (matchDateObj < today) {
      if (onStatusPopup) {
        onStatusPopup('❌ Match date must be today or a future date.', 'error', 2500)
      }
      return
    }

    // Validate multi sports
    if (isMultiSport) {
      const num = parseInt(numberOfParticipants) || 0
      
      // Validate number range
      if (num < 2 || num > 20) {
        if (onStatusPopup) {
          onStatusPopup('❌ Number of participants must be between 2 and 20.', 'error', 2500)
        }
        return
      }
      
      if (sportDetails.type === 'multi_team') {
        // Validate all teams are selected
        if (multiTeams.length !== num || multiTeams.some(team => !team)) {
          if (onStatusPopup) {
            onStatusPopup(`❌ Please select all ${num} teams.`, 'error', 2500)
          }
          return
        }
        
        // Validate no duplicates
        const uniqueTeams = new Set(multiTeams)
        if (uniqueTeams.size !== multiTeams.length) {
          if (onStatusPopup) {
            onStatusPopup('❌ Please select different teams. Duplicate teams are not allowed.', 'error', 2500)
          }
          return
        }
        
        // Validate teams exist in available teams list
        const invalidTeams = multiTeams.filter(team => !teamsList.includes(team))
        if (invalidTeams.length > 0) {
          if (onStatusPopup) {
            onStatusPopup(`❌ Invalid team(s): ${invalidTeams.join(', ')}. Please select from available teams.`, 'error', 3000)
          }
          return
        }
        
        // Validate all teams have players of the same gender
        // Since team creation already enforces same gender within a team, we only need to check one player per team
        try {
          const response = await fetchWithAuth(buildSportApiUrl('teams', sport, eventYear))
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.teams) {
              const teamDetailsMap = new Map()
              data.teams.forEach(team => {
                teamDetailsMap.set(team.team_name, team)
              })
              
              // Get gender of first player from each team (teams already have same gender players)
              const teamGenders = []
              for (const teamName of multiTeams) {
                const team = teamDetailsMap.get(teamName)
                if (team && team.players && team.players.length > 0) {
                  const firstPlayerGender = team.players[0].gender
                  if (firstPlayerGender) {
                    teamGenders.push(firstPlayerGender)
                  }
                }
              }
              
              // Check if all teams have the same gender
              if (teamGenders.length > 0) {
                const firstGender = teamGenders[0]
                const genderMismatch = teamGenders.find(g => g !== firstGender)
                if (genderMismatch) {
                  if (onStatusPopup) {
                    onStatusPopup(`❌ Gender mismatch: All teams must have players of the same gender.`, 'error', 3000)
                  }
                  return
                }
              }
            }
          }
        } catch (err) {
          logger.error('Error validating team genders:', err)
          // Continue with submission if validation fails (backend will catch it)
        }
      } else {
        // Validate all players are selected
        if (multiPlayers.length !== num || multiPlayers.some(player => !player)) {
          if (onStatusPopup) {
            onStatusPopup(`❌ Please select all ${num} players.`, 'error', 2500)
          }
          return
        }
        
        // Validate no duplicates
        const uniquePlayers = new Set(multiPlayers)
        if (uniquePlayers.size !== multiPlayers.length) {
          if (onStatusPopup) {
            onStatusPopup('❌ Please select different players. Duplicate players are not allowed.', 'error', 2500)
          }
          return
        }
        
        // Validate players exist in available players list
        const availableRegNumbers = new Set(allPlayersList.map(p => p.reg_number))
        const invalidPlayers = multiPlayers.filter(player => !availableRegNumbers.has(player))
        if (invalidPlayers.length > 0) {
          if (onStatusPopup) {
            onStatusPopup(`❌ Invalid player(s): ${invalidPlayers.join(', ')}. Please select from available players.`, 'error', 3000)
          }
          return
        }
        
        // Validate all players have same gender
        const selectedPlayersData = allPlayersList.filter(p => multiPlayers.includes(p.reg_number))
        if (selectedPlayersData.length > 0) {
          const firstGender = selectedPlayersData[0].gender
          const genderMismatch = selectedPlayersData.find(p => p.gender !== firstGender)
          if (genderMismatch) {
            if (onStatusPopup) {
              onStatusPopup(`❌ Gender mismatch: All players must have the same gender.`, 'error', 3000)
            }
            return
          }
        }
      }
    } else if (sportDetails && sportDetails.type === 'dual_team') {
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
      
      // Validate both teams have players of the same gender (for dual_team)
      // Since team creation already enforces same gender within a team, we only need to check one player per team
      try {
        const response = await fetchWithAuth(buildSportApiUrl('teams', sport, eventYear))
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.teams) {
            const teamDetailsMap = new Map()
            data.teams.forEach(team => {
              teamDetailsMap.set(team.team_name, team)
            })
            
            // Get gender of first player from each team (teams already have same gender players)
            const teamGenders = []
            for (const teamName of [teamOne, teamTwo]) {
              const team = teamDetailsMap.get(teamName)
              if (team && team.players && team.players.length > 0) {
                const firstPlayerGender = team.players[0].gender
                if (firstPlayerGender) {
                  teamGenders.push(firstPlayerGender)
                }
              }
            }
            
            // Check if both teams have the same gender
            if (teamGenders.length === 2 && teamGenders[0] !== teamGenders[1]) {
              if (onStatusPopup) {
                onStatusPopup(`❌ Gender mismatch: Both teams must have players of the same gender.`, 'error', 3000)
              }
              return
            }
          }
        }
      } catch (err) {
        logger.error('Error validating team genders:', err)
        // Continue with submission if validation fails (backend will catch it)
      }
    } else if (sportDetails && sportDetails.type === 'dual_player') {
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
      
      // Validate gender match for dual_player
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
      // Prepare teams/players arrays based on sport type
      let teams = []
      let players = []
      
      if (isMultiSport) {
        if (sportDetails.type === 'multi_team') {
          teams = multiTeams.filter(Boolean)
        } else {
          players = multiPlayers.filter(Boolean)
        }
      } else if (sportDetails && sportDetails.type === 'dual_team') {
        teams = [teamOne, teamTwo].filter(Boolean)
        players = []
      } else if (sportDetails && sportDetails.type === 'dual_player') {
        teams = []
        players = [playerOne, playerTwo].filter(Boolean)
      }
      
      await executeSubmit(
        () => fetchWithAuth('/api/event-schedule', {
          method: 'POST',
          body: JSON.stringify({
            match_type: matchType,
            sports_name: sport,
            teams: teams,
            players: players,
            match_date: matchDate + 'T00:00:00', // Add time for MongoDB storage
            event_year: eventYear,
            number_of_participants: isMultiSport ? parseInt(numberOfParticipants) : undefined,
          }),
        }),
        {
          onSuccess: (data) => {
            if (onStatusPopup) {
              onStatusPopup(`✅ ${data.message || 'Match scheduled successfully!'}`, 'success', 2500)
            }
            setShowAddForm(false)
            // Clear cache for event-schedule endpoint to ensure fresh data
            clearCache(buildEventScheduleApiUrl(sport, '', eventYear))
            fetchMatches()
            // Reset form
            setMatchType('league')
            setTeamOne('')
            setTeamTwo('')
            setPlayerOne('')
            setPlayerTwo('')
            setMatchDate('')
            setNumberOfParticipants('')
            setMultiTeams([])
            setMultiPlayers([])
          },
          onError: (err) => {
            // Extract error message from the error object
            // The useApi hook sets err.message from the API response
            const errorMessage = err?.message || err?.error || 'Error scheduling match. Please try again.'
            if (onStatusPopup) {
              onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
            }
          },
          showError: false, // We handle error display ourselves
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      // Only show error if onError wasn't called (which shouldn't happen, but just in case)
      logger.error('Error scheduling match:', err)
      // Don't show duplicate error message - onError should have handled it
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


  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${sport} - Event Schedule`}
        subtitle={eventHighlight}
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
                  { value: 'final', label: 'Final' },
                ]}
                className="mb-3"
              />

              {/* Number of participants dropdown for multi sports */}
              {isMultiSport && (
                <Input
                  label={`Number of ${sportDetails.type === 'multi_team' ? 'Teams' : 'Players'}`}
                  type="select"
                  value={numberOfParticipants}
                  onChange={(e) => handleNumberOfParticipantsChange(e.target.value)}
                  required
                  options={Array.from({ length: 19 }, (_, i) => i + 2).map(num => ({
                    value: num.toString(),
                    label: num.toString()
                  }))}
                  className="mb-3"
                />
              )}

              {/* Multi team/player dropdowns */}
              {isMultiSport && numberOfParticipants && (
                <>
                  {sportDetails.type === 'multi_team' ? (
                    multiTeams.map((team, index) => (
                      <Input
                        key={index}
                        label={`Team ${index + 1}`}
                        type="select"
                        value={team}
                        onChange={(e) => handleMultiTeamChange(index, e.target.value)}
                        required
                        disabled={loadingOptions}
                        options={teamsList
                          .filter(t => {
                            // Show current selection or teams not selected in other dropdowns
                            return t === team || !multiTeams.includes(t) || multiTeams.indexOf(t) === index
                          })
                          .map((teamName) => ({
                            value: teamName,
                            label: teamName
                          }))}
                        className="mb-3"
                      />
                    ))
                  ) : (
                    multiPlayers.map((player, index) => (
                      <Input
                        key={index}
                        label={`Player ${index + 1}`}
                        type="select"
                        value={player}
                        onChange={(e) => handleMultiPlayerChange(index, e.target.value)}
                        required
                        disabled={loadingOptions}
                        options={allPlayersList
                          .filter(p => {
                            // Show current selection or players not selected in other dropdowns
                            return p.reg_number === player || !multiPlayers.includes(p.reg_number) || multiPlayers.indexOf(p.reg_number) === index
                          })
                          .map((player) => ({
                            value: player.reg_number,
                            label: `${player.full_name} (${player.reg_number})`
                          }))}
                        className="mb-3"
                      />
                    ))
                  )}
                </>
              )}

              {/* Dual team/player dropdowns (only for dual_team and dual_player) */}
              {sportDetails && sportDetails.type === 'dual_team' && (
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
                    options={teamsList.filter(team => team !== teamTwo).map((team) => ({
                      value: team,
                      label: team
                    }))}
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
                    options={teamsList.filter(team => team !== teamOne).map((team) => ({
                      value: team,
                      label: team
                    }))}
                    className="mb-3"
                  />
                </>
              )}

              {sportDetails && sportDetails.type === 'dual_player' && (
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
                      // If player two is selected first, use playersList (filtered by gender)
                      if (playerTwo && !playerOne) {
                        return playersList
                          .filter(player => player.reg_number !== playerTwo)
                          .map((player) => ({
                            value: player.reg_number,
                            label: `${player.full_name} (${player.reg_number})`
                          }))
                      }
                      // Otherwise, show all players except player two
                      return allPlayersList
                        .filter(player => player.reg_number !== playerTwo)
                        .map((player) => ({
                          value: player.reg_number,
                          label: `${player.full_name} (${player.reg_number})`
                        }))
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
                    options={(() => {
                      // If player one is selected first, use playersList (filtered by gender)
                      if (playerOne && !playerTwo) {
                        return playersList
                          .filter(player => player.reg_number !== playerOne)
                          .map((player) => ({
                            value: player.reg_number,
                            label: `${player.full_name} (${player.reg_number})`
                          }))
                      }
                      // Otherwise, show all players except player one
                      return allPlayersList
                        .filter(player => player.reg_number !== playerOne)
                        .map((player) => ({
                          value: player.reg_number,
                          label: `${player.full_name} (${player.reg_number})`
                        }))
                    })()}
                    className="mb-3"
                  />
                </>
              )}

              <DatePickerInput
                label="Match Date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="mb-4"
              />

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  loading={submitting}
                  variant="success"
                  className="flex-1 px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-[0.85rem] font-bold rounded-lg"
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
                  className="flex-1 px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-[0.85rem] font-bold rounded-lg"
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
                                <div className="[&>div]:!mb-0 [&>div]:!w-fit [&>div]:inline-flex [&>div>select]:!w-auto [&>div>select]:!max-w-[120px]">
                                  <Input
                                    type="select"
                                    value={match.status || 'scheduled'}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      handleStatusChange(match._id, e.target.value)
                                    }}
                                    disabled={
                                      updatingStatus || 
                                      updatingMatchId === match._id || 
                                      (match.winner && match.status === 'completed') || 
                                      (match.qualifiers && match.qualifiers.length > 0 && match.status === 'completed')
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    title={
                                      (match.winner && match.status === 'completed') || 
                                      (match.qualifiers && match.qualifiers.length > 0 && match.status === 'completed')
                                        ? 'Cannot change status when winner/qualifiers are set'
                                        : 'Update Result'
                                    }
                                    options={[
                                      { value: 'scheduled', label: 'Scheduled' },
                                      { value: 'completed', label: 'Completed' },
                                      { value: 'draw', label: 'Draw' },
                                      { value: 'cancelled', label: 'Cancelled' },
                                    ]}
                                    className="px-[2px] py-1.5 text-[0.8rem] font-semibold uppercase tracking-[0.05em] rounded-[8px] bg-[rgba(59,130,246,0.8)] hover:bg-[rgba(59,130,246,1)] text-white"
                                  />
                                </div>
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
                        {sportDetails && (
                          <div>
                            <span className="text-[#ffe66d]">Sport Type:</span>{' '}
                            <span className="text-[#e5e7eb] capitalize">{sportDetails.type || 'N/A'}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-[#ffe66d]">Match Date:</span>{' '}
                          <span className="text-[#e5e7eb]">{formatDate(match.match_date)}</span>
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
                        {/* Display Teams (for team sports) */}
                        {sportDetails && (sportDetails.type === 'dual_team' || sportDetails.type === 'multi_team') && match.teams && match.teams.length > 0 && (
                          <div>
                            <span className="text-[#ffe66d]">Teams:</span>
                            <div className="mt-1 space-y-2">
                              {match.teams.map((team, index) => {
                                const isWinner = match.winner === team
                                const isQualifier = match.qualifiers && match.qualifiers.some(q => q.participant === team)
                                const qualifierInfo = isQualifier ? match.qualifiers.find(q => q.participant === team) : null
                                
                                // Check pending qualifiers (before freezing)
                                const pendingQuals = pendingQualifiers[match._id] || []
                                const pendingQualInfo = pendingQuals.find(q => q.participant === team)
                                const showQualifiedButton = isAdmin && match.status === 'completed' && (!match.qualifiers || match.qualifiers.length === 0) && !isMatchInFuture(match.match_date) && sportDetails && sportDetails.type === 'multi_team' && !pendingQualInfo
                                
                                return (
                                  <div key={index} className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[#e5e7eb]">
                                      {team}
                                      {(qualifierInfo || pendingQualInfo) && (
                                        <span className="ml-2 px-2 py-0.5 rounded text-[0.75rem] font-bold bg-[rgba(255,230,109,0.2)] text-[#ffe66d] border border-[rgba(255,230,109,0.3)]">
                                          {pendingQualInfo ? (pendingQualInfo.position === 1 ? '1st' : pendingQualInfo.position === 2 ? '2nd' : pendingQualInfo.position === 3 ? '3rd' : `${pendingQualInfo.position}th`) : (qualifierInfo.position === 1 ? '1st' : qualifierInfo.position === 2 ? '2nd' : qualifierInfo.position === 3 ? '3rd' : `${qualifierInfo.position}th`)}
                                        </span>
                                      )}
                                    </span>
                                    {showQualifiedButton && (
                                      <Button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleQualifyParticipant(match._id, team)
                                        }}
                                        disabled={updatingMatchId === match._id}
                                        variant="success"
                                        className="px-2 py-1 text-[0.75rem] font-bold rounded"
                                      >
                                        Qualified
                                      </Button>
                                    )}
                                    {isAdmin && match.status === 'completed' && !match.winner && !isMatchInFuture(match.match_date) && sportDetails && sportDetails.type === 'dual_team' && (
                                      <Button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleWinnerSelect(match._id, team)
                                        }}
                                        disabled={updatingWinner || updatingMatchId === match._id}
                                        variant="success"
                                        className="px-2.5 py-1.5 text-[0.85rem] font-bold rounded-lg"
                                      >
                                        Winner
                                      </Button>
                                    )}
                                    {match.status === 'completed' && isWinner && (
                                      <span className="px-2 py-1 rounded text-[0.75rem] font-bold bg-[rgba(34,197,94,0.8)] text-white">
                                        Winner
                                      </span>
                                    )}
                                    {match.status === 'completed' && !isWinner && match.winner && sportDetails && sportDetails.type === 'dual_team' && (
                                      <span className="px-2 py-1 rounded text-[0.75rem] font-bold bg-[rgba(239,68,68,0.8)] text-white">
                                        Loser
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                            {/* Freeze button for multi_team */}
                            {isAdmin && match.status === 'completed' && (!match.qualifiers || match.qualifiers.length === 0) && !isMatchInFuture(match.match_date) && sportDetails && sportDetails.type === 'multi_team' && (pendingQualifiers[match._id] || []).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-[rgba(148,163,184,0.2)]">
                                <Button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleFreezeQualifiers(match._id)
                                  }}
                                  disabled={updatingQualifiers || updatingMatchId === match._id}
                                  variant="success"
                                  className="px-3 py-1.5 text-[0.85rem] font-bold rounded-lg"
                                >
                                  Freeze
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Display Players (for individual sports) */}
                        {sportDetails && (sportDetails.type === 'dual_player' || sportDetails.type === 'multi_player' || sportDetails.type === 'cultural') && match.players && match.players.length > 0 && (
                          <div>
                            <span className="text-[#ffe66d]">Players:</span>
                            <div className="mt-1 space-y-2">
                              {match.players.map((playerRegNumber, index) => {
                                // Find player details from allPlayersList
                                const player = allPlayersList.find(p => p.reg_number === playerRegNumber) || 
                                             { reg_number: playerRegNumber, full_name: playerRegNumber }
                                const playerDisplay = `${player.full_name} (${player.reg_number})`
                                const isWinner = match.winner === playerRegNumber || match.winner === playerDisplay
                                const isQualifier = match.qualifiers && match.qualifiers.some(q => q.participant === playerRegNumber || q.participant === playerDisplay)
                                const qualifierInfo = isQualifier ? match.qualifiers.find(q => q.participant === playerRegNumber || q.participant === playerDisplay) : null
                                
                                // Check pending qualifiers (before freezing) - use reg_number for consistency
                                const pendingQuals = pendingQualifiers[match._id] || []
                                const pendingQualInfo = pendingQuals.find(q => q.participant === playerRegNumber)
                                const showQualifiedButton = isAdmin && match.status === 'completed' && (!match.qualifiers || match.qualifiers.length === 0) && !isMatchInFuture(match.match_date) && sportDetails && sportDetails.type === 'multi_player' && !pendingQualInfo
                                
                                return (
                                  <div key={index} className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[#e5e7eb]">
                                      {playerDisplay}
                                      {(qualifierInfo || pendingQualInfo) && (
                                        <span className="ml-2 px-2 py-0.5 rounded text-[0.75rem] font-bold bg-[rgba(255,230,109,0.2)] text-[#ffe66d] border border-[rgba(255,230,109,0.3)]">
                                          {pendingQualInfo ? (pendingQualInfo.position === 1 ? '1st' : pendingQualInfo.position === 2 ? '2nd' : pendingQualInfo.position === 3 ? '3rd' : `${pendingQualInfo.position}th`) : (qualifierInfo.position === 1 ? '1st' : qualifierInfo.position === 2 ? '2nd' : qualifierInfo.position === 3 ? '3rd' : `${qualifierInfo.position}th`)}
                                        </span>
                                      )}
                                    </span>
                                    {showQualifiedButton && (
                                      <Button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleQualifyParticipant(match._id, playerRegNumber)
                                        }}
                                        disabled={updatingMatchId === match._id}
                                        variant="success"
                                        className="px-2 py-1 text-[0.75rem] font-bold rounded"
                                      >
                                        Qualified
                                      </Button>
                                    )}
                                    {isAdmin && match.status === 'completed' && !match.winner && !isMatchInFuture(match.match_date) && sportDetails && sportDetails.type === 'dual_player' && (
                                      <Button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleWinnerSelect(match._id, playerRegNumber)
                                        }}
                                        disabled={updatingWinner || updatingMatchId === match._id}
                                        variant="success"
                                        className="px-2.5 py-1.5 text-[0.85rem] font-bold rounded-lg"
                                      >
                                        Winner
                                      </Button>
                                    )}
                                    {match.status === 'completed' && isWinner && (
                                      <span className="px-2 py-1 rounded text-[0.75rem] font-bold bg-[rgba(34,197,94,0.8)] text-white">
                                        Winner
                                      </span>
                                    )}
                                    {match.status === 'completed' && !isWinner && match.winner && sportDetails && sportDetails.type === 'dual_player' && (
                                      <span className="px-2 py-1 rounded text-[0.75rem] font-bold bg-[rgba(239,68,68,0.8)] text-white">
                                        Loser
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                            {/* Freeze button for multi_player */}
                            {isAdmin && match.status === 'completed' && (!match.qualifiers || match.qualifiers.length === 0) && !isMatchInFuture(match.match_date) && sportDetails && sportDetails.type === 'multi_player' && (pendingQualifiers[match._id] || []).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-[rgba(148,163,184,0.2)]">
                                <Button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleFreezeQualifiers(match._id)
                                  }}
                                  disabled={updatingQualifiers || updatingMatchId === match._id}
                                  variant="success"
                                  className="px-3 py-1.5 text-[0.85rem] font-bold rounded-lg"
                                >
                                  Freeze
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Fallback for old format (backward compatibility) */}
                        {(!sportDetails || (!match.teams && !match.players)) && (
                          <>
                            {match.team_one && (
                              <div>
                                <span className="text-[#ffe66d]">Team One:</span>{' '}
                                <span className="text-[#e5e7eb]">{match.team_one}</span>
                              </div>
                            )}
                            {match.team_two && (
                              <div>
                                <span className="text-[#ffe66d]">Team Two:</span>{' '}
                                <span className="text-[#e5e7eb]">{match.team_two}</span>
                              </div>
                            )}
                            {match.player_one && (
                              <div>
                                <span className="text-[#ffe66d]">Player One:</span>{' '}
                                <span className="text-[#e5e7eb]">
                                  {typeof match.player_one === 'string' ? match.player_one : 
                                   `${match.player_one.name || ''} (${match.player_one.reg_number || ''})`}
                                </span>
                              </div>
                            )}
                            {match.player_two && (
                              <div>
                                <span className="text-[#ffe66d]">Player Two:</span>{' '}
                                <span className="text-[#e5e7eb]">
                                  {typeof match.player_two === 'string' ? match.player_two : 
                                   `${match.player_two.name || ''} (${match.player_two.reg_number || ''})`}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                        {match.winner && match.status === 'completed' && (
                          <div>
                            <span className="text-[#ffe66d]">Winner:</span>{' '}
                            <span className="text-[#86efac] font-bold">{match.winner}</span>
                          </div>
                        )}
                        {match.qualifiers && match.qualifiers.length > 0 && (
                          <div>
                            <span className="text-[#ffe66d]">Qualifiers:</span>
                            <div className="mt-1 space-y-1">
                              {match.qualifiers
                                .sort((a, b) => a.position - b.position)
                                .map((q, index) => (
                                  <div key={index} className="text-[#e5e7eb] text-[0.8rem]">
                                    {q.position === 1 ? '1st' : q.position === 2 ? '2nd' : q.position === 3 ? '3rd' : `${q.position}th`}: {q.participant}
                                  </div>
                                ))}
                            </div>
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

