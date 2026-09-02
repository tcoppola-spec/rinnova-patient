import { useId } from 'react'
import {
  VIEWBOX,
  MIRROR_AXIS,
  CLIP_X,
  DOT_RADIUS,
  FIELD_RADIUS,
  FULL_FACE,
  FULL_FACE_NAMES,
  mirrorX,
} from './faceGeometry'
import { categoryColor, categoryMark } from './treatmentColors'

/**
 * FaceDiagram
 *
 * Renders the Rinnova face illustration as an SVG, with treatment marks on top
 * based on the visit's treatment_areas.
 *
 * TWO KINDS OF MARK, decided by the treatment's category (see treatmentColors):
 *   - 'point' (injectables) → a DOT at (x, y). Filler goes to a specific spot.
 *   - 'field' (energy, resurfacing) → a soft HALO centred at (x, y). A laser
 *     covers a zone, and a dot would claim a precision we don't have. Halos
 *     render UNDER the dots, so on a mixed visit the injectable points stay
 *     crisp on top of the wash. A "Full face" area draws one large halo over
 *     the centre instead of a mark per region.
 *
 * For a bilateral area (mirror=true) a second mark is reflected across the
 * artwork's axis of symmetry (x = 114.9, NOT the viewBox centre).
 *
 * The artwork is line art with no skin fill — marks sit on the warm gradient of
 * .face-diagram-wrap. Only the RIGHT half of the illustration is drawn: once
 * as-is, and once mirrored to form the left half. The source SVG's left side
 * has an uneven outline (see faceGeometry.js), so mirroring the uniform right
 * half gives a symmetric face for free.
 *
 * Colours come from treatmentColors.js — the single source of truth — never a
 * local map, so the face and the cards can't disagree about what a colour means.
 *
 * Props:
 *   treatments: treatment objects with nested treatment_areas (the visit path)
 *   dots:  optional pre-built point marks [{id,x,y,color,r?,opacity?}]
 *   halos: optional pre-built field marks (same shape); defaults to none
 *   legend: optional node; pass null to suppress the auto legend
 *   onPointTap: optional (x, y) => void in viewBox coords. When provided the SVG
 *     becomes tappable (used by manual entry — tap the face, snap to a region).
 *     Coordinates are converted through the SVG's own CTM, so they're exact
 *     regardless of how the image is scaled or letterboxed on screen.
 */


/**
 * The face illustration, straight from scripts/new-face.svg.
 * Rendered twice by FaceDiagram (right half, then mirrored). The paths that lie
 * entirely on the left (the left brow and left eye) are clipped away and
 * replaced by their mirrored counterparts.
 */
