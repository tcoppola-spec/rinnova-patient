import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import InstallPrompt from './InstallPrompt'

/**
 * Login — passwordless sign-in via email OTP code.
 *
 * Two steps:
 *   'email' → enter email, we send a code (supabase.auth.signInWithOtp)
 *   'code'  → enter the code, we verify it (supabase.auth.verifyOtp)
 *
 * The code length is a Supabase dashboard setting (Email OTP Length, 6–10
 * digits), so we validate the whole range rather than assume 6.
 *
 * We use a code (not a magic link) on purpose: a magic link opens in Safari,
 * which is a separate storage context from an installed iOS PWA, so the PWA
 * never sees the session. A code is typed IN the app, so it works identically
 * in Safari, the installed PWA, and on Android.
 *
 * NOTE: for the code to arrive, TWO Supabase email templates must include
 * {{ .Token }} — default templates only show the link:
 *   "Magic Link"     → sent to a RETURNING user
 *   "Confirm signup" → sent to a FIRST-TIME user
 * Both, not just Magic Link. This screen promises "we'll email you a code" and
 * it cannot branch that copy: signInWithOtp deliberately returns the same
 * response for a new and an existing address, so the client never learns which
 * one it is (and leaking that would undercut our neutral invite-only copy).
 * The consistency has to come from the templates. See CLAUDE.md §4.
 *
 * On successful verify we navigate to '/' ourselves — App isn't mounted on the
 * /login route, so its auth listener can't do the redirect for us.
 */
function Login() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'sending' | 'verifying'
  const [error, setError] = useState('')
  const [resendNote, setResendNote] = useState('')
  const codeRef = useRef(null)

  useEffect(() => {
    if (step === 'code' && codeRef.current) codeRef.current.focus()
  }, [step])

  async function sendCode() {
    setError('')
    setResendNote('')
    setStatus('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setStatus('idle')
    if (error) {
      setError(friendlySendError(error))
      return false
    }
    return true
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    const ok = await sendCode()
    if (ok) setStep('code')
  }

  async function handleResend() {
    const ok = await sendCode()
    if (ok) {
      setResendNote('New code sent — check your email.')
      setCode('')
      if (codeRef.current) codeRef.current.focus()
    }
  }

  async function handleCodeSubmit(e) {
    e.preventDefault()
    setError('')
    const token = code.trim()
    // Supabase's Email OTP Length is configurable (6–10 digits). Accept the
    // whole range so a dashboard change can't silently lock anyone out.
    if (!/^\d{6,10}$/.test(token)) {
      setError('Enter the code from your email.')
      return
    }
    setStatus('verifying')
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    })
    setStatus('idle')
    if (error) {
      setError(friendlyVerifyError(error))
      return
    }
    // Session is now stored; App will pick it up on '/'.
    navigate('/')
  }

  function useDifferentEmail() {
    setStep('email')
    setCode('')
    setError('')
    setResendNote('')
  }

  const busy = status !== 'idle'

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.brand}>Rinnova</h1>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit}>
            <p style={styles.sub}>
              Sign in to see your record. We’ll email you a code.
            </p>

            <label htmlFor="email" style={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
            />

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" disabled={busy} style={buttonStyle(busy)}>
              {status === 'sending' ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit}>
            <p style={styles.sub}>
              Enter the code we sent to{' '}
              <strong style={{ color: 'var(--ink)' }}>{email}</strong>.
            </p>

            <label htmlFor="code" style={styles.label}>Code</label>
            <input
              id="code"
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6,10}"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
              required
              style={styles.codeInput}
            />

            {error && <p style={styles.error}>{error}</p>}
            {resendNote && <p style={styles.note}>{resendNote}</p>}

            <button type="submit" disabled={busy} style={buttonStyle(busy)}>
              {status === 'verifying' ? 'Verifying…' : 'Verify & sign in'}
            </button>

            <div style={styles.linkRow}>
              <button type="button" onClick={handleResend} disabled={busy} style={styles.textLink}>
                Resend code
              </button>
              <span style={styles.dot}>·</span>
              <button type="button" onClick={useDifferentEmail} disabled={busy} style={styles.textLink}>
                Use a different email
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Also offered BEFORE sign-in. The install card originally lived only
          inside App, i.e. behind auth — which put it everywhere except the one
          screen a new patient actually starts on. Someone invited to Rinnova
          should be able to install it as they arrive, not discover the option
          later. Renders nothing when already installed or dismissed. */}
      <div style={styles.installSlot}>
        <InstallPrompt />
      </div>
    </div>
  )
}

