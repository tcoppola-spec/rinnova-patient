/**
 * faceGeometry.js
 *
 * The single source of truth for the face diagram's coordinate space.
 * Both FaceDiagram.jsx (which draws) and faceCoordinates.js (which places dots)
 * import from here, so the two can never drift apart.
 *
 * Measured from scripts/new-face.svg.
 */

// The face illustration's own viewBox.
export const VIEWBOX = { width: 231.2, height: 324.1 }

// The artwork's axis of symmetry. NOTE: this is NOT the viewBox centre (115.6) —
// the illustration is drawn 0.7 units off-centre. Mirroring across the viewBox
// centre would put every bilateral dot in the wrong place.
export const MIRROR_AXIS = 114.9

// The artwork's left half has an uneven outline (the crown swells from ~5.5 to
// ~9.0 units thick). The right half is uniform, so FaceDiagram clips to
// x >= CLIP_X and draws that half twice — once as-is, once mirrored. The clip
// starts slightly left of MIRROR_AXIS so the two halves overlap by ~1 unit and
// no antialiasing seam appears down the middle.
export const CLIP_X = 114.4

// Treatment dot radius. The old 200x260 diagram used r=4 against a 112-wide
// head; this head is 1.6812x wider, so 4 * 1.6812 keeps dots the same size
// relative to the face.
export const DOT_RADIUS = 6.7

/** Reflect an x coordinate across the artwork's axis of symmetry. */
export function mirrorX(x) {
  return 2 * MIRROR_AXIS - x
}
