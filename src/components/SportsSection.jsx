import { useState, useEffect, useRef } from 'react'
import { fetchWithAuth } from '../utils/api'
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

function SportCard({ sport, type, onSportClick, loggedInUser, isEnrolled }) {
  const isAdmin = loggedInUser?.reg_number === 'admin'
  const showEnrolled = !isAdmin && isEnrolled
  const [teamsCount, setTeamsCount] = useState(-1) // -1 means not loaded yet, 0+ means loaded
  const [participantsCount, setParticipantsCount] = useState(-1) // -1 means not loaded yet, 0+ means loaded
  const abortControllerRef = useRef(null)
  const fetchKeyRef = useRef(null) // Track sport.name + type to detect actual changes
  const prevFetchKeyRef = useRef(null) // Track previous fetch key to detect actual changes

  // Debug: Log state changes
  useEffect(() => {
    if (loggedInUser) {
      logger.api(`SportCard ${sport.name} (${type}) - teamsCount: ${teamsCount}, participantsCount: ${participantsCount}`)
    }
  }, [teamsCount, participantsCount, sport.name, type, loggedInUser])

  // Reset counts when user logs out
  useEffect(() => {
    if (!loggedInUser) {
      setTeamsCount(-1)
      setParticipantsCount(-1)
      // Clear refs when user logs out
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      fetchKeyRef.current = null
      prevFetchKeyRef.current = null
    }
  }, [loggedInUser])

  // Fetch counts for logged-in users - only re-run when sport.name or type changes
  useEffect(() => {
    if (!loggedInUser) {
      return
    }

    // Create a unique key for this fetch (sport + type)
    const currentFetchKey = `${sport.name}-${type}`
    const prevFetchKey = prevFetchKeyRef.current
    
    // Only abort previous request if sport.name or type actually changed
    if (abortControllerRef.current && prevFetchKey && prevFetchKey !== currentFetchKey) {
      logger.api(`Sport/type changed from ${prevFetchKey} to ${currentFetchKey}, aborting previous request`)
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      fetchKeyRef.current = null
    }

    // Don't fetch if we already have the data for this exact sport/type
    if ((type === 'team' && teamsCount >= 0) || (type !== 'team' && participantsCount >= 0)) {
      if (fetchKeyRef.current === currentFetchKey) {
        logger.api(`Already have count for ${sport.name} (${type}), skipping fetch`)
        // Update prevFetchKeyRef even if we skip fetch
        prevFetchKeyRef.current = currentFetchKey
        return
      }
    }

    let isMounted = true
    const abortController = new AbortController()
    // Store the fetch key BEFORE updating refs, so cleanup can compare
    const thisEffectFetchKey = currentFetchKey
    abortControllerRef.current = abortController
    fetchKeyRef.current = currentFetchKey
    prevFetchKeyRef.current = currentFetchKey

    const fetchCounts = async () => {
      try {
        if (type === 'team') {
          // Fetch teams count for team events
          const encodedSport = encodeURIComponent(sport.name)
          logger.api(`Fetching teams count for ${sport.name}...`)
          const response = await fetchWithAuth(`/api/teams/${encodedSport}`, {
            signal: abortController.signal,
          })
          
          if (!isMounted) {
            logger.api(`Component unmounted during fetch for ${sport.name}`)
            return
          }

          if (response.ok) {
            const data = await response.json()
            logger.api(`Teams count for ${sport.name}:`, data)
            const count = data.total_teams !== undefined ? data.total_teams : (data.teams ? data.teams.length : 0)
            logger.api(`Setting teamsCount to:`, count, 'for sport:', sport.name)
            if (isMounted) {
              setTeamsCount(count)
            }
          } else {
            logger.warn(`Failed to fetch teams count for ${sport.name}:`, response.status)
            if (isMounted) {
              setTeamsCount(0)
            }
          }
        } else {
          // Fetch participants count for non-team events
          const encodedSport = encodeURIComponent(sport.name)
          logger.api(`Fetching participants count for ${sport.name}...`)
          const response = await fetchWithAuth(`/api/participants-count/${encodedSport}`, {
            signal: abortController.signal,
          })
          
          if (!isMounted) {
            logger.api(`Component unmounted during fetch for ${sport.name}`)
            return
          }

          if (response.ok) {
            const data = await response.json()
            logger.api(`Participants count for ${sport.name}:`, data)
            const count = data.total_participants !== undefined ? data.total_participants : 0
            logger.api(`Setting participantsCount to:`, count, 'for sport:', sport.name)
            if (isMounted) {
              setParticipantsCount(count)
            }
          } else {
            logger.warn(`Failed to fetch participants count for ${sport.name}:`, response.status)
            if (isMounted) {
              setParticipantsCount(0)
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          logger.api(`Request aborted for ${sport.name} (${type})`)
          return
        }
        if (!isMounted) {
          return
        }
        logger.error('Error fetching counts:', err)
        // Set to 0 on error so it still displays
        if (isMounted) {
          if (type === 'team') {
            setTeamsCount(0)
          } else {
            setParticipantsCount(0)
          }
        }
      }
    }

    fetchCounts()

    return () => {
      isMounted = false
      // Only abort if this is still the current controller AND the fetch key actually changed
      // Compare the fetch key from this effect run with what's stored in the ref
      // If they're different, a new effect run started with a different sport/type - abort
      if (abortControllerRef.current === abortController) {
        const currentStoredKey = fetchKeyRef.current
        // If stored key is different from this effect's key, sport/type changed
        if (currentStoredKey && currentStoredKey !== thisEffectFetchKey) {
          // A new effect run started with different sport/type - abort this one
          logger.api(`Aborting request for ${sport.name} (${type}) - new fetch started for different sport/type (${currentStoredKey})`)
          abortController.abort()
        } else {
          // Same fetch key - don't abort (loggedInUser change or unmount)
          logger.api(`Not aborting request for ${sport.name} (${type}) - same fetch key (${thisEffectFetchKey})`)
        }
      }
    }
  }, [sport.name, type, loggedInUser]) // Need loggedInUser to trigger fetch when user logs in

  // Debug: Log render state
  if (loggedInUser) {
    logger.api(`Rendering SportCard ${sport.name} (${type}) - teamsCount: ${teamsCount}, participantsCount: ${participantsCount}`)
  }

  return (
    <div
      className="relative min-h-[170px] rounded-[18px] overflow-hidden shadow-[0_18px_40px_rgba(0,0,0,0.75)] cursor-pointer translate-y-0 transition-all duration-[0.25s] ease-in-out hover:-translate-y-2 hover:shadow-[0_26px_55px_rgba(0,0,0,0.9)]"
      style={{
        background: 'radial-gradient(circle at 0 0, #ffe66d 0, #7f1d1d 50%, #020617 100%)',
      }}
      onClick={() => onSportClick({ name: sport.name, type, players: sport.players })}
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-90"
        style={{ backgroundImage: `url('${sport.image}')` }}
      />
      {showEnrolled && (
        <div className="absolute top-2 right-2 px-3 py-1 rounded-full bg-[rgba(34,197,94,0.9)] text-white text-[0.75rem] font-bold uppercase tracking-[0.1em] shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-10">
          You are enrolled!
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.9)] to-[rgba(0,0,0,0.2)] flex flex-col justify-end p-[0.9rem] px-[1.1rem] text-[#f9fafb] drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)] z-10">
        <div className="text-[1.1rem] font-extrabold text-[#ffe66d] uppercase">{sport.name}</div>
        <div className="text-[0.85rem] mt-[0.15rem]">{sport.text}</div>
        {loggedInUser && (
          <div className="text-[0.8rem] mt-2 font-bold text-[#06b6d4] drop-shadow-[0_2px_8px_rgba(0,0,0,1)]" style={{ zIndex: 20 }}>
            {type === 'team' ? (
              teamsCount < 0 ? 'Loading...' : `${teamsCount} Teams participated`
            ) : (
              participantsCount < 0 ? 'Loading...' : `${participantsCount} Players participated`
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SportsSection({ onSportClick, loggedInUser }) {
  // Show Team Events if:
  // - User is not logged in (show all events)
  // - OR logged in user's reg_number is "admin" (admin - show all)
  // - OR logged in user has non-empty captain_in array (show only sports in captain_in)
  // - OR logged in user is enrolled in team events (has participated_in with team_name)
  const isAdmin = loggedInUser?.reg_number === 'admin'
  const hasCaptainRole = loggedInUser?.captain_in && Array.isArray(loggedInUser.captain_in) && loggedInUser.captain_in.length > 0
  
  // Check if user is enrolled in any team events
  const hasTeamParticipations = loggedInUser?.participated_in && 
    Array.isArray(loggedInUser.participated_in) &&
    loggedInUser.participated_in.some(p => p.team_name)
  
  const showTeamEvents = !loggedInUser || isAdmin || hasCaptainRole || hasTeamParticipations

  // Filter team sports based on captain_in or enrolled participations for non-admin users
  const getTeamSportsToShow = () => {
    if (!loggedInUser || isAdmin) {
      // Show all team sports for non-logged-in users or admin
      return sportsData.team
    }
    
    // Collect all sports the user should see:
    // 1. Sports where user is a captain (from captain_in)
    // 2. Sports where user is enrolled as a participant (from participated_in with team_name)
    const sportsToShow = new Set()
    
    // Add sports from captain_in
    if (hasCaptainRole && Array.isArray(loggedInUser.captain_in)) {
      loggedInUser.captain_in.forEach(sportName => {
        sportsToShow.add(sportName)
      })
    }
    
    // Add sports from participated_in where user is enrolled (has team_name)
    if (hasTeamParticipations && Array.isArray(loggedInUser.participated_in)) {
      loggedInUser.participated_in.forEach(participation => {
        if (participation.team_name) {
          sportsToShow.add(participation.sport)
        }
      })
    }
    
    // Filter team sports to only include those in the set
    return sportsData.team.filter(sport => sportsToShow.has(sport.name))
  }

  const teamSportsToShow = getTeamSportsToShow()

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
                loggedInUser={loggedInUser}
                isEnrolled={isEnrolledInSport(sport.name, 'team')}
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
            loggedInUser={loggedInUser}
            isEnrolled={isEnrolledInSport(sport.name, 'individual')}
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
            loggedInUser={loggedInUser}
            isEnrolled={isEnrolledInSport(sport.name, 'individual')}
          />
        ))}
      </div>
    </section>
  )
}

export default SportsSection

