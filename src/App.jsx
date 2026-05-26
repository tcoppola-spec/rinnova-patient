import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { usePatientData } from './usePatientData'
import './App.css'

function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Patient data (only meaningful once authenticated)
  const { data, loading: dataLoading, error: dataError } = usePatientData()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authLoading && !session) {
      navigate('/login')
    }
  }, [authLoading, session, navigate])

  // Log the patient data to console once it loads — so we can verify everything
  useEffect(() => {
    if (data) {
      console.log('🎯 Patient data loaded:', data)
    }
  }, [data])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (authLoading) {
    return (
      <div className="app-shell">
        <div className="loading-state">Loading…</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="app-shell">
      <div className="placeholder">
        <header className="placeholder-header">
          <h1 className="brand-mark">Rinnova</h1>
          <button onClick={handleLogout} className="signout-btn">Sign out</button>
        </header>

        <p className="placeholder-greeting">
          Signed in as <strong>{session.user.email}</strong>
        </p>

        <div className="placeholder-card">
          {dataLoading && <p>📡 Fetching your patient data…</p>}
          {dataError && <p>⚠️ Error: {dataError}</p>}
          {data && (
            <>
              <p style={{ marginBottom: '8px' }}>✅ Data loaded for <strong>{data.patient.first_name} {data.patient.last_name}</strong></p>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                {data.visits.length} visit{data.visits.length !== 1 ? 's' : ''} ·{' '}
                {data.products.length} product{data.products.length !== 1 ? 's' : ''} ·{' '}
                {data.photos.length} photo{data.photos.length !== 1 ? 's' : ''}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '12px' }}>
                Open browser console to see the full data structure.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App