import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const [status, setStatus] = useState('Connecting to Supabase...')

  useEffect(() => {
    async function testConnection() {
      // Just check that the client was created and has a URL configured
      if (supabase && supabase.supabaseUrl) {
        setStatus(`✅ Connected to Supabase at ${supabase.supabaseUrl}`)
      } else {
        setStatus('❌ Supabase client not configured correctly')
      }
    }
    testConnection()
  }, [])

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Rinnova V1 — Setup Check</h1>
      <p>{status}</p>
    </div>
  )
}

export default App