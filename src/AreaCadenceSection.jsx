import { useState } from 'react'
import { computeAreaCadence } from './areaCadence'
import AreaDetailModal from './AreaDetailModal'

/**
 * AreaCadenceSection
 *
 * "How often do you treat each area?" — the one thing a patient can't get from
 * any single provider, because it spans all of them. Reads straight from the
 * record via src/areaCadence.js (no AI, no averages).
 *
 * Rows lead with what's known: an established rhythm ("about twice a year")
 * where there are enough repeats, a plain gap where there are only two visits,
 * and a bare date where there's one. Nothing is dressed up as a pattern before
 * it is one — see the honesty rules in areaCadence.js.
 *
 * Tapping a row opens the detail sheet with the full history for that area.
 *
 * Props:
 *   visits: visits with nested treatments + treatment_areas
 */

/**
 * How many times ONE area must be treated before the section appears.
 *
 * Counting repeats-in-an-area rather than total visits is the point: visits are
 * a proxy, and a poor one in both directions. Four visits spread across four
 * different areas is four single dates and nothing to report; three visits that
 * all included the lips is a genuine rhythm. A calendar gate ("after a year")
 * fails the same way — quarterly tox produces real patterns inside eight
 * months, while two visits a year apart is still just one gap.
 *
 * 2 reveals the section at the first repeat ("2 times · 5 months apart"), which
 * is already a fact the patient can't get from any one provider. The stronger
 * claim — a named cadence like "about twice a year" — stays gated at 3 inside
 * areaCadence.js, so revealing early never means overclaiming.
 */
const REVEAL_MIN_REPEATS = 2

const COLORS = {
  xeomin: '#7B2CBF',
  radiesse: '#D63384',
  'radiesse-light': '#F06E89',
  rha: '#FF8C42',
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function AreaCadenceSection({ visits = [] }) {
  // Captured once per mount — same purity discipline as HeroCard.
  const [now] = useState(() => Date.now())
  const [openArea, setOpenArea] = useState(null)

  const areas = computeAreaCadence(visits, now)
  const repeated = areas.filter((a) => a.count >= REVEAL_MIN_REPEATS)

  // Hide the whole section until it has something true to say. See the note on
  // REVEAL_MIN_REPEATS — the gate counts repeats in ONE area, not visits: four
  // visits to four different areas is still four single dates and no pattern,
  // while three visits that all included lips is a real rhythm.
  //
  // Returning null rather than an empty state is deliberate. A new patient with
  // no history shouldn't be shown a box explaining a feature they can't use
  // yet; the section simply appears the first time it means something.
  if (repeated.length === 0) return null

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Areas you treat</h2>
        <span className="section-meta">{areas.length}</span>
      </div>

      <ul className="cadence-list">
        {areas.map((area) => (
          <li key={area.key}>
            <button
              type="button"
              className="cadence-row"
              onClick={() => setOpenArea(area)}
            >
              <span className="cadence-dots" aria-hidden="true">
                {area.colorKeys.map((k) => (
                  <span
                    key={k}
                    className="cadence-dot"
                    style={{ background: COLORS[k] || '#888' }}
                  />
                ))}
              </span>

              <span className="cadence-main">
                <span className="cadence-label">{area.label}</span>
                <span className="cadence-meta">
                  {area.count === 1
                    ? `Once, ${fmtDate(area.lastDate)}`
                    : `${area.count} times · ${
                        area.cadenceText ||
                        `${Math.round(area.typicalMonths)} months apart`
                      }`}
                </span>
              </span>

              <span className="cadence-chevron" aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Once revealed, the section still lists single-visit areas for context.
          This says why they're quiet, so a mostly-blank list reads as "not yet"
          rather than "broken". Drops away once a real cadence exists. */}
      {!areas.some((a) => a.cadenceText) && (
        <p className="cadence-footnote">
          A pattern needs a third visit to an area — until then these are gaps,
          not yet a rhythm.
        </p>
      )}

      {openArea && (
        <AreaDetailModal area={openArea} onClose={() => setOpenArea(null)} />
      )}
    </section>
  )
}

export default AreaCadenceSection
