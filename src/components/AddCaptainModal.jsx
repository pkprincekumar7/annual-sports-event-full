import { useState, useEffect } from 'react'
import { Modal, Button, Input, EmptyState } from './ui'
import { useApi, useEventYearWithFallback } from '../hooks'
import { fetchWithAuth, clearCache } from '../utils/api'
import { buildApiUrlWithYear } from '../utils/apiHelpers'
import { formatSportName } from '../utils/stringHelpers'
import logger from '../utils/logger'

function AddCaptainModal({ isOpen, onClose, onStatusPopup, selectedYear }) {
  const [players, setPlayers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedSport, setSelectedSport] = useState('')
  const [sports, setSports] = useState([])
  const { loading, execute } = useApi()
  const eventYear = useEventYearWithFallback(selectedYear)

  // Fetch players list and sports (with cancellation)
  useEffect(() => {
    if (!isOpen) {
      setPlayers([])
      setSports([])
      return
    }

    let isMounted = true
    const abortController = new AbortController()

    const fetchData = async () => {
      try {
        // Fetch both in parallel
        // Don't pass page parameter to get all players (needed for captain selection)
        const [playersRes, sportsRes] = await Promise.all([
          fetchWithAuth(buildApiUrlWithYear('/api/players', eventYear), { signal: abortController.signal }),
          fetchWithAuth(buildApiUrlWithYear('/api/sports', eventYear), { signal: abortController.signal }),
        ])

        if (!isMounted) return

        // Check if responses are OK before parsing JSON
        if (!playersRes.ok) {
          throw new Error(`HTTP error! status: ${playersRes.status} for /api/players`)
        }
        if (!sportsRes.ok) {
          throw new Error(`HTTP error! status: ${sportsRes.status} for /api/sports`)
        }

        const [playersData, sportsData] = await Promise.all([
          playersRes.json(),
          sportsRes.json(),
        ])

        if (playersData.success) {
          // Server-side filtering: admin user already filtered out on server
          setPlayers(playersData.players || [])
        }

        // Sports API now returns array directly (not wrapped in success object)
        if (Array.isArray(sportsData)) {
          // Filter only team sports (dual_team and multi_team)
          const teamSports = sportsData.filter(s => s.type === 'dual_team' || s.type === 'multi_team')
          setSports(teamSports)
        } else if (sportsData.success) {
          // Fallback for old API format
          const teamSports = (sportsData.sports || []).filter(s => s.type === 'dual_team' || s.type === 'multi_team')
          setSports(teamSports)
        } else {
          setSports([])
        }
      } catch (err) {
        if (!isMounted || err.name === 'AbortError') return
        setPlayers([])
        setSports([])
      }
    }

    fetchData()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [isOpen, eventYear])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSelectedPlayer(null)
      setSelectedSport('')
    }
  }, [isOpen])

  // Filter players based on search query
  const filteredPlayers = players.filter((player) =>
    player.reg_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handlePlayerSelect = (player) => {
    setSelectedPlayer(player)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedPlayer) {
      onStatusPopup('❌ Please select a player.', 'error', 2500)
      return
    }

    if (!selectedSport.trim()) {
      onStatusPopup('❌ Please select a sport.', 'error', 2500)
      return
    }

    try {
      await execute(
        () => fetchWithAuth('/api/add-captain', {
          method: 'POST',
          body: JSON.stringify({
            reg_number: selectedPlayer.reg_number,
            sport: selectedSport.trim(),
            event_year: eventYear,
          }),
        }),
        {
          onSuccess: (data) => {
            // Clear caches to ensure UI reflects the new captain assignment
            clearCache('/api/captains-by-sport')
            clearCache('/api/players') // captain_in field changes
            clearCache('/api/me') // In case current user is updated
            // Note: No need to clear team/participant caches as captain assignment doesn't affect them directly
            
            onStatusPopup(
              `✅ ${selectedPlayer.full_name} has been added as captain for ${selectedSport}!`,
              'success',
              3000
            )
            setSelectedPlayer(null)
            setSearchQuery('')
            setSelectedSport('')
            onClose()
          },
          onError: (err) => {
            // The useApi hook extracts the error message from the API response
            const errorMessage = err?.message || err?.error || 'Error adding captain. Please try again.'
            onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      // Don't show duplicate error message - onError should have handled it
      logger.error('Error adding captain:', err)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Captain"
      maxWidth="max-w-[600px]"
    >
      <form onSubmit={handleSubmit}>
        <Input
          label="Search Player (by Registration Number or Name)"
          id="searchPlayer"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Type registration number or name to search..."
        />

        <div className="flex flex-col mb-[0.7rem]">
          <label className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
            Select Player
          </label>
          <div className="max-h-[200px] overflow-y-auto border border-[rgba(148,163,184,0.6)] rounded-[10px] bg-[rgba(15,23,42,0.9)]">
            {searchQuery ? (
              filteredPlayers.length > 0 ? (
                filteredPlayers.map((player) => (
                  <div
                    key={player.reg_number}
                    onClick={() => handlePlayerSelect(player)}
                    className={`px-[10px] py-2 cursor-pointer transition-all ${
                      selectedPlayer?.reg_number === player.reg_number
                        ? 'bg-[rgba(255,230,109,0.2)] border-l-2 border-[#ffe66d]'
                        : 'hover:bg-[rgba(148,163,184,0.1)]'
                    }`}
                  >
                    <div className="text-[#e2e8f0] text-[0.9rem] font-semibold">
                      {player.full_name}
                    </div>
                    <div className="text-[#cbd5ff] text-[0.8rem]">Reg. No: {player.reg_number}</div>
                  </div>
                ))
              ) : (
                <EmptyState message="No players found" className="px-[10px] py-4 text-[0.9rem]" />
              )
            ) : (
              <EmptyState message="Type to search for a player" className="px-[10px] py-4 text-[0.9rem]" />
            )}
          </div>
          {selectedPlayer && (
            <div className="mt-2 px-[10px] py-2 rounded-[10px] bg-[rgba(255,230,109,0.1)] border border-[rgba(255,230,109,0.3)]">
              <div className="text-[#ffe66d] text-[0.85rem] font-semibold">
                Selected: {selectedPlayer.full_name} ({selectedPlayer.reg_number})
              </div>
            </div>
          )}
        </div>

        <Input
          label="Select Sport"
          id="sport"
          name="sport"
          type="select"
          value={selectedSport}
          onChange={(e) => setSelectedSport(e.target.value)}
          required
          options={sports.map((sport) => ({ value: sport.name, label: formatSportName(sport.name) }))}
        />

        <div className="flex gap-[0.6rem] mt-[0.8rem]">
          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            fullWidth
          >
            {loading ? 'Adding...' : 'Submit'}
          </Button>
          <Button
            type="button"
            onClick={onClose}
            disabled={loading}
            variant="secondary"
            fullWidth
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default AddCaptainModal

