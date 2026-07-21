import { useState } from 'react'
import { computeAreaCadence } from './areaCadence'
import { mirrorX, MIRROR_AXIS, DOT_RADIUS } from './faceGeometry'
import FaceDiagram from './FaceDiagram'
import AreaDetailModal from './AreaDetailModal'

/**
 * AreaCadenceSection
 *
 * "How often do you treat each area?" — the one thing no single provider can
 * tell a patient, because it spans all of them. Reads straight from the record
 * via src/areaCadence.js (no AI, no population averages).
 *
 * SHAPE: a face, then a short summary. NOT a list of every area.
 * An enumerated row per region is a log — it makes the reader do the work of
 * finding the pattern, which is the one thing this feature exists to do for
 * them. So the face carries the answer at a glance (bigger, stronger dot = an
 * area you keep coming back to), and the text below names only what's worth
 * saying in words. Areas treated once stay in the count but out of the prose;
 * they're already visible in the timeline.
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
 * 2 reveals the section at the first repeat. The stronger claim — a named
 * cadence like "about twice a year" — stays gated at 3 inside areaCadence.js,
 * so revealing early never means overclaiming.
 */
const REVEAL_MIN_REPEATS = 2

// How many areas get named in prose. Past three it stops being a summary.
const NAMED_IN_SUMMARY = 3

function listPhrase(items) {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function AreaCadenceSection({ visits = [] }) {
  // Captured once per mount — same purity discipline as HeroCard.
  const [now] = useState(() => Date.now())
  const [openArea, setOpenArea] = useState(null)

  const areas = computeAreaCadence(visits, now)
  const repeated = areas.filter((a) => a.count >= REVEAL_MIN_REPEATS)

  // Hide the section until it has something true to say. Returning null rather
  // than an empty state is deliberate: a patient with no history shouldn't be
  // shown a box explaining a feature they can't use yet.
  if (repeated.length === 0) return null

  const maxCount = repeated[0].count

  // Weight each dot by how often that area is treated. This is the summary —
  // the face should answer "what do I actually maintain?" before a word is read.
  const dots = []
  for (const area of areas) {
    if (area.x == null || area.y == null) continue
    const strength = area.count / maxCount
    // Floor of 0.62 so a once-treated area is still legible; areas you return
    // to read as visibly heavier without the map turning into a bar chart.
    const r = DOT_RADIUS * (0.62 + 0.38 * strength)
    const opacity = 0.4 + 0.6 * strength
    const color = COLORS[area.colorKeys[0]] || '#888'

    dots.push({ id: area.key, x: area.x, y: area.y, r, opacity, color })
    // Skip the reflection for a midline point: mirrorX(114.9) is 114.9, so the
    // second dot lands on the first. At full opacity that was invisible; these
    // dots are translucent, so two stacked circles read as a darker area and
    // would silently overstate it. (Stored rows CAN carry mirror=true on a
    // midline area — older data predates the coercion in saveVisit.js.)
    if (area.mirror && Math.abs(area.x - MIRROR_AXIS) > 0.01) {
      dots.push({ id: `${area.key}-m`, x: mirrorX(area.x), y: area.y, r, opacity, color })
    }
  }

  const named = repeated.slice(0, NAMED_IN_SUMMARY)
  const onceOnly = areas.length - repeated.length

  const top = repeated[0]
  const headline =
    repeated.length === 1
      ? `You've come back to your ${top.label.toLowerCase()}`
      : `You keep coming back to ${listPhrase(named.map((a) => a.label.toLowerCase()))}`

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Areas you treat</h2>
      </div>

      <FaceDiagram dots={dots} legend={null} />

      <p className="cadence-headline">{headline}</p>

      {/* Only the repeated areas get a line, and each line is the insight —
          how often — rather than a record of what happened. */}
      <ul className="cadence-summary">
        {named.map((area) => (
          <li key={area.key}>
            <button
              type="button"
              className="cadence-summary-row"
              onClick={() => setOpenArea(area)}
            >
              <span className="cadence-summary-label">{area.label}</span>
              <span className="cadence-summary-value">
                {area.cadenceText || `${area.count} times so far`}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {repeated.length > NAMED_IN_SUMMARY && (
        <p className="cadence-footnote">
          Plus {repeated.length - NAMED_IN_SUMMARY} more{' '}
          {repeated.length - NAMED_IN_SUMMARY === 1 ? 'area' : 'areas'} you've
          treated more than once
          {onceOnly > 0 ? `, and ${onceOnly} treated once.` : '.'}
        </p>
      )}

      {repeated.length <= NAMED_IN_SUMMARY && onceOnly > 0 && (
        <p className="cadence-footnote">
          Plus {onceOnly} {onceOnly === 1 ? 'area' : 'areas'} treated once.
        </p>
      )}

      {!areas.some((a) => a.cadenceText) && (
        <p className="cadence-footnote">
          A third visit to an area is where a rhythm starts to show — until
          then these are gaps, not yet a pattern.
        </p>
      )}

      {openArea && (
        <AreaDetailModal area={openArea} onClose={() => setOpenArea(null)} />
      )}
    </section>
  )
}

export default AreaCadenceSection
