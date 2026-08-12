import { useState } from 'react'
import FaceDiagram from './FaceDiagram'
import { categoryColor } from './treatmentColors'
import { FIELD_RADIUS, FULL_FACE } from './faceGeometry'

/**
 * DesignSystem — the visual reference for Rinnova, at /design.
 *
 * The system was real but invisible: tokens in index.css, rules in CLAUDE.md
 * §8, patterns spread across components. Nothing showed them together, so drift
 * was only ever caught in a diff. This is the page to check a new screen
 * against.
 *
 * ⚠️ EVERY VALUE HERE IS READ LIVE from the document, via getComputedStyle on
 * :root — never retyped. A reference page with hardcoded swatches is worse than
 * none: it starts as documentation and quietly becomes fiction the first time a
 * token changes. Edit src/index.css and this page follows automatically.
 *
 * Components are rendered with their REAL class names for the same reason. A
 * bespoke approximation would drift; this shows what actually ships.
 *
 * Lazy-loaded in main.jsx, so none of it reaches the patient bundle.
 */

const TEXT_TOKENS = [
  ['--ink', 'Primary text, headings'],
  ['--body', 'Secondary text, paragraphs'],
  ['--muted', 'Tertiary text, captions, metadata'],
]

const SURFACE_TOKENS = [
  ['--cream', 'Page background'],
  ['--card', 'Card and sheet surfaces'],
  ['--line', 'Borders'],
  ['--line-soft', 'Subtle dividers, fills'],
]

const ACTION_TOKENS = [
  ['--magenta', 'THE action colour. Every button, link and destructive confirm.'],
  ['--magenta-soft', 'Action backgrounds'],
  ['--magenta-soft-2', 'Action hover backgrounds'],
]

// These are not decoration: the colour IS the clinical category, on the face
// map and on every card that references it. The first four are injectables,
// drawn as a DOT (a point). The last two are non-injectables, drawn as a HALO
// (a field) — see the point-vs-field comparison below.
const TREATMENT_TOKENS = [
  ['--purple', 'Neurotoxin', 'xeomin', 'Botox, Xeomin, Dysport, Jeuveau, Daxxify'],
  ['--magenta', 'Radiesse', 'radiesse', 'Full-strength biostimulator'],
  ['--coral', 'Diluted Radiesse', 'radiesse-light', 'Hyperdilute'],
  ['--orange', 'HA filler', 'rha', 'RHA, Restylane, Juvederm, Belotero'],
  ['--energy', 'Energy & light', 'energy', 'Ultherapy, RF, ultrasound, LED / red light — a field, not a point'],
  ['--resurfacing', 'Resurfacing', 'resurfacing', 'Laser resurfacing, peels, microneedling — a field'],
]

const OTHER_TOKENS = [
  ['--navy', 'Deep brand tone (rarely used directly)'],
  ['--face-line', 'Face illustration line art'],
]

// Illustrative marks for the point-vs-field comparison. Real coordinates from
// faceCoordinates, not a record — this is a design reference, not anyone's data.
const DEMO_DOTS = [
  { id: 'd1', x: 114.9, y: 100.4, color: categoryColor('xeomin') }, // glabella
  { id: 'd2', x: 74.6, y: 112.2, color: categoryColor('xeomin') },  // brow
  { id: 'd3', x: 155.2, y: 112.2, color: categoryColor('xeomin') }, // brow (mirror)
  { id: 'd4', x: 47.7, y: 173.7, color: categoryColor('radiesse') },// cheekbone
  { id: 'd5', x: 182.1, y: 173.7, color: categoryColor('radiesse') },
  { id: 'd6', x: 114.9, y: 220.8, color: categoryColor('rha') },    // lips
]
const DEMO_HALOS = [
  { id: 'h1', x: 47.7, y: 173.7, r: FIELD_RADIUS, color: categoryColor('energy') },   // cheek
  { id: 'h2', x: 182.1, y: 173.7, r: FIELD_RADIUS, color: categoryColor('energy') },
  { id: 'h3', x: 60.9, y: 235.2, r: FIELD_RADIUS, color: categoryColor('resurfacing') }, // jaw
  { id: 'h4', x: 170.3, y: 235.2, r: FIELD_RADIUS, color: categoryColor('resurfacing') },
]
const DEMO_FULL_FACE = [
  { id: 'f1', x: FULL_FACE.x, y: FULL_FACE.y, r: FULL_FACE.radius, color: categoryColor('resurfacing') },
]

