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

// Field-treatment halo radius (energy, resurfacing). Much larger than a dot —
// it stands for a ZONE, not a point. Rendered as a soft radial that fades to
// transparent, so this is the outer reach of the glow, not a hard edge.
export const FIELD_RADIUS = 30

// A full-face treatment (most resurfacing, Ultherapy, LED) is drawn as one
// large halo over the centre of the face rather than a mark per region. Centre
// sits between the forehead (y≈83) and chin (y≈251); the radius reaches out to
// the cheeks and up to the brow without spilling far past the outline.
export const FULL_FACE = { x: MIRROR_AXIS, y: 168, radius: 92 }

// Region names that mean "the whole face". Used by FaceDiagram (draw one big
// halo) and saveVisit (place it, don't call it unplaced).
//
// ⚠️ Bare "face" is included ON PURPOSE, and it's safe only because BOTH callers
// gate this on the treatment being a FIELD treatment (energy / resurfacing /
// other). For an injectable (a point), "face" still resolves to nothing — the
// guard against a fabricated generic "Face" dot on a receipt, which was a real
// bug. A laser or LED "to the face", though, genuinely means the whole face.
export const FULL_FACE_NAMES = new Set(['full face', 'whole face', 'entire face', 'face'])

/** Reflect an x coordinate across the artwork's axis of symmetry. */
export function mirrorX(x) {
  return 2 * MIRROR_AXIS - x
}
