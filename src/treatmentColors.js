/**
 * treatmentColors.js — the single source of truth for treatment categories.
 *
 * The colour, the mark type, and the display label for every category live
 * here and nowhere else. Before this, the colour map was copy-pasted into
 * FaceDiagram, AreaCadenceSection and AreaDetailModal, so adding a category
 * meant editing three files in lockstep or the face map and the cards would
 * disagree about what a colour means. The colour IS the clinical category, so
 * that drift is not cosmetic — it mislabels a medical record.
 *
 * Keep `color` in step with the CSS treatment-dot-* classes in App.css and the
 * design tokens in index.css. This file is the JS side (SVG fills, inline
 * styles); the CSS classes are the stylesheet side. They describe the same
 * colours.
 *
 * MARK TYPE — the rule the whole non-injectable feature turns on:
 *   'point' — injectables. A dot, because filler went to a specific spot.
 *   'field' — energy and resurfacing. A soft halo, because a laser covers a
 *             ZONE, and we usually do not even know its exact boundary. A dot
 *             would claim a precision that does not exist.
 * The treatment TYPE decides point-vs-field; the region decides WHERE. The same
 * "cheeks" is a dot for filler and a halo for a laser.
 */

export const TREATMENT_CATEGORIES = {
  // --- Injectables: a point, in the four locked brand colours ---
  xeomin: { color: '#7B2CBF', mark: 'point', label: 'Neurotoxin' }, // any tox
  radiesse: { color: '#D63384', mark: 'point', label: 'Radiesse' },
  'radiesse-light': { color: '#F06E89', mark: 'point', label: 'Diluted Radiesse' },
  rha: { color: '#FF8C42', mark: 'point', label: 'HA filler' }, // any HA filler

  // --- Non-injectables: a field, in new tones distinct from the injectables ---
  // Cool teal for energy (Ultherapy, RF, ultrasound) — reads as the device /
  // cooling side of the practice, and is unmistakable against the warm four.
  energy: { color: '#2CA6A4', mark: 'field', label: 'Energy / ultrasound' },
  // Rose for resurfacing (laser resurfacing, peels, microneedling). Shares the
  // warm-pink family with the injectables but only ever appears as a
  // translucent halo, never a solid dot, so it stays distinct from Radiesse
  // (magenta) and diluted Radiesse (coral).
  resurfacing: { color: '#E0739F', mark: 'field', label: 'Resurfacing' },

  // Neutral catch-all for anything administered we can't categorise (a body
  // treatment while body is parked, an unrecognised service). Muted grey so it
  // never masquerades as a category it isn't — silence over a wrong colour.
  other: { color: '#8A8AA3', mark: 'point', label: 'Treatment' },
}

// A blank/unknown category resolves here, not to a real one. Grey, point.
const FALLBACK = { color: '#8A8AA3', mark: 'point', label: 'Treatment' }

export function categoryOf(key) {
  return TREATMENT_CATEGORIES[key] || FALLBACK
}

export function categoryColor(key) {
  return categoryOf(key).color
}

/** 'point' (dot) or 'field' (halo). */
export function categoryMark(key) {
  return categoryOf(key).mark
}