const DISPLAY_SCALE = [
  [40, 'Landing brand'],
  [32, 'Greeting'],
  [22, 'Section title, hero headline'],
  [18, 'Card title, visit regions'],
  [17, 'Cadence value, install title'],
  [15, 'Area label, product name'],
]

const BODY_SCALE = [
  [16, 'Form inputs on touch — never smaller, see note below'],
  [15, 'Landing tagline, buttons'],
  [14, 'Body copy, labels'],
  [13, 'Card subtext, secondary copy'],
  [12.5, 'Metadata'],
  [11, 'Badges, footnotes'],
]

const RULES = [
  [
    'Magenta is the only action colour',
    'Including destructive. Red was tried and broke the palette; coral read as dull. Context carries the warning ("Yes, delete"), not hue.',
  ],
  [
    'No emoji in production',
    'Stroke-based SVGs that inherit currentColor. Emoji read as placeholder.',
  ],
  [
    'Wait-and-show, never optimistic',
    'Write, refetch, then update. A record that shows something that was not saved is worse than a brief delay.',
  ],
  [
    'Toasts only when the proof is off-screen',
    'Most actions confirm themselves in place. Toasting those trains people to ignore toasts.',
  ],
  [
    'Every input is at least 16px on touch',
    'Under 16px, iOS zooms the page on focus, and a zoomed page pans sideways. This presented as a layout bug and survived three wrong fixes.',
  ],
  [
    'Phone-first, 480px column',
    'Desktop centres the same column. Do not fight it.',
  ],
]

/**
 * Read every token's computed value straight off :root.
 *
 * Captured once, in a state initializer rather than an effect: the stylesheet
 * is in place before first render, and the values cannot change while the page
 * is open, so an effect would only add a second render for no new information.
 * (Same pattern as HeroCard capturing `now`.)
 */
function readTokens() {
  const styles = getComputedStyle(document.documentElement)
  const read = (name) => styles.getPropertyValue(name).trim()
  const all = {}
  for (const [name] of [
    ...TEXT_TOKENS,
    ...SURFACE_TOKENS,
    ...ACTION_TOKENS,
    ...TREATMENT_TOKENS,
    ...OTHER_TOKENS,
  ]) {
    all[name] = read(name)
  }
  for (const name of ['--gradient-brand', '--f-display', '--f-body', '--phone-width']) {
    all[name] = read(name)
  }
  return all
}

function useTokens() {
  const [values] = useState(readTokens)
  return values
}

function Swatch({ name, role, value }) {
  return (
    <div className="ds-swatch">
      <div className="ds-swatch-chip" style={{ background: `var(${name})` }} />
      <div className="ds-swatch-meta">
        <code className="ds-token">{name}</code>
        <span className="ds-value">{value || '—'}</span>
        <span className="ds-role">{role}</span>
      </div>
    </div>
  )
}

