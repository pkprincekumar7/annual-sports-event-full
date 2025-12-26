import { useState, useEffect, useRef } from 'react'
import { fetchWithAuth, fetchCurrentUser, decodeJWT, clearCache } from './utils/api'
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
import AboutSection from './components/AboutSection'
import Footer from './components/Footer'
import StatusPopup from './components/StatusPopup'

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isAddCaptainModalOpen, setIsAddCaptainModalOpen] = useState(false)
  const [isRemoveCaptainModalOpen, setIsRemoveCaptainModalOpen] = useState(false)
  const [isTeamDetailsModalOpen, setIsTeamDetailsModalOpen] = useState(false)
  const [isParticipantDetailsModalOpen, setIsParticipantDetailsModalOpen] = useState(false)
  const [isPlayerListModalOpen, setIsPlayerListModalOpen] = useState(false)
  const [selectedSport, setSelectedSport] = useState(null)
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
        if (isMounted) setIsLoadingUser(false)
        return
      }

      try {
        // Use optimized fetchCurrentUser function (uses cache)
        const userData = await fetchCurrentUser()
        
        if (!isMounted) return

        if (userData) {
          setLoggedInUser(userData)
        } else {
          // User not found, clear token
          localStorage.removeItem('authToken')
          setAuthToken(null)
        }
      } catch (error) {
        if (!isMounted) return
        console.error('Error fetching user data:', error)
        // On error, clear token
        localStorage.removeItem('authToken')
        setAuthToken(null)
      } finally {
        if (isMounted) setIsLoadingUser(false)
      }
    }

    fetchUserData()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [])

  const handleSportClick = (sport) => {
    // Prevent actions while user data is loading
    if (isLoadingUser) {
      return
    }

    // If admin is logged in and it's a team event, open team details modal
    if (loggedInUser?.reg_number === 'admin' && sport.type === 'team') {
      setSelectedSport(sport)
      setIsTeamDetailsModalOpen(true)
      return
    }
    // If admin is logged in and it's not a team event, show participant details
    if (loggedInUser?.reg_number === 'admin' && sport.type === 'individual') {
      setSelectedSport(sport)
      setIsParticipantDetailsModalOpen(true)
      return
    }
    
    // Check if user is a captain for this sport
    const isCaptainForSport = loggedInUser?.captain_in && 
      Array.isArray(loggedInUser.captain_in) && 
      loggedInUser.captain_in.includes(sport.name)
    
    // Check if user is enrolled in this team event (has team_name in participated_in)
    const isEnrolledInTeamEvent = loggedInUser?.participated_in && 
      Array.isArray(loggedInUser.participated_in) &&
      loggedInUser.participated_in.some(p => 
        p.sport === sport.name && p.team_name
      )
    
    // If user is enrolled in this team event (as participant, regardless of captain status for other sports)
    // Show team details first - this handles both captains enrolled as participants and regular participants
    if (sport.type === 'team' && isEnrolledInTeamEvent) {
      setSelectedSport(sport)
      setIsTeamDetailsModalOpen(true)
      return
    }
    
    // If captain clicks on their team event sport (but not enrolled yet)
    if (isCaptainForSport && sport.type === 'team') {
      // Captain hasn't created a team yet - show registration form
      setSelectedSport(sport)
      setIsModalOpen(true)
      return
    }
    
    // If user is not logged in, open login modal and store the selected sport
    if (!loggedInUser) {
      setSelectedSport(sport)
      setIsLoginModalOpen(true)
      return
    }
    
    // For individual/cultural events, check if user has already participated
    // Skip this check for admin users
    const isAdmin = loggedInUser?.reg_number === 'admin'
    if (sport.type === 'individual' && !isAdmin) {
      const hasParticipated = loggedInUser?.participated_in && 
        Array.isArray(loggedInUser.participated_in) &&
        loggedInUser.participated_in.some(p => p.sport === sport.name)
      
      if (hasParticipated) {
        // User has already participated - show message
        showStatusPopup('You have already participated.', 'error', 3000)
        return
      }
    }
    
    // If user is logged in, open registration modal
    setSelectedSport(sport)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedSport(null)
  }

  const handleCloseLoginModal = () => {
    setIsLoginModalOpen(false)
    // Clear selected sport if user closes login modal without logging in
    // (selectedSport will be preserved if login is successful)
    if (!loginSuccessRef.current) {
      setSelectedSport(null)
    }
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
    // If there was a selected sport before login, open registration modal after login
    if (selectedSport) {
      setIsLoginModalOpen(false)
      setTimeout(() => {
        setIsModalOpen(true)
      }, 100)
    }
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
      const userData = await fetchCurrentUser()
      if (userData) {
        setLoggedInUser(userData)
      } else {
        setLoggedInUser(null)
      }
    } catch (error) {
      console.error('Error refreshing user data:', error)
      setLoggedInUser(null)
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
      console.error('Error exporting Excel:', err)
      showStatusPopup('❌ Error exporting Excel file. Please try again.', 'error', 3000)
    }
  }

  return (
    <>
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
              <SportsSection onSportClick={handleSportClick} loggedInUser={loggedInUser} />
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
      <AboutSection />
      <Footer />
      <StatusPopup popup={statusPopup} />
    </>
  )
}

export default App

