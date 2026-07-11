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

function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const { data, loading: dataLoading, error: dataError, refetch } = usePatientData()
  const [openVisit, setOpenVisit] = useState(null)
  // Lets the patient straight through the moment they finish, without waiting
  // on the RPC round-trip — and keeps them through if that write fails.
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  /**
   * Called on "Get started" or "Skip". Persists the flag via the
   * complete_onboarding RPC (a narrow SECURITY DEFINER function — patients has
   * no UPDATE policy on purpose; see db/add_onboarding_flag.sql).
   *
   * The write is best-effort: we dismiss FIRST, so a failed RPC can never trap
   * the patient in onboarding. If it fails they simply see the flow again next
   * session, which is the right retry.
   */
  async function completeOnboarding() {
    setOnboardingDismissed(true)
    try {
      const { error } = await supabase.rpc('complete_onboarding')
      if (error) throw error
      await refetch() // pick up onboarding_completed = true on the patient row
    } catch (e) {
      console.warn(
        '[onboarding] could not save completion — the patient will see it again next session:',
        e?.message || e
      )
    }
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

  // First-run onboarding, gated on the patient's own DB flag so it follows the
  // account across devices. This sits AFTER the dataLoading check on purpose:
  // the flag lives on the patient row, so rendering before the record loads
  // would flash the carousel at someone who has already completed it.
  //
  // Deliberately NOT wrapped in .app-shell — that wrapper is min-height:100vh
  // (the toolbar-hidden viewport), which strands the dots under mobile Safari's
  // bottom bar. Onboarding pins itself to the visible viewport instead.
  if (!patient.onboarding_completed && !onboardingDismissed) {
    return <Onboarding onDone={completeOnboarding} />
  }

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
