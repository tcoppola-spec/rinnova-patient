import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabaseClient'

/**
 * VisitCard
 *
 * Compact visit card with subtle inline cost editing.
 *
 * Two zones (no visual separation):
 *   - Main area (tap = opens detail modal)
 *   - Cost link (tap = inline edit, NEVER opens modal)
 *
 * Props:
 *   visit: visit object with body_regions, treatments, provider_name, cost
 *   onClick: function called when main area tapped (opens modal)
 *   onRefetch: function called after a successful cost save
 */
function VisitCard({ visit, onClick, onRefetch }) {
  const visitDate = new Date(visit.visit_date + 'T00:00:00')
  const monthShort = visitDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day = visitDate.getDate()
  const year = visitDate.getFullYear()
  const dateLine = monthShort + ' ' + day + ', ' + year

  const treatmentCount = (visit.treatments || []).length
  const countLabel = treatmentCount + ' treatment' + (treatmentCount !== 1 ? 's' : '')
  const providerCompact = formatProviderShort(visit.provider_name)

  return (
    <div className="visit-card">
      <button type="button" onClick={onClick} className="visit-card-main">
        <div className="visit-card-date">{dateLine}</div>

        {visit.body_regions && (
          <div className="visit-card-regions">{visit.body_regions}</div>
        )}

        <div className="visit-card-meta">
          {countLabel}
          {providerCompact && (
            <> with {providerCompact}</>
          )}
        </div>

        <div className="visit-card-cta">
          View visit details <span aria-hidden="true">→</span>
        </div>
      </button>

      <div className="visit-card-cost-row">
        <CostEditor visit={visit} onSaved={onRefetch} />
      </div>
    </div>
  )
}

/**
 * CostEditor
 *
 * Subtle inline editor for visit cost. Shows either:
 *   - "Add cost" link (when empty)
 *   - "Cost $X,XXX" with pencil icon (when filled)
 *   - Input + Save/Cancel (when editing)
 */
function CostEditor({ visit, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(visit.cost != null ? String(visit.cost) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const costFormatted = visit.cost != null
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(visit.cost)
    : null

  function startEdit() {
    setError(null)
    setInputValue(visit.cost != null ? String(visit.cost) : '')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setInputValue(visit.cost != null ? String(visit.cost) : '')
    setError(null)
  }

  async function handleSave() {
    setError(null)
    const trimmed = inputValue.trim()
    if (trimmed === '') {
      setError('Enter a cost')
      return
    }
    const cleaned = trimmed.replace(/[$,\s]/g, '')
    const parsed = parseFloat(cleaned)
    if (isNaN(parsed) || parsed < 0) {
      setError('Enter a valid amount')
      return
    }

    setSaving(true)
    const { error: saveError } = await supabase
      .from('visits')
      .update({ cost: parsed })
      .eq('id', visit.id)
    setSaving(false)

    if (saveError) {
      setError(saveError.message || 'Could not save')
      return
    }

    setEditing(false)
    if (onSaved) onSaved()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  if (editing) {
    return (
      <div className="cost-editor">
        <div className="cost-editor-input-row">
          <span className="cost-editor-prefix">$</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0"
            className="cost-editor-input"
            disabled={saving}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="cost-editor-save"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="cost-editor-cancel"
            aria-label="Cancel"
          >
            ×
          </button>
        </div>
        {error && <div className="cost-editor-error">{error}</div>}
      </div>
    )
  }

  if (costFormatted) {
    return (
      <button type="button" onClick={startEdit} className="cost-link cost-link-filled">
        <span>Cost {costFormatted}</span>
        <svg className="cost-pencil" width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M10.5 1.5 L12.5 3.5 L4 12 L1.5 12.5 L2 10 L10.5 1.5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
        </svg>
      </button>
    )
  }

  return (
    <button type="button" onClick={startEdit} className="cost-link cost-link-empty">
      Add cost
    </button>
  )
}

function formatProviderShort(name) {
  if (!name) return null
  let cleaned = name.replace(/,\s*(MD|DO|DDS|PA|NP|RN|MA|DMD|DPT|PharmD)\.?$/i, '').trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length === 0) return name
  const hasDr = /^Dr\.?$/i.test(parts[0])
  const namesOnly = hasDr ? parts.slice(1) : parts
  if (namesOnly.length === 0) return name
  const particles = /^(del|van|de|la|von|du|le|st|saint)$/i
  let lastName
  if (namesOnly.length >= 2 && particles.test(namesOnly[namesOnly.length - 2])) {
    lastName = namesOnly.slice(-2).join(' ')
  } else {
    lastName = namesOnly[namesOnly.length - 1]
  }
  return hasDr ? 'Dr. ' + lastName : lastName
}

export default VisitCard
