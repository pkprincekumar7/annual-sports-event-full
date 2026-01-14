import { useState, useEffect } from 'react'
import { Modal, Button, Input } from './ui'
import { useApi } from '../hooks'
import { API_URL } from '../utils/api'
import logger from '../utils/logger'

function ResetPasswordModal({ isOpen, onClose, onStatusPopup }) {
  const [emailId, setEmailId] = useState('')
  const { loading, execute } = useApi()

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEmailId('')
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!emailId.trim()) {
      onStatusPopup('❌ Please enter your email ID.', 'error', 2500)
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailId.trim())) {
      onStatusPopup('❌ Please enter a valid email ID.', 'error', 2500)
      return
    }

    try {
      await execute(
        () => fetch(`${API_URL}/api/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email_id: emailId.trim(),
          }),
        }),
        {
          onSuccess: (data) => {
            // Always show success message (for security, don't reveal if email exists)
            onStatusPopup('✅ If the email exists, a new password has been sent to your email.', 'success', 4000)
            setEmailId('')
            onClose()
          },
          onError: (err) => {
            const errorMessage = err?.message || err?.error || 'Error resetting password. Please try again.'
            onStatusPopup(`❌ ${errorMessage}`, 'error', 3000)
          },
        }
      )
    } catch (err) {
      logger.error('Error resetting password:', err)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset Password"
      maxWidth="max-w-[420px]"
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-4 text-sm text-[#cbd5ff]">
          Enter your email ID and we'll send you a new password. You'll be required to change it after login.
        </div>

        <Input
          label="Email ID"
          id="reset_email_id"
          name="email_id"
          type="email"
          value={emailId}
          onChange={(e) => setEmailId(e.target.value)}
          required
        />

        <div className="flex gap-[0.6rem] mt-[0.8rem]">
          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            fullWidth
          >
            {loading ? 'Sending...' : 'Send New Password'}
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

export default ResetPasswordModal