function DesignSystem() {
  const tokens = useTokens()

  return (
    <div className="ds">
      <div className="ds-inner">
        <header className="ds-header">
          <h1 className="ds-title">Rinnova design system</h1>
          <p className="ds-sub">
            Every value on this page is read live from <code>src/index.css</code>,
            and every component uses its real class. Change a token and this
            page follows. Rules and reasoning live in CLAUDE.md §8.
          </p>
        </header>

        <section className="ds-section">
          <h2 className="ds-h2">Text</h2>
          <div className="ds-swatches">
            {TEXT_TOKENS.map(([name, role]) => (
              <Swatch key={name} name={name} role={role} value={tokens[name]} />
            ))}
          </div>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Surfaces</h2>
          <div className="ds-swatches">
            {SURFACE_TOKENS.map(([name, role]) => (
              <Swatch key={name} name={name} role={role} value={tokens[name]} />
            ))}
          </div>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Action</h2>
          <div className="ds-swatches">
            {ACTION_TOKENS.map(([name, role]) => (
              <Swatch key={name} name={name} role={role} value={tokens[name]} />
            ))}
          </div>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Treatment categories</h2>
          <p className="ds-note">
            These four are not decoration. The colour <em>is</em> the clinical
            category, on the face map and everywhere that references it, so the
            key beside each one has to stay in step with the parser and{' '}
            <code>faceCoordinates</code>.
          </p>
          <div className="ds-swatches">
            {TREATMENT_TOKENS.map(([name, role, key, examples]) => (
              <div className="ds-swatch" key={key}>
                <div className="ds-swatch-chip" style={{ background: `var(${name})` }} />
                <div className="ds-swatch-meta">
                  <code className="ds-token">{key}</code>
                  <span className="ds-value">
                    {name} · {tokens[name] || '—'}
                  </span>
                  <span className="ds-role">
                    {role} — {examples}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Gradient</h2>
          <div className="ds-gradient" />
          <code className="ds-token ds-block">--gradient-brand</code>
          <span className="ds-value ds-block">{tokens['--gradient-brand'] || '—'}</span>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Other</h2>
          <div className="ds-swatches">
            {OTHER_TOKENS.map(([name, role]) => (
              <Swatch key={name} name={name} role={role} value={tokens[name]} />
            ))}
          </div>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Display — Fraunces</h2>
          <p className="ds-note">
            <code>--f-display</code> · {tokens['--f-display'] || '—'}
          </p>
          {DISPLAY_SCALE.map(([size, use]) => (
            <div className="ds-type-row" key={`d${size}`}>
              <span
                className="ds-type-sample"
                style={{ fontFamily: 'var(--f-display)', fontSize: `${size}px` }}
              >
                Your record
              </span>
              <span className="ds-type-meta">
                {size}px · {use}
              </span>
            </div>
          ))}
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Body — Inter Tight</h2>
          <p className="ds-note">
            <code>--f-body</code> · {tokens['--f-body'] || '—'}
          </p>
          {BODY_SCALE.map(([size, use]) => (
            <div className="ds-type-row" key={`b${size}`}>
              <span
                className="ds-type-sample"
                style={{ fontFamily: 'var(--f-body)', fontSize: `${size}px` }}
              >
                Your aesthetic treatment history
              </span>
              <span className="ds-type-meta">
                {size}px · {use}
              </span>
            </div>
          ))}
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Buttons</h2>
          <div className="ds-row">
            <button type="button" className="install-btn">Primary</button>
            <button type="button" className="form-save-btn">Save</button>
            <button type="button" className="form-cancel-btn">Cancel</button>
          </div>
          <div className="ds-row">
            <button type="button" className="link-btn">Quiet text link</button>
            <button type="button" className="product-note-btn">Add a note</button>
            <button type="button" className="signout-btn">Sign out</button>
          </div>
          <p className="ds-note">
            Destructive confirms use the same magenta, never red — the wording
            carries the warning.
          </p>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Inputs</h2>
          <input className="form-input" placeholder="Text input" readOnly />
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Textarea — notes run to sentences"
            readOnly
          />
          <p className="ds-note">
            Both are forced to 16px on coarse pointers. Anything smaller makes
            iOS zoom on focus, which pans the whole app sideways.
          </p>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Section header</h2>
          <div className="section-head">
            <h2 className="section-title">Areas you treat</h2>
            <span className="section-meta">4</span>
          </div>
          <div className="empty-state">
            An empty state: quiet, explains what will appear here.
          </div>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Hero card</h2>
          <section className="hero-card">
            <div className="hero-card-inner">
              <h2 className="hero-card-headline">Your refresh window opens in 3 days</h2>
              <p className="hero-card-subtext">
                Typically starts to fade around then. Never prescriptive.
              </p>
              <p className="hero-card-meta">88 days since your last visit</p>
            </div>
          </section>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Cards</h2>
          {/* Mirrors VisitCard's real structure. The outer .visit-card is
              padding: 0 — the padding lives on the inner .visit-card-main
              button, because the card has two separate tap zones (the body
              opens the visit, the cost row edits the cost) and they must not
              bleed into each other. Flattening this here rendered text hard
              against the border, which is exactly the drift this page is for. */}
          <div className="visit-card" style={{ marginBottom: 12 }}>
            <div className="visit-card-main">
              <div className="visit-card-date">APR 24, 2026</div>
              <div className="visit-card-regions">Face, neck, and lips</div>
              <div className="visit-card-meta">
                4 treatments with Dr. Del Campo
              </div>
              <div className="visit-card-cta">
                View visit details <span aria-hidden="true">→</span>
              </div>
            </div>
            <div className="visit-card-cost-row">
              <span className="cost-trigger">$2,500</span>
            </div>
          </div>

          <div className="cadence-carousel is-single">
            <div className="cadence-card" style={{ '--card-accent': 'var(--purple)' }}>
              <span className="cadence-card-label">Forehead</span>
              <span className="cadence-card-value">
                about 3 times a year
                <span className="cadence-card-chevron">›</span>
              </span>
            </div>
          </div>
          <p className="ds-note">
            A cadence card is tinted to its treatment colour, so it ties to its
            dot on the face.
          </p>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Treatment marks</h2>
          <div className="ds-row">
            {TREATMENT_TOKENS.map(([name, role, key]) => {
              const field = key === 'energy' || key === 'resurfacing'
              return (
                <span className="ds-dot-row" key={key}>
                  <span
                    className={`treatment-dot${field ? ' legend-dot-field' : ''}`}
                    style={{ background: `var(${name})`, color: `var(${name})` }}
                  />
                  <span className="ds-type-meta">{role}</span>
                </span>
              )
            })}
          </div>
          <p className="ds-note">
            A solid dot is a point (injectables). A ring is a field
            (non-injectables) — the same idea as the halo on the face below.
          </p>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Point vs field on the face</h2>
          <p className="ds-note">
            Injectables are placed at a spot, so they draw a dot. Energy and
            resurfacing cover a zone we usually can&apos;t bound exactly, so they
            draw a soft halo — &quot;broadly here&quot;, never a false precision.
            The treatment type decides the mark; the region decides where.
          </p>
          <div className="ds-face-compare">
            <div className="ds-face-cell">
              <FaceDiagram dots={DEMO_DOTS} legend={null} />
              <span className="ds-type-meta">Injectables — dots</span>
            </div>
            <div className="ds-face-cell">
              <FaceDiagram halos={DEMO_HALOS} legend={null} />
              <span className="ds-type-meta">Energy &amp; resurfacing — halos</span>
            </div>
          </div>
          <div className="ds-face-cell ds-face-full">
            <FaceDiagram halos={DEMO_FULL_FACE} legend={null} />
            <span className="ds-type-meta">A full-face treatment — one large halo</span>
          </div>
        </section>

        <section className="ds-section">
          <h2 className="ds-h2">Locked decisions</h2>
          <p className="ds-note">
            These were argued for and should not be re-litigated without a real
            reason. Several came from shipped bugs.
          </p>
          <ul className="ds-rules">
            {RULES.map(([title, why]) => (
              <li key={title} className="ds-rule">
                <span className="ds-rule-title">{title}</span>
                <span className="ds-rule-why">{why}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="ds-footer">
          Layout column: <code>--phone-width</code> ·{' '}
          {tokens['--phone-width'] || '—'}
        </footer>
      </div>
    </div>
  )
}

export default DesignSystem
