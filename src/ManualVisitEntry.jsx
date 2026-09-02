import { useState } from 'react'
import FaceDiagram from './FaceDiagram'
import { FACE_REGIONS } from './faceRegions'
import { getCoordinates } from './faceCoordinates'
import { MIRROR_AXIS } from './faceGeometry'
import { categoryColor, categoryMark } from './treatmentColors'
import { PRODUCT_MENU, PRESETS, doseConfigFor } from './manualEntry'

/**
 * ManualVisitEntry — build a visit by tapping the FACE, no receipt.
 *
 * The flow the pilot asked for, and the way an injector thinks: the diagram
 * opens, you tap WHERE the treatment went, then pick WHAT, how much, and add it.
 * Hand the phone to the injector and it's a few taps.
 *
 * INTEGRITY: Rinnova never puts a dot at an arbitrary coordinate. A tap SNAPS to
 * the nearest curated region (FACE_REGIONS) and shows its name to confirm — free
 * tapping that always lands on real anatomy. Mirroring is handled in the snap so
 * a tap on either cheek finds the same region.
 *
 * DOSE is a number + unit per spot (0.4 cc, 10 units), so a visit can carry the
 * per-area breakdown and a rolled-up total — the way clinical notes read.
 *
 * It assembles the SAME `parsed` object the AI parser produces and hands it up
 * via onBuilt, so it flows into the existing review → save → success path with
 * all the coordinate / fan-out / bilateral logic reused. No DB changes.
 *
 * Props:
 *   onBuilt(parsed) — the assembled parsed object, on "Review & save"
 *   onCancel()      — close the whole log-a-visit flow (discarding entry)
 */

const todayISO = () => new Date().toISOString().slice(0, 10)

const REGION_COORDS = FACE_REGIONS.map((r) => ({
  label: r.label,
  midline: r.midline,
  coord: getCoordinates(r.label),
})).filter((r) => r.coord)

// Nearest curated region to a tapped point. Off-axis regions are stored on the
// left; a tap on the right is matched via the mirror, so either side snaps to
// the same region.
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

// Roll per-spot doses up to a visit total, but only when they clearly add up:
// all numeric and the same unit. Otherwise leave the total blank rather than
// guess (e.g. mixing "cc" and "syringe").
function sumDoses(doses) {
  const parts = doses
    .filter((d) => d && String(d).trim())
    .map((d) => {
      const m = String(d).trim().match(/^([\d.]+)\s*(.*)$/)
      return m ? { n: parseFloat(m[1]), unit: (m[2] || '').trim().toLowerCase() } : null
    })
  if (parts.length === 0 || parts.some((p) => !p || Number.isNaN(p.n))) return null
  const unit = parts[0].unit
  if (parts.some((p) => p.unit !== unit)) return null
  const total = +parts.reduce((s, p) => s + p.n, 0).toFixed(2)
  return unit ? `${total} ${unit}` : String(total)
}

