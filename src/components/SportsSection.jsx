import { useState, useEffect, useRef } from 'react'
import { fetchWithAuth, clearCache } from '../utils/api'
import logger from '../utils/logger'

const sportsData = {
  team: [
    { name: 'Cricket', image: '/images/Cricket.jpg', text: 'College teams clash for the trophy.', players: 15 },
    { name: 'Volleyball', image: '/images/Vollyball.jpg', text: 'Smash, block and dominate the court.', players: 9 },
    { name: 'Badminton', image: '/images/Badminton.jpeg', text: "Men's & women's doubles and team events.", players: 4 },
    { name: 'Table Tennis', image: '/images/Tabletennis.jpeg', text: 'Fast rallies and sharp reflexes.', players: 4 },
    { name: 'Kabaddi', image: '/images/Kabbadi.png', text: 'Raid, tackle and roar with your squad.', players: 10 },
    { name: 'Relay 4×100 m', image: '/images/Relay1.o.jpg', text: 'High-speed baton relay on the track.', players: 4 },
    { name: 'Relay 4×400 m', image: '/images/Relay.jpg', text: 'Ultimate test of stamina and teamwork.', players: 4 },
  ],
  individual: [
    { name: 'Carrom', image: '/images/Carrom.jpg', text: 'Strike and pocket with precision.' },
    { name: 'Chess', image: '/images/Chess.jpeg', text: 'Outplay your opponent on the board.' },
    { name: 'Sprint 100 m', image: '/images/Sprint1.jpg', text: 'Pure explosive speed on track.' },
    { name: 'Sprint 200 m', image: '/images/Sprint2.jpg', text: 'Power and pace around the bend.' },
    { name: 'Sprint 400 m', image: '/images/Sprint3.jpg', text: 'One full lap of endurance sprint.' },
    { name: 'Long Jump', image: '/images/Longjump.jpeg', text: 'Fly the farthest into the sand pit.' },
    { name: 'High Jump', image: '/images/Highjump.jpeg', text: 'Clear the bar and set new heights.' },
    { name: 'Javelin', image: '/images/javelin.jpeg', text: 'Throw for maximum distance.' },
    { name: 'Shot Put', image: '/images/Shotput.jpeg', text: 'Show your strength in the circle.' },
    { name: 'Discus Throw', image: '/images/Discussthrow.jpeg', text: 'Perfect spin and powerful release.' },
  ],
  cultural: [
    { name: 'Essay Writing', image: '/images/Essay Writing.jpg', text: 'Express your thoughts powerfully.' },
    { name: 'Story Writing', image: '/images/Story Writing.jpg', text: 'Craft compelling narratives.' },
    { name: 'Group Discussion', image: '/images/gd.png', text: 'Showcase leadership & ideas.' },
    { name: 'Debate', image: '/images/Debate.jpg', text: 'Argue, persuade, win.' },
    { name: 'Extempore', image: '/images/Extempore.jpeg', text: 'Think fast, speak boldly.' },
    { name: 'Quiz', image: '/images/Quiz.jpg', text: 'Test your knowledge.' },
    { name: 'Dumb Charades', image: '/images/Dumb_Charades.jpg', text: 'Act it out, guess it right.' },
    { name: 'Painting', image: '/images/painting.png', text: 'Unleash your creativity.' },
    { name: 'Singing', image: '/images/Singing.jpg', text: 'Voice your passion.' },
  ],
}

