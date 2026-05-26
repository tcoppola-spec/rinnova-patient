function VisitCard({ visit, onClick }) {
  const visitDate = new Date(visit.visit_date + 'T00:00:00')
  const monthShort = visitDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day = visitDate.getDate()
  const year = visitDate.getFullYear()
  const dateLine = monthShort + ' ' + day + ', ' + year

  const treatmentCount = (visit.treatments || []).length
  const countLabel = treatmentCount + ' treatment' + (treatmentCount !== 1 ? 's' : '')

  const providerCompact = formatProviderShort(visit.provider_name)

  return (
    <button type="button" onClick={onClick} className="visit-card">
      <div className="visit-card-date">{dateLine}</div>

      {visit.body_regions && (
        <div className="visit-card-regions">{visit.body_regions}</div>
      )}

      <div className="visit-card-meta">
        {countLabel}
        {providerCompact && (
          <> with {providerCompact}</>
        )}
      </div>

      <div className="visit-card-cta">
        View visit details <span aria-hidden="true">→</span>
      </div>
    </button>
  )
}

function formatProviderShort(name) {
  if (!name) return null

  let cleaned = name.replace(/,\s*(MD|DO|DDS|PA|NP|RN|MA|DMD|DPT|PharmD)\.?$/i, '').trim()

  const parts = cleaned.split(/\s+/)
  if (parts.length === 0) return name

  const hasDr = /^Dr\.?$/i.test(parts[0])
  const namesOnly = hasDr ? parts.slice(1) : parts

  if (namesOnly.length === 0) return name

  const particles = /^(del|van|de|la|von|du|le|st|saint)$/i
  let lastName
  if (namesOnly.length >= 2 && particles.test(namesOnly[namesOnly.length - 2])) {
    lastName = namesOnly.slice(-2).join(' ')
  } else {
    lastName = namesOnly[namesOnly.length - 1]
  }

  return hasDr ? 'Dr. ' + lastName : lastName
}

export default VisitCard
