import { useState, useEffect, useRef, useMemo } from 'react'
import TeamDetailsModal from './TeamDetailsModal'
import RegisterModal from './RegisterModal'
import ParticipantDetailsModal from './ParticipantDetailsModal'
import EventScheduleModal from './EventScheduleModal'

function SportDetailsModal({ isOpen, onClose, selectedSport, loggedInUser, onStatusPopup, onUserUpdate, onEventScheduleClick }) {
  const [activeTab, setActiveTab] = useState(null)
  const hasSetInitialTabRef = useRef(false)
  const lastSportRef = useRef(null)
  const initialTabSetRef = useRef(false)
  
  // All hooks must be called before any early returns
  // Reset active tab when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab(null)
      hasSetInitialTabRef.current = false
      lastSportRef.current = null
      initialTabSetRef.current = false
    }
  }, [isOpen])
  
  // Set initial active tab when modal opens or sport changes
  useEffect(() => {
    if (!isOpen || !selectedSport) return
    
    // Only set initial tab once per sport, or if sport changes
    const sportChanged = lastSportRef.current !== selectedSport.name
    if (sportChanged) {
      initialTabSetRef.current = false
      lastSportRef.current = selectedSport.name
    }
    
    // If we've already set the initial tab for this sport, don't do it again
    if (initialTabSetRef.current) return
    
    const isAdmin = loggedInUser?.reg_number === 'admin'
    const isTeam = selectedSport.type === 'team'
    
    // Check if user is a captain for this sport
    const isCaptainForSport = !isAdmin && loggedInUser?.captain_in && 
      Array.isArray(loggedInUser.captain_in) && 
      loggedInUser.captain_in.includes(selectedSport.name)
    
    // Check if user is enrolled in this team event
    const isEnrolledInTeamEvent = !isAdmin && loggedInUser?.participated_in && 
      Array.isArray(loggedInUser.participated_in) &&
      loggedInUser.participated_in.some(p => 
        p.sport === selectedSport.name && p.team_name
      )
    
    // Determine available tabs
    let availableTabs = []
    if (isAdmin) {
      if (isTeam) {
        availableTabs = [
          { id: 'teams', label: 'View Teams' },
          { id: 'events', label: 'Events' }
        ]
      } else {
        availableTabs = [
          { id: 'participants', label: 'View Participants' },
          { id: 'events', label: 'Events' }
        ]
      }
    } else if (isTeam) {
      if (isCaptainForSport && !isEnrolledInTeamEvent) {
        availableTabs.push({ id: 'create', label: 'Create Team' })
      }
      if (isEnrolledInTeamEvent) {
        availableTabs.push({ id: 'view', label: 'View Team' })
      }
      availableTabs.push({ id: 'events', label: 'View Events' })
    } else {
      const hasParticipatedInIndividual = loggedInUser?.participated_in && 
        Array.isArray(loggedInUser.participated_in) &&
        loggedInUser.participated_in.some(p => p.sport === selectedSport.name && !p.team_name)
      
      if (!hasParticipatedInIndividual) {
        availableTabs.push({ id: 'enroll', label: 'Enroll Now' })
      } else {
        availableTabs.push({ id: 'view', label: 'View Enrollment' })
      }
      availableTabs.push({ id: 'events', label: 'View Events' })
    }
    
    // Set active tab synchronously if not set
    if (availableTabs.length > 0) {
      const firstTab = availableTabs[0].id
      if (!activeTab || !availableTabs.find(t => t.id === activeTab)) {
        initialTabSetRef.current = true
        hasSetInitialTabRef.current = true
        setActiveTab(firstTab)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedSport?.name])

  // Compute values needed for useMemo (must be before useMemo hook)
  const isAdmin = loggedInUser?.reg_number === 'admin'
  const isTeam = selectedSport?.type === 'team'
  
  // Check if user is a captain for this sport
  const isCaptainForSport = !isAdmin && loggedInUser?.captain_in && 
    Array.isArray(loggedInUser.captain_in) && 
    loggedInUser.captain_in.includes(selectedSport?.name)
  
  // Check if user is enrolled in this team event
  const isEnrolledInTeamEvent = !isAdmin && loggedInUser?.participated_in && 
    Array.isArray(loggedInUser.participated_in) &&
    loggedInUser.participated_in.some(p => 
      p.sport === selectedSport?.name && p.team_name
    )
  
  // Check if user has participated in individual event
  const hasParticipatedInIndividual = !isAdmin && loggedInUser?.participated_in && 
    Array.isArray(loggedInUser.participated_in) &&
    loggedInUser.participated_in.some(p => p.sport === selectedSport?.name && !p.team_name)

  // Determine sport type for EventScheduleModal
  const culturalSports = [
    'Essay Writing', 'Story Writing', 'Group Discussion', 'Debate',
    'Extempore', 'Quiz', 'Dumb Charades', 'Painting', 'Singing'
  ]
  const isCultural = selectedSport && culturalSports.includes(selectedSport.name)
  const sportType = isTeam ? 'team' : (isCultural ? 'cultural' : 'individual')

  // Memoize tab content to prevent unnecessary remounts
  // This hook MUST be called before any early returns
  const tabContent = useMemo(() => {
    if (!isOpen || !selectedSport || !activeTab) return null
    
    switch (activeTab) {
      case 'create':
        return (
          <RegisterModal
            key="create"
            isOpen={true}
            onClose={() => {}}
            selectedSport={selectedSport}
            onStatusPopup={onStatusPopup}
            loggedInUser={loggedInUser}
            onUserUpdate={onUserUpdate}
            embedded={true}
          />
        )
      
      case 'view':
        if (isTeam) {
          return (
            <TeamDetailsModal
              key="view-team"
              isOpen={true}
              onClose={onClose}
              sport={selectedSport.name}
              loggedInUser={loggedInUser}
              onStatusPopup={onStatusPopup}
              embedded={true}
            />
          )
        } else {
          // For individual events, show registration modal in view mode
          return (
            <RegisterModal
              key="view-individual"
              isOpen={true}
              onClose={onClose}
              selectedSport={selectedSport}
              onStatusPopup={onStatusPopup}
              loggedInUser={loggedInUser}
              onUserUpdate={onUserUpdate}
              embedded={true}
            />
          )
        }
      
      case 'teams':
        return (
          <TeamDetailsModal
            key="teams"
            isOpen={true}
            onClose={onClose}
            sport={selectedSport.name}
            loggedInUser={loggedInUser}
            onStatusPopup={onStatusPopup}
            embedded={true}
          />
        )
      
      case 'participants':
        return (
          <ParticipantDetailsModal
            key="participants"
            isOpen={true}
            onClose={onClose}
            sport={selectedSport.name}
            loggedInUser={loggedInUser}
            onStatusPopup={onStatusPopup}
            embedded={true}
          />
        )
      
      case 'events':
        return (
          <EventScheduleModal
            key="events"
            isOpen={true}
            onClose={onClose}
            sport={selectedSport.name}
            sportType={sportType}
            loggedInUser={loggedInUser}
            onStatusPopup={onStatusPopup}
            embedded={true}
          />
        )
      
      case 'enroll':
        return (
          <RegisterModal
            key="enroll"
            isOpen={true}
            onClose={onClose}
            selectedSport={selectedSport}
            onStatusPopup={onStatusPopup}
            loggedInUser={loggedInUser}
            onUserUpdate={onUserUpdate}
            embedded={true}
          />
        )
      
      default:
        return null
    }
  }, [activeTab, selectedSport?.name, isTeam, sportType, isOpen, onClose, loggedInUser, onStatusPopup, onUserUpdate])

  // Determine available tabs based on user type and sport type
  const getAvailableTabs = () => {
    if (!selectedSport) return []
    
    if (isAdmin) {
      if (isTeam) {
        return [
          { id: 'teams', label: 'View Teams' },
          { id: 'events', label: 'Events' }
        ]
      } else {
        return [
          { id: 'participants', label: 'View Participants' },
          { id: 'events', label: 'Events' }
        ]
      }
    }
    
    if (isTeam) {
      const tabs = []
      // Can create team if captain and not enrolled
      if (isCaptainForSport && !isEnrolledInTeamEvent) {
        tabs.push({ id: 'create', label: 'Create Team' })
      }
      // Can view team if enrolled
      if (isEnrolledInTeamEvent) {
        tabs.push({ id: 'view', label: 'View Team' })
      }
      // Always show events (even if it's the only tab)
      tabs.push({ id: 'events', label: 'View Events' })
      return tabs
    } else {
      // Individual/cultural events
      const tabs = []
      if (!hasParticipatedInIndividual) {
        tabs.push({ id: 'enroll', label: 'Enroll Now' })
      } else {
        tabs.push({ id: 'view', label: 'View Enrollment' })
      }
      tabs.push({ id: 'events', label: 'View Events' })
      return tabs
    }
  }

  const availableTabs = getAvailableTabs()

  if (!isOpen || !selectedSport) return null

  const handleClose = (e) => {
    e?.stopPropagation()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4">
      <div className="max-w-[900px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.1)] flex items-center justify-between">
          <div>
            <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1">
              {isAdmin ? 'Admin Panel' : 'Sport Details'}
            </div>
            <div className="text-[1.25rem] font-extrabold uppercase tracking-[0.14em] text-[#ffe66d]">
              {selectedSport.name}
            </div>
          </div>
          <button
            type="button"
            className="bg-transparent border-none text-[#e5e7eb] text-2xl cursor-pointer hover:text-[#ffe66d] transition-colors"
            onClick={handleClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        {availableTabs.length > 1 && (
          <div className="px-6 py-3 border-b border-[rgba(255,255,255,0.1)] flex gap-2">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-[0.85rem] font-bold transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-[rgba(255,230,109,0.2)] text-[#ffe66d] border border-[rgba(255,230,109,0.3)]'
                    : 'bg-[rgba(255,255,255,0.05)] text-[#cbd5ff] hover:bg-[rgba(255,255,255,0.1)] border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tabContent}
        </div>
      </div>
    </div>
  )
}

export default SportDetailsModal

