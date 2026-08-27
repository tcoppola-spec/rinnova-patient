import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.jsx'
import Landing from './Landing.jsx'
import Login from './Login.jsx'
import AuthCallback from './AuthCallback.jsx'
import Onboarding from './Onboarding.jsx'

// Lazy so the design reference never lands in the patient bundle — it only
// downloads if someone actually opens /design.
//
// The react-refresh rule below guards Fast Refresh for component modules. This
// is the entry file — it has no exports by design, so there is nothing for Fast
// Refresh to preserve, and the warning does not apply.
// eslint-disable-next-line react-refresh/only-export-components
const DesignSystem = lazy(() => import('./DesignSystem.jsx'))

// Privacy, Terms and Help share one chunk — they are one small file and a
// visitor reading one often reads another.
// eslint-disable-next-line react-refresh/only-export-components
const Privacy = lazy(() => import('./InfoPages.jsx').then((m) => ({ default: m.Privacy })))
// eslint-disable-next-line react-refresh/only-export-components
const Terms = lazy(() => import('./InfoPages.jsx').then((m) => ({ default: m.Terms })))
// eslint-disable-next-line react-refresh/only-export-components
const Help = lazy(() => import('./InfoPages.jsx').then((m) => ({ default: m.Help })))

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

        {/* The visual reference for the design system. Unlinked from the app —
            you reach it by typing the URL. Available in production on purpose:
            Rinnova is phone-first, so the place to check a design is a real
            phone, and a dev-only route would mean it could only ever be viewed
            on a laptop. It exposes nothing but colours, type and components. */}
        <Route
          path="/design"
          element={
            <Suspense fallback={null}>
              <DesignSystem />
            </Suspense>
          }
        />

        {/* Public, and reachable without signing in on purpose: someone
            deciding whether to trust Rinnova with their medical history needs
            to read the privacy page BEFORE creating an account. */}
        <Route path="/privacy" element={<Suspense fallback={null}><Privacy /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={null}><Terms /></Suspense>} />
        <Route path="/help" element={<Suspense fallback={null}><Help /></Suspense>} />

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
// Native (Capacitor) serves the bundled assets from the app itself, so a
// service worker would sit between the WebView and local files and can serve
// stale assets across TestFlight updates — the exact "my update didn't apply"
// bug it prevents on the web. Web-only.
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // Installability is a nice-to-have; the app works fine without it.
      console.warn('[sw] registration failed:', err)
    })
  })
}