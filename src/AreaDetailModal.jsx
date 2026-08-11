import { useEffect } from 'react'
import { formatMonths } from './renewals'
import { categoryColor } from './treatmentColors'

/**
 * AreaDetailModal
 *
 * The detail view behind a row in AreaCadenceSection: every time this area was
 * treated, the gaps between, the rhythm that emerges, and — only when the
 * record supports one — an estimate of when the next would land at the
 * patient's own pace.
 *
 * WHY THIS ESTIMATE IS DIFFERENT FROM THE HERO CARD'S. HeroCard/renewals.js
 * works from industry duration ranges — population averages the patient may not
 * match. This works from their own intervals. Where both exist, this one is the
 * better claim, and it says so ("at your usual pace"), because the whole point
 * is that it's a fact about them rather than about aesthetics patients in
 * general.
 *
 * Honesty rules, inherited from areaCadence.js and the hero card:
 *   - No estimate at all from a single visit. One date is not a rhythm.
 *   - Two dates are shown as a gap, labelled as such — never as "your pattern".
 *   - Descriptive, never prescriptive: "would be about now", never "book now".
 *
 * Props:
 *   area    — one entry from computeAreaCadence() (daysUntilDue is already
 *             resolved against `now` there, so this component needs no clock
 *             of its own — which also keeps it pure)
 *   onClose — dismiss the sheet
 */

function fmtLong(d) {
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Collapse repeats of the same product+dose on one day into a single line.
 * A bilateral area records the product once per side, so "Radiesse" would
 * otherwise appear twice for one cheekbone treatment.
 */
function dedupeProducts(products) {
  const seen = new Set()
  const out = []
  for (const p of products) {
    const k = `${p.name || ''}|${p.dose || ''}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(p)
  }
  return out
}

function AreaDetailModal({ area, onClose }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Newest first — the timeline reads the way the visit list does.
  const entries = [...area.events].reverse()

  let dueLine = null
  if (area.confidence === 'established' && area.daysUntilDue != null) {
    if (area.daysUntilDue > 0) {
      dueLine = `At your usual pace, the next one would land around ${fmtLong(area.dueDate)}.`
    } else {
      dueLine = `At your usual pace, you'd typically have returned by ${fmtLong(area.dueDate)}.`
    }
  } else if (area.confidence === 'provisional') {
    dueLine = `Only one gap so far, so there's no reliable pattern yet — a third visit is where one starts to show.`
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />

      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${area.label} history`}
      >
        <div className="modal-handle" />

        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="modal-body">
          <header className="modal-header">
            <h2 className="modal-date">{area.label}</h2>
            <p className="modal-provider">
              {area.count === 1
                ? 'Treated once'
                : `Treated ${area.count} times${area.cadenceText ? ` · ${area.cadenceText}` : ''}`}
            </p>
          </header>

          {dueLine && <p className="area-due">{dueLine}</p>}

          <div className="area-timeline">
            {entries.map((event, i) => {
              // Gap to the visit BEFORE this one, so it reads as "5 months
              // after the last time" sitting under each entry.
              const older = entries[i + 1]
              const gapMonths = older
                ? area.intervals[area.intervals.length - i - 1]
                : null

              return (
                <div key={event.date.toISOString()} className="area-entry">
                  <div className="area-entry-date">{fmtLong(event.date)}</div>

                  {/* What was actually used that day — the product, and the
                      dose only when the record has one. Dose is never invented,
                      so most entries show just the product, which is honest. */}
                  <div className="area-entry-products">
                    {dedupeProducts(event.products).map((p, j) => (
                      <span key={j} className="area-product">
                        <span
                          className="area-product-dot"
                          style={{ background: categoryColor(p.colorKey) }}
                          aria-hidden="true"
                        />
                        {p.name || 'Treatment'}
                        {p.dose ? <span className="area-product-dose"> · {p.dose}</span> : null}
                      </span>
                    ))}
                  </div>

                  {gapMonths != null && (
                    <div className="area-entry-gap">
                      {formatMonths(gapMonths)} after the previous
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="area-footnote">
            Counted from your own record. An area treated with two products on
            the same day counts once.
          </p>
        </div>
      </div>
    </>
  )
}

export default AreaDetailModal
