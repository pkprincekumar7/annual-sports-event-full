import { Modal } from './ui'
import { useEventYearWithFallback } from '../hooks'

function ProfileModal({ isOpen, onClose, loggedInUser, selectedEventYear }) {
  const { eventYear, eventName } = useEventYearWithFallback(selectedEventYear)
  
  if (!loggedInUser) return null

  const batchDisplay = loggedInUser.batch_name || 'N/A'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Profile"
      headerLabel={null}
      maxWidth="max-w-[600px]"
    >
      <div className="space-y-4">
        <div className="p-4 bg-[rgba(15,23,42,0.6)] rounded-lg border border-[rgba(148,163,184,0.3)] overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <tbody>
              <tr>
                <td className="text-[#cbd5ff] text-sm font-semibold py-2 pr-4 align-top text-left">Full Name:</td>
                <td className="text-[#ffe66d] text-base py-2 break-words text-left font-semibold">{loggedInUser.full_name || 'N/A'}</td>
              </tr>
              <tr>
                <td className="text-[#cbd5ff] text-sm font-semibold py-2 pr-4 align-top text-left">Registration Number:</td>
                <td className="text-[#ffe66d] text-base py-2 break-words text-left font-semibold">{loggedInUser.reg_number || 'N/A'}</td>
              </tr>
              <tr>
                <td className="text-[#cbd5ff] text-sm font-semibold py-2 pr-4 align-top text-left">Gender:</td>
                <td className="text-[#ffe66d] text-base py-2 capitalize break-words text-left font-semibold">{loggedInUser.gender || 'N/A'}</td>
              </tr>
              <tr>
                <td className="text-[#cbd5ff] text-sm font-semibold py-2 pr-4 align-top text-left">Department/Branch:</td>
                <td className="text-[#ffe66d] text-base py-2 break-words text-left font-semibold">{loggedInUser.department_branch || 'N/A'}</td>
              </tr>
              <tr>
                <td className="text-[#cbd5ff] text-sm font-semibold py-2 pr-4 align-top text-left">Batch:</td>
                <td className="text-[#ffe66d] text-base py-2 break-words text-left font-semibold">{batchDisplay}</td>
              </tr>
              <tr>
                <td className="text-[#cbd5ff] text-sm font-semibold py-2 pr-4 align-top text-left">Mobile Number:</td>
                <td className="text-[#ffe66d] text-base py-2 break-words text-left font-semibold">{loggedInUser.mobile_number || 'N/A'}</td>
              </tr>
              <tr>
                <td className="text-[#cbd5ff] text-sm font-semibold py-2 pr-4 align-top text-left">Email ID:</td>
                <td className="text-[#ffe66d] text-base py-2 break-words text-left font-semibold">{loggedInUser.email_id || 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {loggedInUser.captain_in && loggedInUser.captain_in.length > 0 && (
          <div className="p-4 bg-[rgba(15,23,42,0.6)] rounded-lg border border-[rgba(148,163,184,0.3)] overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <tbody>
                <tr>
                  <td className="text-[#cbd5ff] text-sm font-semibold py-2 pr-4 align-top text-left">Captain For:</td>
                  <td className="py-2 text-left">
                    <div className="flex flex-wrap gap-2">
                      {loggedInUser.captain_in.map((sport, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 rounded-full bg-[rgba(255,230,109,0.2)] text-[#ffe66d] text-sm font-semibold border border-[rgba(255,230,109,0.4)] break-words"
                        >
                          {sport}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {loggedInUser.participated_in && loggedInUser.participated_in.length > 0 && (
          <div className="p-4 bg-[rgba(15,23,42,0.6)] rounded-lg border border-[rgba(148,163,184,0.3)] overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <tbody>
                {loggedInUser.participated_in.map((participation, index) => (
                  <tr key={index}>
                    <td className="text-[#cbd5ff] text-sm font-semibold py-2 pr-4 align-top text-left">{participation.sport}:</td>
                    <td className="text-[#ffe66d] text-sm py-2 break-words text-left font-semibold">
                      {participation.team_name ? (
                        <span>Team: {participation.team_name}</span>
                      ) : (
                        'Individual'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ProfileModal

