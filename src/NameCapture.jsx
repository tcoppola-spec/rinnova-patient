import { useState } from 'react'
import { supabase } from './supabaseClient'

/**
 * NameCapture — first-run "what should we call you?" prompt.
 *
 * Shown once, after onboarding, when a patient has no first_name (new testers
 * are provisioned nameless). Writes via the set_my_name RPC — `patients` has no
 * UPDATE policy on purpose, so this narrow SECURITY DEFINER function is the only
 * write path (see db/add_set_name_rpc.sql).
 *
 * Never traps the patient: "Skip for now" dismisses without a name (the greeting
 * handles nameless), and a failed save surfaces an error to retry.
 *
 * Props:
 *   onSaved — (name) => void, after the name is persisted (App refetches)
 *   onSkip  — () => void, dismiss without setting a name
 */
function NameCapture({ onSaved, onSkip }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a name, or skip for now.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const { error: rpcError } = await supabase.rpc('set_my_name', {
        p_first_name: trimmed,
      })
      if (rpcError) throw rpcError
      onSaved(trimmed)
    } catch (err) {
      setSaving(false)
      setError(err.message || 'Could not save your name. Please try again.')
    }
  }

  return (
    <div className="namecap">
      <div className="namecap-card">
        <h1 className="namecap-title">Welcome to Rinnova</h1>
        <p className="namecap-sub">What should we call you?</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            autoComplete="given-name"
            autoFocus
            maxLength={60}
            className="namecap-input"
            disabled={saving}
          />

          {error && <p className="namecap-error">{error}</p>}

          <button type="submit" disabled={saving} className="namecap-save">
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </form>

        <button type="button" onClick={onSkip} disabled={saving} className="namecap-skip">
          Skip for now
        </button>
      </div>
    </div>
  )
}

export default NameCapture
