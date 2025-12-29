import { useEffect, useState } from 'react'
import { EVENT_INFO } from '../constants/app'

function Hero({ onRegisterClick, onLoginClick, onLogout, onAddCaptainClick, onRemoveCaptainClick, onListPlayersClick, onExportExcel, loggedInUser }) {
  const [eventCountdown, setEventCountdown] = useState('')

  useEffect(() => {
    const targetTime = new Date(EVENT_INFO.eventDates.start).getTime()

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
  }, [])

  return (
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
            {EVENT_INFO.name}
          </div>
        </div>
        <div className="mt-1 text-center text-[1.2rem] font-bold text-[#ffe66d] drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] max-md:text-base">
          Event Date: {EVENT_INFO.eventDates.display}
        </div>
        <div className="mt-[0.7rem] text-center text-[1.2rem] font-semibold text-[#ff4dff] drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]">
          Registration Date: {EVENT_INFO.registrationDates.display}
        </div>
        {eventCountdown && (
          <div id="eventCountdown" className="mt-2 mb-0 text-center text-base font-semibold text-red-500">
            {eventCountdown}
          </div>
        )}
        {loggedInUser ? (
          <div className="mt-4 mb-2 text-center flex gap-4 justify-center items-center flex-wrap">
            <div className="text-[1.2rem] font-bold text-[#ffe66d] drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]">
              Welcome {loggedInUser.full_name}
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-6 py-2 rounded-full border border-[rgba(148,163,184,0.7)] text-sm font-bold uppercase tracking-[0.1em] cursor-pointer bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] shadow-[0_10px_24px_rgba(0,0,0,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(0,0,0,0.8)]"
              >
                Logout
              </button>
            )}
            {loggedInUser?.reg_number === 'admin' && onAddCaptainClick && (
              <button
                onClick={onAddCaptainClick}
                className="px-6 py-2 rounded-full border border-[rgba(148,163,184,0.7)] text-sm font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] text-[#e5e7eb] shadow-[0_10px_24px_rgba(79,70,229,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(79,70,229,0.8)]"
              >
                Add Captain
              </button>
            )}
            {loggedInUser?.reg_number === 'admin' && onRemoveCaptainClick && (
              <button
                onClick={onRemoveCaptainClick}
                className="px-6 py-2 rounded-full border border-[rgba(148,163,184,0.7)] text-sm font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-[#e5e7eb] shadow-[0_10px_24px_rgba(239,68,68,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(239,68,68,0.8)]"
              >
                Remove Captain
              </button>
            )}
            {loggedInUser?.reg_number === 'admin' && onListPlayersClick && (
              <button
                onClick={onListPlayersClick}
                className="px-6 py-2 rounded-full border border-[rgba(148,163,184,0.7)] text-sm font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#059669] to-[#047857] text-[#e5e7eb] shadow-[0_10px_24px_rgba(5,150,105,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(5,150,105,0.8)]"
              >
                List Players
              </button>
            )}
            {loggedInUser?.reg_number === 'admin' && onExportExcel && (
              <button
                onClick={onExportExcel}
                className="px-6 py-2 rounded-full border border-[rgba(148,163,184,0.7)] text-sm font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-[#e5e7eb] shadow-[0_10px_24px_rgba(59,130,246,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(59,130,246,0.8)]"
              >
                Export Excel
              </button>
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
    </div>
  )
}

export default Hero

