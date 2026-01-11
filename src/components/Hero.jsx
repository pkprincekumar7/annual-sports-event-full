import { useEffect, useState, useRef } from 'react'
import { useEventYear } from '../hooks/useEventYear'
import { formatDateRange } from '../utils/dateFormatters'
import EventYearSelector from './EventYearSelector'
import ProfileModal from './ProfileModal'

function Hero({ eventDisplayName, onRegisterClick, onLoginClick, onLogout, onCaptainManagementClick, onCoordinatorManagementClick, onBatchManagementClick, onListPlayersClick, onExportExcel, onAdminDashboardClick, onEventYearChange, selectedEventYear, loggedInUser }) {
  const { eventYearConfig } = useEventYear()
  const eventOrganizer = eventYearConfig?.event_organizer || 'Events Community'
  const [eventCountdown, setEventCountdown] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0, left: 'auto' })
  const menuButtonRef = useRef(null)

  // Format dates from database
  const eventDateDisplay = eventYearConfig?.event_dates 
    ? formatDateRange(eventYearConfig.event_dates.start, eventYearConfig.event_dates.end)
    : ''
  const registrationDateDisplay = eventYearConfig?.registration_dates
    ? formatDateRange(eventYearConfig.registration_dates.start, eventYearConfig.registration_dates.end)
    : ''

  useEffect(() => {
    // Use event start date from database for countdown
    const eventStartDate = eventYearConfig?.event_dates?.start
    if (!eventStartDate) {
      setEventCountdown('')
      return
    }

    const targetTime = new Date(eventStartDate).getTime()

    const update = () => {
      const now = Date.now()
      const diff = targetTime - now

      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
        const minutes = Math.floor((diff / (1000 * 60)) % 60)
        const seconds = Math.floor((diff / 1000) % 60)

        setEventCountdown(
          `Event starts in: ${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
        )
      } else {
        setEventCountdown('Registration closed!')
      }
    }

    update()
    const timer = setInterval(update, 1000)

    return () => clearInterval(timer)
  }, [eventYearConfig?.event_dates?.start])

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isMenuOpen])

  return (
    <div id="home" className="mb-6 text-center">
      <div
        className="mx-auto px-[1.4rem] py-[1.8rem] pb-8 rounded-[20px] relative overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.75)), url("/images/collge.png")',
        }}
      >
        <div className="text-center text-[1.7rem] max-md:text-[1.2rem] font-semibold text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.7)]">
          {eventOrganizer}
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
          <div className="text-[2.2rem] font-bold tracking-[0.18em] text-white uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.7),0_0_12px_rgba(0,0,0,0.8)] max-md:text-[1.3rem]">
            {eventDisplayName || 'Championship'}
          </div>
        </div>
        {eventDateDisplay && (
          <div className="mt-1 text-center text-[1.2rem] font-bold text-[#ffe66d] drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] max-md:text-base">
            Event Date: {eventDateDisplay}
          </div>
        )}
        {registrationDateDisplay && (
          <div className="mt-[0.7rem] text-center text-[1.2rem] font-semibold text-[#ff4dff] drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]">
            Registration Date: {registrationDateDisplay}
          </div>
        )}
        {eventCountdown && (
          <div id="eventCountdown" className="mt-2 mb-0 text-center text-base font-semibold text-red-500">
            {eventCountdown}
          </div>
        )}
        {loggedInUser ? (
          <div className="mt-4 mb-2 text-center flex flex-col gap-3 items-center">
            <div className="flex gap-4 justify-center items-center flex-wrap">
              <div className="text-[1.2rem] font-bold text-[#ffe66d] drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]">
                Welcome {loggedInUser.full_name}
              </div>
              <div className="relative">
                <button
                  ref={menuButtonRef}
                  onClick={() => {
                    if (menuButtonRef.current) {
                      const rect = menuButtonRef.current.getBoundingClientRect()
                      const isSmallDevice = window.innerWidth < 768
                      if (isSmallDevice) {
                        // Center the menu on smaller devices
                        const menuWidth = 224 // w-56 = 14rem = 224px
                        setMenuPosition({
                          top: rect.bottom + 8,
                          left: (window.innerWidth - menuWidth) / 2,
                          right: 'auto'
                        })
                      } else {
                        // Right-align on larger devices
                        setMenuPosition({
                          top: rect.bottom + 8,
                          right: window.innerWidth - rect.right,
                          left: 'auto'
                        })
                      }
                    }
                    setIsMenuOpen(!isMenuOpen)
                  }}
                  className="px-6 py-2 rounded-full border border-[rgba(148,163,184,0.7)] text-sm font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-[#e5e7eb] shadow-[0_10px_24px_rgba(99,102,241,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(99,102,241,0.8)] flex items-center gap-2"
                >
                  Menu
                  <span className="text-lg">{isMenuOpen ? '▲' : '▼'}</span>
                </button>
                
                {isMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsMenuOpen(false)}
                    />
                    <div 
                      className="fixed w-56 rounded-lg bg-[rgba(15,23,42,0.98)] border border-[rgba(148,163,184,0.5)] shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-20 overflow-hidden"
                      style={{
                        top: `${menuPosition.top}px`,
                        ...(menuPosition.left !== undefined ? { left: `${menuPosition.left}px` } : {}),
                        ...(menuPosition.right !== undefined && menuPosition.right !== 'auto' ? { right: `${menuPosition.right}px` } : {})
                      }}
                    >
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setIsMenuOpen(false)
                            setIsProfileModalOpen(true)
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm font-semibold text-[#e5e7eb] hover:bg-[rgba(148,163,184,0.2)] transition-colors flex items-center gap-2"
                        >
                          <span className="text-[#ffe66d]">●</span> Profile
                        </button>
                        {loggedInUser?.reg_number === 'admin' && onCaptainManagementClick && (
                          <button
                            onClick={() => {
                              setIsMenuOpen(false)
                              onCaptainManagementClick()
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-semibold text-[#e5e7eb] hover:bg-[rgba(148,163,184,0.2)] transition-colors flex items-center gap-2"
                          >
                            <span className="text-[#6366f1]">●</span> Add/Remove Captain
                          </button>
                        )}
                        {loggedInUser?.reg_number === 'admin' && onCoordinatorManagementClick && (
                          <button
                            onClick={() => {
                              setIsMenuOpen(false)
                              onCoordinatorManagementClick()
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-semibold text-[#e5e7eb] hover:bg-[rgba(148,163,184,0.2)] transition-colors flex items-center gap-2"
                          >
                            <span className="text-[#10b981]">●</span> Add/Remove Coordinator
                          </button>
                        )}
                        {loggedInUser?.reg_number === 'admin' && onBatchManagementClick && (
                          <button
                            onClick={() => {
                              setIsMenuOpen(false)
                              onBatchManagementClick()
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-semibold text-[#e5e7eb] hover:bg-[rgba(148,163,184,0.2)] transition-colors flex items-center gap-2"
                          >
                            <span className="text-[#f59e0b]">●</span> Add/Remove Batch
                          </button>
                        )}
                        {loggedInUser?.reg_number === 'admin' && onListPlayersClick && (
                          <button
                            onClick={() => {
                              setIsMenuOpen(false)
                              onListPlayersClick()
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-semibold text-[#e5e7eb] hover:bg-[rgba(148,163,184,0.2)] transition-colors flex items-center gap-2"
                          >
                            <span className="text-[#059669]">●</span> List Players
                          </button>
                        )}
                        {loggedInUser?.reg_number === 'admin' && onExportExcel && (
                          <button
                            onClick={() => {
                              setIsMenuOpen(false)
                              onExportExcel()
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-semibold text-[#e5e7eb] hover:bg-[rgba(148,163,184,0.2)] transition-colors flex items-center gap-2"
                          >
                            <span className="text-[#3b82f6]">●</span> Export Excel
                          </button>
                        )}
                        {loggedInUser?.reg_number === 'admin' && onAdminDashboardClick && (
                          <button
                            onClick={() => {
                              setIsMenuOpen(false)
                              onAdminDashboardClick()
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-semibold text-[#e5e7eb] hover:bg-[rgba(148,163,184,0.2)] transition-colors flex items-center gap-2"
                          >
                            <span className="text-[#f59e0b]">●</span> Admin Dashboard
                          </button>
                        )}
                        {onLogout && (
                          <div className="border-t border-[rgba(148,163,184,0.3)] mt-2 pt-2">
                            <button
                              onClick={() => {
                                setIsMenuOpen(false)
                                onLogout()
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm font-semibold text-[#e5e7eb] hover:bg-[rgba(148,163,184,0.2)] transition-colors flex items-center gap-2"
                            >
                              <span className="text-red-400">●</span> Logout
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            {loggedInUser?.reg_number === 'admin' && (
              <EventYearSelector
                selectedEventYear={selectedEventYear}
                onEventYearChange={onEventYearChange}
                loggedInUser={loggedInUser}
              />
            )}
          </div>
        ) : (
          <div className="mt-4 mb-2 text-center flex gap-4 justify-center items-center">
            {onLoginClick && (
              <button
                onClick={onLoginClick}
                className="px-8 py-3 rounded-full border border-[rgba(148,163,184,0.7)] text-base font-bold uppercase tracking-[0.1em] cursor-pointer bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] shadow-[0_10px_24px_rgba(0,0,0,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(0,0,0,0.8)]"
              >
                Login
              </button>
            )}
            {onRegisterClick && (
              <button
                onClick={onRegisterClick}
                className="px-8 py-3 rounded-full border-none text-base font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#ffe66d] to-[#ff9f1c] text-[#111827] shadow-[0_10px_24px_rgba(250,204,21,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(250,204,21,0.75)]"
              >
                Register
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mt-[1.4rem] mx-auto max-w-[1000px] text-center px-4 py-2 rounded-full bg-gradient-to-r from-[rgba(0,0,0,0.7)] to-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.2)] font-bold tracking-[0.08em] uppercase text-[1.5rem]">
        MULTIPLE SPORTS • <span className="text-[#ffe66d]">TROPHIES &amp; PRIZES</span> • JOIN THE GAME
      </div>
      
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        loggedInUser={loggedInUser}
        selectedEventYear={selectedEventYear}
      />
    </div>
  )
}

export default Hero

