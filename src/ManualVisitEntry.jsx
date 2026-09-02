import { useState } from 'react'
import FaceDiagram from './FaceDiagram'
import { FACE_REGIONS } from './faceRegions'
import { getCoordinates } from './faceCoordinates'
import { MIRROR_AXIS } from './faceGeometry'
import { categoryColor, categoryMark } from './treatmentColors'
import { PRODUCT_MENU, PRESETS, amountOptionsFor } from './manualEntry'

/**
 * ManualVisitEntry — build a visit by tapping the FACE, no receipt.
 *
 * The flow the pilot asked for, and the way an injector actually thinks: the
 * diagram opens, you tap WHERE the treatment went, then pick WHAT and how much.
 * Hand the phone to the injector and it's a few taps.
 *
 * INTEGRITY: Rinnova never puts a dot at an arbitrary coordinate (a dot in the
 * wrong place falsifies the record). So a tap doesn't drop a freeform dot — it
 * SNAPS to the nearest curated region (FACE_REGIONS) and shows its name to
 * confirm. Free tapping, but it always lands on real anatomy. Mirroring is
 * handled in the snap so a tap on either cheek finds the same region.
 *
 * It assembles the SAME `parsed` object the AI parser produces and hands it up
 * via onBuilt, so it flows into the existing review → save → success path with
 * all the coordinate / fan-out / bilateral logic reused. No DB changes.
 *
 * Props:
 *   onBuilt(parsed) — the assembled parsed object, on "Review & save"
 *   onBack()        — return to the log-visit choice screen
 */

const todayISO = () => new Date().toISOString().slice(0, 10)

// Every region with its resolved coordinate + midline flag, computed once.
const REGION_COORDS = FACE_REGIONS.map((r) => ({
  label: r.label,
  midline: r.midline,
  coord: getCoordinates(r.label),
})).filter((r) => r.coord)

// Nearest curated region to a tapped point. Off-axis regions are stored on the
// left; a tap on the right side is matched by also testing the mirror, so either
// cheek snaps to the same region.
function nearestRegion(x, y) {
  let best = null
  let bestD = Infinity
  for (const r of REGION_COORDS) {
    const { x: cx, y: cy } = r.coord
    const dLeft = (cx - x) ** 2 + (cy - y) ** 2
    const dRight = (2 * MIRROR_AXIS - cx - x) ** 2 + (cy - y) ** 2
    const d = Math.min(dLeft, dRight)
    if (d < bestD) {
      bestD = d
      best = r
    }
  }
  return best
}