// Map Supabase errors to calm, patient-facing messages.
function friendlySendError(error) {
  const msg = (error?.message || '').toLowerCase()
  if (error?.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many requests. Please wait about a minute, then try again.'
  }
  if (msg.includes('email') && msg.includes('invalid')) {
    return 'That email doesn’t look right. Check it and try again.'
  }
  // Enrollment gate (db/gated_enrollment.sql): a non-allowlisted signup makes
  // the trigger raise, which Supabase surfaces as a signup/database failure.
  // Show INVITE-ONLY copy that reveals nothing about whether this specific
  // email is on the list — never echo the raw trigger message.
  if (
    error?.status === 500 ||
    msg.includes('database error') ||
    msg.includes('saving new user') ||
    msg.includes('enrollment') ||
    msg.includes('unexpected')
  ) {
    return 'Rinnova is invite-only right now. If you were invited, double-check the email you used — otherwise reach out to the person who invited you.'
  }
  // Never surface the raw message: keep the neutral default.
  return 'Could not send the code. Please try again.'
}

function friendlyVerifyError(error) {
  const msg = (error?.message || '').toLowerCase()
  if (msg.includes('expired')) {
    return 'That code has expired. Tap “Resend code” for a fresh one.'
  }
  if (error?.status === 429 || msg.includes('rate limit')) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  if (
    msg.includes('invalid') ||
    msg.includes('token') ||
    error?.status === 403 ||
    error?.status === 401
  ) {
    return 'That code isn’t right. Double-check it and try again.'
  }
  return error?.message || 'Could not verify the code. Please try again.'
}

function buttonStyle(busy) {
  return {
    width: '100%',
    padding: '13px',
    fontSize: '16px',
    fontWeight: 600,
    background: 'var(--magenta)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
    marginTop: '4px',
  }
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--page)',
    display: 'flex',
    // Column so the install card stacks UNDER the sign-in card rather than
    // beside it. alignItems still centres horizontally, justifyContent
    // vertically, so the sign-in card sits where it always did.
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: 'var(--f-body)',
    color: 'var(--body)',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
  },
  // Matches the sign-in card's column so the two read as one stack.
  installSlot: {
    width: '100%',
    maxWidth: '380px',
  },
  brand: {
    fontFamily: 'var(--f-display)',
    fontSize: '34px',
    fontWeight: 600,
    color: 'var(--ink)',
    margin: '0 0 6px',
  },
  sub: {
    fontSize: '15px',
    lineHeight: 1.5,
    color: 'var(--body)',
    margin: '0 0 24px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--muted)',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '13px',
    fontSize: '16px',
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: '10px',
    marginBottom: '16px',
    boxSizing: 'border-box',
    color: 'var(--ink)',
  },
  codeInput: {
    width: '100%',
    padding: '13px',
    fontSize: '26px',
    letterSpacing: '0.4em',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: '10px',
    marginBottom: '16px',
    boxSizing: 'border-box',
    color: 'var(--ink)',
  },
  error: {
    color: '#C0285A',
    fontSize: '14px',
    lineHeight: 1.45,
    margin: '0 0 14px',
  },
  note: {
    color: 'var(--muted)',
    fontSize: '14px',
    margin: '0 0 14px',
  },
  linkRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '18px',
  },
  textLink: {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '14px',
    color: 'var(--magenta)',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  dot: {
    color: 'var(--muted)',
  },
}

export default Login
