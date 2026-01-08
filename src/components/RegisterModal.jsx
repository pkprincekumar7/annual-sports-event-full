import { useState, useEffect, useRef } from 'react'
import { Modal, Button, Input } from './ui'
import { useApi, useDepartments, useEventYear } from '../hooks'
import { fetchWithAuth, API_URL, clearCache } from '../utils/api'
import { clearTeamParticipationCaches, clearIndividualParticipationCaches } from '../utils/cacheHelpers'
import { buildSportApiUrl, buildApiUrlWithYear } from '../utils/apiHelpers'
import logger from '../utils/logger'
import { GENDER_OPTIONS } from '../constants/app'
import { generateYearOfAdmissionOptions } from '../utils/yearHelpers'
import { formatSportName } from '../utils/stringHelpers'
import { isTeamSport, getSportType, getTeamSize, isCaptainForSport, isEnrolledInTeamEvent, hasParticipatedInIndividual } from '../utils/sportHelpers'
import { validateParticipantSelection, validateNoDuplicates, validateGenderMatch, validateYearMatch } from '../utils/participantValidation'

function RegisterModal({ isOpen, onClose, selectedSport, onStatusPopup, loggedInUser, onUserUpdate, embedded = false, selectedYear }) {
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
  const { departments: departmentOptions, loading: loadingDepartments } = useDepartments()
  const { eventYear: activeEventYear, eventYearConfig } = useEventYear()
  // Use selectedYear if provided (for admin), otherwise use active event year
  const eventYear = selectedYear || activeEventYear
  
  // Build event display name from database
  const eventDisplayName = eventYearConfig 
    ? `${eventYearConfig.event_organizer || 'Events Community'} • ${eventYearConfig.event_name} - ${eventYearConfig.year}`
    : 'Sports Event' // Fallback
  const eventName = eventYearConfig?.event_name || 'Sports Event'

  const sportType = getSportType(selectedSport)
  const isTeam = isTeamSport(sportType)
  const playerCount = isTeam ? getTeamSize(selectedSport) : 0
  const isGeneralRegistration = !selectedSport
  const prevSportNameRef = useRef(null)
  const isMountedRef = useRef(true)
  
  // Generate year of admission options
  const yearOfAdmissionOptions = generateYearOfAdmissionOptions(eventYear)

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
    const currentSportType = getSportType(selectedSport)
    const currentIsTeam = isTeamSport(currentSportType)

    // Don't fetch if eventYear is not available
    if (!eventYear) {
      if (!currentIsTeam) {
        setLoadingParticipants(false)
        setTotalParticipants(0)
      }
      return
    }

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
          const response = await fetchWithAuth(buildSportApiUrl('participants-count', currentSportName, eventYear))
          
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
            // API returns count in data.count field (not data.total_participants)
            const count = data.count !== undefined ? data.count : 0
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
          // Don't pass page parameter to get all players (needed for participant selection)
          const response = await fetchWithAuth(buildApiUrlWithYear('/api/players', eventYear))
          
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
        if (!currentSportName || !eventYear) return
        
        setLoadingTeams(true)
        try {
          const response = await fetchWithAuth(buildSportApiUrl('teams', currentSportName, eventYear))
          
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
  }, [isOpen, selectedSport?.name, selectedSport?.type, eventYear])

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
            // The useApi hook extracts the error message from the API response
            // Prioritize err.message which contains the backend error message
            const errorMessage = err?.message || err?.error || 'Error while saving. Please try again.'
            onStatusPopup(`❌ ${errorMessage}`, 'error', 4000)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      // Don't show duplicate error message - onError should have handled it
      logger.error('Error while saving player:', err)
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

    // Validate user is a captain for this specific sport
    const isCaptainForThisSport = loggedInUser?.captain_in && 
      Array.isArray(loggedInUser.captain_in) && 
      loggedInUser.captain_in.includes(selectedSport?.name)
    if (!isCaptainForThisSport) {
      onStatusPopup('❌ You can only create teams for sports where you are assigned as captain. Please contact admin to assign you as captain for this sport.', 'error', 4000)
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
    // Collect player reg numbers
    for (let i = 1; i <= playerCount; i++) {
      if (selectedPlayers[i]) {
        playerRegNumbers.push(selectedPlayers[i])
      }
    }

    // Get selected player objects for validation
    const selectedPlayerObjects = players.filter(p => playerRegNumbers.includes(p.reg_number))

    // Validate no duplicates
    const duplicateValidation = validateNoDuplicates(playerRegNumbers, players)
    if (!duplicateValidation.isValid) {
      onStatusPopup(`❌ ${duplicateValidation.error}`, 'error', 5000)
      return
    }

    // Validate gender match
    const genderValidation = validateGenderMatch(selectedPlayerObjects, loggedInUser.gender)
    if (!genderValidation.isValid) {
      onStatusPopup(`❌ ${genderValidation.error}`, 'error', 5000)
      return
    }

    // Validate year match
    const yearValidation = validateYearMatch(selectedPlayerObjects, loggedInUser.year)
    if (!yearValidation.isValid) {
      onStatusPopup(`❌ ${yearValidation.error}`, 'error', 5000)
      return
    }

    // All client-side validation passed, now validate participation limits before submitting
    try {
      const validationResponse = await fetchWithAuth('/api/validate-participations', {
        method: 'POST',
        body: JSON.stringify({
          reg_numbers: playerRegNumbers,
          sport: selectedSport.name,
          event_year: eventYear,
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
            event_year: eventYear,
          }),
          }),
          {
            onSuccess: async (data) => {
              // Clear caches to ensure UI reflects the new team enrollment
              clearTeamParticipationCaches(selectedSport.name, eventYear)
              
              // Update logged-in user data if they are one of the players
              // Use /api/me instead of /api/players for efficiency (only need current user's data)
              if (loggedInUser && playerRegNumbers.includes(loggedInUser.reg_number) && onUserUpdate) {
                try {
                  // Fetch updated user data (cache already cleared above)
                  const userResponse = await fetchWithAuth('/api/me')
                  if (userResponse.ok) {
                    const userData = await userResponse.json()
                    if (userData.success && userData.player) {
                      const { password: _, ...playerWithoutPassword } = userData.player
                      onUserUpdate(playerWithoutPassword)
                    }
                  }
                } catch (updateError) {
                  logger.error('Error updating user data:', updateError)
                  // Don't block success message if user update fails
                }
              }

              onStatusPopup(`✅ Your team registration for ${formatSportName(selectedSport.name)} has been saved!`, 'success', 2500)
              form.reset()
              setSelectedPlayers({})
              
              // Close the popup immediately after successful team creation
              setTimeout(() => {
                onClose()
              }, 500) // Reduced delay to close faster
            },
            onError: (err) => {
              // The useApi hook extracts the error message from the API response
              const errorMessage = err?.message || err?.error || 'Error updating player participations. Please try again.'
              onStatusPopup(`❌ ${errorMessage}`, 'error', 5000)
            },
          }
        )
      } catch (err) {
        // This catch handles cases where execute throws before onError is called
        // Don't show duplicate error message - onError should have handled it
        logger.error('Error updating participation:', err)
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
            event_year: eventYear,
          }),
        }),
        {
          onSuccess: async (data) => {
            // Clear caches to ensure UI reflects the new participant enrollment
            clearIndividualParticipationCaches(selectedSport.name, eventYear)

            // Update logged-in user data with latest information
            if (data.player && onUserUpdate) {
              const { password: _, ...updatedPlayer } = data.player
              onUserUpdate(updatedPlayer)
            } else if (onUserUpdate) {
              // If backend doesn't return player data, fetch it explicitly
              try {
                const userResponse = await fetchWithAuth('/api/me')
                if (userResponse.ok) {
                  const userData = await userResponse.json()
                  if (userData.success && userData.player) {
                    const { password: _, ...playerWithoutPassword } = userData.player
                    onUserUpdate(playerWithoutPassword)
                  }
                }
              } catch (updateError) {
                logger.error('Error updating user data:', updateError)
                // Don't block success message if user update fails
              }
            }

            // Set just participated flag to show success message instead of "Already Participated"
            setJustParticipated(true)
            
            onStatusPopup(`✅ Participated Successfully!`, 'success', 2500)

            // For embedded modals (inside SportDetailsModal), don't close immediately
            // Let the parent handle tab switching based on updated user data
            if (embedded) {
              // Give parent component time to update and re-evaluate tabs
              // The parent's onUserUpdate will handle tab switching
              setTimeout(() => {
                onClose()
              }, 300)
            } else {
              // For standalone modals, close after delay
              setTimeout(() => {
                onClose()
              }, 500)
            }
          },
          onError: (err) => {
            // The useApi hook extracts the error message from the API response
            const errorMessage = err?.message || err?.error || 'Error updating participation. Please try again.'
            onStatusPopup(`❌ ${errorMessage}`, 'error', 5000)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      // Don't show duplicate error message - onError should have handled it
      logger.error('Error while submitting individual registration:', err)
    }
  }

  if (!isOpen) return null

  // Check if user has already participated in this non-team event
  const hasAlreadyParticipated = !isTeam && hasParticipatedInIndividual(loggedInUser, selectedSport?.name)

  // Individual/Cultural Events - Confirmation Dialog or Already Participated View
  if (selectedSport && !isTeam) {
    // If user has already participated (and not just participated), show view-only mode
    if (hasAlreadyParticipated && !justParticipated) {
      return (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title={formatSportName(selectedSport.name)}
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
        subtitle={eventDisplayName}
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
  // Only show for logged-in users who are captains for THIS specific sport
  if (selectedSport && isTeam) {
    // Check if user is logged in and is a captain for THIS specific sport
    const isCaptainForThisSport = isCaptainForSport(loggedInUser, selectedSport.name)
    if (!loggedInUser || !isCaptainForThisSport) {
      // Don't show form if user is not a captain for this sport
      return null
    }
    
    // Validate playerCount is available
    if (playerCount === 0 || !playerCount) {
      return (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Team Registration"
          embedded={embedded}
          maxWidth="max-w-[420px]"
        >
          <div className="text-center text-[#cbd5ff] py-4">
            Team size is not configured for this sport. Please contact admin.
          </div>
        </Modal>
      )
    }
    
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Team Registration"
        subtitle={`${formatSportName(selectedSport.name)} • ${eventDisplayName}`}
        embedded={embedded}
        maxWidth="max-w-[420px]"
      >
        <div className="text-[0.9rem] text-[#cbd5ff] mb-4 text-center">
          Total Teams Participated: <span className="text-[#ffe66d] font-bold">{loadingTeams ? '...' : totalTeams}</span>
        </div>


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

              const playerOptions = players.length === 0 
                ? [{ value: '', label: 'Loading players...' }]
                : filteredPlayers.map((player) => ({
                    value: player.reg_number,
                    label: `${player.full_name} (${player.reg_number})`
                  }))

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
                I agree to follow all rules of {eventName}.
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
      subtitle={eventDisplayName}
      embedded={embedded}
      maxWidth="max-w-[420px]"
    >

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
          options={loadingDepartments ? [] : departmentOptions}
          disabled={loadingDepartments}
        />

        <Input
          label="Year"
          id="year"
          name="year"
          type="select"
          required
          options={yearOfAdmissionOptions}
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
