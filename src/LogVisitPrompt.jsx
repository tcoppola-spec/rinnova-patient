/**
 * LogVisitPrompt
 *
 * The prominent "Log a visit" prompt banner. For V1 minimum, this is a
 * placeholder button — the actual modal with photo upload + AI parsing
 * comes in Chunk 6.
 *
 * For now: clicking it just shows an alert noting the feature is coming.
 *
 * Props: none (currently)
 */
function LogVisitPrompt() {
  function handleClick() {
    alert("Log a visit will be wired up in Chunk 6 (AI parsing).")
  }

  return (
    <button type="button" onClick={handleClick} className="log-prompt">
      <div className="log-prompt-text">
        <div className="log-prompt-title">Log a visit</div>
        <div className="log-prompt-sub">
          Snap the paper from your visit, take a pic of the screen, or describe what you had
        </div>
      </div>
      <span className="log-prompt-arrow" aria-hidden="true">→</span>
    </button>
  )
}

export default LogVisitPrompt