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
  const repeated = areas.filter((a) => a.count > 1)

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Areas you treat</h2>
        {areas.length > 0 && <span className="section-meta">{areas.length}</span>}
      </div>

      {areas.length === 0 ? (
        <div className="empty-state">
          Once your visits include treatment areas, you'll see how often you
          return to each one.
        </div>
      ) : (
        <>
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

          {/* Says plainly why most rows are quiet early on, so a thin list
              reads as "not yet" rather than "broken". */}
          {repeated.length === 0 && (
            <p className="cadence-footnote">
              A pattern needs repeats — log an area a second time and you'll
              start seeing how often you treat it.
            </p>
          )}
        </>
      )}

      {openArea && (
        <AreaDetailModal area={openArea} onClose={() => setOpenArea(null)} />
      )}
    </section>
  )
}

export default AreaCadenceSection
