/**
 * maintenancePlan.js
 *
 * Logic for the merged "Areas you treat" section (docs/your-year-brief.md): a
 * face map, then a per-AREA breakdown that toggles between THIS YEAR (what the
 * record shows) and PLAN NEXT YEAR (an editable draft seeded from history).
 *
 * Rows are keyed by AREA (Under eyes, Lips, Cheeks…), each carrying its dominant
 * treatment category (the coloured dot). Plan rows store the area name in
 * `title` and the color_key in `category`; face coordinates are resolved from the
 * name at render, the same as everywhere else.
 *
 * Discipline (same as renewals.js / areaCadence.js): descriptive, from the
 * patient's OWN data. "This year" is a reading of the record; "Plan next year"
 * is a rough draft the patient edits — never a recommendation.
 */

import { supabase } from './supabaseClient'
import { getCoordinates } from './faceCoordinates'
import { computeAreaCadence } from './areaCadence'
import { TREATMENT_CATEGORIES } from './treatmentColors'

const MS_PER_DAY = 1000 * 60 * 60 * 24

async function myPatientId() {
  const { data, error } = await supabase.from('patients').select('id').single()
  if (error || !data) throw new Error('Could not find your patient record')
  return data.id
}

/** The two years the toggle offers. */
export function planYears(now = new Date()) {
  const y = now.getFullYear()
  return { current: y, next: y + 1 }
}

/**
 * Canonical key for "the same place on the face", matching areaCadence: resolve
 * the name through the coordinate table and group by the POINT, so "Zygoma" and
 * "Cheekbones" are one area. Falls back to the normalised name when unplaceable.
 */
export function areaKeyForName(name) {
  const c = getCoordinates(name)
  if (c) return `pt:${c.x},${c.y}`
  const n = (name || '').trim().toLowerCase()
  return n ? `name:${n}` : null
}

function areaKeyForRow(area) {
  const c = getCoordinates(area.clinical_name) || getCoordinates(area.friendly_name)
  if (c) return `pt:${c.x},${c.y}`
  const n = (area.friendly_name || area.clinical_name || '').trim().toLowerCase()
  return n ? `name:${n}` : null
}

/**
 * Distinct treatment DATES in `year` at the area whose name is `name`. A date is
 * one event, not a row (Radiesse + diluted Radiesse the same day in one cheek is
 * one treatment of that cheek).
 */
export function areaDoneInYear(visits = [], name, year) {
  const key = areaKeyForName(name)
  if (!key) return 0
  const dates = new Set()
  for (const v of visits) {
    if (!v?.visit_date) continue
    if (Number(v.visit_date.slice(0, 4)) !== year) continue
    let hit = false
    for (const t of v.treatments || []) {
      for (const a of t.treatment_areas || []) {
        if (areaKeyForRow(a) === key) { hit = true; break }
      }
      if (hit) break
    }
    if (hit) dates.add(v.visit_date)
  }
  return dates.size
}

/**
 * Seed a draft plan from the patient's OWN history: one row per area they treat,
 * with planned_count = how many times they treated it in the last 365 days
 * (their real rhythm; falls back to 1). Category = the area's dominant treatment.
 * Cost is left blank — we never invent a per-area price.
 */
export function suggestAreaPlan(visits = [], now = Date.now()) {
  const cutoff = now - 365 * MS_PER_DAY
  const areas = computeAreaCadence(visits, now)
  return areas
    .filter((a) => a.label)
    .map((a) => {
      const recent = a.dates.filter((d) => d.getTime() >= cutoff).length
      return {
        kind: 'treatment',
        category: a.colorKeys[0] || 'other',
        title: a.label,
        planned_count: recent || 1,
        est_cost: '',
        notes: '',
        source: 'projection',
      }
    })
}

/** Category options for the dot picker in the editor. */
export function treatmentCategoryOptions() {
  return Object.entries(TREATMENT_CATEGORIES).map(([key, v]) => ({
    key,
    label: v.label,
    color: v.color,
  }))
}

/** Estimated annual total for a set of rows: planned_count × est_cost. */
export function planTotal(rows = []) {
  return rows.reduce((sum, r) => {
    const cost = Number(r.est_cost)
    if (!cost || Number.isNaN(cost)) return sum
    const n = Number(r.planned_count) || 1
    return sum + cost * n
  }, 0)
}

/**
 * Persist an edited plan for one year: delete removed rows, insert new, update
 * the rest. Blank-title rows are dropped. One refetch happens in the caller.
 */
export async function savePlan(year, draft = [], original = []) {
  const patientId = await myPatientId()

  const cleaned = draft
    .map((d, idx) => ({ ...d, display_order: idx }))
    .filter((d) => (d.title || '').trim() !== '')

  const keptIds = new Set(cleaned.filter((d) => d.id).map((d) => d.id))

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

  for (const d of cleaned) {
    const row = {
      plan_year: year,
      kind: 'treatment',
      category: d.category || 'other',
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