function summary(labels) {
  const lower = labels.map((l) => l.toLowerCase())
  let s
  if (lower.length === 1) s = lower[0]
  else if (lower.length === 2) s = `${lower[0]} and ${lower[1]}`
  else s = `${lower.slice(0, -1).join(', ')}, and ${lower[lower.length - 1]}`
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const isMidline = (label) => REGION_COORDS.find((r) => r.label === label)?.midline

function ManualVisitEntry({ onBuilt, onBack }) {
  const [date, setDate] = useState(todayISO())
  // Each placement is ONE product at ONE region.
  const [placements, setPlacements] = useState([]) // {categoryKey, productName, regionLabel, mirror, amount}

  // The spot currently being filled in (set by tapping the face).
  const [active, setActive] = useState(null) // { regionLabel, mirror }
  const [categoryKey, setCategoryKey] = useState('')
  const [productName, setProductName] = useState('')
  const [otherName, setOtherName] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const category = PRODUCT_MENU.find((c) => c.key === categoryKey) || null
  const effectiveProduct = categoryKey === 'other' ? otherName.trim() : productName

  function resetBuilder() {
    setActive(null)
    setCategoryKey('')
    setProductName('')
    setOtherName('')
    setAmount('')
    setError('')
  }

  function handleTap(x, y) {
    const r = nearestRegion(x, y)
    if (!r) return
    setError('')
    // Keep any product/amount already chosen — a tap only (re)places the spot.
    setActive({ regionLabel: r.label, mirror: !r.midline })
  }

  function addPlacement() {
    if (!active) return
    if (!categoryKey) return setError('Pick what was used.')
    if (!effectiveProduct) return setError('Pick or name the product.')
    setPlacements((prev) => [
      ...prev,
      {
        categoryKey,
        productName: effectiveProduct,
        regionLabel: active.regionLabel,
        mirror: active.mirror,
        amount,
      },
    ])
    resetBuilder()
  }

  function removePlacement(i) {
    setPlacements((prev) => prev.filter((_, idx) => idx !== i))
  }

  function applyPreset(preset) {
    setError('')
    setActive(null)
    const added = preset.regions.map((label) => ({
      categoryKey: preset.key,
      productName: preset.product,
      regionLabel: label,
      mirror: !isMidline(label),
      amount: '',
    }))
    setPlacements((prev) => [...prev, ...added])
  }

  // Build the marks for the face: point categories → dots, field categories →
  // halos. The active spot shows a magenta preview dot so the snap is visible.
  const dots = []
  const halos = []
  placements.forEach((p, i) => {
    const c = getCoordinates(p.regionLabel)
    if (!c) return
    const color = categoryColor(p.categoryKey)
    const bucket = categoryMark(p.categoryKey) === 'field' ? halos : dots
    bucket.push({ id: `p${i}`, x: c.x, y: c.y, color })
    if (p.mirror) bucket.push({ id: `p${i}m`, x: 2 * MIRROR_AXIS - c.x, y: c.y, color })
  })
  if (active) {
    const c = getCoordinates(active.regionLabel)
    if (c) {
      dots.push({ id: 'active', x: c.x, y: c.y, color: '#D63384', r: 6, opacity: 0.55 })
      if (active.mirror) {
        dots.push({ id: 'active-m', x: 2 * MIRROR_AXIS - c.x, y: c.y, color: '#D63384', r: 6, opacity: 0.55 })
      }
    }
  }

  function reviewAndSave() {
    // Fold same-named products into one treatment (combining areas) so the save
    // pipeline, which groups areas by treatment name, never doubles a dot.
    const byName = {}
    for (const p of placements) {
      if (!byName[p.productName]) {
        byName[p.productName] = { name: p.productName, color_key: p.categoryKey, amount: p.amount, regions: [] }
      }
      if (!byName[p.productName].regions.some((r) => r.label === p.regionLabel)) {
        byName[p.productName].regions.push({ label: p.regionLabel, mirror: p.mirror })
      }
      if (!byName[p.productName].amount && p.amount) byName[p.productName].amount = p.amount
    }
    const merged = Object.values(byName)

    const areas = merged.flatMap((t) =>
      t.regions.map((r) => ({
        treatment_name: t.name,
        friendly_name: r.label,
        clinical_name: null,
        dose: null,
        mirror: r.mirror === true,
      }))
    )
    const distinct = [...new Set(areas.map((a) => a.friendly_name))]

    onBuilt({
      visit: {
        visit_date: date,
        provider_name: null,
        body_regions: distinct.length ? summary(distinct) : null,
        cost: null,
      },
      treatments: merged.map((t) => ({
        name: t.name,
        summary: null,
        total_dose: t.amount || null,
        lot_number: null,
        color_key: t.color_key,
      })),
      treatment_areas: areas,
      products: [],
    })
  }

  const amountOptions = categoryKey ? amountOptionsFor(categoryKey) : []
  const activeOffAxis = active && !isMidline(active.regionLabel)

  return (
    <div className="logvisit-flow">
      <div className="logvisit-flow-head">
        <h3 className="logvisit-flow-title">Add your visit</h3>
        <p className="logvisit-flow-sub">
          Tap the face where treatment went, then pick the product. Hand the phone
          to your injector if that's easier.
        </p>
      </div>

      <label className="manual-date">
        <span className="manual-label">Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="manual-date-input"
        />
      </label>

      {/* One-tap common treatments */}
      <div className="manual-presets">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="manual-preset" onClick={() => applyPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* The face — tap to place */}
      <FaceDiagram dots={dots} halos={halos} legend={null} onPointTap={handleTap} />
      <p className="manual-tap-hint">
        {active ? `Spot: ${active.regionLabel}` : 'Tap the face where the treatment went'}
      </p>

      {/* Entry panel for the tapped spot */}
      {active && (
        <div className="manual-builder">
          <div className="manual-spot-head">
            <span className="manual-spot-area">{active.regionLabel}</span>
            <span className="manual-spot-retap">Tap the face again to move this spot</span>
          </div>

          {activeOffAxis && (
            <div className="qa-side-toggle manual-spot-sides" role="group" aria-label="sides">
              <button
                type="button"
                className={`qa-side-option${active.mirror ? ' is-active' : ''}`}
                onClick={() => setActive((a) => ({ ...a, mirror: true }))}
              >
                Both sides
              </button>
              <button
                type="button"
                className={`qa-side-option${!active.mirror ? ' is-active' : ''}`}
                onClick={() => setActive((a) => ({ ...a, mirror: false }))}
              >
                One side
              </button>
            </div>
          )}

          <div className="manual-section-label">What was used?</div>
          <div className="manual-cats">
            {PRODUCT_MENU.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`manual-cat${categoryKey === c.key ? ' is-selected' : ''}`}
                onClick={() => {
                  setError('')
                  setCategoryKey(c.key)
                  setProductName('')
                  setOtherName('')
                  setAmount('')
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {category && category.products.length > 0 && (
            <div className="manual-chiprow">
              {category.products.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`qa-chip${productName === p ? ' is-selected' : ''}`}
                  onClick={() => {
                    setError('')
                    setProductName(p)
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          {categoryKey === 'other' && (
            <input
              type="text"
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="What was it called?"
              className="manual-other-input"
            />
          )}

          {categoryKey && amountOptions.length > 0 && (
            <>
              <div className="manual-section-label">
                How much? <span className="manual-optional">(optional)</span>
              </div>
              <div className="manual-chiprow">
                {amountOptions.map((opt) => (
                  <button
                    key={opt || 'none'}
                    type="button"
                    className={`qa-chip${amount === opt ? ' is-selected' : ''}`}
                    onClick={() => setAmount(opt)}
                  >
                    {opt === '' ? 'Skip' : opt}
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions" style={{ marginTop: 16 }}>
            <button type="button" className="form-cancel-btn" onClick={resetBuilder}>
              Cancel
            </button>
            <button type="button" className="form-save-btn" onClick={addPlacement}>
              Add this spot
            </button>
          </div>
        </div>
      )}

      {/* What's been placed so far */}
      {placements.length > 0 && (
        <ul className="manual-list">
          {placements.map((p, i) => (
            <li key={i} className="manual-list-item">
              <div className="manual-list-text">
                <span className="manual-list-name">{p.productName}</span>
                <span className="manual-list-areas">
                  {p.regionLabel}
                  {!isMidline(p.regionLabel) ? (p.mirror ? ' · both sides' : ' · one side') : ''}
                  {p.amount ? ` · ${p.amount}` : ''}
                </span>
              </div>
              <button
                type="button"
                className="manual-list-remove"
                onClick={() => removePlacement(i)}
                aria-label={`Remove ${p.productName} at ${p.regionLabel}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="form-actions" style={{ marginTop: 16 }}>
        <button type="button" onClick={onBack} className="form-cancel-btn">
          Back
        </button>
        <button
          type="button"
          onClick={reviewAndSave}
          className="form-save-btn"
          disabled={placements.length === 0}
        >
          Review &amp; save
        </button>
      </div>
    </div>
  )
}

export default ManualVisitEntry
