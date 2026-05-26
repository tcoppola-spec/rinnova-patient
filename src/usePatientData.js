import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

/**
 * usePatientData
 *
 * Custom React hook that fetches the current patient's complete record
 * from Supabase — patient row, visits (with treatments and areas),
 * photos, products, subscriptions, and provider.
 *
 * Returns { data, loading, error, refetch } so components can render
 * loading states, error states, or the actual data.
 *
 * Relies on Row-Level Security policies (set up in Chunk 1) to ensure
 * the patient only ever sees their own data — we don't filter by ID
 * in the queries themselves, RLS does that for us.
 */
export function usePatientData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function fetchAll() {
    setLoading(true)
    setError(null)

    try {
      // 1. Fetch the patient row (RLS returns only the current user's row)
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('*, primary_provider:providers(*)')
        .single()

      if (patientError) throw patientError
      if (!patient) throw new Error('No patient record found for this user')

      // 2. Fetch all visits for this patient, with nested treatments + areas
      const { data: visits, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          provider:providers(*),
          treatments(
            *,
            treatment_areas(*)
          )
        `)
        .order('visit_date', { ascending: false })

      if (visitsError) throw visitsError

      // 3. Fetch photos
      const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .order('taken_date', { ascending: false, nullsFirst: false })

      if (photosError) throw photosError

      // 4. Fetch products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('added_at', { ascending: false })

      if (productsError) throw productsError

      // 5. Fetch subscriptions
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false })

      if (subscriptionsError) throw subscriptionsError

      setData({
        patient,
        visits: visits || [],
        photos: photos || [],
        products: products || [],
        subscriptions: subscriptions || [],
      })
    } catch (err) {
      console.error('Error fetching patient data:', err)
      setError(err.message || 'Failed to load your data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  return { data, loading, error, refetch: fetchAll }
}