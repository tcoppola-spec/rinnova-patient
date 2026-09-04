/**
 * maintenancePlan.js
 *
 * Logic for the "Maintenance" yearly plan (docs/your-year-brief.md):
 *   - which calendar year to show by default
 *   - COMPUTED progress ("1 of 4 done") from the patient's logged visits
 *   - a projection that SEEDS a draft from the patient's own recent history
 *   - batch save of an edited plan
 *
 * Discipline (same as renewals.js / areaCadence.js): descriptive, from the
 * patient's OWN data. The projection is a rough starting draft the patient
 * edits, never a recommendation.
 */

import { supabase } from './supabaseClient'
import { TREATMENT_CATEGORIES, categoryOf } from './treatmentColors'

const MS_PER_DAY = 1000 * 60 * 60 * 24

async function myPatientId() {
  const { data, error } = await supabase.from('patients').select('id').single()
  if (error || !data) throw new Error('Could not find your patient record')
  return data.id
}

/**
 * Which year to show first. Prefer the current calendar year if the patient has
 * a plan for it; otherwise, late in the year (Oct+) with nothing planned yet,
 * point at next year — there's little of this one left to plan.
 */
export function defaultPlanYear(planItems = [], now = new Date()) {
  const cy = now.getFullYear()
  if (planItems.some((i) => i.plan_year === cy)) return cy
  if (now.getMonth() >= 9) return cy + 1
  return cy
}

/**
 * Distinct visit DATES in `year` that included a treatment of `category`. A date
 * is one event, not a row (same rule as area cadence): Radiesse + diluted
 * Radiesse on the same day is one filler event, not two.
 */
export function doneCount(visits = [], category, year) {
  const dates = new Set()
  for (const v of visits) {
    if (!v?.visit_date) continue
    if (Number(v.visit_date.slice(0, 4)) !== year) continue
    const hit = (v.treatments || []).some((t) => (t.color_key || 'other') === category)
    if (hit) dates.add(v.visit_date)
  }
  return dates.size
}

// Rough industry cadence (times per year) — only a FALLBACK for the projection
// when the patient has no recent history for a category. Their own recent count
// wins. Tunable, like renewals.js DURATIONS.
const TIMES_PER_YEAR = {
  xeomin: 3,
  rha: 1,
  radiesse: 1,
  'radiesse-light': 1,
  biostimulator: 1,
  kybella: 1,
  prp: 3,
  threads: 1,
  dissolver: 0,
  energy: 1,
  light: 4,
  resurfacing: 2,
  other: 1,
}

/**
 * Seed a draft plan from the patient's OWN recent history: one row per treatment
 * category they've had in the last 365 days, with planned_count = how many times
 * they had it in that window (their real rhythm). Cost is left blank — visit
 * cost is per-visit, not per-category, so we don't invent a per-category price.
 *
 * Returns draft rows (no ids) ready to merge into the editor.
 */
export function suggestPlanItems(visits = [], now = new Date()) {
  const cutoff = now.getTime() - 365 * MS_PER_DAY
  const counts = {} // category -> Set of dates in the window
  for (const v of visits) {
    if (!v?.visit_date) continue
    const t = new Date(v.visit_date + 'T00:00:00').getTime()
    if (t < cutoff) continue
    for (const tr of v.treatments || []) {
      const cat = tr.color_key || 'other'
      if (!counts[cat]) counts[cat] = new Set()
      counts[cat].add(v.visit_date)
    }
  }
  const rows = Object.entries(counts).map(([category, dates]) => ({
    kind: 'treatment',
    category,
    title: categoryOf(category).label,
    planned_count: dates.size || TIMES_PER_YEAR[category] || 1,
    est_cost: null,
    notes: null,
    source: 'projection',
  }))
  // Most-frequent first, then alphabetical, so the draft reads sensibly.
  rows.sort((a, b) => b.planned_count - a.planned_count || a.title.localeCompare(b.title))
  return rows
}

/** Category options for the "add a treatment" picker (all known categories). */
export function treatmentCategoryOptions() {
  return Object.entries(TREATMENT_CATEGORIES).map(([key, v]) => ({
    key,
    label: v.label,
    color: v.color,
  }))
}

/** Estimated annual total for a year's rows: planned_count × est_cost. */
export function planTotal(rows = []) {
  return rows.reduce((sum, r) => {
    const cost = Number(r.est_cost)
    if (!cost || Number.isNaN(cost)) return sum
    const n = Number(r.planned_count) || 1
    return sum + cost * n
  }, 0)
}

/**
 * Persist an edited plan for one year. Simple and robust rather than clever:
 * delete rows the patient removed, insert new rows, update the rest. Blank-title
 * rows are dropped. One refetch happens in the caller afterward.
 */
export async function savePlan(year, draft = [], original = []) {
  const patientId = await myPatientId()

  const cleaned = draft
    .map((d, idx) => ({ ...d, display_order: idx }))
    .filter((d) => (d.title || '').trim() !== '')

  const keptIds = new Set(cleaned.filter((d) => d.id).map((d) => d.id))

  // Deletes
  for (const o of original) {
    if (!keptIds.has(o.id)) {
      const { data, error } = await supabase
        .from('plan_items')
        .delete()
        .eq('id', o.id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Could not remove a plan item — the permission may be missing.')
      }
    }
  }

  // Inserts + updates
  for (const d of cleaned) {
    const row = {
      plan_year: year,
      kind: d.kind === 'product' ? 'product' : 'treatment',
      category: d.kind === 'product' ? null : d.category || null,
      title: d.title.trim(),
      planned_count: Math.max(1, Number(d.planned_count) || 1),
      est_cost:
        d.est_cost === '' || d.est_cost == null || Number.isNaN(Number(d.est_cost))
          ? null
          : Number(d.est_cost),
      notes: (d.notes || '').trim() || null,
      source: d.source || 'manual',
      display_order: d.display_order,
    }

    if (!d.id) {
      const { error } = await supabase
        .from('plan_items')
        .insert({ ...row, patient_id: patientId })
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('plan_items')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', d.id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('A plan change saved nothing — the permission may be missing.')
      }
    }
  }
}
