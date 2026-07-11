import { useState, useRef, useEffect } from 'react'

/**
 * Onboarding — first-run, 3-screen swipeable carousel.
 *
 * Shows once on first authenticated entry (App.jsx gates it on a per-user
 * localStorage flag), then never again. Explains what Rinnova is and the two
 * ways to add a visit (photo of a note/receipt, or just saying it).
 *
 * Props:
 *   onDone — called when the patient taps "Get started" (screen 3) or "Skip".
 *            App.jsx records the completion flag and unmounts this.
 *
 * Design: brand gradient on the icons + the Fraunces "R" + the button; cream
 * card; Fraunces headlines, Inter Tight body. All values come from the CSS
 * tokens in index.css — see the .onboarding block in App.css.
 */

const SCREENS = [
  {
    eyebrow: 'Welcome',
    icon: 'r',
    headline: ['Your aesthetic history,', 'all in one place'],
    description:
      'A private record of every treatment you’ve had. What, where, and when, kept just for you.',
  },
  {
    eyebrow: 'Adding a visit',
    icon: 'capture',
    headline: ['Snap a photo,', 'or just say it'],
    description:
      'Photograph your visit note or receipt, or simply tell Rinnova what you had done. It fills in the details.',
  },
  {
    eyebrow: 'Your map',
    icon: 'face',
    headline: ['Know what works,', 'and when you’re due'],
    description:
      'See every treatment by area and date. What worked, what didn’t, and what’s wearing off.',
  },
]

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 8h3l1.4-2h9.2L18 8h3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" strokeLinecap="round" />
    </svg>
  )
}

/**
 * FaceMark — the simplified face icon, from scripts/onboarding-face-icon.svg.
 *
 * A purpose-drawn icon, NOT the detailed FaceDiagram artwork: the visit-map
 * face has ears, irises and a neck that turn to mush at this size. Filled
 * shapes (no strokes), so it takes the brand gradient the same way the R does.
 */
function FaceMark() {
  return (
    <svg className="onboarding-face-mark" viewBox="0 0 94.6 111.9" aria-hidden="true">
      {/* right brow */}
      <path d="M56.7,46.2c.3,0,.6,0,.9-.3.1,0,10.5-6.9,18.3-1.4.7.5,1.7.3,2.2-.4.5-.7.3-1.7-.4-2.2-9.5-6.7-21.3,1.1-21.8,1.4-.7.5-.9,1.4-.4,2.2.3.5.8.7,1.3.7h0Z" />
      {/* right eye */}
      <path d="M73.7,55.9c.7.5,1.7.9,3.1.9s1.6-.7,1.6-1.6-.7-1.6-1.6-1.6-1.5-.5-1.5-.4c-.2-.4-.6-.6-1-.7-.4-.1-.9,0-1.2.2,0,0-7.9,4.9-14.2,0-.7-.5-1.7-.4-2.2.3-.5.7-.4,1.7.3,2.2,2.8,2.1,5.7,2.8,8.3,2.8s6.8-1.3,8.4-2.1h0Z" />
      {/* left eye */}
      <path d="M21.9,56.7c1.4,0,2.4-.4,3.1-.9,1.6.8,4.7,2.1,8.4,2.1s5.6-.7,8.3-2.8c.7-.5.8-1.5.3-2.2-.5-.7-1.5-.8-2.2-.3-6.3,4.8-13.9.1-14.2,0-.4-.2-.8-.3-1.2-.2-.4.1-.8.3-1,.7,0,0-.4.5-1.5.5s-1.6.7-1.6,1.6.7,1.6,1.6,1.6h0Z" />
      {/* left brow */}
      <path d="M21.1,42c-.7.5-.9,1.5-.4,2.2.5.7,1.5.9,2.2.4,7.7-5.4,18.2,1.4,18.3,1.4.3.2.6.3.9.3.5,0,1-.2,1.3-.7.5-.7.3-1.7-.4-2.2-.5-.3-12.3-8.1-21.8-1.4h0Z" />
      {/* mouth */}
      <path d="M62,84c.9,0,1.5-.8,1.5-1.6,0-.9-.8-1.5-1.6-1.5-1.9.1-3.1-.6-4.4-1.3-1.1-.6-2.4-1.3-4.1-1.3s-3.2.5-4,1c-.8-.5-2.1-1-4-1s-2.9.7-4.1,1.3c-1.3.7-2.5,1.4-4.4,1.3-.9,0-1.6.6-1.6,1.5s.6,1.6,1.5,1.6c.2,0,.4,0,.6,0,2.5,0,4.2-.9,5.5-1.7.9-.5,1.7-.9,2.5-.9,2,0,2.8.8,2.9.8.5.5,1.2.6,1.8.3,0,0,0,0,0,0,.1,0,.2-.1.4-.2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,.9-.8,2.9-.8s1.6.4,2.5.9c1.4.8,3,1.7,5.5,1.7s.4,0,.6,0h0Z" />
      {/* lower lip */}
      <path d="M54.8,85.9c-1.6.7-3.4,1-5.5,1s-3.9-.3-5.5-1c-.8-.3-1.7,0-2,.8-.3.8,0,1.7.8,2,2,.8,4.2,1.2,6.7,1.2s4.7-.4,6.7-1.2c.8-.3,1.2-1.2.8-2-.3-.8-1.2-1.2-2-.8h0Z" />
      {/* nose */}
      <path d="M51.1,70.7c-.7.4-1.2.7-1.8.7h0c-.6,0-1.1-.3-1.8-.7-1.1-.7-2.6-1.6-4.8-.7-.8.3-1.2,1.2-.9,2,.3.8,1.2,1.2,2,.9.8-.3,1.1-.1,2.1.5.8.5,1.9,1.1,3.4,1.1h0c1.5,0,2.5-.6,3.4-1.1,1-.6,1.3-.8,2.1-.5.8.3,1.7,0,2-.9.3-.8,0-1.7-.9-2-2.2-.8-3.7,0-4.8.7h0Z" />
      {/* head outline */}
      <path d="M87,38.7h0c-.8-6.5-11.6-25.6-37.7-25.6-26.1,0-36.9,19-37.7,25.6h0c-.2,1.3-3.8,32.7,11.4,51.4,13.1,16.1,24.3,16.8,26.1,16.8h.3c1.8,0,13-.7,26.1-16.8,15.2-18.7,11.6-50.1,11.4-51.4ZM73.2,88.1c-12.9,15.9-23.7,15.6-23.8,15.6,0,0,0,0,0,0,0,0,0,0,0,0,0,0-10.9.2-23.8-15.6-14.4-17.6-10.8-48.8-10.8-49.1.6-5,10.4-22.8,34.6-22.8,24.2,0,34,17.8,34.6,22.8,0,.3,3.6,31.4-10.8,49.1Z" />
    </svg>
  )
}

