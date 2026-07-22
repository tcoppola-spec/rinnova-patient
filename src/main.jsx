import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Landing from './Landing.jsx'
import Login from './Login.jsx'
import AuthCallback from './AuthCallback.jsx'
import Onboarding from './Onboarding.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* "/" is the public landing page — it's the link that gets shared, so
            it explains the product and offers both ways in. Signed-in visitors
            are redirected to /app by Landing itself, which also means an older
            installed app whose start_url is still "/" lands correctly. */}
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<App />} />
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

/**
 * Register the service worker — what makes Rinnova installable rather than
 * bookmarkable (Chrome/Edge/Android require one before offering to install).
 *
 * PRODUCTION ONLY, on purpose. In dev a worker would sit between Vite and the
 * browser and serve stale modules through HMR, which looks exactly like "my
 * edit didn't apply". `import.meta.env.PROD` is false under `netlify dev`, so
 * local work is untouched.
 *
 * Registered after load so it never competes with the first paint.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // Installability is a nice-to-have; the app works fine without it.
      console.warn('[sw] registration failed:', err)
    })
  })
}