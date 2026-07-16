/**
 * renewals.js
 *
 * Deterministic "what's wearing off" model for the hero card — the onboarding
 * promise ("what's wearing off") delivered. NO AI anywhere in this file: it is
 * a small editable table of industry-standard duration ranges crossed with the
 * patient's own treatment dates. Nothing here can hallucinate.
 *
 * HONESTY RULES (same principle as the parser and the face map):
 *   - Ranges + "typically" phrasing only. This is information about the
 *     patient's own record, never a prescription. "May be wearing off",
 *     never "you need".
 *   - A product we can't categorise gets NO duration claim — silence over
 *     invention.
 *
 * The clock groups by CATEGORY (color_key), not product name: Botox in April
 * then Xeomin in July are the same effect — the latest tox treatment resets
 * the tox clock.
 */

// Typical duration ranges in months, by color_key category. Editable — these
// are the industry-standard figures Tracy reviewed; tune as real-world data
// accumulates. min = when effects typically START fading, max = typically gone.
const DURATIONS = {
  'xeomin': { min: 3, max: 4, categoryLabel: 'neurotoxin' }, // any tox: Botox, Xeomin, Jeuveau, Dysport, Daxxify
  'rha': { min: 6, max: 12, categoryLabel: 'HA filler' }, // RHA, Restylane, Juvederm, Belotero…
  'radiesse': { min: 12, max: 18, categoryLabel: 'Radiesse' },
  'radiesse-light': { min: 10, max: 14, categoryLabel: 'hyperdilute Radiesse' }, // ~12-month maintenance, ±2 band
}

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44

/** "4½ months" — half-month precision reads naturally in the card copy. */
export function formatMonths(m) {
  const halves = Math.round(m * 2) / 2
  const whole = Math.floor(halves)
  const frac = halves - whole
  const label = frac ? `${whole}½` : `${whole}`
  return `${label} month${halves === 1 ? '' : 's'}`
}

/**
 * computeRenewals(visits, now) -> [{
 *   name,          // product name from the LATEST treatment in this category
 *   colorKey,
 *   lastDate,      // Date of that treatment's visit
 *   monthsAgo,     // elapsed, fractional
 *   status,        // 'worn' | 'wearing' | 'active'
 *   min, max,      // the typical range, months
 *   fadeStart,     // Date when effects typically start fading (lastDate + min)
 * }]
 *
 * Sorted most-timely first: worn (most overdue first) → wearing → active
 * (soonest fadeStart first). `now` is injected so the card stays pure and this
 * stays trivially testable.
 */
export function computeRenewals(visits, now) {
  // Latest treatment per category across all visits.
  const latest = {}
  for (const v of visits || []) {
    if (!v?.visit_date) continue
    for (const t of v.treatments || []) {
      const spec = DURATIONS[t?.color_key]
      if (!spec) continue // uncategorised product -> no claim, on purpose
      const cur = latest[t.color_key]
      if (!cur || v.visit_date > cur.visitDate) {
        latest[t.color_key] = { visitDate: v.visit_date, name: t.name }
      }
    }
  }

  const out = []
  for (const [colorKey, { visitDate, name }] of Object.entries(latest)) {
    const spec = DURATIONS[colorKey]
    const lastDate = new Date(visitDate + 'T00:00:00')
    const monthsAgo = (now - lastDate.getTime()) / MS_PER_MONTH
    if (monthsAgo < 0) continue // future-dated data; say nothing

    let status = 'active'
    if (monthsAgo > spec.max) status = 'worn'
    else if (monthsAgo >= spec.min) status = 'wearing'

    out.push({
      name,
      colorKey,
      lastDate,
      monthsAgo,
      status,
      min: spec.min,
      max: spec.max,
      fadeStart: new Date(lastDate.getTime() + spec.min * MS_PER_MONTH),
    })
  }

  const rank = { worn: 0, wearing: 1, active: 2 }
  out.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
    if (a.status === 'active') return a.fadeStart - b.fadeStart // soonest due first
    return b.monthsAgo - a.monthsAgo // most overdue first
  })
  return out
}
