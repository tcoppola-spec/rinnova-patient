import { useEffect, useState } from 'react'

/**
 * InstallPrompt
 *
 * Turns Rinnova from "a site you bookmarked" into "an app on your home screen".
 * Two paths, because the platforms genuinely differ:
 *
 *   Android / Chrome / Edge — the browser fires `beforeinstallprompt`, we hold
 *     onto it and show a real Install button. One tap, native install dialog.
 *
 *   iPhone / iPad — Apple exposes NO install API. Safari only installs via
 *     Share → Add to Home Screen, and no amount of JavaScript can trigger it.
 *     That is a platform restriction, not a gap here: short of shipping through
 *     the App Store there is no one-tap install on iOS. So we show the two
 *     steps, with the actual Share glyph, rather than pretending otherwise.
 *
 * Hidden entirely once installed (`display-mode: standalone`, or Apple's
 * legacy `navigator.standalone`), so it never nags someone who already did it.
 *
 * Dismissal is remembered in localStorage, and that IS the right store here —
 * unlike the onboarding flag, which lives on the patient row because it follows
 * the person. "Is Rinnova installed?" is a property of THIS device: the same
 * patient on a new phone should be asked again.
 *
 * Props:
 *   onToast — optional, for confirming a successful install
 *   variant — 'card' (default): a dismissible card, for inside the app.
 *             'landing': a bare primary button for the landing page's action
 *             row. Not dismissible there — it's one of the two ways in, so it
 *             must not disappear, and it falls back to browser-menu
 *             instructions when no install event has fired.
 */

const DISMISS_KEY = 'rinnova.install.dismissed'

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari predates the display-mode media query.
    window.navigator.standalone === true
  )
}

function isIOS() {
  const ua = navigator.userAgent || ''
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac; the touch point count gives it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function ShareGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 9V2M7 2L4.5 4.5M7 2l2.5 2.5M3 7.5v3.5a1 1 0 001 1h6a1 1 0 001-1V7.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function InstallPrompt({ onToast, variant = 'card' }) {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1'
  )
  const [showSteps, setShowSteps] = useState(false)

  useEffect(() => {
    function onBeforeInstall(e) {
      // Chrome shows its own mini-infobar unless we take over. We want the
      // invitation to appear in Rinnova's own voice, in the right place.
      e.preventDefault()
      setDeferred(e)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
      onToast?.('Rinnova added to your home screen')
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [onToast])

  const landing = variant === 'landing'

  if (installed) return null
  if (dismissed && !landing) return null

  const ios = isIOS()
  // In the CARD variant there's nothing to say when the browser hasn't offered
  // an install — stay silent rather than explain. On the LANDING page this is a
  // primary action and can't vanish, so it falls through to instructions.
  if (!ios && !deferred && !landing) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    // A declined prompt can't be re-fired — Chrome discards it. Drop our copy
    // so the button doesn't sit there doing nothing when tapped again.
    setDeferred(null)
    if (outcome === 'dismissed') dismiss()
  }

  // A render function, not a nested component: declaring a component inside a
  // component gives it a new identity every render, which remounts its subtree
  // and drops any state it holds.
  function renderAction() {
    if (!ios && deferred) {
      return (
        <button type="button" className="install-btn" onClick={install}>
          Install Rinnova
        </button>
      )
    }
    if (!showSteps) {
      return (
        <button type="button" className="install-btn" onClick={() => setShowSteps(true)}>
          {ios ? 'Add to home screen' : 'How to install'}
        </button>
      )
    }
    return ios ? (
      // Apple allows no programmatic install, so the honest version is showing
      // exactly where to tap.
      <ol className="install-steps">
        <li>
          Tap <ShareGlyph /> <strong>Share</strong> in Safari&apos;s toolbar
        </li>
        <li>
          Choose <strong>Add to Home Screen</strong>
        </li>
      </ol>
    ) : (
      // Desktop/Android where the event hasn't fired: usually the site is
      // already installed, or the browser wants more engagement first.
      <ol className="install-steps">
        <li>
          Open your browser menu (<strong>⋮</strong> or the address-bar install icon)
        </li>
        <li>
          Choose <strong>Install Rinnova</strong>
        </li>
      </ol>
    )
  }

  if (landing) {
    return (
      <div className="install-landing">
        {renderAction()}
      </div>
    )
  }

  return (
    <section className="install-card">
      <button
        type="button"
        className="install-close"
        onClick={dismiss}
        aria-label="Not now"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <h2 className="install-title">Keep Rinnova on your home screen</h2>
      <p className="install-text">
        Opens full screen, straight to your record — no browser, no bookmark.
      </p>

      {renderAction()}
    </section>
  )
}

export default InstallPrompt
