/**
 * VisitCard
 *
 * A single visit row in the timeline. Shows the date, provider, list of
 * treatments with their colors + summaries + doses, and optional cost.
 *
 * Tapping the card will eventually open the detail modal (built in Step 4).
 * For now, tapping shows an alert.
 *
 * Props:
 *   visit: a visit object from data.visits, with nested treatments.
 *     treatments[].treatment_areas are NOT shown in the card (they're
 *     shown in the detail modal via the face diagram).
 */
function VisitCard({ visit }) {
  function handleClick() {
    alert(`Visit detail (face diagram + areas) comes in Step 4.`)
  }

  // Format the date nicely: "April 24, 2026"
  const visitDateFormatted = new Date(visit.visit_date + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Currency format the cost if present (e.g., 2500.00 → "$2,500")
  const costFormatted = visit.cost != null
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(visit.cost)
    : null

  return (
    <button type="button" onClick={handleClick} className="visit-card">
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
