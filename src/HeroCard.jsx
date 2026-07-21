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
const MS_PER_DAY = 1000 * 60 * 60 * 24

// How far ahead the card starts talking about an upcoming refresh window.
// Aesthetic appointments are booked weeks out, so a window that opens "soon"
// is actionable well before it arrives — a month of runway lets the patient
// plan rather than discover it late. Tune here, alongside DURATIONS.
const OPENING_SOON_DAYS = 30

function daysSinceLabel(days) {
  if (days <= 0) return 'Your last visit was today'
  if (days === 1) return '1 day since your last visit'
  return `${days} days since your last visit`
}

// "in 3 days" reads oddly at the boundaries; say it the way a person would.
function relativeDay(days) {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 14) return `in ${days} days`
  const weeks = Math.round(days / 7)
  return `in about ${weeks} weeks`
}

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

  // Days until the soonest fade window opens (null unless everything's active).
  const daysUntilFade =
    top && top.status === 'active'
      ? Math.ceil((top.fadeStart.getTime() - now) / MS_PER_DAY)
      : null

  let headline
  let subtext
  // The fallback state puts the day count in the headline, so the meta line
  // below would repeat it.
  let headlineIsDaysSince = false

  if (top && top.status === 'worn') {
    headline = `Your ${top.name} has likely worn off`
    subtext = `It typically lasts ${top.min}–${top.max} months — yours was ${formatMonths(top.monthsAgo)} ago.`
  } else if (top && top.status === 'wearing') {
    headline = `Your ${top.name} may be wearing off`
    subtext = `It typically lasts ${top.min}–${top.max} months — yours was ${formatMonths(top.monthsAgo)} ago.`
  } else if (top && daysUntilFade !== null && daysUntilFade <= OPENING_SOON_DAYS) {
    // Still active, but the window opens shortly. Without this state the card
    // said "Nothing's due yet" three days before the refresh window opened —
    // technically true and practically useless, since appointments have to be
    // booked ahead. Same refresh-window voice, just early enough to act on.
    headline = `Your refresh window opens ${relativeDay(daysUntilFade)}`
    subtext = `Your ${top.name} typically starts to fade around ${fmtDate(top.fadeStart)} — worth planning ahead if you'd like to stay in front of it.`
  } else if (top) {
    // Everything still active — refresh-window voice (Tracy's pick): frames
    // the next date as an opening rather than a generic "all set".
    headline = 'Nothing’s due yet'
    subtext = `Your next refresh window opens around ${fmtDate(top.fadeStart)}, when your ${top.name} typically starts to fade.`
  } else if (daysSince !== null) {
    // Visits exist but nothing we can put a duration to.
    headlineIsDaysSince = true
    headline = `It's been ${daysSince} day${daysSince !== 1 ? 's' : ''} since your last visit`
    subtext = providerName
      ? `Your last visit with ${providerName}.`
      : 'Your most recent appointment.'
  } else {
    headline = 'Welcome to your aesthetic record'
    subtext = 'Log your first visit to start building your aesthetic care history.'
  }

  return (
    <section className="hero-card">
      <div className="hero-card-inner">
        <h2 className="hero-card-headline">{headline}</h2>
        <p className="hero-card-subtext">{subtext}</p>

        {/* Always present when there's a visit to count from — the renewal
            insight leads, but "how long has it been" is the thing patients
            check every time, and it shouldn't disappear just because we have
            something smarter to say. Deliberately NOT tied to the provider:
            it's a fact about the record, not about who performed it. Hidden
            only in the fallback state, where the headline already says it. */}
        {daysSince !== null && !headlineIsDaysSince && (
          <p className="hero-card-meta">{daysSinceLabel(daysSince)}</p>
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
