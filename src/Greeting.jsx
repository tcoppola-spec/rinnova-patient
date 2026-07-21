import { useState, useEffect } from 'react'

function currentTimeOfDay() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

/**
 * Greeting
 *
 * The "Good morning, Tracy" header at the top of the patient page.
 * Time-of-day-aware: morning before noon, afternoon noon-6pm, evening after 6pm.
 *
 * Props:
 *   firstName: string | null — the patient's first name. New testers are
 *              provisioned without a name, so this can be empty; we drop the
 *              name cleanly rather than render "Good morning, ".
 */
function Greeting({ firstName }) {
  // Re-read on every focus, not just on mount. Reading the clock during render
  // is impure (the same problem HeroCard had), and a PWA is rarely reloaded —
  // it gets backgrounded and reopened, so a card that fixed its greeting at
  // launch would still say "morning" when you check it after dinner.
  const [timeOfDay, setTimeOfDay] = useState(currentTimeOfDay)

  useEffect(() => {
    const sync = () => setTimeOfDay(currentTimeOfDay())
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  const name = firstName && firstName.trim()

  return (
    <header className="greeting">
      <h1 className="greeting-text">
        Good {timeOfDay}
        {name ? <>, <span className="greeting-name">{name}</span></> : ''}
      </h1>
      <p className="greeting-subtitle">
        Here's where your aesthetic care lives, every day.
      </p>
    </header>
  )
}

export default Greeting