function SportCard({ sport, type, onSportClick, onEventScheduleClick, loggedInUser, isEnrolled, isCaptain, canCreateOrViewTeam, teamsCount, participantsCount }) {
  const isAdmin = loggedInUser?.reg_number === 'admin'
  
  // Use props if provided, otherwise default to -1 (loading state)
  const displayTeamsCount = teamsCount !== undefined ? teamsCount : -1
  const displayParticipantsCount = participantsCount !== undefined ? participantsCount : -1

  // Check if user is enrolled (as individual, team member, or captain) - for non-admin users only
  // For team events: enrolled if they are a team member (has team_name in participation)
  // For individual events: enrolled only if they have participated
  // Note: Being a captain alone doesn't mean enrolled - they must be part of a team
  const isUserEnrolled = !isAdmin && isEnrolled === true

  // Check if user can create team (for team events only)
  // User can create team if they are a captain but NOT enrolled
  const canCreateTeam = !isAdmin && type === 'team' && isCaptain === true && !isEnrolled

  // Determine button text based on user type and enrollment status
  const getButtonText = () => {
    if (isAdmin) {
      return type === 'team' ? 'View Teams' : 'View Participants'
    }
    
    if (type === 'team') {
      return isEnrolled ? 'View Team' : 'Create Team'
    } else {
      return isEnrolled ? 'View Enrollment' : 'Enroll Now'
    }
  }

  // Check if primary button (Create Team/View Team) should be shown for team events
  const shouldShowPrimaryButton = () => {
    if (isAdmin) {
      return true // Admin always sees primary button
    }
    
    if (type === 'team') {
      // canCreateOrViewTeam is passed as a prop (boolean), not a function
      return canCreateOrViewTeam !== undefined ? canCreateOrViewTeam : true
    }
    
    // For non-team events, always show primary button
    return true
  }

  const handleButtonClick = (e) => {
    e.stopPropagation() // Prevent any event bubbling
    onSportClick({ name: sport.name, type, players: sport.players })
  }

  const handleEventScheduleClick = (e) => {
    e.stopPropagation() // Prevent any event bubbling
    if (onEventScheduleClick) {
      onEventScheduleClick({ name: sport.name, type })
    }
  }

  const handleCardClick = () => {
    // Card is now clickable for all users
    onSportClick({ name: sport.name, type, players: sport.players })
  }

  // Debug: Log render state (disabled by default - enable via localStorage.setItem('enableVerboseLogs', 'true'))
  // if (loggedInUser) {
  //   logger.api(`Rendering SportCard ${sport.name} (${type}) - teamsCount: ${teamsCount}, participantsCount: ${participantsCount}`)
  // }

  // Card is now clickable for all users
  const cardClasses = "relative min-h-[170px] rounded-[18px] overflow-hidden shadow-[0_18px_40px_rgba(0,0,0,0.75)] cursor-pointer translate-y-0 transition-all duration-[0.25s] ease-in-out hover:-translate-y-2 hover:shadow-[0_26px_55px_rgba(0,0,0,0.9)]"

  return (
    <div
      className={cardClasses}
      style={{
        background: 'radial-gradient(circle at 0 0, #ffe66d 0, #7f1d1d 50%, #020617 100%)',
      }}
      onClick={handleCardClick}
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-90"
        style={{ backgroundImage: `url('${sport.image}')` }}
      />
      {/* Badges - positioned at top right corner */}
      {isUserEnrolled && (
        <div className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded-md bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white text-[0.7rem] font-bold uppercase tracking-[0.1em] shadow-[0_2px_8px_rgba(34,197,94,0.5)] animate-pulse">
          Enrolled!
        </div>
      )}
      {canCreateTeam && (
        <div className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded-md bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white text-[0.7rem] font-bold uppercase tracking-[0.1em] shadow-[0_2px_8px_rgba(59,130,246,0.5)] animate-pulse">
          Create Team
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.9)] to-[rgba(0,0,0,0.2)] flex flex-col justify-end p-[0.9rem] px-[1.1rem] text-[#f9fafb] drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)] z-10">
        <div className="text-[1.1rem] font-extrabold text-[#ffe66d] uppercase">{sport.name}</div>
        {loggedInUser && (
          <div className="text-[0.8rem] mt-2 font-bold text-[#06b6d4] drop-shadow-[0_2px_8px_rgba(0,0,0,1)]" style={{ zIndex: 20 }}>
            {type === 'team' ? (
              displayTeamsCount < 0 ? 'Loading...' : `${displayTeamsCount} Teams participated`
            ) : (
              displayParticipantsCount < 0 ? 'Loading...' : `${displayParticipantsCount} Players participated`
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SportsSection({ onSportClick, onEventScheduleClick, loggedInUser }) {
  // State for all sports counts
  const [sportsCounts, setSportsCounts] = useState({
    teams_counts: {},
    participants_counts: {}
  })
  const [loadingCounts, setLoadingCounts] = useState(false)
  const prevLoggedInUserRef = useRef(null)
  const hasFetchedRef = useRef(false)

  // Fetch all sports counts once when user logs in
  useEffect(() => {
    const prevUser = prevLoggedInUserRef.current
    const justLoggedIn = prevUser === null && loggedInUser !== null
    
    if (!loggedInUser) {
      setSportsCounts({ teams_counts: {}, participants_counts: {} })
      hasFetchedRef.current = false
      prevLoggedInUserRef.current = null
      return
    }

    // Only fetch if:
    // 1. User just logged in (prev was null, now has user), OR
    // 2. We haven't fetched yet (hasFetchedRef is false)
    if (!justLoggedIn && hasFetchedRef.current) {
      prevLoggedInUserRef.current = loggedInUser
      return
    }

    // Clear any cached API responses to ensure fresh data
    clearCache('/api/sports-counts')

    let isMounted = true
    const abortController = new AbortController()

    const fetchAllCounts = async () => {
      setLoadingCounts(true)
      try {
        // Fetching all sports counts
        const response = await fetchWithAuth('/api/sports-counts', {
          signal: abortController.signal,
        })

        if (!isMounted) {
          // Component unmounted, aborting fetch
          return
        }

        // Response received
        
        if (response.ok) {
          const data = await response.json()
          // Sports counts received
          if (isMounted) {
            setSportsCounts({
              teams_counts: data.teams_counts || {},
              participants_counts: data.participants_counts || {}
            })
            hasFetchedRef.current = true
            prevLoggedInUserRef.current = loggedInUser
            // State updated with sports counts
          }
        } else {
          // Clone response to read error text without consuming the original
          const clonedResponse = response.clone()
          const errorText = await clonedResponse.text().catch(() => 'Unable to read error text')
          logger.warn('Failed to fetch all sports counts:', response.status, errorText)
          if (isMounted) {
            setSportsCounts({ teams_counts: {}, participants_counts: {} })
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          // Request aborted
          return
        }
        if (!isMounted) {
          return
        }
        logger.error('Error fetching all sports counts:', err)
        if (isMounted) {
          setSportsCounts({ teams_counts: {}, participants_counts: {} })
        }
      } finally {
        if (isMounted) {
          setLoadingCounts(false)
        }
      }
    }

    fetchAllCounts()

    return () => {
      isMounted = false
      // Don't abort on loggedInUser change - let the request complete
      // The isMounted check will prevent state updates if component unmounts
      // Only abort if we're sure the component is unmounting (which we can't detect here)
      // So we'll just let requests complete naturally
      // Cleanup: marking as unmounted
    }
  }, [loggedInUser])

  // Show Team Events to all users (logged in or not)
  // All logged-in players should be able to see all sports cards
  const isAdmin = loggedInUser?.reg_number === 'admin'
  
  // Show team events to everyone - no restrictions
  const showTeamEvents = true

  // Show all team sports to non-admin logged-in users
  // Previously filtered, but now showing all for non-admin users
  const teamSportsToShow = sportsData.team

  // Helper function to check if user is enrolled in a sport
  const isEnrolledInSport = (sportName, sportType) => {
    if (!loggedInUser || isAdmin) {
      return false
    }

    if (!loggedInUser.participated_in || !Array.isArray(loggedInUser.participated_in)) {
      return false
    }

    const participation = loggedInUser.participated_in.find(p => p.sport === sportName)
    
    if (!participation) {
      return false
    }

    // For team events: check if user has a team (has team_name)
    if (sportType === 'team') {
      return !!participation.team_name
    }

    // For individual events: check if user has participated (no team_name)
    return !participation.team_name
  }

  // Helper function to check if user is a captain for a sport
  const isCaptainForSport = (sportName) => {
    if (!loggedInUser || isAdmin) {
      return false
    }

    if (!loggedInUser.captain_in || !Array.isArray(loggedInUser.captain_in)) {
      return false
    }

    return loggedInUser.captain_in.includes(sportName)
  }

  // Helper function to check if user can create or view a team for a sport
  const canCreateOrViewTeam = (sportName) => {
    if (isAdmin) {
      return true // Admin can always view teams
    }
    
    // User can create team if they are a captain and not enrolled
    const isCaptain = isCaptainForSport(sportName)
    const isEnrolled = isEnrolledInSport(sportName, 'team')
    
    // Can create if captain and not enrolled, or can view if enrolled
    return (isCaptain && !isEnrolled) || isEnrolled
  }

  return (
    <section id="sports" className="mt-[2.2rem]">
      {showTeamEvents && teamSportsToShow.length > 0 && (
        <>
          <h3 className="text-center mt-14 mb-[1.4rem] text-[1.4rem] tracking-[0.16em] uppercase text-[#ffe66d]">
            Team Events
          </h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[1.2rem]">
            {teamSportsToShow.map((sport) => (
              <SportCard 
                key={sport.name} 
                sport={sport} 
                type="team" 
                onSportClick={onSportClick}
                onEventScheduleClick={onEventScheduleClick}
                loggedInUser={loggedInUser}
                isEnrolled={isEnrolledInSport(sport.name, 'team')}
                isCaptain={isCaptainForSport(sport.name)}
                canCreateOrViewTeam={canCreateOrViewTeam(sport.name)}
                teamsCount={sportsCounts.teams_counts[sport.name]}
                participantsCount={undefined}
              />
            ))}
          </div>
        </>
      )}

      <h3 className="text-center mt-14 mb-[1.4rem] text-[1.4rem] tracking-[0.16em] uppercase text-[#ffe66d]">
        Individual Events
      </h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[1.2rem]">
        {sportsData.individual.map((sport) => (
          <SportCard 
            key={sport.name} 
            sport={sport} 
            type="individual" 
            onSportClick={onSportClick}
            onEventScheduleClick={onEventScheduleClick}
            loggedInUser={loggedInUser}
            isEnrolled={isEnrolledInSport(sport.name, 'individual')}
            isCaptain={false}
            teamsCount={undefined}
            participantsCount={sportsCounts.participants_counts[sport.name]}
          />
        ))}
      </div>

      <h3 className="text-center mt-14 mb-[1.4rem] text-[1.4rem] tracking-[0.16em] uppercase text-[#ffe88d]">
        Literary & Cultural Activities
      </h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[1.2rem]">
        {sportsData.cultural.map((sport) => (
          <SportCard 
            key={sport.name} 
            sport={sport} 
            type="individual" 
            onSportClick={onSportClick}
            onEventScheduleClick={onEventScheduleClick}
            loggedInUser={loggedInUser}
            isEnrolled={isEnrolledInSport(sport.name, 'individual')}
            isCaptain={false}
            teamsCount={undefined}
            participantsCount={sportsCounts.participants_counts[sport.name]}
          />
        ))}
      </div>
    </section>
  )
}

export default SportsSection

