import VisitCard from './VisitCard'

function VisitsTimeline({ visits, onVisitClick }) {
  if (!visits || visits.length === 0) {
    return (
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Your visits</h2>
        </div>
        <p className="empty-state">
          When you log a visit, it'll show up here.
        </p>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Your visits</h2>
        <span className="section-meta">
          {visits.length} total
        </span>
      </div>
      <div className="visits-list">
        {visits.map((visit) => (
          <VisitCard
            key={visit.id}
            visit={visit}
            onClick={() => onVisitClick(visit)}
          />
        ))}
      </div>
    </section>
  )
}

export default VisitsTimeline