function ManualVisitEntry({ onBuilt, onCancel }) {
  const [date, setDate] = useState(todayISO())
  // Each placement is ONE product at ONE region, with its own dose.
  const [placements, setPlacements] = useState([]) // {categoryKey, productName, regionLabel, mirror, dose}

  const [active, setActive] = useState(null) // { regionLabel, mirror } — the tapped spot
  const [pendingPreset, setPendingPreset] = useState(null) // preset awaiting a product

  const [categoryKey, setCategoryKey] = useState('')
  const [productName, setProductName] = useState('')
  const [otherName, setOtherName] = useState('')
  const [amountValue, setAmountValue] = useState('') // the number, as text
  const [amountUnit, setAmountUnit] = useState('')
  const [diluted, setDiluted] = useState(false)
  const [error, setError] = useState('')

  const category = PRODUCT_MENU.find((c) => c.key === categoryKey) || null
  const effectiveProduct = categoryKey === 'other' ? otherName.trim() : productName
  const doseConfig = categoryKey ? doseConfigFor(categoryKey) : null

  function resetBuilder() {
    setActive(null)
    setCategoryKey('')
    setProductName('')
    setOtherName('')
    setAmountValue('')
    setAmountUnit('')
    setDiluted(false)
    setError('')
  }

  function pickCategory(key) {
    setError('')
    setCategoryKey(key)
    setProductName('')
    setOtherName('')
    setDiluted(false)
    setAmountValue('')
    const cfg = doseConfigFor(key)
    setAmountUnit(cfg ? cfg.units[0] : '')
  }

  function handleTap(x, y) {
    const r = nearestRegion(x, y)
    if (!r) return
    setError('')
    setPendingPreset(null) // tapping the face dismisses a half-started preset
    setActive({ regionLabel: r.label, mirror: !r.midline })
  }

  function currentDose() {
    const val = amountValue.trim()
    return val ? `${val} ${amountUnit}`.trim() : ''
  }

  function addPlacement() {
    if (!active) return
    if (!categoryKey) return setError('Pick what was used.')
    if (!effectiveProduct) return setError('Pick or name the product.')
    // Dilution: for Radiesse it's a distinct clinical thing with its own colour;
    // for anything else it's a note on the same product (same colour).
    let finalCategory = categoryKey
    let finalProduct = effectiveProduct
    if (diluted) {
      if (categoryKey === 'radiesse') finalCategory = 'radiesse-light'
      finalProduct = `${effectiveProduct} (diluted)`
    }
    setPlacements((prev) => [
      ...prev,
      {
        categoryKey: finalCategory,
        productName: finalProduct,
        regionLabel: active.regionLabel,
        mirror: active.mirror,
        dose: currentDose(),
      },
    ])
    resetBuilder()
  }

  function removePlacement(i) {
    setPlacements((prev) => prev.filter((_, idx) => idx !== i))
  }

  // A preset only decides the category + regions; the product is chosen next.
  function applyPreset(preset) {
    setError('')
    setActive(null)
    setPendingPreset(preset)
  }

  function addPresetWithProduct(product) {
    if (!pendingPreset) return
    const added = pendingPreset.regions.map((label) => ({
      categoryKey: pendingPreset.key,
      productName: product,
      regionLabel: label,
      mirror: !isMidline(label),
      dose: '',
    }))
    setPlacements((prev) => [...prev, ...added])
    setPendingPreset(null)
  }

  // Marks for the face: point categories → dots, field → halos. The active spot
  // shows a magenta preview dot so the snap is visible.
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
    // Fold same-named products into one treatment (combining areas + doses) so
    // the save pipeline, which groups areas by treatment name, never doubles a
    // dot. Each area keeps its own dose; the treatment total rolls them up.
    const byName = {}
    for (const p of placements) {
      if (!byName[p.productName]) {
        byName[p.productName] = { name: p.productName, color_key: p.categoryKey, regions: [] }
      }
      if (!byName[p.productName].regions.some((r) => r.label === p.regionLabel)) {
        byName[p.productName].regions.push({ label: p.regionLabel, mirror: p.mirror, dose: p.dose || '' })
      }
    }
    const merged = Object.values(byName)

    const areas = merged.flatMap((t) =>
      t.regions.map((r) => ({
        treatment_name: t.name,
        friendly_name: r.label,
        clinical_name: null,
        dose: r.dose || null,
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
        total_dose: sumDoses(t.regions.map((r) => r.dose)),
        lot_number: null,
        color_key: t.color_key,
      })),
      treatment_areas: areas,
      products: [],
    })
  }

  const activeOffAxis = active && !isMidline(active.regionLabel)
  const presetProducts = pendingPreset
    ? PRODUCT_MENU.find((c) => c.key === pendingPreset.key)?.products || []
    : []

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

      {/* A preset was tapped — pick which product before it fills in. */}
      {pendingPreset && (
        <div className="manual-builder">
          <div className="manual-section-label">{pendingPreset.label} — which product?</div>
          <div className="qa-chips">
            {presetProducts.map((p) => (
              <button key={p} type="button" className="qa-chip" onClick={() => addPresetWithProduct(p)}>
                {p}
              </button>
            ))}
          </div>
          <div className="form-actions" style={{ marginTop: 14 }}>
            <button type="button" className="form-cancel-btn" onClick={() => setPendingPreset(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

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

          {!categoryKey ? (
            <>
              <div className="manual-section-label">What was used?</div>
              <div className="qa-chips">
                {PRODUCT_MENU.map((c) => (
                  <button key={c.key} type="button" className="qa-chip" onClick={() => pickCategory(c.key)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Chosen type collapses to a labelled line — no wall of tiles, and
                  ONE action colour (magenta) across the whole panel. */}
              <div className="manual-chosen">
                <span className="manual-chosen-label">{category?.label}</span>
                <button type="button" className="manual-change" onClick={resetBuilder}>
                  Change
                </button>
              </div>

              {category && category.products.length > 0 && (
                <>
                  <div className="manual-section-label">Which product?</div>
                  <div className="qa-chips">
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
                </>
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

              {/* Dilution — injectables only (you don't dilute a laser). */}
              {categoryMark(categoryKey) === 'point' && (
                <label className="manual-diluted">
                  <input
                    type="checkbox"
                    checked={diluted}
                    onChange={(e) => setDiluted(e.target.checked)}
                  />
                  <span>Diluted / hyperdilute</span>
                </label>
              )}

              {/* Dose — a real number + unit (0.4 cc, 10 units). Per spot, so a
                  visit keeps the breakdown and rolls up to a total. */}
              {doseConfig && (
                <>
                  <div className="manual-section-label">
                    How much? <span className="manual-optional">(optional)</span>
                  </div>
                  {doseConfig.units.length > 1 && (
                    <div className="qa-side-toggle manual-unit-toggle" role="group" aria-label="unit">
                      {doseConfig.units.map((u) => (
                        <button
                          key={u}
                          type="button"
                          className={`qa-side-option${amountUnit === u ? ' is-active' : ''}`}
                          onClick={() => setAmountUnit(u)}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="manual-dose-row">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountValue}
                      onChange={(e) => setAmountValue(e.target.value.replace(/[^\d.]/g, ''))}
                      placeholder={`e.g. ${doseConfig.quick[0] || '1'}`}
                      className="manual-dose-input"
                    />
                    <span className="manual-dose-unit">{amountUnit}</span>
                  </div>
                  {doseConfig.quick.length > 0 && (
                    <div className="qa-chips manual-dose-quick">
                      {doseConfig.quick.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className={`qa-chip${amountValue === q ? ' is-selected' : ''}`}
                          onClick={() => setAmountValue(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
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
                  {p.dose ? ` · ${p.dose}` : ''}
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
        <button type="button" onClick={onCancel} className="form-cancel-btn">
          Cancel
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
