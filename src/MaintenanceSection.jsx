import { useState } from 'react'
import { categoryOf, categoryColor } from './treatmentColors'
import { computeAreaCadence } from './areaCadence'
import { getCoordinates } from './faceCoordinates'
import { mirrorX, MIRROR_AXIS, DOT_RADIUS } from './faceGeometry'
import { FACE_REGIONS } from './faceRegions'
import FaceDiagram from './FaceDiagram'
import AreaDetailModal from './AreaDetailModal'
import {
  planYears,
  areaKeyForName,
  areaDoneInYear,
  suggestAreaPlan,
  savePlan,
} from './maintenancePlan'

/**
 * MaintenanceSection — "Areas you treat" (docs/your-year-brief.md).
 *
 * A weighted face map (toggle sits ABOVE it), then a per-AREA breakdown that
 * switches between:
 *   - THIS YEAR — descriptive, from the record ("Under eyes · 2× this year"),
 *     or progress against a saved plan ("2 of 4 done"). Shows the treatment dot.
 *   - PLAN {next} — an editable draft seeded from history. A plan is just AREA +
 *     estimated number of times — NOT a product (that can change), and NOT a
 *     per-area cost (too hard to pin down). One optional annual estimated cost
 *     sits at the bottom, something the patient sets with their provider.
 *
 * Descriptive, never prescriptive.
 *
 * The single annual estimate is stored as a kind='product' plan_items row (the
 * only such row per year) — a carrier, so it needs no schema change. Area rows
 * are kind='treatment'.
 *
 * Props:
 *   planItems: all plan_items rows (any year) from data.planItems
 *   visits: visits with nested treatments + treatment_areas
 *   onRefetch: reload data after a save
 */

const ESTIMATE_TITLE = 'Estimated annual cost'

const fmtUSD = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)

