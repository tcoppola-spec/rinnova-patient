/**
 * faceCoordinates.js
 *
 * Maps a treatment area's friendly_name to an (x, y) position on Rinnova's face
 * SVG. The AI parser doesn't know our SVG geometry, so coordinates are resolved
 * here at save time.
 *
 * COORDINATE SYSTEM (see faceGeometry.js — the shared source of truth):
 *   - viewBox 0 0 231.2 324.1
 *   - axis of symmetry x = 114.9 (NOT the viewBox centre, 115.6)
 *   - For a bilateral (mirror = true) area we store the LEFT-side point
 *     (x < 114.9). FaceDiagram reflects it to (229.8 - x). So we store ONE
 *     coordinate per area regardless of laterality.
 *   - "mirror" is NOT stored here — it comes from the parsed data.
 *
 * ⚠️ THE INVARIANT THAT MATTERS
 *   A bilateral area MUST have an off-axis x. A coordinate at x = 114.9 is the
 *   FIXED POINT of the mirror (229.8 - 114.9 = 114.9), so both of its dots land
 *   on the same pixel and render as one. Any midline coordinate is by definition
 *   NOT bilateral. `assertPlacement()` below enforces this — it is what caught
 *   the tear-trough bug, where an unmatched region fell back to face-centre and
 *   silently drew a single dot on the bridge of the nose.
 *
 * ⚠️ THERE IS NO FALLBACK COORDINATE, ON PURPOSE
 *   An injection always has a location. If we can't place one, that is a GAP IN
 *   THIS TABLE, not a licence to invent a position — a plausible-looking dot in
 *   the wrong place silently falsifies a medical record, which is worse than no
 *   dot at all. getCoordinates() returns null, saveVisit stores x/y as NULL, the
 *   dot is omitted, and the patient is told which region we couldn't map. Then
 *   we add it here. (Null also gives us non-injectables — a laser or peel has no
 *   discrete point — for free.)
 */

import { MIRROR_AXIS } from './faceGeometry'

