import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

/**
 * Login — passwordless sign-in via 6-digit email OTP code.
 *
 * Two steps:
 *   'email' → enter email, we send a code (supabase.auth.signInWithOtp)
 *   'code'  → enter the 6-digit code, we verify it (supabase.auth.verifyOtp)
 *
 * We use a code (not a magic link) on purpose: a magic link opens in Safari,
 * which is a separate storage context from an installed iOS PWA, so the PWA
 * never sees the session. A code is typed IN the app, so it works identically
 * in Safari, the installed PWA, and on Android.
 *
 * NOTE: for the code to arrive, the Supabase "Magic Link" email template must
 * include {{ .Token }} (default templates only show the link). See CLAUDE.md.
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
    if (!/^\d{6}$/.test(token)) {
      setError('Enter the 6-digit code from your email.')
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
              Sign in to see your record. We’ll email you a 6-digit code.
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
              Enter the 6-digit code we sent to{' '}
              <strong style={{ color: 'var(--ink)' }}>{email}</strong>.
            </p>

            <label htmlFor="code" style={styles.label}>Code</label>
            <input
              id="code"
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
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
  return error?.message || 'Could not send the code. Please try again.'
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
