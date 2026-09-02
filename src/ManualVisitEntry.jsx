import { useState } from 'react'
import { FACE_REGIONS } from './faceRegions'
import { PRODUCT_MENU, PRESETS, amountOptionsFor } from './manualEntry'

/**
 * ManualVisitEntry — build a visit by tapping, no receipt and (almost) no typing.
 *
 * The pilot's real-world need: hand the phone to the injector, or have them call
 * out what they did, and log it in seconds. So every choice is a tap — category,
 * product, area, amount — and common treatments are one-tap presets (Nefertiti
 * lift, lip flip…). The only typed field is the name under "Something else".
 *
 * It doesn't save anything itself. It assembles the SAME `parsed` object the AI
 * parser produces and hands it up via onBuilt, so it flows into the existing
 * review → save → success path unchanged (coordinates, fan-out, the bilateral
 * invariant — all reused). Region labels come from FACE_REGIONS, so every pick
 * resolves to a real face coordinate.
 *
 * Props:
 *   onBuilt(parsed) — called with the assembled parsed object on "Review & save"
 *   onBack()        — return to the log-visit choice screen
 */

const MIDLINE = Object.fromEntries(FACE_REGIONS.map((r) => [r.label, r.midline]))
const todayISO = () => new Date().toISOString().slice(0, 10)

