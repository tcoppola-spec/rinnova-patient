/**
 * Greeting
 *
 * The "Good morning, Tracy" header at the top of the patient page.
 * Time-of-day-aware: morning before noon, afternoon noon-6pm, evening after 6pm.
 *
 * Props:
 *   firstName: string — the patient's first name
 */
function Greeting({ firstName }) {
  const hour = new Date().getHours()
  const timeOfDay =
    hour < 12 ? 'morning' :
    hour < 18 ? 'afternoon' :
    'evening'

  return (
    <header className="greeting">
      <h1 className="greeting-text">
        Good {timeOfDay}, <span className="greeting-name">{firstName}</span>
      </h1>
      <p className="greeting-subtitle">
        Here's where your aesthetic care lives, every day.
      </p>
    </header>
  )
}

export default Greeting