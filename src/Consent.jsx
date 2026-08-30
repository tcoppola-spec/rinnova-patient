import { useState } from 'react'

/**
 * Consent — first-run acknowledgment, shown once before a patient uses Rinnova.
 *
 * Gated on the patient's own DB flag (consent_accepted_at), so it follows the
 * account across devices and a reinstall, and the acceptance is RECORDED
 * server-side (see db/add_consent.sql) — not just a client-side checkbox.
 *
 * Unlike onboarding and name capture, this one is REQUIRED: there is no skip,
 * Continue is disabled until the box is checked, and — because the acceptance
 * must actually be recorded — it only advances when the write SUCCEEDS. A failed
 * write surfaces an error to retry rather than letting the patient through
 * unrecorded (fail closed, deliberately the opposite of the onboarding gate).
 *
 * NOTE: this copy is plain-language and honest, and is meant to be reviewed by a
 * lawyer before a public launch — it is not itself legal advice. Keep the four
 * points (personal record / not medical advice / you own & are responsible for
 * your data / Terms + Privacy) intact if you edit the wording.
 *
 * Props:
 *   onAccept — async () => void. Records consent (App calls the accept_consent
 *              RPC then refetches). Must THROW on failure so we can show a retry.
 */
function Consent({ onAccept }) {
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleContinue() {
    if (!checked || saving) return
    setError('')
    setSaving(true)
    try {
      await onAccept()
      // On success App advances the gate; this component unmounts.
    } catch (e) {
      setSaving(false)
      setError(e?.message || 'Could not save. Please check your connection and try again.')
    }
  }

  return (
    <div className="consent">
      <div className="consent-card">
        <h1 className="consent-title">Your record, in your hands</h1>

        <p className="consent-lead">
          A quick note before you start — please read and agree to continue.
        </p>

        <ul className="consent-points">
          <li>
            <strong>Rinnova is yours.</strong> It’s a personal place to keep your own
            aesthetic-treatment history. You own what you put in it.
          </li>
          <li>
            <strong>It’s a record, not medical advice.</strong> Rinnova helps you organize
            and remember — always talk to your provider about treatment decisions.
          </li>
          <li>
            <strong>You’re responsible for what you enter.</strong> Rinnova organizes the
            information you give it; it doesn’t verify it, so you’re in charge of its accuracy.
          </li>
          <li>
            <strong>Your information is private to your account.</strong> By continuing, you
            agree to our{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="consent-link">Terms</a>
            {' '}and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="consent-link">Privacy&nbsp;Policy</a>.
          </li>
        </ul>

        <label className="consent-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            disabled={saving}
          />
          <span>I understand, and I agree to the Terms and Privacy Policy.</span>
        </label>

        {error && <p className="consent-error">{error}</p>}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!checked || saving}
          className="consent-continue"
        >
          {saving ? 'Saving…' : 'Agree & continue'}
        </button>
      </div>
    </div>
  )
}

export default Consent
