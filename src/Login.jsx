import { useState } from 'react'
import { supabase } from './supabaseClient'

function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSendMagicLink(e) {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '480px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Rinnova</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>
        Sign in to see your record
      </p>

      {status === 'sent' ? (
        <div style={{ padding: '20px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px' }}>
          <p style={{ margin: 0 }}>
            ✓ Check your email. We sent a sign-in link to <strong>{email}</strong>.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSendMagicLink}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#333' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              marginBottom: '16px',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              background: '#D63384',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: status === 'sending' ? 'not-allowed' : 'pointer',
              opacity: status === 'sending' ? 0.6 : 1,
            }}
          >
            {status === 'sending' ? 'Sending...' : 'Send me a sign-in link'}
          </button>

          {status === 'error' && (
            <p style={{ color: '#dc2626', fontSize: '14px', marginTop: '12px' }}>
              {errorMessage}
            </p>
          )}
        </form>
      )}
    </div>
  )
}

export default Login