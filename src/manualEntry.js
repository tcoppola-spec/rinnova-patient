/**
 * manualEntry.js — the tap-only vocabulary for building a visit by hand.
 *
 * WHY THIS EXISTS: not everyone has a receipt, and a receipt has no locations
 * anyway. The most reliable source is often the injector themselves — so the
 * patient can hand over the phone (or be told what to tap) and build the visit
 * directly: what, where, how much. The whole point is NO TYPING — everything is
 * picked from these lists — so it stays fast enough to do at the chair.
 *
 * It feeds the SAME pipeline as the AI parser: the picks become a `parsed`-shaped
 * object (treatments + treatment_areas) and go through saveParsedVisit, so
 * coordinates, the duplicate fan-out and the bilateral invariant all apply
 * unchanged. Region labels come from FACE_REGIONS, so every pick resolves.
 *
 * `key` is the color_key (the clinical category — see treatmentColors.js). The
 * product names under each are the common brands; picking one sets `name`. The
 * only place typing is allowed is "Something else", for the rare unlisted item.
 */

export const PRODUCT_MENU = [
  {
    key: 'xeomin',
    label: 'Neurotoxin (tox)',
    products: ['Botox', 'Dysport', 'Xeomin', 'Jeuveau', 'Daxxify'],
  },
  {
    key: 'rha',
    label: 'HA filler',
    products: ['Juvéderm', 'Restylane', 'RHA', 'Revanesse Versa', 'Belotero', 'Skinvive'],
  },
  { key: 'radiesse', label: 'Radiesse', products: ['Radiesse'] },
  { key: 'biostimulator', label: 'Biostimulator (Sculptra)', products: ['Sculptra', 'Bellafill'] },
  { key: 'kybella', label: 'Fat dissolver (Kybella)', products: ['Kybella'] },
  { key: 'prp', label: 'PRP / PRF', products: ['PRP', 'PRF'] },
  { key: 'threads', label: 'PDO threads', products: ['PDO thread lift'] },
  {
    key: 'energy',
    label: 'Energy / ultrasound',
    products: ['Ultherapy', 'Morpheus8', 'RF microneedling', 'Thermage', 'Sofwave'],
  },
  {
    key: 'resurfacing',
    label: 'Laser / peel',
    products: ['Chemical peel', 'Microneedling', 'Fraxel', 'CO2 laser', 'Clear + Brilliant', 'Laser resurfacing'],
  },
  { key: 'light', label: 'LED / IPL / light', products: ['LED therapy', 'IPL / photofacial', 'BBL'] },
  // No product list: pick this and type the name. The one typing fallback.
  { key: 'other', label: 'Something else', products: [] },
]

/**
 * One-tap common treatments. Each pre-fills the builder with a category, a
 * default product and its regions — the "super user friendly" path the pilot
 * asked for (a Nefertiti lift or lip flip in a single tap). The region labels
 * MUST exist in FACE_REGIONS (so they resolve); `mirror` is applied to off-axis
 * regions in the component from each region's own midline flag, so we don't set
 * it here.
 */
export const PRESETS = [
  { label: 'Nefertiti lift', key: 'xeomin', product: 'Botox', regions: ['Jawline', 'Neck bands'] },
  { label: 'Neck bands', key: 'xeomin', product: 'Botox', regions: ['Neck bands'] },
  { label: 'Lip flip', key: 'xeomin', product: 'Botox', regions: ['Lips'] },
  { label: 'Jaw slimming', key: 'xeomin', product: 'Botox', regions: ['Masseter'] },
  { label: 'Forehead & 11s', key: 'xeomin', product: 'Botox', regions: ['Forehead', 'Between the brows'] },
]

// Dose is a NUMBER + a UNIT, not a fixed pick, because real dosing is specific
// (0.1 cc here, 0.4 cc there; 10 units; 2.7 cc total). Each category carries its
// unit(s) and a few quick-fill values; the amount is entered per spot so a visit
// can hold the per-area breakdown AND roll up to a total, the way clinical notes
// read. Fillers offer both cc and syringe because injectors use both.
//   units:  choices for the unit selector (first is the default)
//   quick:  common numeric values, tap to fill (still editable)
// Returns null for treatments that aren't dosed as a number (lasers, peels).
// `quick` is keyed by unit so the fast-fill values make sense for whichever unit
// is selected (10/20/30 for tox units; 0.1/0.5/1 when the same tox is charted in
// cc). Tox is usually units, but real notes DO record it in cc (dilute/microtox,
// and Roberta's own notes), so tox offers both — Rinnova captures what the record
// says rather than forcing a convention.
export function doseConfigFor(key) {
  switch (key) {
    case 'xeomin':
      return { units: ['units', 'cc'], quick: { units: ['10', '20', '30', '40'], cc: ['0.1', '0.5', '1'] } }
    case 'rha':
    case 'radiesse':
    case 'radiesse-light':
      return { units: ['cc', 'syringe'], quick: { cc: ['0.5', '1', '2'], syringe: ['0.5', '1', '2'] } }
    case 'biostimulator':
    case 'kybella':
      return { units: ['vial', 'cc'], quick: { vial: ['1', '2', '3'], cc: ['1', '2', '4'] } }
    case 'threads':
      return { units: ['threads'], quick: { threads: ['2', '4', '6'] } }
    default:
      return null // energy / resurfacing / light / other aren't dosed numerically
  }
}