function FaceArt() {
  return (
    <>
      {/* Head outline, ears and neck */}
      <path className="face-art" d="M217.9,139.3c-2.2-2.7-5.3-4.3-9.3-4.7.3-6.9.5-14.2.5-22,0-34.9-10-62.1-29.8-80.7-16.1-15.2-38.8-24-64-24.7h-1s0,0,0,0c-18,.5-43.6,5.1-63.9,24-19.8,18.4-29.8,45.8-29.8,81.4s.2,15.1.6,21.9c-4,.4-7.2,2-9.3,4.8-4.5,5.7-4.4,15.7.1,30.6,4.4,14.2,11.8,24.5,18.9,27.1,5,17.2,10.8,27.4,14.3,32.6,1.6,2.4,9.4,13.6,21.2,24.5v19.4c0,13.8,0,23.7-14.5,32.3-2.2,1.3-4.5,2.6-6.9,3.8-1.4.7-1.8,2.6-.8,3.8h0c.7,1,2,1.3,3.1.7,2.5-1.3,4.9-2.6,7.1-3.9,17.1-10,17.1-23,17.1-36.7v-14.9c11.9,10,27,18.7,43.3,18.7s31.4-8.7,43.3-18.7v14.9c0,13.7,0,26.7,17.1,36.7,2.3,1.3,4.7,2.6,7.1,3.9,1,.5,2.3.3,3.1-.6h0c1-1.3.6-3.2-.8-3.9-2.4-1.2-4.7-2.5-6.9-3.8-14.5-8.5-14.5-18.5-14.5-32.3v-19.4c11.8-11,19.6-22.2,21.2-24.5,4.9-7.2,10.2-17.7,14.6-32.7,7-2.8,14.3-13,18.6-27,4.6-14.9,4.6-24.9.1-30.6ZM17,168.4c-5-16.1-3.3-23-1-25.9,1.2-1.6,3.1-2.5,5.6-2.8,1.3,20.5,4.1,37,7.4,50.1-4.2-3.8-9-11.4-12-21.4ZM180.3,226.7c-3.2,4.7-31.8,45.5-65.4,45.5s-62.2-40.8-65.4-45.5c-5.6-8.2-23.7-40.7-23.7-114.1S88.2,13,114.9,12.3c21,.6,89.1,9.4,89.1,100.3s-12.9,98.2-23.7,114.1ZM212.8,168.4c-3,9.7-7.6,17.2-11.7,21.1,3.3-13.3,5.9-29.7,7.2-49.8,2.5.3,4.3,1.2,5.6,2.8,2.3,2.9,4,9.7-1,25.9Z" />
      {/* Nose base */}
      <path className="face-art" d="M101.8,198.9l.7.3c2.3,1.1,7,3.3,13,3.3s8.2-.9,12.8-3.5c1.2-.7,1.7-2.3,1-3.5-.7-1.2-2.3-1.7-3.5-1-9.5,5.5-17.3,1.8-21.1,0l-.8-.4c-1.3-.6-2.8,0-3.4,1.3-.6,1.3,0,2.8,1.3,3.4Z" />
      {/* Mouth */}
      <path className="face-art" d="M139,219.9c-4,.4-7.7.2-11.3.1-1.1,0-2.2,0-3.3-.1-1.9,0-3.7.3-5.5.6-1.4.2-2.6.5-3.7.5-1.8,0-3.4-.2-5-.5-1.7-.3-3.5-.5-5.3-.4h-2.9c-5.4.3-8.1.5-11.3,0-1.4-.2-2.7.8-2.9,2.2-.2,1.4.8,2.7,2.2,2.9,3.6.5,6.7.4,12.2.1h2.9c1.3-.2,2.7,0,4.3.3,1.7.2,3.6.5,5.7.5h0c1.5,0,3.1-.3,4.6-.5,1.5-.3,3.1-.5,4.4-.5,1.1,0,2.1,0,3.2.1,3.7.1,7.6.3,11.9-.1,1.4-.1,2.5-1.4,2.3-2.8-.1-1.4-1.4-2.5-2.8-2.3Z" />
      {/* Lower lip */}
      <path className="face-art" d="M122.8,234.1c-6.9,2.4-15.9.2-16,.2-1.2-.3-2.4.5-2.7,1.7-.3,1.2.4,2.4,1.7,2.7.3,0,4.3,1,9.3,1s6.2-.3,9.2-1.4c1.2-.4,1.8-1.7,1.4-2.9-.4-1.2-1.7-1.8-2.9-1.4Z" />
      {/* Left eye + iris (clipped away; the mirrored right eye replaces it) */}
      <path className="face-art" d="M91.6,153.2c.5.6,1.3,1,2.1,1s1.2-.2,1.8-.6c1.1-1,1.3-2.7.3-3.8-6-7.1-13.2-10.6-21.9-10.7-8.8-.2-17.2,3.6-22.3,10.2-.9,1.2-.7,2.9.5,3.8,1.2.9,2.9.7,3.8-.5,3.1-4,7.1-6,10.5-7-.4,1.2-.5,2.8-.5,4-.2,5.1,2.2,9.7,7.8,10.2,6.1.6,9.2-3.3,9.8-8.5.1-1.3,0-3.2,0-4.6,3,1.5,5.8,3.7,8.3,6.7Z" />
      {/* Left brow (clipped away; the mirrored right brow replaces it) */}
      <path className="face-art" d="M52.2,131.2c4.5-1.5,10.7-2.4,14.2-2.7,11.2-1.1,23.3,3.3,27.9,4,4.1.6,3.9-5.9-1.6-7.8-9.6-3.3-17.3-4.4-27.3-2.8-8.8,1.4-16.1,6.4-16.5,7.3-.8,1.6,1.2,2.8,3.4,2.1Z" />
      {/* Right brow */}
      <path className="face-art" d="M181,129.1c-.4-.8-7.7-5.9-16.5-7.3-10-1.6-17.7-.5-27.3,2.8-5.5,1.9-5.7,8.4-1.6,7.8,4.6-.7,16.7-5,27.9-4,3.5.3,9.7,1.2,14.2,2.7,2.2.8,4.2-.4,3.4-2.1Z" />
      {/* Right eye + iris */}
      <path className="face-art" d="M156,138.9c-8.8.2-15.9,3.7-21.9,10.7-1,1.1-.8,2.8.3,3.8.5.4,1.1.6,1.8.6s1.5-.3,2.1-1c2.6-3,5.3-5.2,8.3-6.7-.1,1.4-.2,3.3,0,4.6.6,5.2,3.7,9.1,9.8,8.5,5.6-.5,8-5.1,7.8-10.2,0-1.2-.1-2.7-.5-4,3.5,1,7.4,3.1,10.5,7,.9,1.2,2.6,1.4,3.8.5,1.2-.9,1.4-2.6.5-3.8-5.1-6.5-13.5-10.4-22.3-10.2Z" />
    </>
  )
}

