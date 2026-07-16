import { useState } from 'react'
import { computeRenewals, formatMonths } from './renewals'

/**
 * HeroCard
 *
 * The gradient card near the top. Smart about renewals: it knows every
 * treatment and its date, crosses them with typical duration ranges
 * (src/renewals.js — deterministic, no AI), and leads with the most timely
 * insight:
 *
 *   worn/wearing  → "Your Xeomin may be wearing off" + typical range + elapsed
 *   all active    → "You're all set" + when the next one starts fading
 *   no data       → the original days-since / welcome states
 *
 * Copy rules: "typically" + ranges, never prescriptive — this is information
 * about the patient's own record, not medical advice.
 *
 * The CTA still books with the patient's own provider (single provider per
 * patient is a V1 decision — see docs/providers-and-invites-brief.md; the
 * provider-from-data upgrade lands with that brief).
 *
 * Props:
 *   visits: visits with nested treatments (renewals are computed from these)
 *   lastVisitDate: string (ISO date) | null — fallback headline
 *   providerName: string — the patient's provider display name
 *   providerPhone: string — provider phone for the tel: link
 */
function HeroCard({ visits = [], lastVisitDate, providerName, providerPhone }) {
  // Captured once per mount: keeps render pure (no Date.now() during render,
  // which is impure and was a long-standing lint error in this file). A page
  // lives for minutes; renewal math cares about months.
  const [now] = useState(() => Date.now())

  const renewals = computeRenewals(visits, now)
  const top = renewals[0] || null

  const daysSince = lastVisitDate
    ? Math.floor((now - new Date(lastVisitDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
    : null

  const telHref = providerPhone
    ? `tel:${providerPhone.replace(/[^\d+]/g, '')}`
    : null

  const fmtDate = (d) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  let headline
  let subtext

  if (top && top.status === 'worn') {
    headline = `Your ${top.name} has likely worn off`
    subtext = `It typically lasts ${top.min}–${top.max} months — yours was ${formatMonths(top.monthsAgo)} ago.`
  } else if (top && top.status === 'wearing') {
    headline = `Your ${top.name} may be wearing off`
    subtext = `It typically lasts ${top.min}–${top.max} months — yours was ${formatMonths(top.monthsAgo)} ago.`
  } else if (top) {
    // Everything still active — refresh-window voice (Tracy's pick): frames
    // the next date as an opening rather than a generic "all set".
    headline = 'Nothing’s due yet'
    subtext = `Your next refresh window opens around ${fmtDate(top.fadeStart)}, when your ${top.name} typically starts to fade.`
  } else if (daysSince !== null) {
    // Visits exist but nothing we can put a duration to.
    headline = `It's been ${daysSince} day${daysSince !== 1 ? 's' : ''} since your last visit`
    subtext = providerName
      ? `Your last visit with ${providerName}.`
      : 'Your most recent appointment.'
  } else {
    headline = 'Welcome to your record'
    subtext = 'Log your first visit to start building your aesthetic care history.'
  }

  return (
    <section className="hero-card">
      <div className="hero-card-inner">
        <h2 className="hero-card-headline">{headline}</h2>
        <p className="hero-card-subtext">{subtext}</p>

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
