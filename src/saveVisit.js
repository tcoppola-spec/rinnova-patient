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
import { getCoordinates, assertPlacement } from './faceCoordinates'
import { MIRROR_AXIS } from './faceGeometry'

/**
 * Deterministic fan-out for the duplicate-dot bug.
 *
 * faceCoordinates maps each region to ONE point. So a visit with both Radiesse
 * and Diluted Radiesse at "Cheekbones" would place both dots on the identical
 * pixel — one completely hides the other, and the record looks like it's missing
 * a product. Tracy's April 24 visit only escapes this because its rows carry
 * hand-offsets that were typed in by hand back in Chunk 1.
 *
 * So the Nth product at the same region is nudged by a fixed delta. The deltas
 * mirror the hand-offsets already in the seed data ((+5,+2) in the old 200x260
 * space, which scales by the migration affine to roughly (+8.4, +2.6)).
 *
 * Direction matters, to preserve the laterality invariant:
 *   - bilateral: nudge medially + down. Stays off-axis, so it still mirrors into
 *     two distinct dots.
 *   - midline:   nudge DOWN ONLY. Moving x would push a midline area off the
 *     axis of symmetry, which is anatomically wrong.
 */
const FAN_BILATERAL = { x: 8.4, y: 2.6 }
const FAN_MIDLINE = { x: 0, y: 8 }

function fanOut(base, mirror, seenPerArea, friendlyName) {
  const key = friendlyName.toLowerCase().trim()
  const n = seenPerArea[key] || 0
  seenPerArea[key] = n + 1
  if (n === 0) return base

  const onAxis = Math.abs(base.x - MIRROR_AXIS) < 0.5
  const d = onAxis ? FAN_MIDLINE : FAN_BILATERAL
  return {
    x: +(base.x + n * d.x).toFixed(1),
    y: +(base.y + n * d.y).toFixed(1),
  }
}

export async function saveParsedVisit(parsed) {
  const visit = parsed?.visit || {}
  const treatments = Array.isArray(parsed?.treatments) ? parsed.treatments : []
  const areas = Array.isArray(parsed?.treatment_areas) ? parsed.treatment_areas : []
  // Take-home / retail items (serums, supplements). NOT injected, so they never
  // get a treatment_area or a face dot — they save to the products list.
  const products = Array.isArray(parsed?.products) ? parsed.products : []

  // Group areas under their treatment_name (the parser links them by name).
  // Skip any area with no friendly_name — that column is NOT NULL in the DB.
  const areasByTreatment = {}
  for (const area of areas) {
    if (!area?.friendly_name) continue
    const key = area.treatment_name || ''
    if (!areasByTreatment[key]) areasByTreatment[key] = []
    areasByTreatment[key].push(area)
  }

  // Regions we could not place. These are NOT given an invented coordinate —
  // see the header of faceCoordinates.js. They save with x/y NULL (no dot) and
  // are handed back so the UI can tell the patient, and so we know to add them.
  const unplaced = []

  // How many times we've already placed each region in THIS visit, so a second
  // product at the same area can be fanned out instead of stacked.
  const seenPerArea = {}

  // Build the nested treatments payload, resolving each area's coordinate.
  // Drop treatments with no name (that column is NOT NULL too).
  const payloadTreatments = treatments
    .filter((t) => t?.name)
    .map((t) => {
      const tAreas = (areasByTreatment[t.name] || []).map((a) => {
        let mirror = a.mirror === true

        // Place from the CLINICAL name when we have one, and only fall back to
        // the friendly name. Everyday speech is coarser than anatomy: "buccal"
        // and "lateral cheeks" are distinct sites that a patient calls
        // "cheeks" for both, so resolving from display wording silently
        // collapses them onto one point and the fan-out then scatters the dots
        // from a location neither of them is at. Clinical terms are exactly the
        // vocabulary this table is keyed on, so they place precisely.
        //
        // It also decouples the two jobs: friendly_name is for reading,
        // clinical_name is for placement. Rewording the patient-facing copy can
        // no longer move a dot. Receipts and guided-Q&A answers carry no
        // clinical_name, so they fall through to the friendly name as before.
        const base =
          getCoordinates(a.clinical_name) || getCoordinates(a.friendly_name)

        if (!base) {
          unplaced.push(a.friendly_name)
          return {
            friendly_name: a.friendly_name,
            clinical_name: a.clinical_name ?? null,
            dose: a.dose ?? null,
            mirror,
            x: null, // no invented dot — see faceCoordinates.js
            y: null,
          }
        }

        // Bilateral + on-axis is a contradiction: the mirror maps the point onto
        // itself, so both dots land on the same pixel. When it happens now, the
        // TABLE wins and we draw one honest dot.
        //
        // Why coerce rather than drop, and why that's safe here: `mirror` is the
        // parser's claim about anatomy ("a platysma is paired"), while `x` is our
        // claim about this illustration ("Rinnova draws the neck as one central
        // zone" — faceRegions.js says midline: true for Neck as well). On a
        // midline point the illustration is authoritative, and one dot is exactly
        // what the guided Q&A produces for the same region.
        //
        // This did NOT used to be safe. During the tear-trough bug an on-axis
        // coordinate meant "unmatched name fell back to face-centre" — invented,
        // so dropping it was right. There is no fallback any more (see
        // faceCoordinates.js), so reaching the axis now always means a curated
        // entry deliberately placed there. Dropping it would delete a real
        // treatment from the record to protect against a fabrication that can no
        // longer occur.
        const problem = assertPlacement(base, mirror, a.friendly_name)
        if (problem) {
          console.warn(
            `[saveVisit] ${problem} — this region is drawn on the midline, so it saves as a single dot.`
          )
          mirror = false
        }

        const coord = fanOut(base, mirror, seenPerArea, a.friendly_name)

        return {
          friendly_name: a.friendly_name,
          clinical_name: a.clinical_name ?? null,
          dose: a.dose ?? null,
          mirror,
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

  const payloadProducts = products
    .filter((p) => p?.name)
    .map((p) => ({ name: p.name, notes: p.notes ?? null }))

  const payload = {
    visit: {
      visit_date: visitDate,
      provider_name: visit.provider_name ?? null,
      body_regions: visit.body_regions ?? null,
      cost: visit.cost ?? null,
    },
    treatments: payloadTreatments,
    products: payloadProducts,
  }

  if (unplaced.length > 0) {
    // Loud on purpose. An injection always has a location, so an unplaced region
    // is a GAP IN faceCoordinates.js that we need to close — not a normal state.
    console.error(
      '[saveVisit] Could not place on the face map:',
      unplaced,
      '— saved with no dot. Add these regions to faceCoordinates.js.'
    )
  }

  // One atomic call. The function resolves patient_id and status server-side.
  const { data, error } = await supabase.rpc('save_parsed_visit', { payload })
  if (error) throw error

  // Returned so the UI can be honest about what happened:
  //   unplaced       — named regions we couldn't map (no dot)
  //   savedProducts  — count of take-home products filed
  //   mappedCount    — treatment dots actually placed
  //   hasTreatments  — were there injectables at all
  // A receipt with treatments but zero placed dots is the "no face map from this
  // receipt" case — the moment to nudge toward a clinical note / adding locations.
  const mappedCount = payloadTreatments.reduce(
    (n, t) => n + t.areas.filter((a) => a.x != null).length,
    0
  )
  return {
    visitId: data,
    usedToday,
    unplaced,
    savedProducts: payloadProducts.length,
    mappedCount,
    hasTreatments: payloadTreatments.length > 0,
  }
}
