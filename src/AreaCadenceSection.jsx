import { useRef, useState } from 'react'
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

// How many areas get named in the headline sentence. Past three it stops
// reading as a summary.
const NAMED_IN_SUMMARY = 3

// How many cards the carousel holds. The dots are a position indicator, and
// past this many they stop being countable at a glance — the rest collapse
// into the footnote. Cards are ordered most-treated first, so the cut only
// ever drops the least-established patterns.
const CAROUSEL_MAX = 8

function listPhrase(items) {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function AreaCadenceSection({ visits = [] }) {
  // Captured once per mount — same purity discipline as HeroCard.
  const [now] = useState(() => Date.now())
  const [openArea, setOpenArea] = useState(null)
  const [index, setIndex] = useState(0)
  const trackRef = useRef(null)

  /**
   * Which card is currently centred.
   *
   * Measured from actual geometry rather than derived from scrollLeft and a
   * fixed card width: the cards are a percentage of the viewport, and the
   * first and last are padded so they can centre, so any arithmetic shortcut
   * drifts. Nearest-centre is exact whatever the layout does.
   */
  function syncIndex() {
    const el = trackRef.current
    if (!el) return
    const mid = el.scrollLeft + el.clientWidth / 2
    let best = 0
    let bestDistance = Infinity
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i]
      const childMid = child.offsetLeft + child.offsetWidth / 2
      const distance = Math.abs(childMid - mid)
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    }
    setIndex((prev) => (prev === best ? prev : best))
  }

  function goTo(i) {
    const el = trackRef.current
    const child = el?.children[i]
    if (!el || !child) return
    const left = child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' })
  }

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
  const shown = repeated.slice(0, CAROUSEL_MAX)
  const extra = repeated.length - shown.length
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

      {/* A carousel, not a list. These rows are tappable, and stacked plain
          text reads as prose — nothing said "there is more here" or "this
          opens something". Horizontal cards in the action colour say both:
          the next card peeks past the edge, and the dots show position. */}
      <div
        className="cadence-carousel"
        ref={trackRef}
        onScroll={syncIndex}
      >
        {shown.map((area) => (
          <button
            key={area.key}
            type="button"
            className="cadence-card"
            onClick={() => setOpenArea(area)}
          >
            <span className="cadence-card-label">{area.label}</span>
            <span className="cadence-card-value">
              {area.cadenceText || `${area.count} times so far`}
              <span className="cadence-card-chevron" aria-hidden="true">›</span>
            </span>
          </button>
        ))}
      </div>

      {shown.length > 1 && (
        <div className="cadence-nav" role="tablist" aria-label="Areas">
          {shown.map((area, i) => (
            <button
              key={area.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={area.label}
              className={`cadence-nav-dot${i === index ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}

      {(extra > 0 || onceOnly > 0) && (
        <p className="cadence-footnote">
          {extra > 0 &&
            `Plus ${extra} more ${extra === 1 ? 'area' : 'areas'} you've treated more than once`}
          {extra > 0 && onceOnly > 0 && ', and '}
          {extra === 0 && onceOnly > 0 && 'Plus '}
          {onceOnly > 0 &&
            `${onceOnly} ${onceOnly === 1 ? 'area' : 'areas'} treated once`}
          .
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
