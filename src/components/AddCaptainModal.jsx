import { useState, useEffect } from 'react'
import { fetchWithAuth } from '../utils/api'
import logger from '../utils/logger'

function AddCaptainModal({ isOpen, onClose, onStatusPopup }) {
  const [players, setPlayers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [sports, setSports] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        const [playersRes, sportsRes] = await Promise.all([
          fetchWithAuth('/api/players', { signal: abortController.signal }),
          fetchWithAuth('/api/sports', { signal: abortController.signal }),
        ])

        if (!isMounted) return

        const [playersData, sportsData] = await Promise.all([
          playersRes.json(),
          sportsRes.json(),
        ])

        if (playersData.success) {
          const filteredPlayers = (playersData.players || []).filter(
            (p) => p.reg_number !== 'admin'
          )
          setPlayers(filteredPlayers)
        }

        if (sportsData.success) {
          setSports(sportsData.sports || [])
        }
      } catch (err) {
        if (!isMounted || err.name === 'AbortError') return
        logger.error('Error fetching data:', err)
        setPlayers([])
        setSports([])
      }
    }

    fetchData()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [isOpen])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSelectedPlayer(null)
      setIsSubmitting(false)
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

    if (isSubmitting) return

    if (!selectedPlayer) {
      onStatusPopup('❌ Please select a player.', 'error', 2500)
      return
    }

    const sportSelect = e.target.querySelector('[name="sport"]')
    const sport = sportSelect?.value?.trim()

    if (!sport) {
      onStatusPopup('❌ Please select a sport.', 'error', 2500)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetchWithAuth('/api/add-captain', {
        method: 'POST',
        body: JSON.stringify({
          reg_number: selectedPlayer.reg_number,
          sport: sport,
        }),
      })

      if (!response.ok) {
        // Try to get the error message from the response
        let errorMessage = 'Error adding captain. Please try again.'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
        setIsSubmitting(false)
        return
      }

      const data = await response.json()

      if (data.success) {
        onStatusPopup(
          `✅ ${selectedPlayer.full_name} has been added as captain for ${sport}!`,
          'success',
          3000
        )
        setSelectedPlayer(null)
        setSearchQuery('')
        setIsSubmitting(false)
        onClose()
      } else {
        const errorMessage = data.error || 'Error adding captain. Please try again.'
        onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
        setIsSubmitting(false)
      }
    } catch (err) {
      logger.error('Error adding captain:', err)
      onStatusPopup('❌ Error adding captain. Please try again.', 'error', 2500)
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4"
    >
      <aside className="max-w-[600px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] pb-[1.5rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          className="absolute top-[10px] right-3 bg-transparent border-none text-[#e5e7eb] text-base cursor-pointer"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">
          Admin Panel
        </div>
        <div className="text-[1.25rem] font-extrabold text-center uppercase tracking-[0.14em] text-[#ffe66d] mb-[0.7rem]">
          Add Captain
        </div>
        <div className="text-[0.85rem] text-center text-[#e5e7eb] mb-4">
          PCE, Purnea • Umang – 2026 Sports Fest
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="searchPlayer" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Search Player (by Registration Number or Name)
            </label>
            <input
              type="text"
              id="searchPlayer"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type registration number or name to search..."
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            />
          </div>

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

          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="sport" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Select Sport *
            </label>
            <select
              id="sport"
              name="sport"
              required
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            >
              <option value="">Select Sport</option>
              {sports.map((sport) => (
                <option key={sport} value={sport}>
                  {sport}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-[0.6rem] mt-[0.8rem]">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-full border-none py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#ffe66d] to-[#ff9f1c] text-[#111827] shadow-[0_10px_24px_rgba(250,204,21,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(250,204,21,0.75)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isSubmitting ? 'Adding...' : 'Submit'}
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

export default AddCaptainModal

