import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { usePatientData } from './usePatientData'
import Greeting from './Greeting'
import HeroCard from './HeroCard'
import LogVisitPrompt from './LogVisitPrompt'
import VisitsTimeline from './VisitsTimeline'
import AreaCadenceSection from './AreaCadenceSection'
import PhotosSection from './PhotosSection'
import ProductsSection from './ProductsSection'
import SubscriptionsSection from './SubscriptionsSection'
import PageFooter from './PageFooter'
import VisitDetailModal from './VisitDetailModal'
import Onboarding from './Onboarding'
import NameCapture from './NameCapture'
import Toast from './Toast'
import UpdateBanner from './UpdateBanner'
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
  const [nameDismissed, setNameDismissed] = useState(false)

  // Brief confirmation pill for actions whose result isn't visible where the
  // patient is looking (deletes, photo attach/detach). See Toast.jsx for the
  // discipline rule on what does and doesn't get toasted.
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  function showToast(message) {
    setToast({ message, key: Date.now() })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

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

  /**
   * "What should we call you?" — persists first_name via set_my_name (narrow
   * SECURITY DEFINER RPC; patients has no UPDATE policy). Called by NameCapture
   * only on success, so refetch here just picks up the new name. Dismiss first
   * so a refetch hiccup can't strand the patient on the prompt.
   */
  async function handleNameSaved() {
    setNameDismissed(true)
    try {
      await refetch()
    } catch (e) {
      console.warn('[name] refetch after save failed:', e)
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

  // After onboarding, ask nameless testers what to call them. Sits here (after
  // the data load, after onboarding) so it never flashes before we know whether
  // a name exists. Skippable — never traps the patient.
  if (!patient.first_name && !nameDismissed) {
    return (
      <NameCapture
        onSaved={handleNameSaved}
        onSkip={() => setNameDismissed(true)}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className="page">
        <div className="utility-bar">
          <button onClick={handleLogout} className="signout-btn">Sign out</button>
        </div>

        <Greeting firstName={patient.first_name} />

        <HeroCard
          visits={visits}
          lastVisitDate={lastVisit?.visit_date}
          providerName={patient.primary_provider?.name || patient.provider_name}
          providerPhone={patient.primary_provider?.phone || patient.provider_phone}
        />

        <LogVisitPrompt
          onRefetch={refetch}
          visits={visits}
          patientName={patient.first_name}
          providerEmail={patient.primary_provider?.email || ''}
        />

        <VisitsTimeline
          visits={visits}
          onVisitClick={(visit) => setOpenVisit(visit)}
          onRefetch={refetch}
        />

        {/* Sits under the timeline: it's a reading OF the visits, so it should
            follow them rather than compete with them for the top of the page. */}
        <AreaCadenceSection visits={visits} />

        <PhotosSection
          photos={photos}
          visits={visits}
          onRefetch={refetch}
          onToast={showToast}
          onOpenVisit={(visitId) => {
            const v = visits.find((x) => x.id === visitId)
            if (v) setOpenVisit(v)
          }}
        />

        <ProductsSection products={products} onRefetch={refetch} />

        <SubscriptionsSection subscriptions={subscriptions} />

        <PageFooter />
      </div>

      {openVisit && (
        <VisitDetailModal
          // Re-read from the refetched list, so photo changes made inside the
          // sheet show up without closing and reopening it.
          visit={visits.find((v) => v.id === openVisit.id) || openVisit}
          photos={photos}
          onClose={() => setOpenVisit(null)}
          onDeleted={async () => {
            setOpenVisit(null)
            showToast('Visit deleted')
            await refetch()
          }}
          onRefetch={refetch}
          onToast={showToast}
        />
      )}

      <Toast toast={toast} />

      {/* Shows only when this build is older than the deployed one. */}
      <UpdateBanner />
    </div>
  )
}

export default App
