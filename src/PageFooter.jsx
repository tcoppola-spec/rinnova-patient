import { Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'

/**
 * PageFooter
 *
 * Bottom of the patient page: brand line, a feedback button, the standing
 * links, and who built it.
 *
 * The links are react-router <Link>s, not plain <a href>s, so tapping one does
 * not reload the app — which matters in the installed app / PWA, where a full
 * reload means re-fetching the whole record just to read a help page.
 *
 * Feedback is a mailto: to hello@rinnova.io, pre-filled with the platform and
 * build id so a pilot report is traceable to a specific build. A mailto works
 * in the Capacitor iOS shell (WKWebView hands it to the system Mail composer)
 * and on the web. __APP_VERSION__ is the build id injected at compile time by
 * Vite (see vite.config.js) — guarded with typeof so a stray reference can't
 * throw if it's ever absent.
 */
function feedbackHref() {
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
  const platform = Capacitor.isNativePlatform() ? 'iOS app' : 'Web'
  const subject = encodeURIComponent('Rinnova feedback')
  const body = encodeURIComponent(
    `\n\n\n———\nSent from Rinnova (${platform} · build ${version}).`
  )
  return `mailto:hello@rinnova.io?subject=${subject}&body=${body}`
}

function PageFooter() {
  return (
    <footer className="page-footer">
      <div className="footer-brand">Rinnova</div>
      <div className="footer-tagline">Your care, kept</div>

      <a className="footer-feedback" href={feedbackHref()}>
        Send feedback
      </a>

      <nav className="footer-links">
        <Link to="/privacy" className="footer-link">Privacy</Link>
        <span className="footer-dot" aria-hidden="true">·</span>
        <Link to="/terms" className="footer-link">Terms</Link>
        <span className="footer-dot" aria-hidden="true">·</span>
        <Link to="/help" className="footer-link">Help</Link>
      </nav>

      <div className="footer-built">Built by Tondo LLC</div>
    </footer>
  )
}

export default PageFooter
