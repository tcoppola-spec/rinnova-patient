import { Link } from 'react-router-dom'

/**
 * PageFooter
 *
 * Bottom of the patient page: brand line, the standing links, and who built it.
 *
 * The links are react-router <Link>s, not plain <a href>s, so tapping one does
 * not reload the app — which matters in the installed PWA, where a full reload
 * means re-fetching the whole record just to read a help page.
 */
function PageFooter() {
  return (
    <footer className="page-footer">
      <div className="footer-brand">Rinnova</div>
      <div className="footer-tagline">Your care, kept</div>

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
