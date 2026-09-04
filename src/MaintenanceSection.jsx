import { useState } from 'react'
import { categoryOf } from './treatmentColors'
import {
  defaultPlanYear,
  doneCount,
  suggestPlanItems,
  treatmentCategoryOptions,
  planTotal,
  savePlan,
} from './maintenancePlan'

/**
 * MaintenanceSection — the "Maintenance" yearly plan (docs/your-year-brief.md).
 *
 * A collapsible section (collapsed by default, no price in the header). Expanded,
 * it shows the plan for one calendar year as rows: treatments with a planned
 * count and COMPUTED progress ("1 of 4 done"), products with directions. The
 * pencil enters an edit mode where every field is editable, rows can be added
 * (treatment or product) or removed, and the draft can be seeded from the
 * patient's own recent history.
 *
 * Discipline: descriptive, never prescriptive. It's the patient's rough draft,
 * seeded from their data and freely adjusted — Rinnova never says "you need".
 *
 * Props:
 *   planItems: all plan_items rows (any year) from data.planItems
 *   visits: visits with nested treatments (progress is computed from these)
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
  const [expanded, setExpanded] = useState(false)
  const [year, setYear] = useState(() => defaultPlanYear(planItems))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showPicker, setShowPicker] = useState(false)

  const yearItems = planItems
    .filter((i) => i.plan_year === year)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

  const hasVisits = visits.length > 0

  // ---- edit-mode helpers ----
  function toEditable(rows) {
    return rows.map((i) => ({
      id: i.id,
      kind: i.kind,
      category: i.category,
      title: i.title,
      planned_count: i.planned_count,
      est_cost: i.est_cost == null ? '' : String(i.est_cost),
      notes: i.notes || '',
      source: i.source,
    }))
  }

  function enterEdit(seed = []) {
    setError(null)
    setShowPicker(false)
    // Merge suggestions but skip categories already present, so "suggest" never
    // duplicates a row the patient already has.
    const base = toEditable(yearItems)
    const have = new Set(base.filter((r) => r.kind === 'treatment').map((r) => r.category))
    const extra = seed.filter((s) => !(s.kind === 'treatment' && have.has(s.category)))
    setDraft([...base, ...extra])
    setEditing(true)
  }

  function updateDraft(idx, field, value) {
    setDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  function removeDraft(idx) {
    setDraft((prev) => prev.filter((_, i) => i !== idx))
  }

  function addTreatment(opt) {
    setShowPicker(false)
    setDraft((prev) => [
      ...prev,
      { kind: 'treatment', category: opt.key, title: opt.label, planned_count: 1, est_cost: '', notes: '', source: 'manual' },
    ])
  }

  function addProduct() {
    setDraft((prev) => [
      ...prev,
      { kind: 'product', category: null, title: '', planned_count: 1, est_cost: '', notes: '', source: 'manual' },
    ])
  }

  function addSuggestions() {
    const have = new Set(draft.filter((r) => r.kind === 'treatment').map((r) => r.category))
    const extra = suggestPlanItems(visits).filter((s) => !have.has(s.category))
    if (extra.length === 0) return
    setDraft((prev) => [...prev, ...extra])
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      await savePlan(year, draft, yearItems)
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

  const total = planTotal(editing ? draft : yearItems)

  return (
    <section className="section">
      {/* Header toggles expand/collapse. No price here — deliberately quiet. */}
      <button
        type="button"
        className="plan-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="plan-header-text">
          <h2 className="section-title">Maintenance</h2>
          <span className="plan-header-sub">Your yearly plan</span>
        </div>
        <svg
          className={'plan-chevron' + (expanded ? ' is-open' : '')}
          width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="plan-body">
          {/* Year switcher + edit affordance. Year arrows disabled while editing
              (the draft belongs to one year). */}
          <div className="plan-toolbar">
            <div className="plan-year">
              <button
                type="button"
                className="plan-year-arrow"
                onClick={() => setYear((y) => y - 1)}
                disabled={editing}
                aria-label="Previous year"
              >
                ‹
              </button>
              <span className="plan-year-label">{year}</span>
              <button
                type="button"
                className="plan-year-arrow"
                onClick={() => setYear((y) => y + 1)}
                disabled={editing}
                aria-label="Next year"
              >
                ›
              </button>
            </div>

            {!editing && yearItems.length > 0 && (
              <button type="button" className="plan-link-btn" onClick={() => enterEdit()}>
                Edit
                <Pencil />
              </button>
            )}
          </div>

          {/* ---- EDIT MODE ---- */}
          {editing ? (
            <>
              {draft.length === 0 && (
                <p className="plan-empty-hint">
                  Add what you expect this year. It’s a rough draft you can change
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

              {/* Add controls */}
              <div className="plan-add-controls">
                {showPicker ? (
                  <div className="plan-picker">
                    {treatmentCategoryOptions().map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className="plan-picker-chip"
                        onClick={() => addTreatment(opt)}
                      >
                        <span className="plan-dot" style={{ background: opt.color }} />
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="plan-picker-cancel"
                      onClick={() => setShowPicker(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="plan-add-row">
                    <button type="button" className="plan-add-btn" onClick={() => setShowPicker(true)}>
                      <span aria-hidden="true">+</span> Add treatment
                    </button>
                    <button type="button" className="plan-add-btn" onClick={addProduct}>
                      <span aria-hidden="true">+</span> Add product
                    </button>
                    {hasVisits && (
                      <button type="button" className="plan-add-btn" onClick={addSuggestions}>
                        Suggest from my history
                      </button>
                    )}
                  </div>
                )}
              </div>

              {total > 0 && (
                <p className="plan-total">About {fmtUSD(total)} planned this year.</p>
              )}

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
              {yearItems.length === 0 ? (
                <div className="plan-empty">
                  <p className="plan-empty-text">
                    Plan out {year}: how often you expect each treatment, and what
                    to budget. A rough draft you can change anytime.
                  </p>
                  <div className="plan-add-row">
                    {hasVisits && (
                      <button
                        type="button"
                        className="plan-add-btn"
                        onClick={() => enterEdit(suggestPlanItems(visits))}
                      >
                        Suggest from my history
                      </button>
                    )}
                    <button type="button" className="plan-add-btn" onClick={() => enterEdit()}>
                      <span aria-hidden="true">+</span> Build it myself
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <ul className="plan-list">
                    {yearItems.map((item) => (
                      <PlanViewRow key={item.id} item={item} visits={visits} year={year} />
                    ))}
                  </ul>
                  {total > 0 && (
                    <p className="plan-total">About {fmtUSD(total)} planned this year.</p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

/** A read-only plan row: treatment (with progress) or product (with directions). */
function PlanViewRow({ item, visits, year }) {
  const isTreatment = item.kind !== 'product'
  const cat = isTreatment ? categoryOf(item.category) : null
  const planned = Math.max(1, item.planned_count || 1)
  const done = isTreatment ? doneCount(visits, item.category, year) : 0
  const over = done > planned
  const pct = Math.min(100, Math.round((done / planned) * 100))
  const costEach = item.est_cost != null ? fmtUSD(Number(item.est_cost)) : null

  return (
    <li className="plan-item">
      <div className="plan-item-head">
        {isTreatment && (
          <span className="plan-dot" style={{ background: cat.color }} aria-hidden="true" />
        )}
        <span className="plan-item-title">{item.title}</span>
        {costEach && (
          <span className="plan-item-cost">
            ~{costEach}{isTreatment ? ' each' : ''}
          </span>
        )}
      </div>

      {isTreatment ? (
        <div className="plan-progress">
          <div className="plan-progress-bar">
            <div className="plan-progress-fill" style={{ width: pct + '%' }} />
          </div>
          <div className="plan-progress-text">
            {over ? (
              <>
                {done} done · planned {planned}
                <span className="plan-ahead">ahead</span>
              </>
            ) : (
              <>{done} of {planned} done</>
            )}
          </div>
        </div>
      ) : (
        <>
          {item.notes && <div className="plan-item-notes">{item.notes}</div>}
          {item.planned_count > 1 && (
            <div className="plan-item-notes">Restock about {item.planned_count}× this year</div>
          )}
        </>
      )}
    </li>
  )
}

/** An editable plan row. */
function PlanEditRow({ row, onChange, onRemove }) {
  const isTreatment = row.kind !== 'product'
  const cat = isTreatment ? categoryOf(row.category) : null
  const n = Math.max(1, Number(row.planned_count) || 1)

  return (
    <div className="plan-edit-row">
      <div className="plan-edit-top">
        {isTreatment && (
          <span className="plan-dot" style={{ background: cat.color }} aria-hidden="true" />
        )}
        <input
          type="text"
          className="form-input plan-edit-title"
          value={row.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder={isTreatment ? 'Treatment' : 'Product name'}
        />
        <button type="button" className="plan-remove" onClick={onRemove} aria-label="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="plan-edit-fields">
        {isTreatment ? (
          <div className="plan-field">
            <span className="plan-field-label">Times</span>
            <div className="plan-stepper">
              <button
                type="button"
                onClick={() => onChange('planned_count', Math.max(1, n - 1))}
                aria-label="Fewer"
              >
                −
              </button>
              <span className="plan-stepper-n">{n}×</span>
              <button
                type="button"
                onClick={() => onChange('planned_count', n + 1)}
                aria-label="More"
              >
                +
              </button>
            </div>
          </div>
        ) : null}

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

      {!isTreatment && (
        <input
          type="text"
          className="form-input plan-notes-input"
          value={row.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          placeholder="Directions — e.g. use 2× daily"
        />
      )}
    </div>
  )
}

export default MaintenanceSection