function Pencil() {
  return (
    <svg className="edit-pencil" width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M10.5 1.5 L12.5 3.5 L4 12 L1.5 12.5 L2 10 L10.5 1.5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function MaintenanceSection({ planItems = [], visits = [], onRefetch }) {
  const [now] = useState(() => Date.now())
  const [mode, setMode] = useState('this') // 'this' | 'next'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState([])
  const [estimateInput, setEstimateInput] = useState('') // annual estimate, string
  const [estimateRowId, setEstimateRowId] = useState(null)
  const [showEstimate, setShowEstimate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [openArea, setOpenArea] = useState(null)

  const { current, next } = planYears(new Date(now))
  const year = mode === 'this' ? current : next

  const allAreas = computeAreaCadence(visits, now)
  const areaByKey = new Map(allAreas.map((a) => [a.key, a]))

  const savedItems = planItems.filter((i) => i.plan_year === year)
  const savedAreas = savedItems
    .filter((i) => i.kind !== 'product')
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  const savedEstimateRow = savedItems.find((i) => i.kind === 'product') || null

  if (allAreas.length === 0 && planItems.length === 0) return null

  // ---- face dots ----
  // "This year" shows the all-time weighted history map; the PLAN (view or edit)
  // shows exactly the plan's areas, so adding/removing a row adds/removes its dot.
  const maxCount = allAreas.reduce((m, a) => Math.max(m, a.count), 0) || 1
  const historyDots = []
  for (const area of allAreas) {
    if (area.x == null || area.y == null) continue
    const strength = area.count / maxCount
    const r = DOT_RADIUS * (0.62 + 0.38 * strength)
    const opacity = 0.4 + 0.6 * strength
    const color = categoryColor(area.colorKeys[0])
    historyDots.push({ id: area.key, x: area.x, y: area.y, r, opacity, color })
    if (area.mirror && Math.abs(area.x - MIRROR_AXIS) > 0.01) {
      historyDots.push({ id: `${area.key}-m`, x: mirrorX(area.x), y: area.y, r, opacity, color })
    }
  }

  // Dots for a set of plan rows: one per placeable area, coloured by its
  // (dominant/derived) category and sized by planned times.
  function planDots(rows) {
    const maxN = rows.reduce((m, r) => Math.max(m, r.planned_count || 1), 0) || 1
    const out = []
    for (const r of rows) {
      const coord = getCoordinates(r.title)
      if (!coord) continue
      const cat = r.category || areaByKey.get(areaKeyForName(r.title))?.colorKeys[0] || 'other'
      const strength = (r.planned_count || 1) / maxN
      const rad = DOT_RADIUS * (0.62 + 0.38 * strength)
      const opacity = 0.4 + 0.6 * strength
      const color = categoryColor(cat)
      out.push({ id: r.title, x: coord.x, y: coord.y, r: rad, opacity, color })
      if (Math.abs(coord.x - MIRROR_AXIS) > 0.01) {
        out.push({ id: `${r.title}-m`, x: mirrorX(coord.x), y: coord.y, r: rad, opacity, color })
      }
    }
    return out
  }

  // ---- view rows ----
  const suggested = suggestAreaPlan(visits, now)
  const hasSavedPlan = savedAreas.length > 0
  const isPastOrCurrent = year <= current

  let viewRows
  let showingSuggestion = false
  if (hasSavedPlan) {
    viewRows = savedAreas.map((i) => ({ ...i, variant: isPastOrCurrent ? 'progress' : 'plan' }))
  } else if (mode === 'this') {
    viewRows = allAreas
      .map((a) => ({
        title: a.label,
        category: a.colorKeys[0] || 'other',
        done: areaDoneInYear(visits, a.label, year),
        variant: 'descriptive',
      }))
      .filter((r) => r.done > 0)
  } else {
    viewRows = suggested.map((s) => ({ ...s, variant: 'plan' }))
    showingSuggestion = suggested.length > 0
  }

  const estimateValue = savedEstimateRow?.est_cost != null ? Number(savedEstimateRow.est_cost) : null

  // Actual spend for the current year — the sum of logged visit costs. Real
  // money, so no "about"; it's the total of what's been recorded this year.
  const spentThisYear = visits.reduce((s, v) => {
    if (!v?.visit_date || Number(v.visit_date.slice(0, 4)) !== current) return s
    const c = Number(v.cost)
    return c && !Number.isNaN(c) ? s + c : s
  }, 0)

  // The face follows the draft while editing, the plan while viewing next year,
  // and the history map for "this year".
  const dots = editing
    ? planDots(draft)
    : mode === 'next'
      ? planDots(viewRows)
      : historyDots

  // ---- edit helpers ----
  function enterEdit() {
    setError(null)
    setShowPicker(false)
    const seed = hasSavedPlan ? savedAreas : suggested
    setDraft(
      seed.map((i) => ({
        id: i.id,
        title: i.title,
        planned_count: i.planned_count || 1,
        category: i.category ?? null,
        source: i.source,
      }))
    )
    setEstimateInput(estimateValue != null ? String(estimateValue) : '')
    setEstimateRowId(savedEstimateRow?.id || null)
    setShowEstimate(estimateValue != null)
    setEditing(true)
  }

  function updateDraft(idx, field, value) {
    setDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }
  function removeDraft(idx) {
    setDraft((prev) => prev.filter((_, i) => i !== idx))
  }
  function addArea(region) {
    setShowPicker(false)
    // Colour the dot from history if we've treated this area before, else grey.
    // This is a visual tie to the face, not a committed "product".
    const cat = areaByKey.get(areaKeyForName(region.label))?.colorKeys[0] || 'other'
    setDraft((prev) => [
      ...prev,
      { title: region.label, planned_count: 1, category: cat, source: 'manual' },
    ])
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      // Area rows + (optionally) the single estimate carrier row.
      const rows = draft.map((d) => ({ ...d, kind: 'treatment' }))
      const est = estimateInput.trim()
      if (est !== '' && !Number.isNaN(Number(est))) {
        rows.push({
          id: estimateRowId || undefined,
          kind: 'product',
          title: ESTIMATE_TITLE,
          planned_count: 1,
          est_cost: est,
          category: null,
          source: 'manual',
        })
      }
      // original = ALL saved rows for the year (areas + estimate), so a cleared
      // estimate is deleted by the diff.
      await savePlan(year, rows, savedItems)
      setEditing(false)
      setDraft([])
      if (onRefetch) await onRefetch()
    } catch (e) {
      setError(e.message || 'Could not save your plan')
    } finally {
      setSaving(false)
    }
  }
  function handleCancel() {
    setEditing(false)
    setDraft([])
    setError(null)
    setShowPicker(false)
  }

  function openDetail(row) {
    const area = areaByKey.get(areaKeyForName(row.title))
    if (area) setOpenArea(area)
  }

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Areas you treat</h2>
      </div>

      {/* Toggle ABOVE the diagram. */}
      <div className="plan-toggle" role="tablist" aria-label="Plan view">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'this'}
          className={'plan-toggle-btn' + (mode === 'this' ? ' is-active' : '')}
          onClick={() => { if (!editing) setMode('this') }}
          disabled={editing}
        >
          This year
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'next'}
          className={'plan-toggle-btn' + (mode === 'next' ? ' is-active' : '')}
          onClick={() => { if (!editing) setMode('next') }}
          disabled={editing}
        >
          Plan {next}
        </button>
      </div>

      {dots.length > 0 && <FaceDiagram dots={dots} legend={null} />}

      {editing ? (
        /* ---- EDIT MODE (plan a year) ---- */
        <>
          {draft.length === 0 && (
            <p className="plan-empty-hint">
              Add the areas you expect to treat and roughly how often. A rough
              draft you can change anytime.
            </p>
          )}

          {draft.map((row, idx) => (
            <PlanEditRow
              key={idx}
              row={row}
              onChange={(field, value) => updateDraft(idx, field, value)}
              onRemove={() => removeDraft(idx)}
            />
          ))}

          <div className="plan-add-controls">
            {showPicker ? (
              <div className="plan-picker">
                {FACE_REGIONS.map((region) => (
                  <button
                    key={region.label}
                    type="button"
                    className="plan-picker-chip"
                    onClick={() => addArea(region)}
                  >
                    {region.label}
                  </button>
                ))}
                <button type="button" className="plan-picker-cancel" onClick={() => setShowPicker(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="plan-add-btn" onClick={() => setShowPicker(true)}>
                <span aria-hidden="true">+</span> Add an area
              </button>
            )}
          </div>

          {/* Single optional annual estimate — set with your provider. */}
          <div className="plan-estimate-edit">
            {showEstimate ? (
              <label className="plan-estimate-field">
                <span className="plan-field-label">Estimated cost for the year</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="form-input plan-cost-input"
                  value={estimateInput}
                  onChange={(e) => setEstimateInput(e.target.value)}
                  placeholder="—"
                />
              </label>
            ) : (
              <button
                type="button"
                className="plan-add-btn"
                onClick={() => setShowEstimate(true)}
              >
                <span aria-hidden="true">+</span> Add estimated cost
              </button>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions" style={{ marginTop: 12 }}>
            <button type="button" className="form-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save plan'}
            </button>
            <button type="button" className="form-cancel-btn" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        /* ---- VIEW MODE ---- */
        <>
          <div className="plan-viewbar">
            {showingSuggestion && (
              <span className="plan-suggestion-note">Suggested from your history</span>
            )}
            {(mode === 'next' || hasSavedPlan) && (
              <button type="button" className="plan-link-btn" onClick={enterEdit}>
                {hasSavedPlan ? 'Edit' : 'Edit & save'}
                <Pencil />
              </button>
            )}
          </div>

          {viewRows.length === 0 ? (
            <p className="plan-empty-text">
              {mode === 'this'
                ? `Nothing logged for ${year} yet.`
                : `Plan ${next}: tap Edit to set the areas you expect to treat.`}
            </p>
          ) : (
            <>
              <ul className="plan-list">
                {viewRows.map((row, i) => (
                  <PlanViewRow
                    key={row.id || `r-${i}`}
                    row={row}
                    visits={visits}
                    year={year}
                    hasDetail={!!areaByKey.get(areaKeyForName(row.title))}
                    onOpen={() => openDetail(row)}
                  />
                ))}
              </ul>
              {mode === 'this'
                ? spentThisYear > 0 && (
                    <p className="plan-total">Total this year: {fmtUSD(spentThisYear)}.</p>
                  )
                : estimateValue != null && (
                    <p className="plan-total">
                      Estimated cost for {year}: about {fmtUSD(estimateValue)}.
                    </p>
                  )}
            </>
          )}
        </>
      )}

      {openArea && <AreaDetailModal area={openArea} onClose={() => setOpenArea(null)} />}
    </section>
  )
}

/** A read-only area row. Descriptive rows show the treatment dot; plan rows are
 *  just area + number (a plan isn't tied to a product). */
function PlanViewRow({ row, visits, year, hasDetail, onOpen }) {
  const isDescriptive = row.variant === 'descriptive'
  // The dot always shows (a visual tie to the face); the category LABEL only on
  // the descriptive "this year" rows — a plan isn't tied to a product.
  const cat = categoryOf(row.category || 'other')
  const planned = Math.max(1, row.planned_count || 1)
  const done = isDescriptive ? row.done : areaDoneInYear(visits, row.title, year)
  const over = done > planned
  const pct = row.variant === 'progress' ? Math.min(100, Math.round((done / planned) * 100)) : 0

  const body = (
    <>
      <div className="plan-item-head">
        <span className="plan-item-area">{row.title}</span>
      </div>
      <div className="plan-item-sub">
        <span className="plan-dot" style={{ background: cat.color }} aria-hidden="true" />
        {isDescriptive && <span className="plan-item-cat">{cat.label}</span>}
        <span className="plan-item-freq">
          {row.variant === 'descriptive' && `· ${done}× this year`}
          {row.variant === 'plan' && `about ${planned}× a year`}
          {row.variant === 'progress' && (
            over ? (
              <>{done} done · planned {planned}<span className="plan-ahead">ahead</span></>
            ) : (
              <>{done} of {planned} done</>
            )
          )}
        </span>
      </div>
      {row.variant === 'progress' && (
        <div className="plan-progress-bar">
          <div className="plan-progress-fill" style={{ width: pct + '%' }} />
        </div>
      )}
    </>
  )

  if (hasDetail) {
    return (
      <li className="plan-item">
        <button type="button" className="plan-item-btn" onClick={onOpen}>
          {body}
          <span className="plan-item-chevron" aria-hidden="true">›</span>
        </button>
      </li>
    )
  }
  return <li className="plan-item">{body}</li>
}

/** An editable plan row: area name + estimated times. No product, no per-row cost. */
function PlanEditRow({ row, onChange, onRemove }) {
  const n = Math.max(1, Number(row.planned_count) || 1)
  return (
    <div className="plan-edit-row">
      <div className="plan-edit-top">
        <span
          className="plan-dot"
          style={{ background: categoryOf(row.category || 'other').color }}
          aria-hidden="true"
        />
        <input
          type="text"
          className="form-input plan-edit-title"
          value={row.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="Area (e.g. Under eyes)"
        />
        <button type="button" className="plan-remove" onClick={onRemove} aria-label="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="plan-edit-fields">
        <div className="plan-field">
          <span className="plan-field-label">Times a year</span>
          <div className="plan-stepper">
            <button type="button" onClick={() => onChange('planned_count', Math.max(1, n - 1))} aria-label="Fewer">−</button>
            <span className="plan-stepper-n">{n}×</span>
            <button type="button" onClick={() => onChange('planned_count', n + 1)} aria-label="More">+</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MaintenanceSection
