/**
 * patientProviders.js
 *
 * Write helpers for the patient's own provider contact list (name + phone),
 * shared by ProvidersSection and the HeroCard booking menu. See
 * docs/booking-providers-brief.md.
 *
 * Every mutation CHECKS THE RETURNED ROWS, not just the error: a missing RLS
 * policy fails silently (success, zero rows — CLAUDE.md §14), so an empty result
 * is surfaced as a real failure rather than a fake success.
 */

import { supabase } from './supabaseClient'

async function myPatientId() {
  const { data, error } = await supabase.from('patients').select('id').single()
  if (error || !data) throw new Error('Could not find your patient record')
  return data.id
}

// Clear any existing primary for this patient. Needed before setting a new
// primary because the DB enforces at-most-one-primary (partial unique index).
async function clearPrimaries(patientId) {
  const { error } = await supabase
    .from('patient_providers')
    .update({ is_primary: false })
    .eq('patient_id', patientId)
    .eq('is_primary', true)
  if (error) throw error
}

/**
 * Add a provider. makePrimary clears any existing primary first. Returns the new
 * row's id.
 */
export async function addProvider({ name, phone, makePrimary = false }) {
  const trimmedName = (name || '').trim()
  if (!trimmedName) throw new Error('A name is required')

  const patientId = await myPatientId()
  if (makePrimary) await clearPrimaries(patientId)

  const payload = {
    patient_id: patientId,
    name: trimmedName,
    phone: (phone || '').trim() || null,
    is_primary: !!makePrimary,
  }
  const { data, error } = await supabase
    .from('patient_providers')
    .insert(payload)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Nothing was saved — the permission may be missing. Please tell Tondo.')
  }
  return data[0].id
}

/** Make one provider the primary, clearing whichever was primary before. */
export async function setPrimary(id) {
  const patientId = await myPatientId()
  await clearPrimaries(patientId)
  const { data, error } = await supabase
    .from('patient_providers')
    .update({ is_primary: true })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Nothing changed — the permission may be missing.')
  }
}

/** Update a provider's name/phone. */
export async function updateProvider(id, { name, phone }) {
  const trimmedName = (name || '').trim()
  if (!trimmedName) throw new Error('A name is required')
  const { data, error } = await supabase
    .from('patient_providers')
    .update({ name: trimmedName, phone: (phone || '').trim() || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Nothing was saved — the permission may be missing.')
  }
}

/** Delete a provider. Past visits keep their provider_name (plain text). */
export async function deleteProvider(id) {
  const { data, error } = await supabase
    .from('patient_providers')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Nothing was deleted — the permission may be missing.')
  }
}
