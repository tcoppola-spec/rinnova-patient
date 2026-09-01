import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { apiUrl } from './apiBase'

/**
 * DeleteAccount — in-app "delete my account", required by Apple for any app that
 * lets you create an account (App Store Review Guideline 5.1.1(v)).
 *
 * Quiet by default (a small text link), because it's destructive and shouldn't
 * compete with anything. Tapping it expands an inline confirmation that states,
 * plainly, that this is permanent and erases everything — matching the app's
 * "inline expansion" pattern and its rule that destructive actions use magenta
 * WITH clear context, never a red button.
 *
 * The actual deletion runs server-side (netlify/functions/delete-account.js),
 * which needs the service-role key. We send the user's access token so the server
 * deletes only the caller's own account. On success we sign out and return to the
 * start — the account no longer exists, so the session is already invalid.
 */
function DeleteAccount() {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setError('')
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Please sign in again, then try.')

      const res = await fetch(apiUrl('/.netlify/functions/delete-account'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error('Could not delete your account. Please try again.')

      // The account is gone; clear the (now-invalid) local session and leave.
      await supabase.auth.signOut()
      navigate('/')
    } catch (e) {
      setDeleting(false)
      setError(e?.message || 'Could not delete your account. Please try again.')
    }
  }

  if (!confirming) {
    return (
      <div className="delete-account">
        <button
          type="button"
          className="delete-account-link"
          onClick={() => setConfirming(true)}
        >
          Delete my account
        </button>
      </div>
    )
  }

  return (
    <div className="delete-account">
      <div className="delete-account-confirm">
        <p className="delete-account-warning">
          This permanently deletes your account and everything in it — your visits,
          photos, products and notes. This can’t be undone.
        </p>

        {error && <p className="delete-account-error">{error}</p>}

        <button
          type="button"
          className="delete-account-go"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Yes, delete everything'}
        </button>
        <button
          type="button"
          className="delete-account-cancel"
          onClick={() => {
            setConfirming(false)
            setError('')
          }}
          disabled={deleting}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default DeleteAccount
