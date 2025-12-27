import { useState, useEffect, useRef } from 'react'
import { fetchWithAuth, clearCache } from '../utils/api'
import logger from '../utils/logger'

function PlayerListModal({ isOpen, onClose, onStatusPopup }) {
  const [players, setPlayers] = useState([])
  const [filteredPlayers, setFilteredPlayers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [editedData, setEditedData] = useState({})
  const [saving, setSaving] = useState(false)
  const isRefreshingRef = useRef(false) // Use ref to track if we're refreshing after update

  // Function to fetch players (extracted for reuse)
  // showError: whether to show error popup (default: true for initial load, false for silent refresh)
  const fetchPlayers = async (signal = null, showError = true) => {
    setLoading(true)
    try {
      const response = await fetchWithAuth('/api/players', {
        signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        // Filter out admin user
        const filteredPlayers = (data.players || []).filter(
          p => p.reg_number !== 'admin'
        )
        setPlayers(filteredPlayers)
        setFilteredPlayers(filteredPlayers)
      } else {
        throw new Error(data.error || 'Failed to fetch players')
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      logger.error('Error fetching players:', err)
      // Don't show error if we're in the middle of a refresh after update
      if (showError && onStatusPopup && !isRefreshingRef.current) {
        onStatusPopup('❌ Error fetching players. Please try again.', 'error', 3000)
      }
      // Re-throw error so caller can handle it if needed
      throw err
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setPlayers([])
      setFilteredPlayers([])
      setSearchQuery('')
      setEditingPlayer(null)
      setEditedData({})
      return
    }

    const abortController = new AbortController()
    fetchPlayers(abortController.signal)

    return () => {
      abortController.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]) // Removed onStatusPopup from dependencies to prevent re-fetching

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPlayers(players)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = players.filter(
        player =>
          player.reg_number.toLowerCase().includes(query) ||
          player.full_name.toLowerCase().includes(query)
      )
      setFilteredPlayers(filtered)
    }
  }, [searchQuery, players])


  const handlePlayerClick = (player) => {
    setEditingPlayer(player.reg_number)
    setEditedData({
      reg_number: player.reg_number,
      full_name: player.full_name,
      gender: player.gender,
      department_branch: player.department_branch,
      year: player.year,
      mobile_number: player.mobile_number,
      email_id: player.email_id,
    })
  }

  const handleCancelEdit = () => {
    setEditingPlayer(null)
    setEditedData({})
  }

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSavePlayer = async () => {
    // Validate required fields
    if (!editedData.reg_number || !editedData.full_name || !editedData.gender || 
        !editedData.department_branch || !editedData.year || !editedData.mobile_number || 
        !editedData.email_id) {
      if (onStatusPopup) {
        onStatusPopup('❌ Please fill all required fields.', 'error', 2500)
      }
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editedData.email_id)) {
      if (onStatusPopup) {
        onStatusPopup('❌ Invalid email format.', 'error', 2500)
      }
      return
    }

    // Validate phone number
    const phoneRegex = /^[0-9]{10}$/
    if (!phoneRegex.test(editedData.mobile_number)) {
      if (onStatusPopup) {
        onStatusPopup('❌ Invalid mobile number. Must be 10 digits.', 'error', 2500)
      }
      return
    }

    setSaving(true)
    try {
      const response = await fetchWithAuth('/api/update-player', {
        method: 'PUT',
        body: JSON.stringify(editedData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        if (onStatusPopup) {
          onStatusPopup('✅ Player details updated successfully!', 'success', 2500)
        }
        // Refresh players list silently (don't show error if refresh fails)
        // Set flag to prevent error popups during refresh
        isRefreshingRef.current = true
        
        // Clear cache first to ensure we get fresh data
        clearCache('/api/players')
        
        // Use a separate function to avoid showing loading state and errors
        try {
          const response = await fetchWithAuth('/api/players')
          
          if (!response.ok) {
            // Response not OK, but don't show error - just log it
            logger.warn('Refresh failed: response not OK', response.status)
            isRefreshingRef.current = false
            return
          }

          const refreshData = await response.json()
          logger.api('Refresh response:', refreshData)
          
          if (refreshData && refreshData.success) {
            const filteredPlayers = (refreshData.players || []).filter(
              p => p.reg_number !== 'admin'
            )
            setPlayers(filteredPlayers)
            setFilteredPlayers(filteredPlayers)
            logger.api('Players list refreshed successfully')
          } else {
            // Data structure unexpected, but don't show error
            logger.warn('Refresh: unexpected data structure', refreshData)
          }
        } catch (err) {
          // Log error but don't show popup - the update was successful
          logger.error('Error refreshing players list after update:', err)
        } finally {
          isRefreshingRef.current = false
        }
        setEditingPlayer(null)
        setEditedData({})
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
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4"
    >
      <aside className="max-w-[800px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] pb-[1.5rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          className="absolute top-[10px] right-3 bg-transparent border-none text-[#e5e7eb] text-base cursor-pointer hover:text-[#ffe66d] transition-colors"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">
          Admin Panel
        </div>
        <div className="text-[1.25rem] font-extrabold text-center uppercase tracking-[0.14em] text-[#ffe66d] mb-[0.7rem]">
          List Players
        </div>
        <div className="text-[0.85rem] text-center text-[#e5e7eb] mb-4">
          PCE, Purnea • Umang – 2026 Sports Fest
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <label htmlFor="searchPlayer" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em] block">
            Search by Registration Number or Name
          </label>
          <input
            type="text"
            id="searchPlayer"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type registration number or name to search..."
            className="w-full px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
          />
        </div>

        {loading && (
          <div className="text-center py-8 text-[#a5b4fc]">
            Loading players...
          </div>
        )}

        {!loading && filteredPlayers.length === 0 && (
          <div className="text-center py-8 text-[#a5b4fc]">
            {searchQuery ? 'No players found matching your search.' : 'No players found.'}
          </div>
        )}

        {!loading && filteredPlayers.length > 0 && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <div className="text-[0.9rem] text-[#cbd5ff] mb-2 text-center">
              Total Players: <span className="text-[#ffe66d] font-bold">{filteredPlayers.length}</span>
            </div>
            {filteredPlayers.map((player) => {
              const isEditing = editingPlayer === player.reg_number
              return (
                <div
                  key={player.reg_number}
                  className={`px-4 py-3 rounded-[12px] border ${
                    isEditing
                      ? 'border-[rgba(255,230,109,0.5)] bg-[rgba(255,230,109,0.05)]'
                      : 'border-[rgba(148,163,184,0.3)] bg-[rgba(15,23,42,0.6)] cursor-pointer hover:bg-[rgba(15,23,42,0.8)] transition-colors'
                  }`}
                  onClick={() => !isEditing && handlePlayerClick(player)}
                >
                  {!isEditing ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[#e5e7eb] font-semibold text-[0.95rem]">
                          {player.full_name}
                        </div>
                        <div className="text-[#a5b4fc] text-[0.8rem] mt-1">
                          Reg. No: {player.reg_number} • {player.department_branch} • {player.year}
                        </div>
                      </div>
                      <div className="text-[#ffe66d] text-sm">Click to edit</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-[#cbd5ff] text-[0.85rem] mb-3 font-semibold">
                        Editing: {player.full_name} ({player.reg_number})
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col">
                          <label className="text-[0.75rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            value={editedData.full_name || ''}
                            onChange={(e) => handleFieldChange('full_name', e.target.value)}
                            className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none focus:border-[#ffe66d]"
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[0.75rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                            Gender *
                          </label>
                          <select
                            value={editedData.gender || ''}
                            onChange={(e) => handleFieldChange('gender', e.target.value)}
                            className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none focus:border-[#ffe66d]"
                          >
                            <option value="">Select</option>
                            <option>Male</option>
                            <option>Female</option>
                          </select>
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[0.75rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                            Department/Branch *
                          </label>
                          <select
                            value={editedData.department_branch || ''}
                            onChange={(e) => handleFieldChange('department_branch', e.target.value)}
                            className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none focus:border-[#ffe66d]"
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

                        <div className="flex flex-col">
                          <label className="text-[0.75rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                            Year *
                          </label>
                          <select
                            value={editedData.year || ''}
                            onChange={(e) => handleFieldChange('year', e.target.value)}
                            className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none focus:border-[#ffe66d]"
                          >
                            <option value="">Select</option>
                            <option>1st Year (2025)</option>
                            <option>2nd Year (2024)</option>
                            <option>3rd Year (2023)</option>
                            <option>4th Year (2022)</option>
                          </select>
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[0.75rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                            Mobile Number *
                          </label>
                          <input
                            type="tel"
                            value={editedData.mobile_number || ''}
                            onChange={(e) => handleFieldChange('mobile_number', e.target.value)}
                            className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none focus:border-[#ffe66d]"
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[0.75rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
                            Email ID *
                          </label>
                          <input
                            type="email"
                            value={editedData.email_id || ''}
                            onChange={(e) => handleFieldChange('email_id', e.target.value)}
                            className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none focus:border-[#ffe66d]"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          type="button"
                          onClick={handleSavePlayer}
                          disabled={saving}
                          className="flex-1 px-4 py-2 rounded-[8px] text-[0.85rem] font-semibold bg-gradient-to-r from-[#ffe66d] to-[#ff9f1c] text-[#111827] border-none disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_4px_12px_rgba(250,204,21,0.4)] transition-all"
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={saving}
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
    </div>
  )
}

export default PlayerListModal

