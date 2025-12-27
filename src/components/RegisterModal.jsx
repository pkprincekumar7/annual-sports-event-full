import { useState, useEffect } from 'react'
import { fetchWithAuth, API_URL, clearCache } from '../utils/api'
import logger from '../utils/logger'

function RegisterModal({ isOpen, onClose, selectedSport, onStatusPopup, loggedInUser, onUserUpdate }) {
  const [registrationCountdown, setRegistrationCountdown] = useState('')
  const [players, setPlayers] = useState([])
  const [selectedPlayers, setSelectedPlayers] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [totalTeams, setTotalTeams] = useState(0)
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [loadingParticipants, setLoadingParticipants] = useState(false)

  const isTeam = selectedSport?.type === 'team'
  const playerCount = isTeam ? selectedSport?.players || 0 : 0
  const isGeneralRegistration = !selectedSport

  // Fetch players list for team player dropdowns (with caching and cancellation)
  useEffect(() => {
    if (!isOpen) {
      setPlayers([])
      setTotalTeams(0)
      setTotalParticipants(0)
      return
    }

    if (!isTeam) {
      // For non-team events, fetch participants count
      let isMounted = true
      const abortController = new AbortController()

      const fetchParticipantsCount = async () => {
        if (!selectedSport?.name) return
        
        setLoadingParticipants(true)
        try {
          const encodedSport = encodeURIComponent(selectedSport.name)
          const response = await fetchWithAuth(`/api/participants-count/${encodedSport}`, {
            signal: abortController.signal,
          })
          
          if (!isMounted) return

          const data = await response.json()
          if (data.success) {
            setTotalParticipants(data.total_participants || 0)
          }
        } catch (err) {
          if (!isMounted || err.name === 'AbortError') return
          logger.error('Error fetching participants count:', err)
          setTotalParticipants(0)
        } finally {
          if (isMounted) {
            setLoadingParticipants(false)
          }
        }
      }

      fetchParticipantsCount()

      return () => {
        isMounted = false
        abortController.abort()
      }
    }

    // For team events

    let isMounted = true
    const abortController = new AbortController()

    const fetchPlayers = async () => {
      try {
        const response = await fetchWithAuth('/api/players', {
          signal: abortController.signal,
        })
        
        if (!isMounted) return

        const data = await response.json()
        if (data.success) {
          setPlayers(data.players || [])
        }
      } catch (err) {
        if (!isMounted || err.name === 'AbortError') return
        logger.error('Error fetching players:', err)
        setPlayers([])
      }
    }

    const fetchTotalTeams = async () => {
      if (!selectedSport?.name) return
      
      setLoadingTeams(true)
      try {
        const encodedSport = encodeURIComponent(selectedSport.name)
        const response = await fetchWithAuth(`/api/teams/${encodedSport}`, {
          signal: abortController.signal,
        })
        
        if (!isMounted) return

        const data = await response.json()
        if (data.success) {
          setTotalTeams(data.total_teams || 0)
        }
      } catch (err) {
        if (!isMounted || err.name === 'AbortError') return
        logger.error('Error fetching total teams:', err)
        setTotalTeams(0)
      } finally {
        if (isMounted) {
          setLoadingTeams(false)
        }
      }
    }

    fetchPlayers()
    fetchTotalTeams()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [isOpen, isTeam, selectedSport])

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
    // Reset submitting state when modal closes
    if (!isOpen) {
      setIsSubmitting(false)
    }
  }, [isOpen, isTeam, playerCount, loggedInUser])

  // Registration countdown
  useEffect(() => {
    if (!isOpen) return

    const targetTime = new Date('2026-01-02T00:00:00').getTime()

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

    setIsSubmitting(true)
    try {
      // Save to JSON file via backend API
      const response = await fetch(`${API_URL}/api/save-player`, {
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
      })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.success) {
        onStatusPopup('✅ Your registration has been saved!', 'success', 2500)
        form.reset()
        setIsSubmitting(false)
        setTimeout(() => {
          onClose()
        }, 2500)
      } else {
        // Handle error response (including duplicate registration)
        const errorMessage = data.error || 'Error while saving. Please try again.'
        onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
        setIsSubmitting(false)
      }
    } catch (err) {
      logger.error('Error while saving player:', err)
      onStatusPopup('❌ Error while saving. Please try again.', 'error', 2500)
      setIsSubmitting(false)
    }
  }

  // Handle team event form submission
  const handleTeamSubmit = async (e) => {
    e.preventDefault()

    if (isSubmitting) return

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

    // All client-side validation passed, now set submitting state before API calls
    setIsSubmitting(true)

    // Validate participation limits before submitting
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
        setIsSubmitting(false)
        return
      }
    } catch (validationError) {
      logger.error('Error validating participations:', validationError)
      onStatusPopup('❌ Error validating participations. Please try again.', 'error', 4000)
      setIsSubmitting(false)
      return
    }

    try {
      // Update participated_in for all selected players (already collected above)
      if (playerRegNumbers.length > 0) {
        try {
          const participationResponse = await fetchWithAuth('/api/update-team-participation', {
            method: 'POST',
            body: JSON.stringify({
              reg_numbers: playerRegNumbers,
              sport: selectedSport.name,
              team_name: teamName,
            }),
          })

          const participationData = await participationResponse.json()
          
          if (!participationResponse.ok || !participationData.success) {
            // Show error message to user
            const errorMessage = participationData.error || 'Error updating player participations. Please try again.'
            onStatusPopup(`❌ ${errorMessage}`, 'error', 5000)
            setIsSubmitting(false)
            return // Don't proceed with closing modal
          }

          // Update logged-in user data if they are one of the players
          // Use the updated player data from the response if available
          if (loggedInUser && playerRegNumbers.includes(loggedInUser.reg_number) && onUserUpdate) {
            // The participation response should include updated player data
            // If not, we can fetch it, but with cache it's fast
            try {
              // Clear cache to get fresh data
              clearCache('/api/players')
              
              // Fetch updated player data (will use cache if available)
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
        } catch (participationError) {
          logger.error('Error updating participation:', participationError)
          onStatusPopup('❌ Error updating player participations. Please try again.', 'error', 4000)
          setIsSubmitting(false)
          return
        }
      }

      onStatusPopup(`✅ Your team registration for ${selectedSport.name.toUpperCase()} has been saved!`, 'success', 2500)

      form.reset()
      setSelectedPlayers({})
      setIsSubmitting(false)
      setTimeout(() => {
        onClose()
      }, 2500)
    } catch (err) {
      logger.error('Error while submitting team registration:', err)
      onStatusPopup('❌ Error while submitting. Please try again.', 'error', 2500)
      setIsSubmitting(false)
    }
  }

  // Handle individual/cultural event confirmation
  const handleIndividualConfirm = async (confirmed) => {
    if (!confirmed) {
      onClose()
      return
    }

    if (isSubmitting) return

    if (!loggedInUser) {
      onStatusPopup('❌ Please login to participate.', 'error', 2500)
      return
    }

    setIsSubmitting(true)
    try {
      // Update participated_in field in players.json
      try {
        const response = await fetchWithAuth('/api/update-participation', {
          method: 'POST',
          body: JSON.stringify({
            reg_number: loggedInUser.reg_number,
            sport: selectedSport.name,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        if (!data.success) {
          // Show error message to user
          const errorMessage = data.error || 'Error updating participation. Please try again.'
          onStatusPopup(`❌ ${errorMessage}`, 'error', 5000)
          setIsSubmitting(false)
          return // Don't proceed with closing modal or showing success
        }

        // Update logged-in user data with latest information
        if (data.player && onUserUpdate) {
          const { password: _, ...updatedPlayer } = data.player
          onUserUpdate(updatedPlayer)
        }

        onStatusPopup(`✅ Your registration for ${selectedSport.name.toUpperCase()} has been saved!`, 'success', 2500)
        setIsSubmitting(false)

        setTimeout(() => {
          onClose()
        }, 2500)
      } catch (participationError) {
        logger.error('Error updating participation:', participationError)
        onStatusPopup('❌ Error updating participation. Please try again.', 'error', 4000)
        setIsSubmitting(false)
        return
      }
    } catch (err) {
      logger.error('Error while submitting individual registration:', err)
      onStatusPopup('❌ Error while submitting. Please try again.', 'error', 2500)
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Check if user has already participated in this non-team event
  const hasAlreadyParticipated = !isTeam && loggedInUser?.participated_in && 
    Array.isArray(loggedInUser.participated_in) &&
    loggedInUser.participated_in.some(p => p.sport === selectedSport?.name)

  // Individual/Cultural Events - Confirmation Dialog or Already Participated View
  if (selectedSport && !isTeam) {
    // If user has already participated, show view-only mode
    if (hasAlreadyParticipated) {
      return (
        <div
          className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4"
        >
          <aside className="max-w-[420px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] pb-[1.5rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative">
            <button
              type="button"
              className="absolute top-[10px] right-3 bg-transparent border-none text-[#e5e7eb] text-base cursor-pointer hover:text-[#ffe66d] transition-colors"
              onClick={onClose}
            >
              ✕
            </button>

            <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">Participation Status</div>
            <div className="text-[1.25rem] font-extrabold text-center uppercase tracking-[0.14em] text-[#ffe66d] mb-[0.7rem]">
              {selectedSport.name.toUpperCase()}
            </div>
            <div className="text-[0.85rem] text-center text-[#e5e7eb] mb-6">PCE, Purnea • Umang – 2026 Sports Fest</div>

            <div className="text-center mb-6">
              <div className="inline-block px-4 py-2 rounded-full bg-[rgba(34,197,94,0.2)] text-[#22c55e] text-[0.9rem] font-bold uppercase tracking-[0.1em] border border-[rgba(34,197,94,0.4)]">
                ✓ Already Participated
              </div>
            </div>

            <div className="text-[0.9rem] text-[#cbd5ff] mb-8 text-center">
              Total Players Participated: <span className="text-[#ffe66d] font-bold text-[1.1rem]">{loadingParticipants ? '...' : totalParticipants}</span>
            </div>

            <div className="flex justify-center mt-[0.8rem]">
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-[9px] rounded-full border border-[rgba(148,163,184,0.7)] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.9)]"
              >
                Close
              </button>
            </div>
          </aside>
        </div>
      )
    }

    // User hasn't participated yet - show confirmation dialog
    return (
      <div
        className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4"
      >
        <aside className="max-w-[420px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] pb-[1.5rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative">
          <button
            type="button"
            className="absolute top-[10px] right-3 bg-transparent border-none text-[#e5e7eb] text-base cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>

          <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">Official Registration</div>
          <div className="text-[1.25rem] font-extrabold text-center uppercase tracking-[0.14em] text-[#ffe66d] mb-[0.7rem]">
            {selectedSport.name.toUpperCase()}
          </div>
          <div className="text-[0.85rem] text-center text-[#e5e7eb] mb-4">PCE, Purnea • Umang – 2026 Sports Fest</div>
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
            <button
              type="button"
              onClick={() => handleIndividualConfirm(true)}
              disabled={isSubmitting}
              className="flex-1 rounded-full border-none py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#ffe66d] to-[#ff9f1c] text-[#111827] shadow-[0_10px_24px_rgba(250,204,21,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(250,204,21,0.75)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isSubmitting ? 'Submitting...' : 'Yes'}
            </button>
            <button
              type="button"
              onClick={() => handleIndividualConfirm(false)}
              disabled={isSubmitting}
              className="flex-1 rounded-full border border-[rgba(148,163,184,0.7)] py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.9)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              No
            </button>
          </div>
        </aside>
      </div>
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
      <div
        className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4"
      >
        <aside className="max-w-[420px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] pb-[1.5rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative max-h-[90vh] overflow-y-auto">
          <button
            type="button"
            className="absolute top-[10px] right-3 bg-transparent border-none text-[#e5e7eb] text-base cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>

          <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">Official Registration</div>
          <div className="text-[1.25rem] font-extrabold text-center uppercase tracking-[0.14em] text-[#ffe66d] mb-[0.7rem]">
            Team Registration
          </div>
          <div className="text-[0.85rem] text-center text-[#e5e7eb] mb-4">PCE, Purnea • Umang – 2026 Sports Fest</div>
          <div className="my-1 mb-2 text-center text-[0.95rem] font-semibold text-[#ffe66d]">
            Sports Name: {selectedSport.name.toUpperCase()}
          </div>
          <div className="text-[0.9rem] text-[#cbd5ff] mb-4 text-center">
            Total Teams Participated: <span className="text-[#ffe66d] font-bold">{loadingTeams ? '...' : totalTeams}</span>
          </div>

          {registrationCountdown && (
            <div className="my-2 mb-[0.9rem] text-center text-base font-semibold text-red-500">{registrationCountdown}</div>
          )}

          <form id="teamRegistrationForm" onSubmit={handleTeamSubmit}>
            <div className="flex flex-col mb-[0.7rem]">
              <label htmlFor="teamName" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                Team Name *
              </label>
              <input
                type="text"
                id="teamName"
                name="teamName"
                required
                className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
              />
            </div>

            {Array.from({ length: playerCount }, (_, i) => i + 1).map((index) => {
              // Get all selected reg_numbers except the current one
              const otherSelectedRegNumbers = Object.entries(selectedPlayers)
                .filter(([key, value]) => key !== String(index) && value)
                .map(([_, value]) => value)

              return (
                <div key={index} className="flex flex-col mb-[0.7rem]">
                  <label htmlFor={`player_${index}`} className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                    Player {index} {index === 1 && loggedInUser ? '(You - Required)' : ''} *
                  </label>
                  <select
                    id={`player_${index}`}
                    name={`player_${index}`}
                    required
                    value={selectedPlayers[index] || ''}
                    onChange={(e) => handlePlayerSelect(index, e.target.value)}
                    className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
                  >
                    <option value="">Select Player</option>
                    {players
                      .filter((player) => 
                        player.reg_number !== 'admin' && 
                        player.gender === loggedInUser?.gender &&
                        player.year === loggedInUser?.year &&
                        (player.reg_number === selectedPlayers[index] || !otherSelectedRegNumbers.includes(player.reg_number))
                      )
                      .map((player) => (
                        <option key={player.reg_number} value={player.reg_number}>
                          {player.full_name} ({player.reg_number})
                        </option>
                      ))}
                  </select>
                </div>
              )
            })}

            <div className="flex flex-col mb-[0.7rem]">
              <label className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                <input type="checkbox" id="declaration" required className="mr-2" />
                I agree to follow all rules of Umang 2026.
              </label>
            </div>

            <div className="flex gap-[0.6rem] mt-[0.8rem]">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-full border-none py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#ffe66d] to-[#ff9f1c] text-[#111827] shadow-[0_10px_24px_rgba(250,204,21,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(250,204,21,0.75)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 rounded-full border border-[rgba(148,163,184,0.7)] py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.9)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                Cancel
              </button>
            </div>
          </form>
        </aside>
      </div>
    )
  }

  // General Registration - Full Form
  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4"
    >
      <aside className="max-w-[420px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] pb-[1.5rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          className="absolute top-[10px] right-3 bg-transparent border-none text-[#e5e7eb] text-base cursor-pointer"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">Official Registration</div>
        <div className="text-[1.25rem] font-extrabold text-center uppercase tracking-[0.14em] text-[#ffe66d] mb-[0.7rem]">
          Player Entry Form
        </div>
        <div className="text-[0.85rem] text-center text-[#e5e7eb] mb-4">PCE, Purnea • Umang – 2026 Sports Fest</div>

        {registrationCountdown && (
          <div className="my-2 mb-[0.9rem] text-center text-base font-semibold text-red-500">{registrationCountdown}</div>
        )}

        <form id="generalRegistrationForm" onSubmit={handleGeneralSubmit}>
          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="reg_number" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Reg. Number *
            </label>
            <input
              type="text"
              id="reg_number"
              name="reg_number"
              required
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            />
          </div>

          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="full_name" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Full Name *
            </label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              required
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            />
          </div>

          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="gender" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Gender *
            </label>
            <select
              id="gender"
              name="gender"
              required
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            >
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>

          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="department_branch" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Department / Branch *
            </label>
            <select
              id="department_branch"
              name="department_branch"
              required
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            >
              <option value="">Select</option>
              <option>CSE</option>
              <option>CSE (AI)</option>
              <option>ECE</option>
              <option>EE</option>
              <option>CE</option>
              <option>ME</option>
              <option>MTE</option>
            </select>
          </div>

          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="year" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Year *
            </label>
            <select
              id="year"
              name="year"
              required
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            >
              <option value="">Select</option>
              <option>1st Year (2025)</option>
              <option>2nd Year (2024)</option>
              <option>3rd Year (2023)</option>
              <option>4th Year (2022)</option>
            </select>
          </div>

          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="mobile_number" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Mobile Number *
            </label>
            <input
              type="tel"
              id="mobile_number"
              name="mobile_number"
              required
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            />
          </div>

          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="email_id" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Email ID *
            </label>
            <input
              type="email"
              id="email_id"
              name="email_id"
              required
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            />
          </div>

          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="password" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            />
          </div>

          <div className="flex gap-[0.6rem] mt-[0.8rem]">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-full border-none py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#ffe66d] to-[#ff9f1c] text-[#111827] shadow-[0_10px_24px_rgba(250,204,21,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(250,204,21,0.75)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isSubmitting ? 'Registering...' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-full border border-[rgba(148,163,184,0.7)] py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.9)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              Cancel
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

export default RegisterModal