function ScreenIcon({ kind }) {
  if (kind === 'r') {
    return <span className="onboarding-r" aria-hidden="true">R</span>
  }
  if (kind === 'capture') {
    return (
      <span className="onboarding-icon-row">
        <span className="onboarding-glyph onboarding-glyph-camera"><CameraIcon /></span>
        <span className="onboarding-or">or</span>
        <span className="onboarding-glyph onboarding-glyph-mic"><MicIcon /></span>
      </span>
    )
  }
  return <FaceMark />
}

function Onboarding({ onDone }) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef(null)
  const last = SCREENS.length - 1

  // Lock background scroll while onboarding is up (same pattern as
  // VisitDetailModal). Without this the page behind can still scroll, which on
  // mobile Safari keeps the bottom toolbar expanded over the content.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  function go(i) {
    setIndex(Math.max(0, Math.min(last, i)))
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) go(dx < 0 ? index + 1 : index - 1)
    touchStartX.current = null
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowRight') go(index + 1)
    else if (e.key === 'ArrowLeft') go(index - 1)
  }

  return (
    <div className="onboarding">
      {/* One brand-gradient definition, referenced by every line icon's stroke */}
      <svg width="0" height="0" className="onboarding-grad-def" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="onboarding-grad" x1="0" y1="0" x2="1" y2="1">
            <stop className="onboarding-stop-1" offset="0" />
            <stop className="onboarding-stop-2" offset="0.5" />
            <stop className="onboarding-stop-3" offset="1" />
          </linearGradient>
        </defs>
      </svg>

      <div
        className="onboarding-card"
        role="region"
        aria-roledescription="carousel"
        aria-label="Welcome to Rinnova"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {index < last && (
          <button type="button" className="onboarding-skip" onClick={onDone}>
            Skip
          </button>
        )}

        <div
          className="onboarding-viewport"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="onboarding-track"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {SCREENS.map((screen, i) => (
              <section
                key={i}
                className="onboarding-slide"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${SCREENS.length}`}
                aria-hidden={i !== index}
              >
                {/* Eyebrow pins to the top; the icon/headline/description
                    group centres in the space that's left. */}
                <p className="onboarding-eyebrow">{screen.eyebrow}</p>
                <div className="onboarding-body">
                  <div className="onboarding-iconzone">
                    <ScreenIcon kind={screen.icon} />
                  </div>
                  <h2 className="onboarding-headline">
                    {screen.headline[0]}
                    <br />
                    {screen.headline[1]}
                  </h2>
                  <p className="onboarding-desc">{screen.description}</p>
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="onboarding-footer">
          {/* The slot is always present, even on screens 1-2 where it's empty.
              Without it the footer would grow when "Get started" appears on
              screen 3, shrinking the viewport and jolting the content upward
              mid-swipe. */}
          <div className="onboarding-cta-slot">
            {index === last && (
              <button type="button" className="onboarding-cta" onClick={onDone}>
                Get started
              </button>
            )}
          </div>
          <div className="onboarding-dots">
            {SCREENS.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`onboarding-dot${i === index ? ' is-active' : ''}`}
                aria-label={`Go to screen ${i + 1} of ${SCREENS.length}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
