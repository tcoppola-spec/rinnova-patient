import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { usePatientData } from './usePatientData'
import Greeting from './Greeting'
import HeroCard from './HeroCard'
import LogVisitPrompt from './LogVisitPrompt'
import VisitsTimeline from './VisitsTimeline'
import PhotosSection from './PhotosSection'
import ProductsSection from './ProductsSection'
import SubscriptionsSection from './SubscriptionsSection'
import PageFooter from './PageFooter'
import VisitDetailModal from './VisitDetailModal'
import Onboarding from './Onboarding'
import './App.css'

// First-run onboarding flag, per user, in localStorage. V1 fallback for the
// brief's preferred profile column (which would need a DEFINER RPC + migration
// so patients can't broadly write their own row). Wrapped because private-mode
// browsers can throw on access.
const onboardingKey = (userId) => `rinnova.onboarding.${userId}`
function isOnboarded(userId) {
  if (!userId) return true
  try {
    return localStorage.getItem(onboardingKey(userId)) === 'done'
  } catch {
    return true // if storage is unavailable, don't trap the user on onboarding
  }
}
function markOnboarded(userId) {
  if (!userId) return
  try {
    localStorage.setItem(onboardingKey(userId), 'done')
  } catch {
    /* no-op: nothing we can do if storage is blocked */
  }
}

function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const { data, loading: dataLoading, error: dataError, refetch } = usePatientData()
  const [openVisit, setOpenVisit] = useState(null)
  const [onboardingDone, setOnboardingDone] = useState(false)

  const userId = session?.user?.id
  // Show the first-run flow once per user, before the main UI. Reading storage
  // in render is a cheap, synchronous, side-effect-free read.
  const needsOnboarding = !!userId && !onboardingDone && !isOnboarded(userId)

  function completeOnboarding() {
    markOnboarded(userId)
    setOnboardingDone(true)
  }

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

  // First-run onboarding gates the main UI (doesn't need patient data loaded).
  if (needsOnboarding) {
    return (
      <div className="app-shell">
        <Onboarding onDone={completeOnboarding} />
      </div>
    )
  }

  if (dataLoading) {
    return (
      <div className="app-shell">
        <div className="loading-state">Loading your record…</div>
      </div>
    )
  }

  if (dataError) {
    return (
      <div className="app-shell">
        <div className="error-state">
          <p>Something went wrong loading your record.</p>
          <p className="error-detail">{dataError}</p>
          <button onClick={handleLogout} className="signout-btn" style={{ marginTop: 16 }}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  const { patient, visits, photos, products, subscriptions } = data
  const lastVisit = visits[0]

  return (
    <div className="app-shell">
      <div className="page">
        <div className="utility-bar">
          <button onClick={handleLogout} className="signout-btn">Sign out</button>
        </div>

        <Greeting firstName={patient.first_name} />

        <HeroCard
          lastVisitDate={lastVisit?.visit_date}
          providerName={patient.primary_provider?.name || patient.provider_name}
          providerPhone={patient.primary_provider?.phone || patient.provider_phone}
        />

        <LogVisitPrompt onRefetch={refetch} />

        <VisitsTimeline
          visits={visits}
          onVisitClick={(visit) => setOpenVisit(visit)}
          onRefetch={refetch}
        />

        <PhotosSection photos={photos} onRefetch={refetch} />

        <ProductsSection products={products} onRefetch={refetch} />

        <SubscriptionsSection subscriptions={subscriptions} />

        <PageFooter />
      </div>

      {openVisit && (
        <VisitDetailModal
          visit={openVisit}
          onClose={() => setOpenVisit(null)}
        />
      )}
    </div>
  )
}

export default App
