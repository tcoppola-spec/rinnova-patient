/**
 * faceRegions.js
 *
 * The UNIVERSAL region list for the guided area Q&A — the choices a patient
 * picks from when a document (usually a receipt) names a treatment but not
 * where it went.
 *
 * WHY A FIXED LIST: this inverts the hard problem. Free text from the AI (or
 * the patient) has to be fuzzy-matched onto our coordinate vocabulary, and a
 * miss becomes an unmapped region. Here the patient picks FROM our vocabulary,
 * so every answer is guaranteed to resolve to a real face coordinate — no
 * matching, no fabrication, nothing to interpret.
 *
 * Every `label` below MUST resolve through getCoordinates(). There's a check
 * for this — run scripts/check-face-regions (or the dry-run in the session
 * notes) after editing either this file or faceCoordinates.js.
 *
 * `midline` mirrors the coordinate space: midline regions sit ON the axis of
 * symmetry (x = 114.9) and are never bilateral (mirror must stay false — a
 * bilateral midline area is the contradiction assertPlacement() rejects).
 * Off-axis regions default to "both sides" in the UI because that's the
 * overwhelmingly common pattern for tox and filler, but the patient can flip
 * any of them to one side.
 *
 * Deliberately NOT product-aware (tox sites vs filler sites): a universal list
 * can't be anatomically wrong, and people do get tox in the masseter and filler
 * in the temples. Ordered top-of-face to bottom so the list reads like a face.
 */

export const FACE_REGIONS = [
  { label: 'Forehead', midline: true },
  { label: 'Between the brows', midline: true },
  { label: 'Brows', midline: false },
  { label: 'Around the eyes', midline: false },
  { label: 'Under the eyes', midline: false },
  { label: 'Temples', midline: false },
  { label: 'Cheeks', midline: false },
  { label: 'Nose', midline: true },
  { label: 'Smile lines', midline: false },
  { label: 'Lips', midline: true },
  { label: 'Around the mouth', midline: false },
  { label: 'Marionette lines', midline: false },
  { label: 'Chin', midline: true },
  { label: 'Jawline', midline: false },
  { label: 'Neck', midline: true },
]
