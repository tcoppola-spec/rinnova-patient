/**
 * FaceDiagram
 *
 * Renders a stylized face (head, brows, eyes, lips, etc.) as an SVG,
 * with treatment dots positioned on top based on the visit's treatment_areas.
 *
 * For each treatment_area:
 *   - A single dot is rendered at (x, y) using the parent treatment's color
 *   - If mirror=true, a SECOND dot is also rendered, mirrored across the center
 *     axis at x=100 (so x=76 → also at x=124)
 *
 * Colors map from treatment.color_key to design system colors:
 *   xeomin = purple    (#7B2CBF)
 *   radiesse = magenta (#D63384)
 *   radiesse-light = coral (#F06E89)
 *   rha = orange       (#FF8C42)
 *
 * Props:
 *   treatments: array of treatment objects, each with nested treatment_areas
 */

// Color map — matches the locked design system colors for product dots
const COLORS = {
  xeomin: '#7B2CBF',
  radiesse: '#D63384',
  'radiesse-light': '#F06E89',
  rha: '#FF8C42',
}

function FaceDiagram({ treatments = [] }) {
  // Flatten all treatment_areas with their color attached, expanding mirrors
  const dots = []
  treatments.forEach((treatment) => {
    const color = COLORS[treatment.color_key] || '#888'
    const areas = treatment.treatment_areas || []
    areas.forEach((area) => {
      // Primary dot
      dots.push({
        id: area.id,
        x: area.x,
        y: area.y,
        color,
      })
      // Mirror dot (if mirror=true), reflected across center axis at x=100
      if (area.mirror) {
        dots.push({
          id: `${area.id}-mirror`,
          x: 200 - area.x,
          y: area.y,
          color,
        })
      }
    })
  })

  return (
    <div className="face-diagram-wrap">
      <svg
        className="face-diagram-svg"
        viewBox="0 0 200 260"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Face diagram showing treatment areas"
        role="img"
      >
        {/* Neck — drawn first so face overlaps cleanly */}
        <path
          d="M 76,184 L 70,240 Q 100,248 130,240 L 124,184 Z"
          fill="#F8EFE3"
          stroke="#D9CDBA"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />

        {/* Face fill — warm cream, rounder proportions */}
        <path
          d="M 100,48 C 68,48 44,72 44,108 C 44,140 54,168 70,184 C 82,194 92,198 100,198 C 108,198 118,194 130,184 C 146,168 156,140 156,108 C 156,72 132,48 100,48 Z"
          fill="#F8EFE3"
          stroke="#D9CDBA"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />

        {/* Brows — lifted, arched, open */}
        <path className="face-feature" d="M 60,94 Q 76,88 92,94" strokeWidth="1.3" />
        <path className="face-feature" d="M 108,94 Q 124,88 140,94" strokeWidth="1.3" />

        {/* Eyes — lower, rounder, more open */}
        <path className="face-feature" d="M 62,110 Q 76,98 90,110 Q 76,121 62,110 Z" />
        <path className="face-feature" d="M 110,110 Q 124,98 138,110 Q 124,121 110,110 Z" />

        {/* Soft cheek blush */}
        <ellipse cx="66" cy="130" rx="12" ry="7" fill="#F0C8B8" opacity="0.4" />
        <ellipse cx="134" cy="130" rx="12" ry="7" fill="#F0C8B8" opacity="0.4" />

        {/* Nose — subtle line + nostril hint */}
        <path className="face-feature" d="M 100,104 Q 97,132 102,138" strokeWidth="0.9" opacity="0.6" />
        <path className="face-feature" d="M 96,138 Q 100,142 104,138" strokeWidth="0.7" opacity="0.5" />

        {/* Lips — gently filled */}
        <path
          d="M 84,164 Q 92,160 100,163 Q 108,160 116,164 Q 108,172 100,172 Q 92,172 84,164 Z"
          fill="#D89B86"
          opacity="0.55"
        />
        <path className="face-feature" d="M 84,164 Q 100,167 116,164" strokeWidth="0.7" opacity="0.6" />

        {/* Subtle chin curve */}
        <path className="face-feature" d="M 88,188 Q 100,193 112,188" strokeWidth="0.8" opacity="0.5" />

        {/* Treatment dots — rendered last so they sit on top of everything */}
        {dots.map((dot) => (
          <g key={dot.id} className="area-dot">
            <circle cx={dot.x} cy={dot.y} r="4" fill={dot.color} />
          </g>
        ))}
      </svg>

      {/* Color legend below the face */}
      <div className="face-diagram-legend">
        {treatments.map((t) => (
          <div key={t.id} className="legend-item">
            <span
              className="legend-dot"
              style={{ background: COLORS[t.color_key] || '#888' }}
              aria-hidden="true"
            />
            <span className="legend-name">{t.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default FaceDiagram