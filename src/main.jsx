import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Login from './Login.jsx'
import AuthCallback from './AuthCallback.jsx'
import Onboarding from './Onboarding.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Dev-only: review the onboarding design without signing in (and
            without burning OTP codes against Supabase's ~4/hour per-email
            limit). import.meta.env.DEV is false in a production build, so this
            route does not exist on the deployed site. */}
        {import.meta.env.DEV && (
          <Route
            path="/preview-onboarding"
            element={<Onboarding onDone={() => window.location.reload()} />}
          />
        )}
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)