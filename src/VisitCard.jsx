/**
 * VisitCard
 *
 * A single visit row in the timeline. Tapping calls onClick prop —
 * the parent decides what to do (typically open the detail modal).
 *
 * Props:
 *   visit: a visit object with nested treatments
 *   onClick: function to call when the card is tapped
 */
function VisitCard({ visit, onClick }) {
  // Format the date nicely: "April 24, 2026"
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

  return (
    <button type="button" onClick={onClick} className="visit-card">
      <div className="visit-card-head">
        <div className="visit-card-date">{visitDateFormatted}</div>
        {visit.provider_name && (
          <div className="visit-card-provider">with {visit.provider_name}</div>
        )}
      </div>

      <div className="visit-card-treatments">
        {(visit.treatments || []).map((t) => (
          <div key={t.id} className="treatment-row">
            <span
              className={`treatment-dot treatment-dot-${t.color_key}`}
              aria-hidden="true"
            />
            <div className="treatment-row-text">
              <div className="treatment-row-name">{t.name}</div>
              {t.summary && (
                <div className="treatment-row-summary">{t.summary}</div>
              )}
              {t.total_dose && (
                <div className="treatment-row-dose">{t.total_dose}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="visit-card-foot">
        {costFormatted ? (
          <span className="visit-card-cost">{costFormatted}</span>
        ) : (
          <span className="visit-card-cost visit-card-cost-empty">Add cost</span>
        )}
        <span className="visit-card-chevron" aria-hidden="true">›</span>
      </div>
    </button>
  )
}

export default VisitCard