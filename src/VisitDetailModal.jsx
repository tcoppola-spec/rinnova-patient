import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import FaceDiagram from './FaceDiagram'
import VisitPhotos from './VisitPhotos'

/**
 * VisitDetailModal
 *
 * Props:
 *   visit      — the visit, with nested treatments -> treatment_areas
 *   photos     — ALL the patient's photos (this component picks out the ones
 *                attached to this visit, and offers the rest for attaching)
 *   onClose    — dismiss the sheet
 *   onDeleted  — called after a successful delete, so App can refetch and close
 *   onRefetch  — called after a photo is added / attached / detached
 *   onToast    — brief confirmation pill, passed through to VisitPhotos
 */
function VisitDetailModal({ visit, photos = [], onClose, onDeleted, onRefetch, onToast }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape' && !deleting) onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose, deleting])

  /**
   * Deleting the visit cascades to its treatments and treatment_areas (both FKs
   * are ON DELETE CASCADE), so this one row removes the whole record. It relies
   * on the DELETE policy added by db/allow_visit_delete.sql — without it the
   * delete would silently affect zero rows and report success, so we check the
   * returned rows rather than trusting the absence of an error.
   */
  async function handleDelete() {
    setDeleteError(null)
    setDeleting(true)

    const { data, error } = await supabase
      .from('visits')
      .delete()
      .eq('id', visit.id)
      .select('id')

    if (error) {
      setDeleting(false)
      setDeleteError(error.message || 'Could not delete this visit.')
      return
    }

    // A missing DELETE policy doesn't error — it just deletes nothing. Catch
    // that here instead of telling the patient it worked when it didn't.
    if (!data || data.length === 0) {
      setDeleting(false)
      setDeleteError(
        'Nothing was deleted. The delete permission may be missing — please tell Tondo.'
      )
      return
    }

    if (onDeleted) onDeleted()
  }

  if (!visit) return null

  const visitDateFormatted = new Date(visit.visit_date + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const costFormatted = visit.cost != null
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(visit.cost)
    : null

  const treatments = [...(visit.treatments || [])].sort(
    (a, b) => (a.display_order || 0) - (b.display_order || 0)
  )

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="Visit details">
        <div className="modal-handle" />

        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="modal-body">
          <header className="modal-header">
            <h2 className="modal-date">{visitDateFormatted}</h2>
            {visit.provider_name && (
              <p className="modal-provider">with {visit.provider_name}</p>
            )}
          </header>

          <FaceDiagram treatments={treatments} />

          <div className="modal-treatments">
            {treatments.map((treatment) => {
              const areas = [...(treatment.treatment_areas || [])].sort(
                (a, b) => (a.display_order || 0) - (b.display_order || 0)
              )

              return (
                <div key={treatment.id} className="modal-treatment">
                  <div className="modal-treatment-head">
                    <span className={`treatment-dot treatment-dot-${treatment.color_key}`} aria-hidden="true" />
                    <div className="modal-treatment-titles">
                      <div className="modal-treatment-name">{treatment.name}</div>
                      {treatment.summary && (
                        <div className="modal-treatment-summary">{treatment.summary}</div>
                      )}
                      {treatment.total_dose && (
                        <div className="modal-treatment-dose">{treatment.total_dose}</div>
                      )}
                    </div>
                  </div>

                  {areas.length > 0 && (
                    <ul className="modal-areas">
                      {areas.map((area) => (
                        <li key={area.id} className="modal-area">
                          <div className="modal-area-name">
                            {area.friendly_name}
                            {area.mirror && (
                              <span className="modal-area-mirror" aria-label="both sides">
                                {' '}· both sides
                              </span>
                            )}
                          </div>
                          {(area.clinical_name || area.dose) && (
                            <div className="modal-area-meta">
                              {area.clinical_name && (
                                <span className="modal-area-clinical">{area.clinical_name}</span>
                              )}
                              {area.clinical_name && area.dose && (
                                <span className="modal-area-sep"> · </span>
                              )}
                              {area.dose && (
                                <span className="modal-area-dose">{area.dose}</span>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>

          <VisitPhotos
            visitId={visit.id}
            photos={photos}
            onRefetch={onRefetch}
            onToast={onToast}
          />

          {/* Cost shows only when it's been added. When empty, nothing here —
              cost is added from the visit list, not this read-only view. */}
          {costFormatted && (
            <footer className="modal-footer">
              <div className="modal-cost-row">
                <span className="modal-cost-label">Total cost</span>
                <span className="modal-cost-value">{costFormatted}</span>
              </div>
            </footer>
          )}

          <div className="lightbox-actions">
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => { setDeleteError(null); setConfirmingDelete(true) }}
                className="lightbox-delete-btn"
              >
                Delete visit
              </button>
            ) : (
              <div className="lightbox-confirm-row">
                {/* Say what actually gets destroyed — this cascades to every
                    treatment and every dot on the face map, and it can't be
                    undone. */}
                <span className="lightbox-confirm-text">
                  Delete this visit and its {treatments.length}{' '}
                  {treatments.length === 1 ? 'treatment' : 'treatments'}? This
                  can’t be undone.
                </span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="product-confirm-yes"
                >
                  {deleting ? '…' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="product-confirm-no"
                >
                  Cancel
                </button>
              </div>
            )}
            {deleteError && (
              <div className="form-error" style={{ marginTop: 8 }}>{deleteError}</div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default VisitDetailModal
