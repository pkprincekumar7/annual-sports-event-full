import { useState, useEffect, useRef } from 'react'
import { fetchWithAuth, fetchCurrentUser, decodeJWT, clearCache } from './utils/api'
import logger from './utils/logger'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import SportsSection from './components/SportsSection'
import RegisterModal from './components/RegisterModal'
import LoginModal from './components/LoginModal'
import AddCaptainModal from './components/AddCaptainModal'
import RemoveCaptainModal from './components/RemoveCaptainModal'
import TeamDetailsModal from './components/TeamDetailsModal'
import ParticipantDetailsModal from './components/ParticipantDetailsModal'
import PlayerListModal from './components/PlayerListModal'
import EventScheduleModal from './components/EventScheduleModal'
import SportDetailsModal from './components/SportDetailsModal'
import AboutSection from './components/AboutSection'
import Footer from './components/Footer'
import StatusPopup from './components/StatusPopup'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isAddCaptainModalOpen, setIsAddCaptainModalOpen] = useState(false)
  const [isRemoveCaptainModalOpen, setIsRemoveCaptainModalOpen] = useState(false)
  const [isTeamDetailsModalOpen, setIsTeamDetailsModalOpen] = useState(false)
  const [isParticipantDetailsModalOpen, setIsParticipantDetailsModalOpen] = useState(false)
  const [isPlayerListModalOpen, setIsPlayerListModalOpen] = useState(false)
  const [isEventScheduleModalOpen, setIsEventScheduleModalOpen] = useState(false)
  const [isSportDetailsModalOpen, setIsSportDetailsModalOpen] = useState(false)
  const [selectedSport, setSelectedSport] = useState(null)
  const [selectedEventSport, setSelectedEventSport] = useState(null)
  const [statusPopup, setStatusPopup] = useState({ show: false, message: '', type: 'success' })
  const loginSuccessRef = useRef(false) // Track if login was successful to preserve selectedSport
  
  // Only store JWT token in localStorage, not user data
  const [authToken, setAuthToken] = useState(() => {
    return localStorage.getItem('authToken') || null
  })
  const [loggedInUser, setLoggedInUser] = useState(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)

  // Fetch user data from server on mount if token exists
  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    const fetchUserData = async () => {
      const token = localStorage.getItem('authToken')
      if (!token) {
        if (isMounted) {
          setIsLoadingUser(false)
          setAuthToken(null)
          setLoggedInUser(null)
        }
        return
      }

      // Ensure authToken state is set from localStorage
      if (isMounted) {
        setAuthToken(token)
      }

      // Store token before fetch to check if it gets cleared
      const tokenBeforeFetch = token

      try {
        // Use optimized fetchCurrentUser function (uses cache)
        const result = await fetchCurrentUser()
        
        if (!isMounted) return

        // Check if token was cleared during fetch (indicates auth error)
        const tokenAfterFetch = localStorage.getItem('authToken')
        const tokenWasCleared = tokenBeforeFetch && !tokenAfterFetch

        if (result.user) {
          // Successfully fetched user data
          setLoggedInUser(result.user)
          setAuthToken(tokenBeforeFetch) // Ensure authToken state is set
          setIsLoadingUser(false) // Stop loading
          // Ensure token is set (in case it was temporarily missing)
          if (tokenBeforeFetch && !tokenAfterFetch) {
            localStorage.setItem('authToken', tokenBeforeFetch)
          }
        } else if (result.authError || tokenWasCleared) {
          // Authentication error - token is invalid or expired
          // Token may have already been cleared by fetchWithAuth
          logger.info('Authentication error detected, clearing token')
          if (localStorage.getItem('authToken')) {
            localStorage.removeItem('authToken')
          }
          setAuthToken(null)
          setLoggedInUser(null)
          setIsLoadingUser(false) // Stop loading
        } else {
          // If result.user is null but authError is false and token wasn't cleared,
          // it means a temporary error (network issue, server error, etc.)
          logger.warn('Temporary error fetching user data. Result:', result)
          
          // Ensure authToken state is set since token exists
          setAuthToken(tokenBeforeFetch)
          
          // Retry immediately without delay for better UX
          // Keep loading true until retry completes
          const retryFetch = async () => {
            if (!isMounted) return
            try {
              const retryResult = await fetchCurrentUser()
              if (!isMounted) return
              
              if (retryResult.user) {
                setLoggedInUser(retryResult.user)
                setAuthToken(localStorage.getItem('authToken'))
                setIsLoadingUser(false) // Stop loading on success
              } else if (retryResult.authError) {
                // Auth error on retry - clear token
                logger.info('Authentication error on retry, clearing token')
                localStorage.removeItem('authToken')
                setAuthToken(null)
                setLoggedInUser(null)
                setIsLoadingUser(false) // Stop loading on auth error
              } else {
                // Retry also failed with temporary error - stop loading but keep token
                setIsLoadingUser(false)
              }
            } catch (retryError) {
              if (!isMounted) return
              logger.error('Error on retry fetch:', retryError)
              setIsLoadingUser(false) // Stop loading even on error
              // Keep token - might be temporary network issue
            }
          }
          
          // Retry immediately (no delay) - use setTimeout with 0 to run after current execution
          setTimeout(retryFetch, 0)
          // Don't set loading to false here - let retry handle it
        }
      } catch (error) {
        if (!isMounted) return
        logger.error('Error fetching user data:', error)
        // On unexpected errors, check if token still exists
        // Only clear if it was explicitly cleared (auth error)
        const currentToken = localStorage.getItem('authToken')
        if (!currentToken && tokenBeforeFetch) {
          // Token was cleared during fetch, likely an auth error
          setAuthToken(null)
          setLoggedInUser(null)
          setIsLoadingUser(false)
        } else {
          // Token still exists - might be temporary network issue
          // Retry once
          const retryFetch = async () => {
            if (!isMounted) return
            try {
              const retryResult = await fetchCurrentUser()
              if (!isMounted) return
              
              if (retryResult.user) {
                setLoggedInUser(retryResult.user)
                setAuthToken(localStorage.getItem('authToken'))
                setIsLoadingUser(false)
              } else if (retryResult.authError) {
                localStorage.removeItem('authToken')
                setAuthToken(null)
                setLoggedInUser(null)
                setIsLoadingUser(false)
              } else {
                setIsLoadingUser(false)
              }
            } catch (retryError) {
              if (!isMounted) return
              logger.error('Error on retry fetch:', retryError)
              setIsLoadingUser(false)
            }
          }
          setTimeout(retryFetch, 0)
          // Don't set loading to false here - let retry handle it
        }
      }
    }

    fetchUserData()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [])

  const handleEventScheduleClick = (sport) => {
    // Determine sport_type: check if it's a cultural event
    const culturalSports = [
      'Essay Writing', 'Story Writing', 'Group Discussion', 'Debate',
      'Extempore', 'Quiz', 'Dumb Charades', 'Painting', 'Singing'
    ]
    const isCultural = culturalSports.includes(sport.name)
    
    setSelectedEventSport({
      ...sport,
      sportType: sport.type === 'team' ? 'team' : (isCultural ? 'cultural' : 'individual')
    })
    setIsEventScheduleModalOpen(true)
  }

  const handleSportClick = (sport) => {
    // Prevent actions while user data is loading
    if (isLoadingUser) {
      return
    }

    // If user is not logged in, open login modal and store the selected sport
    if (!loggedInUser) {
      setSelectedSport(sport)
      setIsLoginModalOpen(true)
      return
    }
    
    // For logged-in users, open the unified sport details modal
    setSelectedSport(sport)
    setIsSportDetailsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedSport(null)
  }

  const handleCloseLoginModal = () => {
    setIsLoginModalOpen(false)
    // Clear selected sport when login modal is closed
    setSelectedSport(null)
    loginSuccessRef.current = false // Reset the flag
  }

  const handleLoginSuccess = (player, token) => {
    // Store player data in memory only (excluding password)
    // Do NOT store in localStorage - only token is stored
    setLoggedInUser(player)
    // Store JWT token in localStorage
    if (token) {
      setAuthToken(token)
      localStorage.setItem('authToken', token)
    }
    // Set flag to indicate login was successful
    loginSuccessRef.current = true
    // Close login modal - user can click on sport again if they want to view it
    setIsLoginModalOpen(false)
    // Clear selected sport - let user choose what to do after login
    setSelectedSport(null)
  }

  // Function to refresh user data from server (optimized with cache)
  const refreshUserData = async () => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      setLoggedInUser(null)
      return
    }

    try {
      // Clear cache to force fresh fetch
      clearCache('/api/players')
      // Use optimized fetchCurrentUser function
      const result = await fetchCurrentUser()
      if (result.user) {
        setLoggedInUser(result.user)
      } else if (result.authError) {
        // Auth error - clear user and token
        setLoggedInUser(null)
        localStorage.removeItem('authToken')
        setAuthToken(null)
      } else {
        // Temporary error - keep current user state, don't clear
        // User stays logged in with cached data
      }
    } catch (error) {
      logger.error('Error refreshing user data:', error)
      // On unexpected errors, don't clear user - might be temporary network issue
    }
  }

  const handleUserUpdate = (updatedPlayer) => {
    // Update logged-in user data (e.g., after participation update)
    setLoggedInUser(updatedPlayer)
    // Clear cache to ensure fresh data on next fetch
    clearCache('/api/players')
  }

  const handleLogout = () => {
    // Clear logged-in user data from memory and token from localStorage
    setLoggedInUser(null)
    setAuthToken(null)
    localStorage.removeItem('authToken')
    showStatusPopup('✅ Logged out successfully!', 'success', 2000)
  }

  const showStatusPopup = (message, type = 'success', duration = 2500) => {
    setStatusPopup({ show: true, message, type })
    setTimeout(() => {
      setStatusPopup({ show: false, message: '', type: 'success' })
    }, duration)
  }

  const handleExportExcel = async () => {
    try {
      const response = await fetchWithAuth('/api/export-excel')
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        showStatusPopup(
          `❌ ${errorData.error || 'Failed to export Excel file. Please try again.'}`,
          'error',
          3000
        )
        return
      }

      // Get the blob from response
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'Players_Report.xlsx'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      showStatusPopup('✅ Excel file downloaded successfully!', 'success', 2500)
    } catch (err) {
      logger.error('Error exporting Excel:', err)
      showStatusPopup('❌ Error exporting Excel file. Please try again.', 'error', 3000)
    }
  }

  return (
    <ErrorBoundary>
      <Navbar />
      <main id="top" className="max-w-[1300px] mx-auto px-4 py-6 pb-10 grid grid-cols-[minmax(0,1.6fr)] gap-10 max-md:grid-cols-1">
        <section>
          {isLoadingUser ? (
            // Show loading state while fetching user data
            <div id="home" className="mb-6 text-center">
              <div
                className="mx-auto px-[1.4rem] py-[1.8rem] pb-8 rounded-[20px] relative overflow-hidden bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.75)), url("/images/collge.png")',
                }}
              >
                <div className="text-center text-[1.7rem] font-semibold text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.7)]">
                  Purnea College of Engineering, Purnea
                </div>
                <div
                  className="mt-[1.2rem] mb-[0.6rem] mx-auto text-center w-fit px-[1.6rem] py-2 bg-gradient-to-b from-[#ff3434] to-[#b70000] rounded-full shadow-[0_14px_30px_rgba(0,0,0,0.6),0_0_0_3px_rgba(255,255,255,0.15)] relative overflow-visible"
                  style={{
                    position: 'relative',
                  }}
                >
                  <div
                    className="absolute top-1/2 left-[-26px] w-[42px] h-[26px] bg-gradient-to-b from-[#c40d0d] to-[#7a0202]"
                    style={{
                      clipPath: 'polygon(100% 0, 0 0, 80% 50%, 0 100%, 100% 100%)',
                    }}
                  />
                  <div
                    className="absolute top-1/2 right-[-26px] w-[42px] h-[26px] bg-gradient-to-b from-[#c40d0d] to-[#7a0202]"
                    style={{
                      clipPath: 'polygon(0 0, 100% 0, 20% 50%, 100% 100%, 0 100%)',
                    }}
                  />
                  <div className="text-[2.2rem] font-bold tracking-[0.18em] text-white uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.7),0_0_12px_rgba(0,0,0,0.8)] max-md:text-[1.7rem]">
                    UMANG – 2026
                  </div>
                </div>
                <div className="mt-4 mb-2 text-center">
                  <div className="text-[1.2rem] font-bold text-[#ffe66d] drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] animate-pulse">
                    Loading user data...
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Hero 
                onRegisterClick={() => setIsModalOpen(true)} 
                onLoginClick={() => setIsLoginModalOpen(true)}
                onLogout={handleLogout}
                onAddCaptainClick={() => setIsAddCaptainModalOpen(true)}
                onRemoveCaptainClick={() => setIsRemoveCaptainModalOpen(true)}
                onListPlayersClick={() => setIsPlayerListModalOpen(true)}
                onExportExcel={handleExportExcel}
                loggedInUser={loggedInUser}
              />
              <SportsSection 
                onSportClick={handleSportClick} 
                onEventScheduleClick={handleEventScheduleClick}
                loggedInUser={loggedInUser} 
              />
            </>
          )}
        </section>
      </main>
      <RegisterModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        selectedSport={selectedSport}
        onStatusPopup={showStatusPopup}
        loggedInUser={loggedInUser}
        onUserUpdate={handleUserUpdate}
      />
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={handleCloseLoginModal}
        onLoginSuccess={handleLoginSuccess}
        onStatusPopup={showStatusPopup}
      />
      <AddCaptainModal
        isOpen={isAddCaptainModalOpen}
        onClose={() => setIsAddCaptainModalOpen(false)}
        onStatusPopup={showStatusPopup}
      />
      <RemoveCaptainModal
        isOpen={isRemoveCaptainModalOpen}
        onClose={() => setIsRemoveCaptainModalOpen(false)}
        onStatusPopup={showStatusPopup}
      />
      <TeamDetailsModal
        isOpen={isTeamDetailsModalOpen}
        onClose={() => {
          setIsTeamDetailsModalOpen(false)
          setSelectedSport(null)
        }}
        sport={selectedSport?.name}
        loggedInUser={loggedInUser}
        onStatusPopup={showStatusPopup}
      />
      <ParticipantDetailsModal
        isOpen={isParticipantDetailsModalOpen}
        onClose={() => {
          setIsParticipantDetailsModalOpen(false)
          setSelectedSport(null)
        }}
        sport={selectedSport?.name}
        loggedInUser={loggedInUser}
        onStatusPopup={showStatusPopup}
      />
      <PlayerListModal
        isOpen={isPlayerListModalOpen}
        onClose={() => setIsPlayerListModalOpen(false)}
        onStatusPopup={showStatusPopup}
      />
      <EventScheduleModal
        isOpen={isEventScheduleModalOpen}
        onClose={() => {
          setIsEventScheduleModalOpen(false)
          setSelectedEventSport(null)
        }}
        sport={selectedEventSport?.name}
        sportType={selectedEventSport?.sportType || (selectedEventSport?.type === 'team' ? 'team' : 'individual')}
        loggedInUser={loggedInUser}
        onStatusPopup={showStatusPopup}
      />
      <SportDetailsModal
        isOpen={isSportDetailsModalOpen}
        onClose={() => {
          setIsSportDetailsModalOpen(false)
          setSelectedSport(null)
        }}
        selectedSport={selectedSport}
        loggedInUser={loggedInUser}
        onStatusPopup={showStatusPopup}
        onUserUpdate={handleUserUpdate}
        onEventScheduleClick={handleEventScheduleClick}
      />
      <AboutSection />
      <Footer />
      <StatusPopup popup={statusPopup} />
    </ErrorBoundary>
  )
}

export default App

