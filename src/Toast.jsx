/**
 * Toast — a brief bottom-of-screen confirmation pill.
 *
 * ⚠️ THE RULE (from the design discussion — keep it disciplined):
 * only toast actions whose PROOF OF SUCCESS is off-screen. Rinnova's
 * wait-and-show pattern means most actions confirm themselves — the edited
 * cost updates in place, the added product appears in the list. Toasting those
 * would train the patient to ignore toasts. The toast exists for the actions
 * that otherwise end in silence:
 *   - deletes (the thing just vanishes — absence is terrible feedback)
 *   - photo attach/detach (the badge lives behind the open modal)
 * The "Saved to your record" screen in LogVisitPrompt is NOT a toast candidate:
 * its subtext carries load-bearing information (products filed, no-map notes)
 * that a 2.5s pill can't hold.
 *
 * Purely presentational — App owns the state and the auto-dismiss timer.
 * `key` on toast changes re-mounts the pill so back-to-back toasts re-animate.
 *
 * Props:
 *   toast — { message, key } or null
 */
function Toast({ toast }) {
  if (!toast) return null

  return (
    <div key={toast.key} className="toast" role="status" aria-live="polite">
      <svg
        className="toast-check"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5 12.5l4 4 10-10"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{toast.message}</span>
    </div>
  )
}

export default Toast
