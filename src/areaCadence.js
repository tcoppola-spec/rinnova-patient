/**
 * areaCadence.js
 *
 * "How often do you treat this area?" — computed from the patient's OWN record.
 * No AI, no population averages: this file only counts what actually happened.
 *
 * This is the thing no one else can tell a patient. A provider knows their own
 * chart; nobody knows you've treated your lips six times in three years across
 * two injectors. That is the whole Rinnova thesis as a number.
 *
 * It also exists to make reminders honest. renewals.js works off industry
 * duration ranges, which are population averages a given patient may not match.
 * Once there are enough repeats here, "you typically refresh your lips every
 * 7 months" is a fact about them, not an average.
 *
 * HONESTY RULES (same family as renewals.js and the face map):
 *   - A pattern needs repeats. One visit is not a cadence; two visits are ONE
 *     interval and are reported as provisional, never as "your pattern".
 *   - We report what the record says and stop. No advice, no "you should".
 *   - Areas we can't group are dropped rather than guessed into a bucket.
 */

import { getCoordinates } from './faceCoordinates'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const MS_PER_MONTH = MS_PER_DAY * 30.44

// How many distinct treatment dates before we'll call something a pattern.
// Two dates give a single interval — real, but one gap is an anecdote: a
// holiday or a bad month moves it arbitrarily. Three dates give two intervals,
// which is the first point a median means anything.
const ESTABLISHED_MIN_VISITS = 3

/**
 * Canonical key for "the same place on the face".
 *
 * Grouping by name alone fails immediately: a clinical note says "Zygoma", the
 * guided Q&A says "Cheekbones", the patient-facing translation says
 * "Cheekbones" — same place, three strings. So we resolve the name back through
 * the coordinate table and group by the POINT, which is what "same area"
 * actually means. Two names that resolve to one point are one region.
 *
 * Clinical name first, for the reason documented in saveVisit.js: everyday
 * words are coarser than anatomy ("cheeks" covers buccal AND lateral cheeks),
 * so display wording must not drive grouping any more than it drives placement.
 *
 * Note this deliberately re-resolves from the NAME rather than reading the
 * stored x/y: saved coordinates carry the duplicate fan-out offset, so two
 * products at one area sit on slightly different points and would split into
 * two regions.
 */
function regionKey(area) {
  const coord =
    getCoordinates(area.clinical_name) || getCoordinates(area.friendly_name)
  if (coord) return `pt:${coord.x},${coord.y}`

  // Unplaceable (a laser, a peel, or a gap in the lookup). Still countable —
  // fall back to the normalised name so it groups with itself across visits.
  const name = (area.friendly_name || area.clinical_name || '').trim().toLowerCase()
  return name ? `name:${name}` : null
}

/** "Cheekbones" beats "Zygoma" for a heading: pick the most-used label. */
function pickLabel(labels) {
  const counts = new Map()
  for (const l of labels) {
    if (!l) continue
    counts.set(l, (counts.get(l) || 0) + 1)
  }
  let best = null
  let bestN = -1
  for (const [label, n] of counts) {
    // Ties break toward the shorter label — "Lips" over "Lips (upper)".
    if (n > bestN || (n === bestN && label.length < best.length)) {
      best = label
      bestN = n
    }
  }
  return best
}

