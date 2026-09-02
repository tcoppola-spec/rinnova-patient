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
    products: ['Juvéderm', 'Restylane', 'RHA', 'Revanesse Versa', 'Belotero'],
  },
  { key: 'radiesse', label: 'Radiesse', products: ['Radiesse'] },
  { key: 'radiesse-light', label: 'Diluted Radiesse', products: ['Diluted Radiesse'] },
  {
    key: 'energy',
    label: 'Energy / ultrasound',
    products: ['Ultherapy', 'Morpheus8', 'RF microneedling'],
  },
  {
    key: 'resurfacing',
    label: 'Laser / peel',
    products: ['Laser resurfacing', 'Chemical peel', 'Microneedling'],
  },
  { key: 'light', label: 'LED / light therapy', products: ['LED therapy'] },
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
  { label: 'Nefertiti lift', key: 'xeomin', product: 'Botox', regions: ['Jawline', 'Neck'] },
  { label: 'Lip flip', key: 'xeomin', product: 'Botox', regions: ['Lips'] },
  { label: 'Jaw slimming', key: 'xeomin', product: 'Botox', regions: ['Masseter'] },
  { label: 'Forehead & 11s', key: 'xeomin', product: 'Botox', regions: ['Forehead', 'Between the brows'] },
]

// Amount presets. Injectables carry a real unit patients recognise; everything
// else is a session. '' means "don't record an amount" (dose stays null — we
// never force a guessed number).
const TOX_AMOUNTS = ['', '10 units', '20 units', '30 units', '40 units', '50+ units']
const FILLER_AMOUNTS = ['', '½ syringe', '1 syringe', '1½ syringes', '2 syringes', '3+ syringes']
const SESSION_AMOUNTS = ['', '1 session']

export function amountOptionsFor(key) {
  if (key === 'xeomin') return TOX_AMOUNTS
  if (key === 'rha' || key === 'radiesse' || key === 'radiesse-light') return FILLER_AMOUNTS
  return SESSION_AMOUNTS
}
