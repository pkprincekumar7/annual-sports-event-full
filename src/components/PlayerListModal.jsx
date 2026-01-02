import { useState, useEffect, useRef } from 'react'
import { Modal, Button, Input, LoadingSpinner, EmptyState } from './ui'
import { useApi, useDepartments, useEventYearWithFallback } from '../hooks'
import { fetchWithAuth, clearCache } from '../utils/api'
import { buildApiUrlWithYear } from '../utils/apiHelpers'
import { GENDER_OPTIONS } from '../constants/app'

function PlayerListModal({ isOpen, onClose, onStatusPopup, selectedYear }) {
  const [players, setPlayers] = useState([])
  const [filteredPlayers, setFilteredPlayers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [editedData, setEditedData] = useState({})
  const { loading: saving, execute } = useApi()
  const { departments: departmentOptions, loading: loadingDepartments } = useDepartments()
  const eventYear = useEventYearWithFallback(selectedYear)
  const isRefreshingRef = useRef(false) // Use ref to track if we're refreshing after update

  // Function to fetch players (extracted for reuse)
  // showError: whether to show error popup (default: true for initial load, false for silent refresh)
  const fetchPlayers = async (signal = null, showError = true) => {
    setLoading(true)
    try {
      const response = await fetchWithAuth(buildApiUrlWithYear('/api/players', eventYear), {
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
  }, [isOpen, eventYear]) // Include eventYear to refetch when year changes

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
      year: player.year, // Store year string
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
        !editedData.department_branch || !editedData.mobile_number || 
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

    try {
      await execute(
        () => fetchWithAuth('/api/update-player', {
          method: 'PUT',
          body: JSON.stringify(editedData),
        }),
        {
          onSuccess: (data) => {
            if (onStatusPopup) {
              onStatusPopup('✅ Player details updated successfully!', 'success', 2500)
            }
            // Refresh players list silently (don't show error if refresh fails)
            // Set flag to prevent error popups during refresh
            isRefreshingRef.current = true
            
            // Clear cache first to ensure we get fresh data
            clearCache('/api/players')
            
            // Use a separate function to avoid showing loading state and errors
            fetchWithAuth(buildApiUrlWithYear('/api/players', eventYear))
              .then((response) => {
                if (!response.ok) {
                  isRefreshingRef.current = false
                  return
                }
                return response.json()
              })
              .then((refreshData) => {
                if (refreshData && refreshData.success) {
                  const filteredPlayers = (refreshData.players || []).filter(
                    p => p.reg_number !== 'admin'
                  )
                  setPlayers(filteredPlayers)
                  setFilteredPlayers(filteredPlayers)
                }
              })
              .catch(() => {
                // Don't show popup - the update was successful
              })
              .finally(() => {
                isRefreshingRef.current = false
              })
            setEditingPlayer(null)
            setEditedData({})
          },
          onError: (err) => {
            // The useApi hook extracts the error message from the API response
            const errorMessage = err?.message || err?.error || 'Failed to update player. Please try again.'
            if (onStatusPopup) {
              onStatusPopup(`❌ ${errorMessage}`, 'error', 4000)
            }
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      // Don't show duplicate error message - onError should have handled it
      logger.error('Error updating player:', err)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="List Players"
      maxWidth="max-w-[800px]"
    >
      {/* Search Bar */}
      <div className="mb-4">
        <Input
          label="Search by Registration Number or Name"
          id="searchPlayer"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Type registration number or name to search..."
        />
      </div>

      {loading && (
        <LoadingSpinner message="Loading players..." />
      )}

      {!loading && filteredPlayers.length === 0 && (
        <EmptyState
          message={searchQuery ? 'No players found matching your search.' : 'No players found.'}
          className="py-8"
        />
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
                          Reg. No: {player.reg_number} • {player.department_branch} • {player.year || ''}
                        </div>
                      </div>
                      <div className="text-[#ffe66d] text-sm">Click to edit</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-[#cbd5ff] text-[0.85rem] mb-3 font-semibold">
                        Editing: {player.full_name} ({player.reg_number})
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          label="Full Name"
                          value={editedData.full_name || ''}
                          onChange={(e) => handleFieldChange('full_name', e.target.value)}
                          required
                        />

                        <Input
                          label="Gender"
                          type="select"
                          value={editedData.gender || ''}
                          onChange={(e) => handleFieldChange('gender', e.target.value)}
                          disabled={true}
                          options={GENDER_OPTIONS.filter(opt => opt.value !== '')}
                          required
                        />

                        <Input
                          label="Department/Branch"
                          type="select"
                          value={editedData.department_branch || ''}
                          onChange={(e) => handleFieldChange('department_branch', e.target.value)}
                          options={loadingDepartments ? [{ value: '', label: 'Loading...' }] : departmentOptions.filter(opt => opt.value !== '')}
                          disabled={loadingDepartments}
                          required
                        />

                        <Input
                          label="Year"
                          type="text"
                          value={editedData.year || ''}
                          disabled={true}
                          required
                        />

                        <Input
                          label="Mobile Number"
                          type="tel"
                          value={editedData.mobile_number || ''}
                          onChange={(e) => handleFieldChange('mobile_number', e.target.value)}
                          required
                        />

                        <Input
                          label="Email ID"
                          type="email"
                          value={editedData.email_id || ''}
                          onChange={(e) => handleFieldChange('email_id', e.target.value)}
                          required
                        />
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button
                          type="button"
                          onClick={handleSavePlayer}
                          disabled={saving}
                          loading={saving}
                          className="flex-1 px-4 py-2 text-[0.85rem] font-semibold rounded-[8px]"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={saving}
                          variant="secondary"
                          className="flex-1 px-4 py-2 text-[0.85rem] font-semibold rounded-[8px]"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
    </Modal>
  )
}

export default PlayerListModal

