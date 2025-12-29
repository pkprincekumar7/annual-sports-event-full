import { useState, useEffect, useRef } from 'react'
import { Modal, Button, Input } from './ui'
import { useApi } from '../hooks'
import { fetchWithAuth, API_URL, clearCache } from '../utils/api'
import logger from '../utils/logger'
import { EVENT_INFO, GENDER_OPTIONS, DEPARTMENT_OPTIONS } from '../constants/app'

function RegisterModal({ isOpen, onClose, selectedSport, onStatusPopup, loggedInUser, onUserUpdate, embedded = false }) {
  const [registrationCountdown, setRegistrationCountdown] = useState('')
  const [players, setPlayers] = useState([])
  const [selectedPlayers, setSelectedPlayers] = useState({})
  const [totalTeams, setTotalTeams] = useState(0)
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [justParticipated, setJustParticipated] = useState(false) // Track if user just participated
  const { loading: isSubmitting, execute: executeGeneral } = useApi()
  const { loading: isSubmittingTeam, execute: executeTeam } = useApi()
  const { loading: isSubmittingIndividual, execute: executeIndividual } = useApi()

  const isTeam = selectedSport?.type === 'team'
  const playerCount = isTeam ? selectedSport?.players || 0 : 0
  const isGeneralRegistration = !selectedSport
  const prevSportNameRef = useRef(null)
  const isMountedRef = useRef(true)

  // Fetch players list for team player dropdowns
  useEffect(() => {
    if (!isOpen) {
      isMountedRef.current = false
      setPlayers([])
      setTotalTeams(0)
      setTotalParticipants(0)
      setLoadingParticipants(false)
      setLoadingTeams(false)
      setJustParticipated(false)
      prevSportNameRef.current = null
      return
    }

    const currentSportName = selectedSport?.name
    const currentIsTeam = selectedSport?.type === 'team'

    // Don't fetch if sport is not yet available
    if (currentIsTeam && !currentSportName) {
      return
    }

    // For non-team events, if we don't have a sport name yet, don't fetch
    if (!currentIsTeam && !currentSportName) {
      setLoadingParticipants(false)
      setTotalParticipants(0)
      return
    }

    // Check if sport name actually changed - if not, don't re-fetch
    // But if players are empty, we should still fetch
    // For non-team events, always fetch if sport name changed or if we don't have data yet
    const sportNameChanged = currentSportName !== prevSportNameRef.current
    const shouldFetch = sportNameChanged || 
                       (currentIsTeam && players.length === 0 && prevSportNameRef.current !== null) ||
                       (!currentIsTeam && (prevSportNameRef.current === null || totalParticipants === 0 && !loadingParticipants))
    
    if (!shouldFetch && prevSportNameRef.current !== null) {
      // Skipping fetch - sport name unchanged and data already loaded
      // For non-team events, ensure loading state is reset if we're skipping fetch
      if (!currentIsTeam && loadingParticipants) {
        setLoadingParticipants(false)
      }
      return
    }
    
    // Store current sport name before fetching
    prevSportNameRef.current = currentSportName
    isMountedRef.current = true

    if (!currentIsTeam) {
      // For non-team events, fetch participants count
      const fetchParticipantsCount = async () => {
        if (!currentSportName) {
          setLoadingParticipants(false)
          setTotalParticipants(0)
          return
        }
        
        setLoadingParticipants(true)
        try {
          const encodedSport = encodeURIComponent(currentSportName)
          const response = await fetchWithAuth(`/api/participants-count/${encodedSport}`)
          
          if (!isMountedRef.current) {
            return
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error')
            logger.error(`HTTP error fetching participants count: ${response.status} - ${errorText}`)
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const data = await response.json()
          
          if (data.success && isMountedRef.current) {
            const count = data.total_participants || 0
            setTotalParticipants(count)
          } else if (isMountedRef.current) {
            logger.warn('Failed to fetch participants count:', data.error)
            setTotalParticipants(0)
          }
        } catch (err) {
          if (!isMountedRef.current) {
            return
          }
          logger.error('Error fetching participants count:', err)
          if (isMountedRef.current) {
            setTotalParticipants(0)
          }
        } finally {
          if (isMountedRef.current) {
            setLoadingParticipants(false)
          }
        }
      }

      fetchParticipantsCount()
    } else {
      // For team events, fetch players and teams
      const fetchPlayers = async () => {
        try {
          const response = await fetchWithAuth('/api/players')
          
          if (!isMountedRef.current) {
            logger.warn('Component unmounted, skipping players update')
            return
          }

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const data = await response.json()
          
          if (data.success && isMountedRef.current) {
            const playersList = data.players || []
            setPlayers(playersList)
          } else if (isMountedRef.current) {
            logger.warn('Failed to fetch players:', data.error)
            setPlayers([])
          }
        } catch (err) {
          if (!isMountedRef.current) return
          logger.error('Error fetching players:', err)
          if (isMountedRef.current) {
            setPlayers([])
          }
        }
      }

      const fetchTotalTeams = async () => {
        if (!currentSportName) return
        
        setLoadingTeams(true)
        try {
          const encodedSport = encodeURIComponent(currentSportName)
          const response = await fetchWithAuth(`/api/teams/${encodedSport}`)
          
          if (!isMountedRef.current) return

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const data = await response.json()
          if (data.success && isMountedRef.current) {
            setTotalTeams(data.total_teams || 0)
          } else if (isMountedRef.current) {
            setTotalTeams(0)
          }
        } catch (err) {
          if (!isMountedRef.current) return
          logger.error('Error fetching total teams:', err)
          if (isMountedRef.current) {
            setTotalTeams(0)
          }
        } finally {
          if (isMountedRef.current) {
            setLoadingTeams(false)
          }
        }
      }

      fetchPlayers()
      fetchTotalTeams()
    }

    return () => {
      isMountedRef.current = false
    }
  }, [isOpen, selectedSport?.name, selectedSport?.type])

  // Reset selected players when modal opens/closes or sport changes
  useEffect(() => {
    if (isOpen && isTeam && playerCount > 0) {
      const initial = {}
      for (let i = 1; i <= playerCount; i++) {
        initial[i] = ''
      }
      // Auto-select logged-in user as Player 1 if they are a captain
      if (loggedInUser?.reg_number && loggedInUser?.captain_in && Array.isArray(loggedInUser.captain_in) && loggedInUser.captain_in.length > 0) {
        initial[1] = loggedInUser.reg_number
      }
      setSelectedPlayers(initial)
    } else {
      setSelectedPlayers({})
    }
    // Reset state when modal closes is handled by useApi hook
  }, [isOpen, isTeam, playerCount, loggedInUser])

  // Registration countdown
  useEffect(() => {
    if (!isOpen) return

    const targetTime = new Date(EVENT_INFO.registrationDates.start).getTime()

    const update = () => {
      const now = Date.now()
      const diff = targetTime - now

      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
        const minutes = Math.floor((diff / (1000 * 60)) % 60)
        const seconds = Math.floor((diff / 1000) % 60)

        setRegistrationCountdown(
          `Registration opens in: ${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
        )
      } else {
        setRegistrationCountdown('Registration is OPEN!')
      }
    }

    update()
    const timer = setInterval(update, 1000)

    return () => clearInterval(timer)
  }, [isOpen])

  const handlePlayerSelect = (playerIndex, regNumber) => {
    setSelectedPlayers((prev) => ({
      ...prev,
      [playerIndex]: regNumber,
    }))
  }

  // Handle general registration form submission
  const handleGeneralSubmit = async (e) => {
    e.preventDefault()

    if (isSubmitting) return

    const form = e.target
    const regNumber = form.querySelector('[name="reg_number"]')?.value?.trim()
    const fullName = form.querySelector('[name="full_name"]')?.value?.trim()
    const gender = form.querySelector('[name="gender"]')?.value?.trim()
    const dept = form.querySelector('[name="department_branch"]')?.value?.trim()
    const year = form.querySelector('[name="year"]')?.value?.trim()
    const phone = form.querySelector('[name="mobile_number"]')?.value?.trim()
    const email = form.querySelector('[name="email_id"]')?.value?.trim()
    const password = form.querySelector('[name="password"]')?.value?.trim()

    if (!regNumber || !fullName || !gender || !dept || !year || !phone || !email || !password) {
      onStatusPopup('❌ Please fill all required fields.', 'error', 2500)
      return
    }

    try {
      await executeGeneral(
        () => fetch(`${API_URL}/api/save-player`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reg_number: regNumber,
            full_name: fullName,
            gender: gender,
            department_branch: dept,
            year: year,
            mobile_number: phone,
            email_id: email,
            password: password,
          }),
        }),
        {
          onSuccess: (data) => {
            // Clear cache to ensure new player appears in player lists
            clearCache('/api/players')
            onStatusPopup('✅ Your registration has been saved!', 'success', 2500)
            form.reset()
            setTimeout(() => {
              onClose()
            }, 2500)
          },
          onError: async (err) => {
            // Try to extract a more detailed error message from the response
            let errorMessage = err.message || 'Error while saving. Please try again.'
            
            // If error has status 409, it's a duplicate registration number
            if (err.status === 409) {
              errorMessage = 'Registration number already exists. Please use a different registration number.'
            } else if (err.message && err.message.includes('already exists')) {
              errorMessage = err.message
            }
            
            onStatusPopup(`❌ ${errorMessage}`, 'error', 4000)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      logger.error('Error while saving player:', err)
      
      // Check if it's a duplicate registration number error
      let errorMessage = 'Error while saving. Please try again.'
      if (err.status === 409 || (err.message && err.message.includes('already exists'))) {
        errorMessage = 'Registration number already exists. Please use a different registration number.'
      }
      
      onStatusPopup(`❌ ${errorMessage}`, 'error', 4000)
    }
  }

  // Handle team event form submission
  const handleTeamSubmit = async (e) => {
    e.preventDefault()

    if (isSubmittingTeam) return

    if (!loggedInUser) {
      onStatusPopup('❌ Please login to register a team.', 'error', 2500)
      return
    }

    const form = e.target
    const teamName = form.querySelector('[name="teamName"]')?.value?.trim()

    if (!teamName) {
      onStatusPopup('❌ Please enter team name.', 'error', 2500)
      return
    }

    // Validate all players are selected
    const missingPlayers = []
    for (let i = 1; i <= playerCount; i++) {
      if (!selectedPlayers[i]) {
        missingPlayers.push(i)
      }
    }

    if (missingPlayers.length > 0) {
      onStatusPopup(`❌ Please select all players.`, 'error', 2500)
      return
    }

    // Validate that logged-in user is one of the selected players
    const loggedInUserSelected = Object.values(selectedPlayers).includes(loggedInUser.reg_number)
    if (!loggedInUserSelected) {
      onStatusPopup('❌ You must include yourself as one of the players.', 'error', 3000)
      return
    }

    // Check for duplicate players
    const playerRegNumbers = []
    const duplicateCheck = new Set()
    const duplicates = []
    
    for (let i = 1; i <= playerCount; i++) {
      if (selectedPlayers[i]) {
        if (duplicateCheck.has(selectedPlayers[i])) {
          const player = players.find(p => p.reg_number === selectedPlayers[i])
          duplicates.push(player ? player.full_name : selectedPlayers[i])
        } else {
          duplicateCheck.add(selectedPlayers[i])
          playerRegNumbers.push(selectedPlayers[i])
        }
      }
    }

    if (duplicates.length > 0) {
      onStatusPopup(`❌ Duplicate players selected: ${duplicates.join(', ')}. Each player can only be selected once.`, 'error', 5000)
      return
    }

    // Validate that all selected players have the same gender as logged-in user
    const genderMismatches = []
    for (let i = 1; i <= playerCount; i++) {
      if (selectedPlayers[i]) {
        const player = players.find(p => p.reg_number === selectedPlayers[i])
        if (player && player.gender !== loggedInUser.gender) {
          genderMismatches.push(`${player.full_name} (${player.reg_number})`)
        }
      }
    }

    if (genderMismatches.length > 0) {
      onStatusPopup(`❌ Gender mismatch: ${genderMismatches.join(', ')} must have the same gender (${loggedInUser.gender}) as you.`, 'error', 5000)
      return
    }

    // Validate that all selected players have the same year as logged-in user
    const yearMismatches = []
    for (let i = 1; i <= playerCount; i++) {
      if (selectedPlayers[i]) {
        const player = players.find(p => p.reg_number === selectedPlayers[i])
        if (player && player.year !== loggedInUser.year) {
          yearMismatches.push(`${player.full_name} (${player.reg_number})`)
        }
      }
    }

    if (yearMismatches.length > 0) {
      onStatusPopup(`❌ Year mismatch: ${yearMismatches.join(', ')} must be in the same year (${loggedInUser.year}) as you.`, 'error', 5000)
      return
    }

    // All client-side validation passed, now validate participation limits before submitting
    try {
      const validationResponse = await fetchWithAuth('/api/validate-participations', {
        method: 'POST',
        body: JSON.stringify({
          reg_numbers: playerRegNumbers,
          sport: selectedSport.name,
        }),
      })

      const validationData = await validationResponse.json()
      if (!validationResponse.ok || !validationData.success) {
        const errorMessage = validationData.error || 'Some players cannot participate. Please check and try again.'
        onStatusPopup(`❌ ${errorMessage}`, 'error', 5000)
        return
      }
    } catch (validationError) {
      logger.error('Error validating participations:', validationError)
      onStatusPopup('❌ Error validating participations. Please try again.', 'error', 4000)
      return
    }

    // Update participated_in for all selected players
    if (playerRegNumbers.length > 0) {
      try {
        await executeTeam(
          () => fetchWithAuth('/api/update-team-participation', {
            method: 'POST',
            body: JSON.stringify({
              reg_numbers: playerRegNumbers,
              sport: selectedSport.name,
              team_name: teamName,
            }),
          }),
          {
            onSuccess: async (data) => {
              // Clear caches to ensure UI reflects the new team enrollment
              const encodedSport = encodeURIComponent(selectedSport.name)
              clearCache(`/api/teams/${encodedSport}`)
              clearCache(`/api/participants-count/${encodedSport}`)
              clearCache(`/api/event-schedule/${encodedSport}/teams-players`) // Update dropdowns in event schedule
              clearCache('/api/players')
              clearCache('/api/me') // Current user's participation data changes
              clearCache('/api/sports-counts') // Team count changes
              
              // Update logged-in user data if they are one of the players
              if (loggedInUser && playerRegNumbers.includes(loggedInUser.reg_number) && onUserUpdate) {
                try {
                  // Fetch updated player data (cache already cleared above)
                  const playerResponse = await fetchWithAuth('/api/players')
                  if (playerResponse.ok) {
                    const playerData = await playerResponse.json()
                    if (playerData.success) {
                      const updatedPlayer = playerData.players.find(p => p.reg_number === loggedInUser.reg_number)
                      if (updatedPlayer) {
                        const { password: _, ...playerWithoutPassword } = updatedPlayer
                        onUserUpdate(playerWithoutPassword)
                      }
                    }
                  }
                } catch (updateError) {
                  logger.error('Error updating user data:', updateError)
                  // Don't block success message if user update fails
                }
              }

              onStatusPopup(`✅ Your team registration for ${selectedSport.name.toUpperCase()} has been saved!`, 'success', 2500)
              form.reset()
              setSelectedPlayers({})
              
              // Close the popup immediately after successful team creation
              setTimeout(() => {
                onClose()
              }, 500) // Reduced delay to close faster
            },
            onError: (err) => {
              const errorMessage = err.message || 'Error updating player participations. Please try again.'
              onStatusPopup(`❌ ${errorMessage}`, 'error', 5000)
            },
          }
        )
      } catch (err) {
        // This catch handles cases where execute throws before onError is called
        logger.error('Error updating participation:', err)
        onStatusPopup('❌ Error updating player participations. Please try again.', 'error', 4000)
      }
    }
  }

  // Handle individual/cultural event confirmation
  const handleIndividualConfirm = async (confirmed) => {
    if (!confirmed) {
      onClose()
      return
    }

    if (isSubmittingIndividual) return

    if (!loggedInUser) {
      onStatusPopup('❌ Please login to participate.', 'error', 2500)
      return
    }

    try {
      await executeIndividual(
        () => fetchWithAuth('/api/update-participation', {
          method: 'POST',
          body: JSON.stringify({
            reg_number: loggedInUser.reg_number,
            sport: selectedSport.name,
          }),
        }),
        {
          onSuccess: (data) => {
            // Clear caches to ensure UI reflects the new participant enrollment
            const encodedSport = encodeURIComponent(selectedSport.name)
            clearCache(`/api/participants/${encodedSport}`)
            clearCache(`/api/participants-count/${encodedSport}`)
            clearCache(`/api/event-schedule/${encodedSport}/teams-players`) // Update dropdowns in event schedule
            clearCache('/api/players')
            clearCache('/api/me') // Current user's participation data changes
            clearCache('/api/sports-counts') // Participant count changes

            // Update logged-in user data with latest information
            if (data.player && onUserUpdate) {
              const { password: _, ...updatedPlayer } = data.player
              onUserUpdate(updatedPlayer)
            }

            // Set just participated flag to show success message instead of "Already Participated"
            setJustParticipated(true)
            
            onStatusPopup(`✅ Participated Successfully!`, 'success', 2500)

            // Close the popup immediately after successful participation
            setTimeout(() => {
              onClose()
            }, 500) // Reduced delay to close faster
          },
          onError: (err) => {
            const errorMessage = err.message || 'Error updating participation. Please try again.'
            onStatusPopup(`❌ ${errorMessage}`, 'error', 5000)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      logger.error('Error while submitting individual registration:', err)
      onStatusPopup('❌ Error while submitting. Please try again.', 'error', 2500)
    }
  }

  if (!isOpen) return null

  // Check if user has already participated in this non-team event
  const hasAlreadyParticipated = !isTeam && loggedInUser?.participated_in && 
    Array.isArray(loggedInUser.participated_in) &&
    loggedInUser.participated_in.some(p => p.sport === selectedSport?.name)

  // Individual/Cultural Events - Confirmation Dialog or Already Participated View
  if (selectedSport && !isTeam) {
    // If user has already participated (and not just participated), show view-only mode
    if (hasAlreadyParticipated && !justParticipated) {
      return (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title={selectedSport.name.toUpperCase()}
          subtitle={EVENT_INFO.fullName}
          embedded={embedded}
          maxWidth="max-w-[420px]"
        >
          <div className="text-center mb-6">
            <div className="inline-block px-4 py-2 rounded-full bg-[rgba(34,197,94,0.2)] text-[#22c55e] text-[0.9rem] font-bold uppercase tracking-[0.1em] border border-[rgba(34,197,94,0.4)]">
              ✓ Already Participated
            </div>
          </div>

          <div className="text-[0.9rem] text-[#cbd5ff] mb-8 text-center">
            Total Players Participated: <span className="text-[#ffe66d] font-bold text-[1.1rem]">{loadingParticipants ? '...' : totalParticipants}</span>
          </div>
        </Modal>
      )
    }

    // User hasn't participated yet - show confirmation dialog
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={selectedSport.name.toUpperCase()}
        subtitle={EVENT_INFO.fullName}
        embedded={embedded}
        maxWidth="max-w-[420px]"
      >
        {players.length > 0 && (
          <div className="text-[0.75rem] text-center text-[#94a3b8] mb-2">
            {players.length} player{players.length !== 1 ? 's' : ''} available
          </div>
        )}
        <div className="text-[0.9rem] text-[#cbd5ff] mb-4 text-center">
          Total Players Participated: <span className="text-[#ffe66d] font-bold">{loadingParticipants ? '...' : totalParticipants}</span>
        </div>

        {registrationCountdown && (
          <div className="my-2 mb-6 text-center text-base font-semibold text-red-500">{registrationCountdown}</div>
        )}

        <div className="text-center text-[1.1rem] font-semibold text-[#e5e7eb] mb-8">
          Are you sure you want to participate?
        </div>

        <div className="flex gap-[0.6rem] mt-[0.8rem]">
          <Button
            type="button"
            onClick={() => handleIndividualConfirm(true)}
            disabled={isSubmittingIndividual}
            loading={isSubmittingIndividual}
            className="flex-1 rounded-full py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em]"
          >
            {isSubmittingIndividual ? 'Submitting...' : 'Yes'}
          </Button>
          <Button
            type="button"
            onClick={() => handleIndividualConfirm(false)}
            disabled={isSubmittingIndividual}
            variant="secondary"
            className="flex-1 rounded-full py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em]"
          >
            No
          </Button>
        </div>
      </Modal>
    )
  }

  // Team Events - Team Name + Player Dropdowns
  // Only show for logged-in users with captain_in (non-empty array)
  if (selectedSport && isTeam) {
    // Check if user is logged in and has captain role
    const hasCaptainRole = loggedInUser?.captain_in && Array.isArray(loggedInUser.captain_in) && loggedInUser.captain_in.length > 0
    if (!loggedInUser || !hasCaptainRole) {
      // Don't show form if user is not a captain
      return null
    }
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Team Registration"
        subtitle={`${selectedSport.name.toUpperCase()} • ${EVENT_INFO.fullName}`}
        embedded={embedded}
        maxWidth="max-w-[420px]"
      >
        <div className="text-[0.9rem] text-[#cbd5ff] mb-4 text-center">
          Total Teams Participated: <span className="text-[#ffe66d] font-bold">{loadingTeams ? '...' : totalTeams}</span>
        </div>

        {registrationCountdown && (
          <div className="my-2 mb-[0.9rem] text-center text-base font-semibold text-red-500">{registrationCountdown}</div>
        )}

        <form id="teamRegistrationForm" onSubmit={handleTeamSubmit}>
          <Input
            label="Team Name"
            id="teamName"
            name="teamName"
            required
          />

            {Array.from({ length: playerCount }, (_, i) => i + 1).map((index) => {
              // Get all selected reg_numbers except the current one
              const otherSelectedRegNumbers = Object.entries(selectedPlayers)
                .filter(([key, value]) => key !== String(index) && value)
                .map(([_, value]) => value)

              // Get team gender and year for filtering
              const teamGender = loggedInUser?.gender
              const teamYear = loggedInUser?.year

              // Filter players for this dropdown
              const filteredPlayers = players.length === 0 ? [] : (() => {
                // Check if logged-in user is a captain for this sport
                const isLoggedInUserCaptain = loggedInUser?.captain_in && 
                  Array.isArray(loggedInUser.captain_in) && 
                  loggedInUser.captain_in.includes(selectedSport?.name)
                
                // Count how many captains are already selected
                const selectedCaptainsCount = Object.values(selectedPlayers)
                  .filter(regNum => {
                    const player = players.find(p => p.reg_number === regNum)
                    return player && player.captain_in && 
                           Array.isArray(player.captain_in) && 
                           player.captain_in.includes(selectedSport?.name)
                  }).length
                
                return players.filter((player) => {
                  // Basic filters
                  if (player.reg_number === 'admin') return false
                  if (player.gender !== teamGender) return false
                  if (player.year !== teamYear) return false
                  
                  // Allow currently selected player to remain in list
                  if (player.reg_number === selectedPlayers[index]) return true
                  
                  // Exclude if already selected in another dropdown
                  if (otherSelectedRegNumbers.includes(player.reg_number)) return false
                  
                  // Check if player is already in a team for this sport
                  if (player.participated_in && Array.isArray(player.participated_in)) {
                    const existingParticipation = player.participated_in.find(
                      p => p.sport === selectedSport?.name && p.team_name
                    )
                    if (existingParticipation) {
                      // Player is already in a team for this sport
                      return false
                    }
                  }
                  
                  // Check if player is a captain for this sport
                  const isPlayerCaptain = player.captain_in && 
                    Array.isArray(player.captain_in) && 
                    player.captain_in.includes(selectedSport?.name)
                  
                  if (isPlayerCaptain) {
                    // If this is the logged-in user (who is creating the team), allow them
                    if (player.reg_number === loggedInUser?.reg_number && index === 1) {
                      return true
                    }
                    
                    // If a captain is already selected, don't show other captains
                    // (team can only have one captain)
                    if (selectedCaptainsCount > 0) {
                      return false
                    }
                    
                    // Check if this captain has already created a team for this sport
                    if (player.participated_in && Array.isArray(player.participated_in)) {
                      const captainTeamParticipation = player.participated_in.find(
                        p => p.sport === selectedSport?.name && p.team_name
                      )
                      if (captainTeamParticipation) {
                        // Captain has already created a team
                        return false
                      }
                    }
                  }
                  
                  return true
                })
              })()

              if (index === 1 && filteredPlayers.length === 0 && players.length > 0) {
                logger.warn('No players available after filtering:', {
                  totalPlayers: players.length,
                  userGender: loggedInUser?.gender,
                  userYear: loggedInUser?.year,
                  filteredCount: filteredPlayers.length
                })
              }

              const playerOptions = [
                { value: '', label: players.length === 0 ? 'Loading players...' : 'Select Player' },
                ...filteredPlayers.map((player) => ({
                  value: player.reg_number,
                  label: `${player.full_name} (${player.reg_number})`
                }))
              ]

              return (
                <Input
                  key={index}
                  label={`Player ${index} ${index === 1 && loggedInUser ? '(You - Required)' : ''}`}
                  id={`player_${index}`}
                  name={`player_${index}`}
                  type="select"
                  value={selectedPlayers[index] || ''}
                  onChange={(e) => handlePlayerSelect(index, e.target.value)}
                  required
                  options={playerOptions}
                />
              )
            })}

            <div className="flex flex-col mb-[0.7rem]">
              <label className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                <input type="checkbox" id="declaration" required className="mr-2" />
                I agree to follow all rules of {EVENT_INFO.name}.
              </label>
            </div>

          <div className="flex gap-[0.6rem] mt-[0.8rem]">
            <Button
              type="submit"
              disabled={isSubmittingTeam}
              loading={isSubmittingTeam}
              className="flex-1 rounded-full py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em]"
            >
              {isSubmittingTeam ? 'Submitting...' : 'Submit'}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              disabled={isSubmittingTeam}
              variant="secondary"
              className="flex-1 rounded-full py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em]"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    )
  }

  // General Registration - Full Form
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Player Entry Form"
      subtitle={EVENT_INFO.fullName}
      embedded={embedded}
      maxWidth="max-w-[420px]"
    >
      {registrationCountdown && (
        <div className="my-2 mb-[0.9rem] text-center text-base font-semibold text-red-500">{registrationCountdown}</div>
      )}

      <form id="generalRegistrationForm" onSubmit={handleGeneralSubmit}>
        <Input
          label="Reg. Number"
          id="reg_number"
          name="reg_number"
          required
        />

        <Input
          label="Full Name"
          id="full_name"
          name="full_name"
          required
        />

        <Input
          label="Gender"
          id="gender"
          name="gender"
          type="select"
          required
          options={GENDER_OPTIONS}
        />

        <Input
          label="Department / Branch"
          id="department_branch"
          name="department_branch"
          type="select"
          required
          options={DEPARTMENT_OPTIONS}
        />

        <Input
          label="Year"
          id="year"
          name="year"
          type="select"
          required
          options={[
            { value: '', label: 'Select' },
            { value: '1st Year (2025)', label: '1st Year (2025)' },
            { value: '2nd Year (2024)', label: '2nd Year (2024)' },
            { value: '3rd Year (2023)', label: '3rd Year (2023)' },
            { value: '4th Year (2022)', label: '4th Year (2022)' },
          ]}
        />

        <Input
          label="Mobile Number"
          id="mobile_number"
          name="mobile_number"
          type="tel"
          required
        />

        <Input
          label="Email ID"
          id="email_id"
          name="email_id"
          type="email"
          required
        />

        <Input
          label="Password"
          id="password"
          name="password"
          type="password"
          required
        />

        <div className="flex gap-[0.6rem] mt-[0.8rem]">
          <Button
            type="submit"
            disabled={isSubmitting}
            loading={isSubmitting}
            className="flex-1 rounded-full py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em]"
          >
            {isSubmitting ? 'Registering...' : 'Submit'}
          </Button>
          <Button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            variant="secondary"
            className="flex-1 rounded-full py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em]"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default RegisterModal
