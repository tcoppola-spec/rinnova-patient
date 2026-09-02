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

  // Newer injectables — each its own colour (the colour IS the clinical
  // category). Cool tones on purpose, so none can be mistaken for one of the
  // four warm injectables above. All 'point' — they're injected at a spot.
  biostimulator: { color: '#3E63A8', mark: 'point', label: 'Biostimulator' }, // Sculptra / PLLA — indigo
  kybella: { color: '#1668D9', mark: 'point', label: 'Fat dissolver' }, // Kybella — strong blue
  prp: { color: '#C79A2E', mark: 'point', label: 'PRP / PRF' }, // regenerative — gold
  threads: { color: '#566270', mark: 'point', label: 'Threads' }, // PDO threads — slate
  dissolver: { color: '#6B4E3D', mark: 'point', label: 'Dissolver' }, // hyaluronidase — brown

  // --- Non-injectables: a field, in new tones distinct from the injectables ---
  // Cool teal for energy devices (Ultherapy, RF, ultrasound) — reads as the
  // tightening / device side of the practice, unmistakable against the warm
  // four.
  energy: { color: '#2CA6A4', mark: 'field', label: 'Energy / ultrasound' },
  // LED / red-light therapy gets its own magenta-red — it literally IS red
  // light, so the halo reads as what it is. A field like the rest.
  light: { color: '#E5325F', mark: 'field', label: 'LED / light therapy' },
  // Rose for resurfacing (laser resurfacing, peels, microneedling). Shares the
  // warm-pink family with the injectables but only ever appears as a
  // translucent halo, never a solid dot, so it stays distinct from Radiesse
  // (magenta) and diluted Radiesse (coral).
  resurfacing: { color: '#E0739F', mark: 'field', label: 'Resurfacing' },

  // Neutral catch-all for anything administered we can't categorise (a body
  // treatment while body is parked, an unrecognised service). Muted grey so it
  // never masquerades as a category it isn't — silence over a wrong colour.
  // A FIELD, not a point: a non-injectable administered treatment covers an
  // area, so if it has a location it should read as a soft zone, never a
  // misleading pinpoint dot. (Body 'other' treatments carry no location, so
  // the mark type doesn't matter for them.)
  other: { color: '#8A8AA3', mark: 'field', label: 'Treatment' },
}

// A blank/unknown category resolves here, not to a real one. Grey, field.
const FALLBACK = { color: '#8A8AA3', mark: 'field', label: 'Treatment' }

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
