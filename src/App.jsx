import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Redirect to login if not authenticated (once loading is done)
  useEffect(() => {
    if (!loading && !session) {
      navigate('/login')
    }
  }, [loading, session, navigate])

  async function handleLogout() {
    await supabase.auth.signOut()
    // The auth state change listener above will update session to null,
    // and the redirect effect will send us to /login automatically.
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#666' }}>Loading...</p>
      </div>
    )
  }

  if (!session) {
    // We're about to redirect; render nothing in the meantime
    return null
  }

  // Logged in — show a basic placeholder
  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', margin: 0 }}>Rinnova</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            background: 'transparent',
            color: '#666',
            border: '1px solid #ccc',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>

      <p style={{ fontSize: '16px', color: '#333', marginBottom: '8px' }}>
        Signed in as <strong>{session.user.email}</strong>
      </p>

      <div style={{ marginTop: '32px', padding: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
        <p style={{ margin: 0, color: '#166534' }}>
          ✅ Auth is working. Patient page UI comes in Chunk 3.
        </p>
      </div>
    </div>
  )
}

export default App