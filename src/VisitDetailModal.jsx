import { useEffect } from 'react'
import FaceDiagram from './FaceDiagram'

function VisitDetailModal({ visit, onClose }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

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

          <footer className="modal-footer">
            {costFormatted ? (
              <div className="modal-cost-row">
                <span className="modal-cost-label">Total cost</span>
                <span className="modal-cost-value">{costFormatted}</span>
              </div>
            ) : (
              <div className="modal-cost-row modal-cost-row-empty">
                <span className="modal-cost-label">Total cost</span>
                <span className="modal-cost-empty">Not yet added</span>
              </div>
            )}
          </footer>
        </div>
      </div>
    </>
  )
}

export default VisitDetailModal