function summary(labels) {
  const lower = labels.map((l) => l.toLowerCase())
  let s
  if (lower.length === 1) s = lower[0]
  else if (lower.length === 2) s = `${lower[0]} and ${lower[1]}`
  else s = `${lower.slice(0, -1).join(', ')}, and ${lower[lower.length - 1]}`
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function ManualVisitEntry({ onBuilt, onBack }) {
  const [date, setDate] = useState(todayISO())
  const [treatments, setTreatments] = useState([]) // { categoryKey, productName, regions:[{label,mirror}], amount }

  // Builder (the one being assembled right now)
  const [categoryKey, setCategoryKey] = useState('')
  const [productName, setProductName] = useState('')
  const [otherName, setOtherName] = useState('')
  const [regions, setRegions] = useState([]) // [{ label, mirror }]
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const category = PRODUCT_MENU.find((c) => c.key === categoryKey) || null
  const effectiveProduct = categoryKey === 'other' ? otherName.trim() : productName

  function resetBuilder() {
    setCategoryKey('')
    setProductName('')
    setOtherName('')
    setRegions([])
    setAmount('')
  }

  function pickCategory(key) {
    setError('')
    setCategoryKey(key)
    setProductName('')
    setOtherName('')
    setAmount('')
  }

  function applyPreset(preset) {
    setError('')
    setCategoryKey(preset.key)
    setProductName(preset.product)
    setOtherName('')
    setAmount('')
    setRegions(
      preset.regions.map((label) => ({ label, mirror: !MIDLINE[label] }))
    )
  }

  const isRegionOn = (label) => regions.some((r) => r.label === label)

  function toggleRegion(label) {
    setError('')
    setRegions((prev) =>
      prev.some((r) => r.label === label)
        ? prev.filter((r) => r.label !== label)
        : [...prev, { label, mirror: !MIDLINE[label] }]
    )
  }

  function setMirror(label, mirror) {
    setRegions((prev) => prev.map((r) => (r.label === label ? { ...r, mirror } : r)))
  }

  function addTreatment() {
    if (!categoryKey) return setError('Pick what was used.')
    if (!effectiveProduct) return setError('Pick or name the product.')
    if (regions.length === 0) return setError('Tap at least one area.')
    setTreatments((prev) => [
      ...prev,
      { categoryKey, productName: effectiveProduct, regions, amount },
    ])
    resetBuilder()
  }

  function removeTreatment(i) {
    setTreatments((prev) => prev.filter((_, idx) => idx !== i))
  }

  function reviewAndSave() {
    // Fold same-named products into one treatment (combining areas) so the save
    // pipeline, which groups areas by treatment name, never doubles a dot.
    const byName = {}
    for (const t of treatments) {
      if (!byName[t.productName]) {
        byName[t.productName] = {
          name: t.productName,
          color_key: t.categoryKey,
          amount: t.amount,
          regions: [],
        }
      }
      for (const r of t.regions) {
        if (!byName[t.productName].regions.some((x) => x.label === r.label)) {
          byName[t.productName].regions.push(r)
        }
      }
      if (!byName[t.productName].amount && t.amount) byName[t.productName].amount = t.amount
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

  const offAxisSelected = regions.filter((r) => !MIDLINE[r.label])
  const amountOptions = categoryKey ? amountOptionsFor(categoryKey) : []

  return (
    <div className="logvisit-flow">
      <div className="logvisit-flow-head">
        <h3 className="logvisit-flow-title">Add your visit</h3>
        <p className="logvisit-flow-sub">
          Tap in what was done — hand the phone to your injector if that's easier.
        </p>
      </div>

      {/* Date */}
      <label className="manual-date">
        <span className="manual-label">Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="manual-date-input"
        />
      </label>

      {/* Treatments added so far */}
      {treatments.length > 0 && (
        <ul className="manual-list">
          {treatments.map((t, i) => (
            <li key={i} className="manual-list-item">
              <div className="manual-list-text">
                <span className="manual-list-name">{t.productName}</span>
                <span className="manual-list-areas">
                  {t.regions.map((r) => r.label).join(', ')}
                  {t.amount ? ` · ${t.amount}` : ''}
                </span>
              </div>
              <button
                type="button"
                className="manual-list-remove"
                onClick={() => removeTreatment(i)}
                aria-label={`Remove ${t.productName}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Builder */}
      <div className="manual-builder">
        <div className="manual-section-label">
          {treatments.length ? 'Add another' : 'What did you get?'}
        </div>

        {/* One-tap presets */}
        <div className="manual-presets">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="manual-preset"
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Category tiles */}
        <div className="manual-cats">
          {PRODUCT_MENU.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`manual-cat${categoryKey === c.key ? ' is-selected' : ''}`}
              onClick={() => pickCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Product picker (or a name field for "Something else") */}
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

        {/* Where */}
        {categoryKey && (
          <>
            <div className="manual-section-label">Where?</div>
            <div className="qa-chips">
              {FACE_REGIONS.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  className={`qa-chip${isRegionOn(r.label) ? ' is-selected' : ''}`}
                  onClick={() => toggleRegion(r.label)}
                  aria-pressed={isRegionOn(r.label)}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {offAxisSelected.length > 0 && (
              <div className="qa-sides">
                {offAxisSelected.map((r) => (
                  <div key={r.label} className="qa-side-row">
                    <span className="qa-side-label">{r.label}</span>
                    <div className="qa-side-toggle" role="group" aria-label={`${r.label} sides`}>
                      <button
                        type="button"
                        className={`qa-side-option${r.mirror ? ' is-active' : ''}`}
                        onClick={() => setMirror(r.label, true)}
                      >
                        Both sides
                      </button>
                      <button
                        type="button"
                        className={`qa-side-option${!r.mirror ? ' is-active' : ''}`}
                        onClick={() => setMirror(r.label, false)}
                      >
                        One side
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* How much (optional) */}
        {categoryKey && amountOptions.length > 0 && (
          <>
            <div className="manual-section-label">How much? <span className="manual-optional">(optional)</span></div>
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

        <button type="button" className="manual-add-btn" onClick={addTreatment}>
          Add to visit
        </button>
      </div>

      <div className="form-actions" style={{ marginTop: 16 }}>
        <button type="button" onClick={onBack} className="form-cancel-btn">
          Back
        </button>
        <button
          type="button"
          onClick={reviewAndSave}
          className="form-save-btn"
          disabled={treatments.length === 0}
        >
          Review &amp; save
        </button>
      </div>
    </div>
  )
}

export default ManualVisitEntry