// Normalize a friendly_name into a lookup key.
// Parenthetical qualifiers are dropped first: the AI writes things like
// "Tear trough (undereyes)", which must resolve to "tear trough".
function normalizeKey(name) {
  if (!name || typeof name !== 'string') return ''
  return name
    .replace(/\([^)]*\)/g, ' ')  // drop "(undereyes)", "(glabella)", ...
    .toLowerCase()
    .replace(/['’`]/g, '')       // "crow's" -> "crows"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// Crude singularisation, enough for anatomy: "tear troughs" -> "tear trough".
const singular = (word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)
const tokens = (key) => key.split(' ').filter(Boolean).map(singular)

const COORDINATES = {
  // --- Upper face ---
  'forehead': { x: 114.9, y: 83.4 },
  'forehead lines': { x: 114.9, y: 83.4 },
  'between the brows': { x: 114.9, y: 100.4 },
  'glabella': { x: 114.9, y: 100.4 },
  'frown lines': { x: 114.9, y: 100.4 },
  'elevens': { x: 114.9, y: 100.4 },
  'brows': { x: 74.6, y: 112.2 },
  'brow': { x: 74.6, y: 112.2 },
  'brow lift': { x: 74.6, y: 112.2 },
  'temples': { x: 30.8, y: 135.7 },
  'temple': { x: 30.8, y: 135.7 },

  // --- Eye region ---
  // Outer corner, fanning laterally.
  'around the eyes': { x: 46.7, y: 148.5 },
  'crows feet': { x: 46.7, y: 148.5 },
  'lateral canthus': { x: 46.7, y: 148.5 },
  'orbicularis oculi': { x: 46.7, y: 148.5 },
  // "Periorbital" = around the orbit, i.e. this region — NOT the tear trough
  // below it. A clinical note pairing them ("Periorbitals/Infraorbital") used to
  // match only on the infraorbital half and place the dot under the eye.
  'periorbital': { x: 46.7, y: 148.5 },
  'periorbitals': { x: 46.7, y: 148.5 },
  // Hollow under the inner half of the lower lid. Measured against the artwork:
  // lower lid sits at y=159.5, iris centre x=74.6, inner canthus x=96.4.
  'tear trough': { x: 84, y: 168 },
  'under eye': { x: 84, y: 168 },
  'under eyes': { x: 84, y: 168 },
  'undereye': { x: 84, y: 168 },
  'undereyes': { x: 84, y: 168 },
  'under eye hollows': { x: 84, y: 168 },
  'infraorbital': { x: 84, y: 168 },
  'infraorbital hollow': { x: 84, y: 168 },

  // --- Nose ---
  'sides of nose': { x: 114.9, y: 155.4 },
  'nose': { x: 114.9, y: 155.4 },
  'nasalis': { x: 114.9, y: 155.4 },
  'bunny lines': { x: 101.5, y: 159.3 },
  'nose bridge': { x: 114.9, y: 140 },
  'nose tip': { x: 114.9, y: 196 },

  // --- Cheeks ---
  'cheekbones': { x: 47.7, y: 173.7 },
  'cheekbone': { x: 47.7, y: 173.7 },
  'cheeks': { x: 47.7, y: 173.7 },
  'cheek': { x: 47.7, y: 173.7 },
  'zygoma': { x: 47.7, y: 173.7 },
  'mid face': { x: 47.7, y: 173.7 },
  'lower cheeks': { x: 57.7, y: 205.1 },
  'buccal': { x: 57.7, y: 205.1 },
  'outer cheeks': { x: 38.1, y: 192.0 },
  'lateral cheeks': { x: 38.1, y: 192.0 },

  // --- Perioral ---
  'nasolabial folds': { x: 98, y: 210 },
  'nasolabial fold': { x: 98, y: 210 },
  'smile lines': { x: 98, y: 210 },
  'lips': { x: 114.9, y: 220.8 },
  'lip': { x: 114.9, y: 220.8 },
  'upper lip': { x: 114.9, y: 215.6 },
  'lower lip': { x: 114.9, y: 226.1 },
  'philtrum': { x: 114.9, y: 213 },
  'perioral': { x: 105, y: 214 },
  'smokers lines': { x: 105, y: 214 },
  'lip lines': { x: 105, y: 214 },
  'corners of mouth': { x: 88.0, y: 224.8 },
  'around the mouth': { x: 88.0, y: 224.8 },
  'dao': { x: 88.0, y: 224.8 },
  'marionette lines': { x: 90, y: 240 },
  'marionette': { x: 90, y: 240 },

  // --- Lower face / jaw ---
  'chin': { x: 114.9, y: 251.0 },
  'mentalis': { x: 114.9, y: 251.0 },
  'jawline corners': { x: 60.9, y: 235.2 },
  'jawline': { x: 60.9, y: 235.2 },
  'jaw': { x: 60.9, y: 235.2 },
  'mandibular angle': { x: 60.9, y: 235.2 },
  'masseter': { x: 58, y: 222 },

  // --- Neck ---
  'upper neck': { x: 114.9, y: 286.3 },
  'neck': { x: 114.9, y: 286.3 },
  'platysma': { x: 114.9, y: 286.3 },
}

// Pre-tokenise the table once.
const ENTRIES = Object.entries(COORDINATES).map(([key, coord]) => ({
  key,
  coord,
  toks: tokens(key),
}))

/**
 * getCoordinates(friendlyName) -> { x, y } | null
 *
 * Exact-string matching against free-text AI output is too brittle — the parser
 * writes "Tear trough (undereyes)", "Tear troughs", "Under-eye hollows" for the
 * same anatomy. So:
 *   1. normalize (parentheticals dropped, punctuation stripped)
 *   2. exact key match
 *   3. token-subset match: every token of a key appears in the input. The key
 *      with the MOST tokens wins, so "lower cheeks" beats "cheeks".
 *
 * Returns null when nothing matches. Null is a real answer — see the header.
 */
export function getCoordinates(friendlyName) {
  const key = normalizeKey(friendlyName)
  if (!key) return null

  if (COORDINATES[key]) return COORDINATES[key]

  const inputToks = tokens(key)
  let best = null
  for (const e of ENTRIES) {
    if (e.toks.every((t) => inputToks.includes(t))) {
      if (!best || e.toks.length > best.toks.length) best = e
    }
  }
  return best ? best.coord : null
}

/**
 * assertPlacement(coord, mirror, friendlyName) -> string | null
 *
 * Returns a problem description, or null if the placement is sound.
 *
 * The one invariant worth enforcing: a BILATERAL area cannot sit on the axis of
 * symmetry, because the mirror would map it onto itself and draw both dots at
 * the same point. This is exactly the failure that produced a single midline dot
 * for a bilateral tear trough.
 */
export function assertPlacement(coord, mirror, friendlyName) {
  if (!coord) return null
  if (mirror && Math.abs(coord.x - MIRROR_AXIS) < 0.5) {
    return `"${friendlyName}" is marked bilateral but resolves to x=${coord.x}, on the axis of symmetry (${MIRROR_AXIS}). Its two dots would land on the same point. The coordinate is wrong.`
  }
  return null
}

export { normalizeKey }