/** Median is deliberate: one unusually long gap shouldn't redefine a pattern. */
function median(nums) {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * describeCadence(months) -> "about twice a year" | "about every 5 months" | …
 *
 * Per-year phrasing only where it's natural. "About 5 times a year" is worse
 * than "about every 10 weeks" for short intervals, and nobody says "0.8 times
 * a year", so those fall back to the interval form.
 */
export function describeCadence(months) {
  if (!Number.isFinite(months) || months <= 0) return null
  const perYear = 12 / months
  const roundedPerYear = Math.round(perYear)
  if (roundedPerYear >= 2 && roundedPerYear <= 4 && Math.abs(perYear - roundedPerYear) < 0.35) {
    return roundedPerYear === 2
      ? 'about twice a year'
      : `about ${roundedPerYear} times a year`
  }
  if (Math.abs(months - 12) < 1.5) return 'about once a year'
  // Past ~2 years nobody counts in months.
  if (months >= 22) {
    const years = Math.round((months / 12) * 2) / 2
    return `about every ${years % 1 ? years.toFixed(1).replace('.5', '½') : years} years`
  }
  const m = Math.round(months)
  if (m <= 1) return 'about every month'
  return `about every ${m} months`
}

/**
 * computeAreaCadence(visits, now) -> [{
 *   key,            // canonical region key
 *   label,          // patient-facing area name
 *   colorKeys,      // categories treated here (for the dot colours)
 *   dates,          // Date[] ascending, one per DISTINCT treatment date
 *   count,          // dates.length
 *   intervals,      // months between consecutive dates
 *   typicalMonths,  // median interval, or null when there's only one date
 *   cadenceText,    // "about twice a year", or null
 *   lastDate,
 *   monthsSinceLast,
 *   dueDate,        // when a next one would land at the patient's own pace
 *   daysUntilDue,   // negative = already past
 *   confidence,     // 'single' | 'provisional' | 'established'
 * }]
 *
 * Sorted by most-treated first, then most recent — the areas someone actually
 * maintains rise to the top.
 *
 * `now` is injected so callers stay pure (the HeroCard lesson).
 */
export function computeAreaCadence(visits = [], now = Date.now()) {
  const groups = new Map()

  for (const visit of visits) {
    if (!visit?.visit_date) continue
    const date = new Date(visit.visit_date + 'T00:00:00')
    if (Number.isNaN(date.getTime())) continue

    for (const treatment of visit.treatments || []) {
      for (const area of treatment.treatment_areas || []) {
        const key = regionKey(area)
        if (!key) continue

        if (!groups.has(key)) {
          groups.set(key, { key, labels: [], colorKeys: new Set(), byDate: new Map() })
        }
        const g = groups.get(key)
        g.labels.push(area.friendly_name || area.clinical_name)
        if (treatment.color_key) g.colorKeys.add(treatment.color_key)

        // Keyed by DATE, not by row. Radiesse and diluted Radiesse in the same
        // cheek on the same day is ONE time that cheek was treated — counting
        // rows would double the apparent frequency and halve the apparent
        // interval, which would then feed a reminder that fires twice as often
        // as it should.
        g.byDate.set(visit.visit_date, date)
      }
    }
  }

  const out = []
  for (const g of groups.values()) {
    const dates = [...g.byDate.values()].sort((a, b) => a - b)
    const lastDate = dates[dates.length - 1]

    const intervals = []
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i - 1]) / MS_PER_MONTH)
    }

    const typicalMonths = intervals.length ? median(intervals) : null
    const confidence =
      dates.length >= ESTABLISHED_MIN_VISITS
        ? 'established'
        : dates.length === 2
          ? 'provisional'
          : 'single'

    const dueDate =
      typicalMonths != null
        ? new Date(lastDate.getTime() + typicalMonths * MS_PER_MONTH)
        : null

    out.push({
      key: g.key,
      label: pickLabel(g.labels),
      colorKeys: [...g.colorKeys],
      dates,
      count: dates.length,
      intervals,
      typicalMonths,
      // Only phrase a cadence once there IS one. A single interval is shown as
      // a gap ("5 months apart") by the UI, not dressed up as a rhythm.
      cadenceText:
        confidence === 'established' ? describeCadence(typicalMonths) : null,
      lastDate,
      monthsSinceLast: (now - lastDate.getTime()) / MS_PER_MONTH,
      dueDate,
      daysUntilDue:
        dueDate != null ? Math.ceil((dueDate.getTime() - now) / MS_PER_DAY) : null,
      confidence,
    })
  }

  out.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.lastDate - a.lastDate
  })

  return out
}
