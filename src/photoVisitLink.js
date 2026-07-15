/**
 * visitPhotos.js
 *
 * Attaching / detaching a photo to a visit. Both are UPDATEs on photos.visit_id.
 *
 * ⚠️ WHY THESE CHECK THE RETURNED ROWS
 *
 * A Postgres UPDATE that matches no rows — because an RLS policy rejected it —
 * is NOT an error. PostgREST returns success with zero rows affected. So
 * `if (error)` alone would report a cheerful success while nothing happened.
 * This exact trap has bitten this project twice (the photos/products delete in
 * Chunk 5, and the visit delete in July 2026, where the button silently did
 * nothing for want of a DELETE policy).
 *
 * So: always `.select('id')` and treat an empty result as a failure. That's what
 * turns "attach to another patient's visit", which RLS refuses via WITH CHECK,
 * into an honest error message instead of a lie.
 *
 * The ownership rule itself lives in the database, not here — see
 * db/add_visit_photos.sql. The policy's WITH CHECK clause rejects any visit_id
 * that isn't one of the caller's own visits, so a hostile client calling this
 * with someone else's visit id gets zero rows back, and we surface that.
 */

import { supabase } from './supabaseClient'

/** Attach a photo to a visit. Throws with a patient-readable message on failure. */
export async function attachPhotoToVisit(photoId, visitId) {
  const { data, error } = await supabase
    .from('photos')
    .update({ visit_id: visitId })
    .eq('id', photoId)
    .select('id')

  if (error) throw new Error(error.message || 'Could not attach this photo.')

  // Zero rows = RLS refused it (not our photo, or not our visit). Not an error
  // from PostgREST's point of view, so we have to catch it ourselves.
  if (!data || data.length === 0) {
    throw new Error(
      'Could not attach this photo to that visit. Please tell Tondo if this keeps happening.'
    )
  }
  return data[0]
}

/**
 * Detach a photo from its visit. The photo STAYS in the archive — it just loses
 * its badge. Detaching never deletes anything.
 */
export async function detachPhotoFromVisit(photoId) {
  const { data, error } = await supabase
    .from('photos')
    .update({ visit_id: null })
    .eq('id', photoId)
    .select('id')

  if (error) throw new Error(error.message || 'Could not detach this photo.')

  if (!data || data.length === 0) {
    throw new Error('Could not detach this photo. Please tell Tondo if this keeps happening.')
  }
  return data[0]
}
