/**
 * faceCoordinates.js
 *
 * Lookup table that maps a treatment area's friendly_name to an (x, y)
 * position on Rinnova's face SVG. The AI parser (parse-visit.js) does NOT
 * return coordinates — it doesn't know our SVG geometry — so when we save a
 * parsed visit we look each area up here to place its dot.
 *
 * COORDINATE SYSTEM (must match FaceDiagram.jsx):
 *   - viewBox is 0 0 200 260
 *   - center axis is x = 100
 *   - For a bilateral (mirror = true) area we store the LEFT-side point
 *     (x < 100). FaceDiagram reflects it to (200 - x) automatically, so we
 *     store ONE coordinate per area regardless of mirror.
 *   - "mirror" itself is NOT stored here — it comes from the parsed data.
 *
 * MATCHING:
 *   Keys are normalized (lowercase, apostrophes/punctuation stripped, spaces
 *   collapsed) so "Crow's Feet", "crows feet", and "Crows  Feet" all resolve
 *   to the same entry. Add aliases as new friendly_names surface.
 *
 * SEED:
 *   The canonical block below is the 17 areas from Tracy's April 24, 2026
 *   visit — the exact x/y already in the database, so new visits line up with
 *   the existing demo visit. The aliases block adds common phrasings the AI
 *   may emit that differ from Tracy's wording (e.g. "glabella", "crows feet").
 *
 * COVERAGE:
 *   treatment_areas.x / .y are NOT NULL, so an area with no match still needs
 *   a coordinate. getCoordinates() returns null on a miss and saveVisit falls
 *   back to DEFAULT_COORDINATE (face center) and logs a warning — that warning
 *   is the signal to add the missing friendly_name here.
 */

// Fallback for an unmatched area (x/y are NOT NULL, so we can't skip). Roughly
// face-center so a stray dot lands somewhere sane rather than off-diagram.
export const DEFAULT_COORDINATE = { x: 100, y: 130 }

// Normalize a friendly_name into a stable lookup key.
function normalizeKey(name) {
  if (!name || typeof name !== 'string') return ''
  return name
    .toLowerCase()
    .replace(/['’`]/g, '')       // drop apostrophes: "crow's" -> "crows"
    .replace(/[^a-z0-9]+/g, ' ') // any other punctuation -> space
    .trim()
    .replace(/\s+/g, ' ')        // collapse runs of whitespace
}

const COORDINATES = {
  // --- Canonical: Tracy's April 24, 2026 visit (exact DB values) ---
  'between the brows': { x: 100, y: 73 },
  'forehead': { x: 100, y: 60 },
  'brows': { x: 76, y: 82 },
  'around the eyes': { x: 70, y: 110 },
  'sides of nose': { x: 100, y: 115 },
  'corners of mouth': { x: 84, y: 168 },
  'chin': { x: 100, y: 188 },
  'upper neck': { x: 100, y: 215 },
  'cheekbones': { x: 60, y: 129 },
  'lower cheeks': { x: 66, y: 153 },
  'outer cheeks': { x: 50, y: 143 },
  'jawline corners': { x: 64, y: 176 },
  'lips': { x: 100, y: 165 },

  // --- Aliases: common phrasings the AI may emit for the same spots ---
  'glabella': { x: 100, y: 73 },
  'frown lines': { x: 100, y: 73 },
  'brow': { x: 76, y: 82 },
  'brow lift': { x: 76, y: 82 },
  'crows feet': { x: 62, y: 112 },
  'around the mouth': { x: 84, y: 168 },
  'bunny lines': { x: 92, y: 118 },
  'cheek': { x: 60, y: 129 },
  'cheeks': { x: 60, y: 129 },
  'jawline': { x: 64, y: 176 },
  'jaw': { x: 64, y: 176 },
  'neck': { x: 100, y: 215 },
  'lip': { x: 100, y: 165 },
  'upper lip': { x: 100, y: 161 },
  'lower lip': { x: 100, y: 169 },
  'nose': { x: 100, y: 115 },
  'temples': { x: 50, y: 100 },
  'temple': { x: 50, y: 100 },
}

/**
 * getCoordinates(friendlyName) -> { x, y } | null
 *
 * Returns the seed coordinate for a friendly_name, or null if we don't have
 * one yet. saveVisit treats null as "use DEFAULT_COORDINATE and warn."
 */
export function getCoordinates(friendlyName) {
  const key = normalizeKey(friendlyName)
  return COORDINATES[key] || null
}

export { normalizeKey }
