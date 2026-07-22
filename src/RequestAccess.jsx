import { useState } from 'react'
import { supabase } from './supabaseClient'

/**
 * RequestAccess
 *
 * The front door for people who find Rinnova without an invite. Writes a row to
 * access_requests (db/access_requests.sql) for Tondo to review by hand.
 *
 * A request is NOT access. Nothing here creates an account or touches
 * allowed_emails; the enrollment trigger still gates signup. Approving is a
 * deliberate manual step.
 *
 * The referrer's first AND last name are required, and that is the whole point
 * of the form. Anyone can type an email address, but naming the person who
 * recommended you is something only a real referral can do, and it is checkable
 * against someone we already know. "Sarah" is not a referral you can verify.
 * The same requirement is enforced in the RLS policy, because a client-side
 * check is bypassed by posting straight to the API.
 *
 * Props:
 *   onDone — optional, called after a successful submission
 */
function RequestAccess({ onDone }) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [refFirst, setRefFirst] = useState('')
  const [refLast, setRefLast] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const payload = {
      full_name: fullName.trim(),
      email: email.trim(),
      referrer_first_name: refFirst.trim(),
      referrer_last_name: refLast.trim(),
      note: note.trim() === '' ? null : note.trim(),
    }

    if (!payload.full_name) return setError('Please enter your name.')
    if (!payload.email || !payload.email.includes('@')) {
      return setError('Please enter a valid email address.')
    }
    if (!payload.referrer_first_name || !payload.referrer_last_name) {
      return setError(
        'Please enter the first and last name of the person who recommended Rinnova to you.'
      )
    }

    setSaving(true)
    const { error: saveError } = await supabase.from('access_requests').insert(payload)
    setSaving(false)

    if (saveError) {
      // 23505 = unique violation on the email. A second submission is a
      // duplicate, not a failure, so say so plainly.
      if (saveError.code === '23505') {
        setSent(true)
        if (onDone) onDone()
        return
      }
      setError('Could not send your request. Please try again.')
      return
    }

    setSent(true)
    if (onDone) onDone()
  }

  if (sent) {
    return (
      <div className="request-sent">
        <p className="request-sent-title">Request received</p>
        <p className="request-sent-body">
          We check every request against the person who referred you. If it all
          lines up, you will get an email when your access is ready.
        </p>
      </div>
    )
  }

  if (!open) {
    return (
      <button type="button" className="request-open" onClick={() => setOpen(true)}>
        No invite yet? Request access
      </button>
    )
  }

  return (
    <form className="request-form" onSubmit={handleSubmit}>
      <p className="request-intro">
        Rinnova is invite only while we pilot it. Tell us who recommended it to
        you so we can check.
      </p>

      <label className="request-label" htmlFor="ra-name">Your name</label>
      <input
        id="ra-name"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="form-input"
        autoComplete="name"
        disabled={saving}
      />

      <label className="request-label" htmlFor="ra-email">Your email</label>
      <input
        id="ra-email"
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="form-input"
        autoComplete="email"
        disabled={saving}
      />

      <label className="request-label">Who recommended Rinnova to you?</label>
      <div className="request-name-row">
        <input
          type="text"
          value={refFirst}
          onChange={(e) => setRefFirst(e.target.value)}
          placeholder="First name"
          className="form-input"
          disabled={saving}
          aria-label="Referrer first name"
        />
        <input
          type="text"
          value={refLast}
          onChange={(e) => setRefLast(e.target.value)}
          placeholder="Last name"
          className="form-input"
          disabled={saving}
          aria-label="Referrer last name"
        />
      </div>
      <p className="request-hint">
        Both names are required. We verify every request against the person who
        referred you.
      </p>

      <label className="request-label" htmlFor="ra-note">Anything else? (optional)</label>
      <textarea
        id="ra-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="form-textarea"
        rows={2}
        disabled={saving}
      />

      {error && <p className="request-error">{error}</p>}

      <div className="request-actions">
        <button type="submit" className="install-btn" disabled={saving}>
          {saving ? 'Sending…' : 'Send request'}
        </button>
        <button
          type="button"
          className="request-cancel"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default RequestAccess
