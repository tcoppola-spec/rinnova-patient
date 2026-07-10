/**
 * faceCoordinates.js
 *
 * Lookup table that maps a treatment area's friendly_name to an (x, y)
 * position on Rinnova's face SVG. The AI parser (parse-visit.js) does NOT
 * return coordinates — it doesn't know our SVG geometry — so when we save a
 * parsed visit we look each area up here to place its dot.
 *
 * COORDINATE SYSTEM (see faceGeometry.js — the shared source of truth):
 *   - viewBox is 0 0 231.2 324.1
 *   - the axis of symmetry is x = 114.9 (NOT the viewBox centre, 115.6)
 *   - For a bilateral (mirror = true) area we store the LEFT-side point
 *     (x < 114.9). FaceDiagram reflects it to (229.8 - x) automatically, so we
 *     store ONE coordinate per area regardless of mirror.
 *   - "mirror" itself is NOT stored here — it comes from the parsed data.
 *
 * MATCHING:
 *   Keys are normalized (lowercase, apostrophes/punctuation stripped, spaces
 *   collapsed) so "Crow's Feet", "crows feet", and "Crows  Feet" all resolve
 *   to the same entry. Add aliases as new friendly_names surface.
 *
 * HOW THESE VALUES WERE DERIVED
 *   These were the 200x260 coordinates of the old face diagram, mapped onto the
 *   new illustration by an affine fitted to two landmarks — the iris centres and
 *   the mouth centre, both of which are independent of line weight:
 *
 *       x' = 114.9 + (x - 100) * 1.6812
 *       y' = 1.3093 * y + 4.805
 *
 *   Out of sample it predicts the brow centre to within 1.0 unit. Three entries
 *   then needed a hand correction, marked below. The same transform + the same
 *   corrections were applied to the existing database rows — see
 *   db/migrate_face_coordinates.sql.
 *
 * COVERAGE:
 *   treatment_areas.x / .y are NOT NULL, so an area with no match still needs
 *   a coordinate. getCoordinates() returns null on a miss and saveVisit falls
 *   back to DEFAULT_COORDINATE (face centre) and logs a warning — that warning
 *   is the signal to add the missing friendly_name here.
 */

// Fallback for an unmatched area (x/y are NOT NULL, so we can't skip). Roughly
// face-centre so a stray dot lands somewhere sane rather than off-diagram.
export const DEFAULT_COORDINATE = { x: 114.9, y: 175 }

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
  // --- Canonical: the areas from Tracy's April 24, 2026 visit ---
  'between the brows': { x: 114.9, y: 100.4 },
  'forehead': { x: 114.9, y: 83.4 },
  'brows': { x: 74.6, y: 112.2 },
  // Corrected by hand: the stored value sat between the iris and the eye corner,
  // which read as "on the pupil" once the new art drew an actual iris. This sits
  // on the outer canthus (measured at x=50.7), fanning laterally — crow's feet.
  'around the eyes': { x: 46.7, y: 148.5 },
  'sides of nose': { x: 114.9, y: 155.4 },
  'corners of mouth': { x: 88.0, y: 224.8 },
  'chin': { x: 114.9, y: 251.0 },
  'upper neck': { x: 114.9, y: 286.3 },
  'cheekbones': { x: 47.7, y: 173.7 },
  'lower cheeks': { x: 57.7, y: 205.1 },
  // Nudged +7.3 medially: the affine position spilled past the silhouette and
  // clipped the ear (the old face had neither ears nor a thick outline).
  'outer cheeks': { x: 38.1, y: 192.0 },
  // Nudged +6.5 medially: the affine position hung off the jaw where it narrows.
  // Still overlaps the jaw line, as a jawline dot should.
  'jawline corners': { x: 60.9, y: 235.2 },
  'lips': { x: 114.9, y: 220.8 },

  // --- Aliases: common phrasings the AI may emit for the same spots ---
  'glabella': { x: 114.9, y: 100.4 },
  'frown lines': { x: 114.9, y: 100.4 },
  'brow': { x: 74.6, y: 112.2 },
  'brow lift': { x: 74.6, y: 112.2 },
  'crows feet': { x: 46.7, y: 148.5 },   // same anatomy as "around the eyes"
  'around the mouth': { x: 88.0, y: 224.8 },
  'bunny lines': { x: 101.5, y: 159.3 },
  'cheek': { x: 47.7, y: 173.7 },
  'cheeks': { x: 47.7, y: 173.7 },
  'jawline': { x: 60.9, y: 235.2 },
  'jaw': { x: 60.9, y: 235.2 },
  'neck': { x: 114.9, y: 286.3 },
  'lip': { x: 114.9, y: 220.8 },
  'upper lip': { x: 114.9, y: 215.6 },
  'lower lip': { x: 114.9, y: 226.1 },
  'nose': { x: 114.9, y: 155.4 },
  'temples': { x: 30.8, y: 135.7 },
  'temple': { x: 30.8, y: 135.7 },
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