function FaceDiagram({ treatments = [], dots: dotsProp, halos: halosProp, legend, onPointTap }) {
  // useId can contain ':', which is not valid inside a url(#...) reference.
  const uid = useId().replace(/:/g, '')
  const clipId = `face-half-${uid}`

  // Convert a screen tap into the SVG's own coordinate space via its CTM, so it
  // maps correctly no matter how the image is scaled/letterboxed. Off unless a
  // caller wants taps (manual entry).
  function handleSvgTap(e) {
    const svg = e.currentTarget
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(ctm.inverse())
    onPointTap(p.x, p.y)
  }

  // A caller can supply its own marks (AreaCadenceSection weights dots by how
  // often an area is treated). Keeping the build here rather than forking the
  // component means the illustration, the clip/mirror trick and the coordinate
  // space live in exactly one place — see the note in faceGeometry.js.
  const dots = dotsProp || []
  const halos = halosProp || []

  if (!dotsProp && !halosProp) {
    treatments.forEach((treatment) => {
      const color = categoryColor(treatment.color_key)
      const isField = categoryMark(treatment.color_key) === 'field'
      const bucket = isField ? halos : dots
      const areas = treatment.treatment_areas || []

      areas.forEach((area) => {
        // A field treatment applied to the whole face draws ONE big centred
        // halo, regardless of the region row's coordinate.
        const name = (area.friendly_name || area.clinical_name || '').trim().toLowerCase()
        if (isField && FULL_FACE_NAMES.has(name)) {
          halos.push({
            id: `${area.id}-full`,
            x: FULL_FACE.x,
            y: FULL_FACE.y,
            r: FULL_FACE.radius,
            color,
          })
          return
        }

        // x/y are NULL when the region couldn't be placed (see
        // faceCoordinates.js — we never invent a coordinate). Draw no mark
        // rather than a wrong one. The area still appears in the list below.
        if (area.x == null || area.y == null) return

        bucket.push({ id: area.id, x: area.x, y: area.y, color })
        // Mirror mark (if mirror=true), reflected across the axis of symmetry.
        if (area.mirror) {
          bucket.push({ id: `${area.id}-mirror`, x: mirrorX(area.x), y: area.y, color })
        }
      })
    })
  }

  // One radial gradient per distinct halo colour: a soft centre fading to fully
  // transparent, so a halo reads as "broadly here", never a hard bubble.
  const haloColors = [...new Set(halos.map((h) => h.color))]

  return (
    <div className="face-diagram-wrap">
      <svg
        className="face-diagram-svg"
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Face diagram showing treatment areas"
        role="img"
        onClick={onPointTap ? handleSvgTap : undefined}
        style={onPointTap ? { cursor: 'crosshair' } : undefined}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={CLIP_X}
              y="0"
              width={VIEWBOX.width - CLIP_X}
              height={VIEWBOX.height}
            />
          </clipPath>
          {haloColors.map((c, i) => (
            <radialGradient key={c} id={`halo-${uid}-${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c} stopOpacity="0.32" />
              <stop offset="55%" stopColor={c} stopOpacity="0.16" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {/* Right half of the illustration, as drawn */}
        <g clipPath={`url(#${clipId})`}>
          <FaceArt />
        </g>

        {/* The same right half, mirrored to become the left half */}
        <g transform={`translate(${2 * MIRROR_AXIS},0) scale(-1,1)`}>
          <g clipPath={`url(#${clipId})`}>
            <FaceArt />
          </g>
        </g>

        {/* Field halos: over the line art (they're a treatment layer), but
            BELOW the dots, so injectable points stay crisp on the wash. */}
        {halos.map((halo) => {
          const gi = haloColors.indexOf(halo.color)
          return (
            <circle
              key={halo.id}
              className="area-halo"
              cx={halo.x}
              cy={halo.y}
              r={halo.r ?? FIELD_RADIUS}
              fill={`url(#halo-${uid}-${gi})`}
            />
          )
        })}

        {/* Treatment dots — rendered last so they sit on top of everything */}
        {dots.map((dot) => (
          <g key={dot.id} className="area-dot">
            <circle
              cx={dot.x}
              cy={dot.y}
              r={dot.r ?? DOT_RADIUS}
              fill={dot.color}
              opacity={dot.opacity}
            />
          </g>
        ))}

        {/* Watermark, bottom-left corner. Baked into the SVG so it stays put if
            the diagram is screenshotted. */}
        <text className="face-watermark" x="1" y={VIEWBOX.height - 3}>
          app.rinnova.io
        </text>
      </svg>

      {/* Color legend below the face. A caller supplying its own dots supplies
          its own legend too (or none) — the treatment list wouldn't describe
          what's drawn. */}
      {legend !== undefined ? legend : (
      <div className="face-diagram-legend">
        {treatments.map((t) => (
          <div key={t.id} className="legend-item">
            <span
              className={`legend-dot${categoryMark(t.color_key) === 'field' ? ' legend-dot-field' : ''}`}
              // color drives the field ring (currentColor); background drives
              // the solid point swatch. Setting both lets the class pick.
              style={{ background: categoryColor(t.color_key), color: categoryColor(t.color_key) }}
              aria-hidden="true"
            />
            <span className="legend-name">{t.name}</span>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

export default FaceDiagram
