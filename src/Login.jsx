import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { apiUrl } from './apiBase'

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
 * On successful verify we navigate to '/app' ourselves — App isn't mounted on
 * the /login route, so its auth listener can't do the redirect for us.
 */
// Once a code is sent we remember it here, so that leaving the app to fetch the
// code from email — which on iOS can EVICT the WebView from memory and cold-
// reload it on return — restores the "enter your code" screen instead of
// dumping the patient back at step one. Back at step one they'd tap "resend",
// and a few of those trip Supabase's ~4-per-hour cap and lock sign-in (exactly
// what happened in the native app). React state can't survive a reload;
// localStorage can. TTL matches the code's own 1-hour validity — a day-old
// pending flag shouldn't force the code screen.
const PENDING_KEY = 'rinnova.login.pending'
const PENDING_TTL_MS = 60 * 60 * 1000

// The one demo address Apple's App Review uses to get past our invite-only,
// emailed-code sign-in (a reviewer can't receive the code). Typing THIS email
// routes the code to the reviewer-signin function instead of the normal OTP,
// so no real inbox is involved. The secret code lives only in Netlify env +
// the App Review notes — this address is just the routing key. See
// netlify/functions/reviewer-signin.js. Harmless in the bundle: without the
// server-side code, this email does nothing.
const REVIEWER_EMAIL = 'appreview@rinnova.io'

function isReviewerEmail(value) {
  return value.trim().toLowerCase() === REVIEWER_EMAIL
}

function readPendingEmail() {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return ''
    const { email, ts } = JSON.parse(raw)
    if (!email || !ts || Date.now() - ts > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_KEY)
      return ''
    }
    return email
  } catch {
    return ''
  }
}

function writePendingEmail(email) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ email, ts: Date.now() }))
  } catch {
    /* private mode / storage disabled — the flow still works, just won't restore */
  }
}

function clearPendingEmail() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}

function Login() {
  const navigate = useNavigate()
  // Lazy initialisers run once, on mount: if a fresh code is pending, resume on
  // the code screen with the same address rather than starting over.
  const [step, setStep] = useState(() => (readPendingEmail() ? 'code' : 'email')) // 'email' | 'code'
  const [email, setEmail] = useState(() => readPendingEmail())
  const [inviteCode, setInviteCode] = useState('')
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
    // A shared invite code (the friends & family pilot) lets a new email create
    // its own record without being hand-added to the allowlist. It rides in as
    // user metadata, which the enrollment trigger reads on account creation
    // (db/access_codes.sql). It's ignored for an already-existing account, so a
    // returning tester correctly leaves it blank.
    const options = { shouldCreateUser: true }
    const trimmedInvite = inviteCode.trim()
    if (trimmedInvite) options.data = { access_code: trimmedInvite }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options,
    })
    setStatus('idle')
    if (error) {
      setError(friendlySendError(error))
      return false
    }
    // A code is now out; remember it so a mid-flow app eviction resumes here.
    writePendingEmail(email.trim())
    return true
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    // Reviewer: no real code to send (no inbox) — go straight to code entry,
    // where the secret review code is validated server-side.
    if (isReviewerEmail(email)) {
      setError('')
      setStep('code')
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

    // Reviewer path: exchange the review code for a session server-side (the
    // function validates the code against a Netlify secret) instead of a normal
    // OTP verify. Everything downstream is an ordinary Supabase session.
    if (isReviewerEmail(email)) {
      setStatus('verifying')
      try {
        const res = await fetch(apiUrl('/.netlify/functions/reviewer-signin'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), code: token }),
        })
        if (!res.ok) throw new Error('reviewer sign-in rejected')
        const { access_token, refresh_token } = await res.json()
        const { error: sessErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })
        if (sessErr) throw sessErr
      } catch {
        setStatus('idle')
        setError('That code isn’t right. Double-check it and try again.')
        return
      }
      setStatus('idle')
      clearPendingEmail()
      navigate('/app')
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
    // Signed in — the pending code is spent, so don't resume the code screen.
    clearPendingEmail()
    // Session is now stored; App picks it up on '/app'. ("/" is the public
    // landing page and would just bounce us here again.)
    navigate('/app')
  }

  function useDifferentEmail() {
    // Deliberately starting over — drop the pending code so we don't resume it.
    clearPendingEmail()
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

            <label htmlFor="invite" style={styles.label}>Invite code</label>
            <input
              id="invite"
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="From your invitation"
              style={styles.input}
            />
            <p style={styles.hint}>
              New to Rinnova? Enter your invite code. Signing back in? Leave it blank.
            </p>

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
  // Enrollment gate (db/access_codes.sql): a signup with neither an allowlisted
  // email nor a valid invite code makes the trigger raise, which Supabase
  // surfaces as a signup/database failure. Show INVITE-ONLY copy that reveals
  // nothing about which of email/code was wrong — never echo the raw message.
  if (
    error?.status === 500 ||
    msg.includes('database error') ||
    msg.includes('saving new user') ||
    msg.includes('enrollment') ||
    msg.includes('unexpected')
  ) {
    return 'Rinnova is invite-only right now. Double-check the invite code you entered — or reach out to whoever invited you.'
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
  hint: {
    fontSize: '12px',
    lineHeight: 1.45,
    color: 'var(--muted)',
    margin: '-8px 0 18px',
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
