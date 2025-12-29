/**
 * EXAMPLE: Refactored AddCaptainModal using reusable components
 * This demonstrates significant code reduction
 * 
 * This is an EXAMPLE file - shows the pattern for refactoring
 */

import { useState, useEffect } from 'react'
import { Modal, Button, Input } from '../ui'
import { useApi, useModal } from '../../hooks'
import { fetchWithAuth, clearCache } from '../../utils/api'

function AddCaptainModalRefactored({ isOpen, onClose, onStatusPopup }) {
  const [players, setPlayers] = useState([])
  const [sports, setSports] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedSport, setSelectedSport] = useState('')
  
  const { loading, error, execute } = useApi()
  const confirmModal = useModal()

  // Fetch data
  useEffect(() => {
    if (!isOpen) {
      setPlayers([])
      setSports([])
      return
    }

    const fetchData = async () => {
      try {
        const [playersRes, sportsRes] = await Promise.all([
          fetchWithAuth('/api/players'),
          fetchWithAuth('/api/sports'),
        ])

        if (playersRes.ok) {
          const playersData = await playersRes.json()
          if (playersData.success) {
            setPlayers((playersData.players || []).filter(p => p.reg_number !== 'admin'))
          }
        }

        if (sportsRes.ok) {
          const sportsData = await sportsRes.json()
          if (sportsData.success) {
          setSports(sportsData.sports || [])
          }
        }
      } catch (err) {
        // Error handling
      }
    }

    fetchData()
  }, [isOpen])

  const filteredPlayers = players.filter((player) =>
    player.reg_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedPlayer) {
      onStatusPopup('❌ Please select a player.', 'error', 2500)
      return
    }

    if (!selectedSport) {
      onStatusPopup('❌ Please select a sport.', 'error', 2500)
      return
    }

    try {
      await execute(
        () => fetchWithAuth('/api/add-captain', {
          method: 'POST',
          body: JSON.stringify({
            reg_number: selectedPlayer.reg_number,
            sport: selectedSport,
          }),
        }),
        {
          onSuccess: () => {
            clearCache('/api/captains-by-sport')
            clearCache('/api/players')
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
        }
      )
    } catch (err) {
      onStatusPopup(`❌ ${err.message || 'Error adding captain.'}`, 'error', 3000)
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
                    onClick={() => setSelectedPlayer(player)}
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
                <div className="px-[10px] py-4 text-center text-[#cbd5ff] text-[0.9rem]">
                  No players found
                </div>
              )
            ) : (
              <div className="px-[10px] py-4 text-center text-[#cbd5ff] text-[0.9rem]">
                Type to search for a player
              </div>
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
          options={sports.map(sport => ({ value: sport, label: sport }))}
        />

        <div className="flex gap-[0.6rem] mt-[0.8rem]">
          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            fullWidth
          >
            Submit
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

export default AddCaptainModalRefactored

