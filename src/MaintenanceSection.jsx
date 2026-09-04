import { useState } from 'react'
import { categoryOf, categoryColor } from './treatmentColors'
import { computeAreaCadence } from './areaCadence'
import { mirrorX, MIRROR_AXIS, DOT_RADIUS } from './faceGeometry'
import FaceDiagram from './FaceDiagram'
import AreaDetailModal from './AreaDetailModal'
import {
  planYears,
  areaKeyForName,
  areaDoneInYear,
  suggestAreaPlan,
  treatmentCategoryOptions,
  planTotal,
  savePlan,
} from './maintenancePlan'

/**
 * MaintenanceSection — "Areas you treat" (docs/your-year-brief.md).
 *
 * Merges the old cadence view and the yearly plan into ONE section: a weighted
 * face map, then a per-AREA breakdown that toggles between:
 *   - THIS YEAR  — descriptive, from the record ("Under eyes · 2× this year"),
 *                  or progress against a saved plan ("2 of 4 done").
 *   - PLAN NEXT YEAR — an editable draft seeded from history.
 *
 * Each row is an AREA (heading) with its dominant treatment category (the dot).
 * Descriptive, never prescriptive — "this year" reads the record; the plan is a
 * rough draft the patient adjusts.
 *
 * Props:
 *   planItems: all plan_items rows (any year) from data.planItems
 *   visits: visits with nested treatments + treatment_areas
 *   onRefetch: reload data after a save
 */

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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [openArea, setOpenArea] = useState(null)

  const { current, next } = planYears(new Date(now))
  const year = mode === 'this' ? current : next

  // All-time area map — drives the face (stable across the toggle) and the
  // this-year descriptive rows and the tap-through detail.
  const allAreas = computeAreaCadence(visits, now)
  const areaByKey = new Map(allAreas.map((a) => [a.key, a]))

  const savedItems = planItems
    .filter((i) => i.plan_year === year)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

  // Nothing to show at all → hide the section (don't explain a feature the
  // patient can't use yet), same discipline as the old cadence section.
  if (allAreas.length === 0 && planItems.length === 0) return null

  // ---- face dots (all-time weighted) ----
  const maxCount = allAreas.reduce((m, a) => Math.max(m, a.count), 0) || 1
  const dots = []
  for (const area of allAreas) {
    if (area.x == null || area.y == null) continue
    const strength = area.count / maxCount
    const r = DOT_RADIUS * (0.62 + 0.38 * strength)
    const opacity = 0.4 + 0.6 * strength
    const color = categoryColor(area.colorKeys[0])
    dots.push({ id: area.key, x: area.x, y: area.y, r, opacity, color })
    if (area.mirror && Math.abs(area.x - MIRROR_AXIS) > 0.01) {
      dots.push({ id: `${area.key}-m`, x: mirrorX(area.x), y: area.y, r, opacity, color })
    }
  }

  // ---- what to render in view mode ----
  const suggested = suggestAreaPlan(visits, now)
  const hasSavedPlan = savedItems.length > 0
  const isPastOrCurrent = year <= current

  let viewRows
  let showingSuggestion = false
  if (hasSavedPlan) {
    viewRows = savedItems.map((i) => ({ ...i, variant: isPastOrCurrent ? 'progress' : 'plan' }))
  } else if (mode === 'this') {
    // Descriptive: areas treated THIS year, from the record.
    viewRows = allAreas
      .map((a) => ({
        title: a.label,
        category: a.colorKeys[0] || 'other',
        done: areaDoneInYear(visits, a.label, year),
        variant: 'descriptive',
      }))
      .filter((r) => r.done > 0)
  } else {
    // Next year, no saved plan → the suggestion (editable via Edit).
    viewRows = suggested.map((s) => ({ ...s, variant: 'plan' }))
    showingSuggestion = suggested.length > 0
  }

  const total = planTotal(editing ? draft : viewRows)

  // ---- edit helpers ----
  function toEditable(rows) {
    return rows.map((i) => ({
      id: i.id,
      category: i.category,
      title: i.title,
      planned_count: i.planned_count || 1,
      est_cost: i.est_cost == null ? '' : String(i.est_cost),
      notes: i.notes || '',
      source: i.source,
    }))
  }

  function enterEdit() {
    setError(null)
    setShowPicker(false)
    // Edit the saved plan for this year, or seed a fresh draft from history.
    const seed = hasSavedPlan ? savedItems : suggested
    setDraft(toEditable(seed))
    setEditing(true)
  }

  function updateDraft(idx, field, value) {
    setDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }
  function removeDraft(idx) {
    setDraft((prev) => prev.filter((_, i) => i !== idx))
  }
  function addArea(opt) {
    setShowPicker(false)
    setDraft((prev) => [
      ...prev,
      { category: opt.key, title: '', planned_count: 1, est_cost: '', notes: '', source: 'manual' },
    ])
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      await savePlan(year, draft, savedItems)
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

      {dots.length > 0 && <FaceDiagram dots={dots} legend={null} />}

      {/* This year / Plan next year toggle */}
      <div className="plan-toggle" role="tablist" aria-label="Plan view">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'this'}
          className={'plan-toggle-btn' + (mode === 'this' ? ' is-active' : '')}
          onClick={() => { if (editing) return; setMode('this') }}
          disabled={editing}
        >
          This year
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'next'}
          className={'plan-toggle-btn' + (mode === 'next' ? ' is-active' : '')}
          onClick={() => { if (editing) return; setMode('next') }}
          disabled={editing}
        >
          Plan {next}
        </button>
      </div>

      {editing ? (
        /* ---- EDIT MODE ---- */
        <>
          {draft.length === 0 && (
            <p className="plan-empty-hint">
              Add the areas you plan to treat. It’s a rough draft you can change
              anytime.
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
                {treatmentCategoryOptions().map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className="plan-picker-chip"
                    onClick={() => addArea(opt)}
                  >
                    <span className="plan-dot" style={{ background: opt.color }} />
                    {opt.label}
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

          {total > 0 && <p className="plan-total">About {fmtUSD(total)} planned this year.</p>}
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
          {/* Edit affordance — plan a year (or adjust the saved plan). */}
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
                : `Plan ${next}: tap Edit to set how often you expect to treat each area.`}
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
              {total > 0 && <p className="plan-total">About {fmtUSD(total)} planned this year.</p>}
            </>
          )}
        </>
      )}

      {openArea && <AreaDetailModal area={openArea} onClose={() => setOpenArea(null)} />}
    </section>
  )
}

