/**
 * saveVisit.js
 *
 * Takes the read-only object the AI parser returns (parse-visit.js) and writes
 * it to Supabase as a real visit + treatments + treatment_areas.
 *
 * The actual multi-table write happens inside a single Postgres function,
 * `save_parsed_visit(payload jsonb)`, so all three inserts commit together or
 * not at all — a visit can never be left half-written. This module's job is to
 * shape the parsed data into that function's payload: group areas under their
 * treatment, resolve each area's face-diagram coordinate, and fill required
 * fields the AI may have left blank.
 *
 * Payload shape sent to the RPC:
 *   {
 *     visit: { visit_date, provider_name, body_regions, cost },
 *     treatments: [
 *       { name, summary, total_dose, color_key,
 *         areas: [ { friendly_name, clinical_name, dose, mirror, x, y } ] }
 *     ]
 *   }
 *
 * Returns { visitId, usedToday, missingCoords } on success, throws on failure.
 */

import { supabase } from './supabaseClient'
import { getCoordinates, DEFAULT_COORDINATE } from './faceCoordinates'

export async function saveParsedVisit(parsed) {
  const visit = parsed?.visit || {}
  const treatments = Array.isArray(parsed?.treatments) ? parsed.treatments : []
  const areas = Array.isArray(parsed?.treatment_areas) ? parsed.treatment_areas : []

  // Group areas under their treatment_name (the parser links them by name).
  // Skip any area with no friendly_name — that column is NOT NULL in the DB.
  const areasByTreatment = {}
  for (const area of areas) {
    if (!area?.friendly_name) continue
    const key = area.treatment_name || ''
    if (!areasByTreatment[key]) areasByTreatment[key] = []
    areasByTreatment[key].push(area)
  }

  // Any friendly_name we couldn't place — surfaced back to the caller and
  // logged, so we know to add it to faceCoordinates.js.
  const missingCoords = []

  // Build the nested treatments payload, resolving each area's coordinate.
  // Drop treatments with no name (that column is NOT NULL too).
  const payloadTreatments = treatments
    .filter((t) => t?.name)
    .map((t) => {
      const tAreas = (areasByTreatment[t.name] || []).map((a) => {
        let coord = getCoordinates(a.friendly_name)
        if (!coord) {
          missingCoords.push(a.friendly_name)
          coord = DEFAULT_COORDINATE
        }
        return {
          friendly_name: a.friendly_name,
          clinical_name: a.clinical_name ?? null,
          dose: a.dose ?? null,
          mirror: a.mirror === true,
          x: coord.x,
          y: coord.y,
        }
      })
      return {
        name: t.name,
        summary: t.summary ?? null,
        total_dose: t.total_dose ?? null,
        // color_key is NOT NULL; fall back to a valid key if the AI left it out.
        color_key: t.color_key || 'xeomin',
        areas: tAreas,
      }
    })

  // visit_date is NOT NULL. If the AI couldn't find one, use today's date and
  // tell the caller so the UI can be transparent about it.
  let usedToday = false
  let visitDate = visit.visit_date
  if (!visitDate) {
    visitDate = new Date().toISOString().slice(0, 10)
    usedToday = true
  }

  const payload = {
    visit: {
      visit_date: visitDate,
      provider_name: visit.provider_name ?? null,
      body_regions: visit.body_regions ?? null,
      cost: visit.cost ?? null,
    },
    treatments: payloadTreatments,
  }

  if (missingCoords.length > 0) {
    console.warn(
      '[saveVisit] No face coordinates for:',
      missingCoords,
      '— placed at center. Add them to faceCoordinates.js.'
    )
  }

  // One atomic call. The function resolves patient_id and status server-side.
  const { data, error } = await supabase.rpc('save_parsed_visit', { payload })
  if (error) throw error

  return { visitId: data, usedToday, missingCoords }
}
