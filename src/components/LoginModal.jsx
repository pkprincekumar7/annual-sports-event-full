import { useState, useEffect } from 'react'
import { Modal, Button, Input } from './ui'
import { useApi } from '../hooks'
import { API_URL, clearCache } from '../utils/api'
import logger from '../utils/logger'

function LoginModal({ isOpen, onClose, onLoginSuccess, onStatusPopup }) {
  const [regNumber, setRegNumber] = useState('')
  const [password, setPassword] = useState('')
  const { loading, execute } = useApi()

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setRegNumber('')
      setPassword('')
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!regNumber.trim() || !password.trim()) {
      onStatusPopup('❌ Please enter both registration number and password.', 'error', 2500)
      return
    }

    try {
      await execute(
        () => fetch(`${API_URL}/api/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reg_number: regNumber.trim(),
            password: password.trim(),
          }),
        }),
        {
          onSuccess: (data) => {
            // useApi already checked response.ok, parsed JSON, and verified data.success
            // Clear caches to ensure fresh data after login
            clearCache('/api/me')
            clearCache('/api/players')
            clearCache('/api/sports-counts')
            clearCache('/api/captains-by-sport')
            
            // Store JWT token in localStorage (user data is handled by App.jsx)
            if (data.token) {
              localStorage.setItem('authToken', data.token)
            }
            
            onStatusPopup('✅ Login successful!', 'success', 2000)
            // Pass player data to App.jsx (will be stored in memory only)
            onLoginSuccess(data.player, data.token)
            setRegNumber('')
            setPassword('')
            onClose()
          },
          onError: (err) => {
            // Error handling - useApi already logged it
            const errorMessage = err.message || 'Error while logging in. Please try again.'
            onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
          },
        }
      )
    } catch (err) {
      // This catch handles cases where execute throws before onError is called
      logger.error('Error while logging in:', err)
      const errorMessage = err.message || 'Error while logging in. Please try again.'
      onStatusPopup(`❌ ${errorMessage}`, 'error', 2500)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Player Login"
      headerLabel="Login"
      maxWidth="max-w-[420px]"
    >
      <form onSubmit={handleSubmit}>
        <Input
          label="Reg. Number"
          id="login_reg_number"
          name="reg_number"
          type="text"
          value={regNumber}
          onChange={(e) => setRegNumber(e.target.value)}
          required
        />

        <Input
          label="Password"
          id="login_password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="flex gap-[0.6rem] mt-[0.8rem]">
          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            fullWidth
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
          <Button
            type="button"
            onClick={onClose}
            disabled={loading}
            variant="secondary"
            fullWidth
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default LoginModal