/** A read-only area row: area name, dot + category, and a frequency line. */
function PlanViewRow({ row, visits, year, hasDetail, onOpen }) {
  const cat = categoryOf(row.category)
  const planned = Math.max(1, row.planned_count || 1)
  const done = row.variant === 'descriptive' ? row.done : areaDoneInYear(visits, row.title, year)
  const over = done > planned
  const pct = row.variant === 'progress' ? Math.min(100, Math.round((done / planned) * 100)) : 0

  const body = (
    <>
      <div className="plan-item-head">
        <span className="plan-item-area">{row.title}</span>
        {row.est_cost != null && row.est_cost !== '' && (
          <span className="plan-item-cost">~{fmtUSD(Number(row.est_cost))} each</span>
        )}
      </div>
      <div className="plan-item-sub">
        <span className="plan-dot" style={{ background: cat.color }} aria-hidden="true" />
        <span className="plan-item-cat">{cat.label}</span>
        <span className="plan-item-freq">
          {row.variant === 'descriptive' && `· ${done}× this year`}
          {row.variant === 'plan' && `· plan ${planned}×`}
          {row.variant === 'progress' && (
            over ? (
              <>· {done} done · planned {planned}<span className="plan-ahead">ahead</span></>
            ) : (
              <>· {done} of {planned} done</>
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

/** An editable area row: area name, category dot, planned count, est cost. */
function PlanEditRow({ row, onChange, onRemove }) {
  const cat = categoryOf(row.category)
  const n = Math.max(1, Number(row.planned_count) || 1)

  return (
    <div className="plan-edit-row">
      <div className="plan-edit-top">
        <span className="plan-dot" style={{ background: cat.color }} aria-hidden="true" />
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
      <div className="plan-edit-cat">{cat.label}</div>
      <div className="plan-edit-fields">
        <div className="plan-field">
          <span className="plan-field-label">Times</span>
          <div className="plan-stepper">
            <button type="button" onClick={() => onChange('planned_count', Math.max(1, n - 1))} aria-label="Fewer">−</button>
            <span className="plan-stepper-n">{n}×</span>
            <button type="button" onClick={() => onChange('planned_count', n + 1)} aria-label="More">+</button>
          </div>
        </div>
        <div className="plan-field">
          <span className="plan-field-label">Est. $ each</span>
          <input
            type="number"
            inputMode="decimal"
            className="form-input plan-cost-input"
            value={row.est_cost}
            onChange={(e) => onChange('est_cost', e.target.value)}
            placeholder="—"
          />
        </div>
      </div>
    </div>
  )
}

export default MaintenanceSection
