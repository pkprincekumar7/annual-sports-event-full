import { useState } from 'react'
import { API_URL } from '../utils/api'
import logger from '../utils/logger'

function LoginModal({ isOpen, onClose, onLoginSuccess, onStatusPopup }) {
  const [regNumber, setRegNumber] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!regNumber.trim() || !password.trim()) {
      onStatusPopup('❌ Please enter both registration number and password.', 'error', 2500)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reg_number: regNumber.trim(),
          password: password.trim(),
        }),
      })

      if (!response.ok) {
        // Try to get the error message from the response
        let errorMessage = 'Error while logging in. Please try again.'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || 'Invalid registration number or password.'
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
        setIsLoading(false)
        return
      }

      const data = await response.json()

      if (data.success) {
        // Store JWT token in localStorage (user data is handled by App.jsx)
        if (data.token) {
          localStorage.setItem('authToken', data.token)
        }
        onStatusPopup('✅ Login successful!', 'success', 2000)
        // Pass player data to App.jsx (will be stored in memory only)
        onLoginSuccess(data.player, data.token)
        setRegNumber('')
        setPassword('')
        setIsLoading(false)
        onClose()
      } else {
        const errorMessage = data.error || 'Invalid registration number or password.'
        onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
        setIsLoading(false)
      }
    } catch (err) {
      logger.error('Error while logging in:', err)
      onStatusPopup('❌ Error while logging in. Please try again.', 'error', 2500)
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.65)] flex items-center justify-center z-[200] p-4"
    >
      <aside className="max-w-[420px] w-full bg-gradient-to-br from-[rgba(12,16,40,0.98)] to-[rgba(9,9,26,0.94)] rounded-[20px] px-[1.4rem] py-[1.6rem] pb-[1.5rem] border border-[rgba(255,255,255,0.12)] shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-[20px] relative">
        <button
          type="button"
          className="absolute top-[10px] right-3 bg-transparent border-none text-[#e5e7eb] text-base cursor-pointer"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[#a5b4fc] mb-1 text-center">Login</div>
        <div className="text-[1.25rem] font-extrabold text-center uppercase tracking-[0.14em] text-[#ffe66d] mb-[0.7rem]">
          Player Login
        </div>
        <div className="text-[0.85rem] text-center text-[#e5e7eb] mb-4">PCE, Purnea • Umang – 2026 Sports Fest</div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="login_reg_number" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Reg. Number *
            </label>
            <input
              type="text"
              id="login_reg_number"
              name="reg_number"
              required
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            />
          </div>

          <div className="flex flex-col mb-[0.7rem]">
            <label htmlFor="login_password" className="text-[0.78rem] uppercase text-[#cbd5ff] mb-1 tracking-[0.06em]">
              Password *
            </label>
            <input
              type="password"
              id="login_password"
              name="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-[10px] py-2 rounded-[10px] border border-[rgba(148,163,184,0.6)] bg-[rgba(15,23,42,0.9)] text-[#e2e8f0] text-[0.9rem] outline-none transition-all duration-[0.15s] ease-in-out focus:border-[#ffe66d] focus:shadow-[0_0_0_1px_rgba(255,230,109,0.55),0_0_16px_rgba(248,250,252,0.2)] focus:-translate-y-[1px]"
            />
          </div>

          <div className="flex gap-[0.6rem] mt-[0.8rem]">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-full border-none py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-gradient-to-r from-[#ffe66d] to-[#ff9f1c] text-[#111827] shadow-[0_10px_24px_rgba(250,204,21,0.6)] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(250,204,21,0.75)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-[rgba(148,163,184,0.7)] py-[9px] text-[0.9rem] font-bold uppercase tracking-[0.1em] cursor-pointer bg-[rgba(15,23,42,0.95)] text-[#e5e7eb] transition-all duration-[0.12s] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.9)]"
            >
              Cancel
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

export default LoginModal

