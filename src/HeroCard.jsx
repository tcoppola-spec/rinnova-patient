/**
 * HeroCard
 *
 * The big gradient card near the top showing "It's been X days since your last visit"
 * with a tel: link to make an appointment.
 *
 * Props:
 *   lastVisitDate: string (ISO date) | null — the date of the most recent visit
 *   providerName: string — the provider's display name
 *   providerPhone: string — the provider's phone number for the tel: link
 */
function HeroCard({ lastVisitDate, providerName, providerPhone }) {
  // Calculate days since last visit
  const daysSince = lastVisitDate
    ? Math.floor((Date.now() - new Date(lastVisitDate).getTime()) / (1000 * 60 * 60 * 24))
    : null

  // Format phone for tel: link (strip non-digits, keep + if present)
  const telHref = providerPhone
    ? `tel:${providerPhone.replace(/[^\d+]/g, '')}`
    : null

  return (
    <section className="hero-card">
      <div className="hero-card-inner">
        {daysSince !== null ? (
          <>
            <h2 className="hero-card-headline">
              It's been {daysSince} day{daysSince !== 1 ? 's' : ''} since your last visit
            </h2>
            <p className="hero-card-subtext">
              {providerName ? `Your last visit with ${providerName}.` : 'Your most recent appointment.'}
            </p>
          </>
        ) : (
          <>
            <h2 className="hero-card-headline">Welcome to your record</h2>
            <p className="hero-card-subtext">
              Log your first visit to start building your aesthetic care history.
            </p>
          </>
        )}

        {telHref && (
          <a href={telHref} className="hero-card-cta">
            Make an appointment <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
    </section>
  )
}

export default HeroCard