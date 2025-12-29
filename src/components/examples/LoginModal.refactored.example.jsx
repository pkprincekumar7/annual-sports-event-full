/**
 * EXAMPLE: Refactored LoginModal using reusable components
 * This demonstrates how to use the new reusable components
 * 
 * This is an EXAMPLE file - shows the pattern for refactoring
 */

import { useState } from 'react'
import { Modal, Button, Input } from '../ui'
import { useApi } from '../../hooks'
import { validateEmail, validatePhone } from '../../utils/formValidation'
import API_URL from '../../config/api'

function LoginModalRefactored({ isOpen, onClose, onLoginSuccess, onStatusPopup }) {
  const [regNumber, setRegNumber] = useState('')
  const [password, setPassword] = useState('')
  const { loading, error, execute } = useApi()

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!regNumber.trim() || !password.trim()) {
      onStatusPopup('❌ Please fill all required fields.', 'error', 2500)
      return
    }

    try {
      const response = await execute(
        () => fetch(`${API_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reg_number: regNumber.trim(),
            password: password.trim(),
          }),
        }),
        {
          onSuccess: async (response) => {
            const data = await response.json()
            if (data.success && onLoginSuccess) {
              onLoginSuccess(data.player, data.token)
              onStatusPopup('✅ Login successful!', 'success', 2000)
              onClose()
            }
          },
        }
      )
    } catch (err) {
      // Error already handled by useApi
      onStatusPopup(`❌ ${err.message || 'Login failed. Please try again.'}`, 'error', 3000)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Login"
      headerLabel="User Authentication"
      maxWidth="max-w-[420px]"
    >
      <form onSubmit={handleSubmit}>
        <Input
          label="Registration Number"
          id="reg_number"
          name="reg_number"
          type="text"
          value={regNumber}
          onChange={(e) => setRegNumber(e.target.value)}
          required
        />

        <Input
          label="Password"
          id="password"
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
            Login
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

export default LoginModalRefactored

