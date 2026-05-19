import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('processing')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function handleCallback() {
      // Supabase auth-helpers automatically reads the URL hash and creates a session
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        setStatus('error')
        setErrorMessage(error.message)
        return
      }

      if (data.session) {
        // Session exists — redirect to the home page
        navigate('/')
      } else {
        // No session yet — wait briefly and check again
        // (Supabase needs a moment to process the URL tokens)
        setTimeout(async () => {
          const { data: retryData } = await supabase.auth.getSession()
          if (retryData.session) {
            navigate('/')
          } else {
            setStatus('error')
            setErrorMessage('Could not complete sign in. The link may have expired.')
          }
        }, 1000)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div style={{ padding: '40px', maxWidth: '480px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
      {status === 'processing' && (
        <p style={{ color: '#666' }}>Signing you in...</p>
      )}
      {status === 'error' && (
        <div>
          <p style={{ color: '#dc2626', marginBottom: '16px' }}>{errorMessage}</p>
          <a href="/login" style={{ color: '#D63384' }}>← Back to sign in</a>
        </div>
      )}
    </div>
  )
}

export default AuthCallback