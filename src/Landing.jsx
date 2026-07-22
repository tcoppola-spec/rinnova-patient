import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import FaceDiagram from './FaceDiagram'
import InstallPrompt from './InstallPrompt'
import RequestAccess from './RequestAccess'

/**
 * Landing — the public page at app.rinnova.io.
 *
 * This URL is the link Tracy sends people. It used to drop them straight into a
 * sign-in form, which told them nothing about what Rinnova is and made an app
 * feel like a bookmark. Now it explains the product, shows it, and offers two
 * equal ways in.
 *
 * INSTALLING IS AN OPTION, NOT A GATE. Both buttons carry the same weight:
 * Rinnova works completely in a browser, and nobody should have to install
 * anything to see their own medical history. The install is there for people
 * who want it on their home screen.
 *
 * Signed-in visitors never see this — they're sent to /app. That also means an
 * older installed app whose start_url is still "/" lands correctly instead of
 * opening marketing.
 *
 * The preview is built from the app's OWN face artwork rather than a
 * screenshot of a record. Nothing here is a patient's data, and no invented
 * treatment history appears in marketing — that is the one thing this product
 * must not do, even in a mockup.
 */

const FEATURES = [
  {
    title: 'Notes or receipts, either works',
    body: 'Photograph a clinical note or a checkout receipt. Rinnova reads it into a real visit with products, doses, dates and cost.',
  },
  {
    title: 'Mapped on your face',
    body: 'Every area you have treated, placed on a diagram. If a document does not say where something went, Rinnova asks you rather than guessing.',
  },
  {
    title: 'Know what is wearing off',
    body: 'Your own treatment dates crossed with typical durations, so you can see your next refresh window coming instead of discovering it late.',
  },
  {
    title: 'How often you treat each area',
    body: 'Lips twice a year, forehead every four months. A pattern no single provider can see, because it spans all of them.',
  },
  {
    title: 'Photos and products, together',
    body: 'Progress photos attached to the visit they belong to, and a running list of what you use.',
  },
]

// Illustrative only — the app's own artwork with a few dots so the diagram
// reads as a face map. Not a record, not anyone's data.
const PREVIEW_DOTS = [
  { id: 'p1', x: 114.9, y: 83.4, color: '#7B2CBF' },
  { id: 'p2', x: 114.9, y: 100.4, color: '#7B2CBF' },
  { id: 'p3', x: 74.6, y: 112.2, color: '#7B2CBF' },
  { id: 'p4', x: 155.2, y: 112.2, color: '#7B2CBF' },
  { id: 'p5', x: 47.7, y: 173.7, color: '#D63384' },
  { id: 'p6', x: 182.1, y: 173.7, color: '#D63384' },
  { id: 'p7', x: 114.9, y: 220.8, color: '#FF8C42' },
]

function Landing() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) navigate('/app', { replace: true })
      else setChecking(false)
    })
    return () => { cancelled = true }
  }, [navigate])

  // Don't flash marketing at someone who is already signed in.
  if (checking) return null

  return (
    <div className="landing">
      <div className="landing-inner">
        <header className="landing-hero">
          <h1 className="landing-brand">Rinnova</h1>
          <p className="landing-tagline">
            Your aesthetic treatment history, organized, understandable, and
            actually yours.
          </p>
          <p className="landing-beta">Private pilot</p>
        </header>

        <div className="landing-preview" aria-hidden="true">
          <div className="landing-phone">
            <div className="landing-phone-screen">
              <div className="landing-mock-greeting">Good morning</div>
              <div className="landing-mock-card">
                <div className="landing-mock-card-title">
                  Your refresh window opens in 3 days
                </div>
                <div className="landing-mock-card-sub">
                  Your neurotoxin typically starts to fade around then.
                </div>
              </div>
              <FaceDiagram dots={PREVIEW_DOTS} legend={null} />
            </div>
          </div>
        </div>

        {/* Above the features on purpose: someone who already knows what
            Rinnova is should not have to scroll past the pitch to get in. The
            features are there to persuade anyone who does not. */}
        <div className="landing-actions">
          <InstallPrompt variant="landing" />
          <Link to="/login" className="landing-signin">
            Sign in in your browser
          </Link>
        </div>

        <p className="landing-invite">
          Rinnova is invite only while we pilot it. If someone invited you, sign
          in with the email they used.
        </p>

        <div className="landing-request">
          <RequestAccess />
        </div>

        <ul className="landing-features">
          {FEATURES.map((f) => (
            <li key={f.title} className="landing-feature">
              <h2 className="landing-feature-title">{f.title}</h2>
              <p className="landing-feature-body">{f.body}</p>
            </li>
          ))}
        </ul>

        <footer className="landing-footer">
          <span className="landing-footer-brand">Tondo LLC</span>
          <span className="landing-footer-note">
            Rinnova is a Tondo LLC product. Currently in private pilot.
          </span>
        </footer>
      </div>
    </div>
  )
}

export default Landing
