import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabaseClient'

/**
 * VisitCard
 *
 * Compact visit card with subtle inline editing of provider + cost.
 *
 * Two zones (no visual separation):
 *   - Main area (tap = opens detail modal)
 *   - Meta row: "Provider · Cost" links (tap = inline edit, NEVER opens modal)
 *
 * Props:
 *   visit: visit object with body_regions, treatments, provider_name, cost
 *   onClick: function called when main area tapped (opens modal)
 *   onRefetch: function called after a successful save
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
        <VisitMetaEditor visit={visit} onSaved={onRefetch} />
      </div>
    </div>
  )
}

function Pencil() {
  return (
    <svg className="cost-pencil" width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M10.5 1.5 L12.5 3.5 L4 12 L1.5 12.5 L2 10 L10.5 1.5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/**
 * VisitMetaEditor
 *
 * The "Provider · Cost" row. Shows two subtle links by default; tapping one
 * swaps the whole row for that field's inline input (so the two never fight for
 * space). Both write straight to the visit row — visits allows the patient to
 * update their own visit (same path the cost editor always used).
 */
function VisitMetaEditor({ visit, onSaved }) {
  const [editing, setEditing] = useState(null) // null | 'provider' | 'cost'
  const [providerValue, setProviderValue] = useState(visit.provider_name || '')
  const [costValue, setCostValue] = useState(visit.cost != null ? String(visit.cost) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select?.()
    }
  }, [editing])

  const costFormatted = visit.cost != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(visit.cost)
    : null
  const providerShort = formatProviderShort(visit.provider_name)

  function startEdit(field) {
    setError(null)
    setProviderValue(visit.provider_name || '')
    setCostValue(visit.cost != null ? String(visit.cost) : '')
    setEditing(field)
  }

  function cancel() {
    setEditing(null)
    setError(null)
  }

  async function saveProvider() {
    setError(null)
    const name = providerValue.trim()
    setSaving(true)
    const { error: saveError } = await supabase
      .from('visits')
      .update({ provider_name: name || null })
      .eq('id', visit.id)
    setSaving(false)
    if (saveError) {
      setError(saveError.message || 'Could not save')
      return
    }
    setEditing(null)
    if (onSaved) onSaved()
  }

  async function saveCost() {
    setError(null)
    const trimmed = costValue.trim()
    if (trimmed === '') {
      setError('Enter a cost')
      return
    }
    const parsed = parseFloat(trimmed.replace(/[$,\s]/g, ''))
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
    setEditing(null)
    if (onSaved) onSaved()
  }

  if (editing === 'provider') {
    return (
      <div className="cost-editor">
        <div className="cost-editor-input-row">
          <input
            ref={inputRef}
            type="text"
            value={providerValue}
            onChange={(e) => setProviderValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveProvider() }
              else if (e.key === 'Escape') { e.preventDefault(); cancel() }
            }}
            placeholder="Provider name"
            className="cost-editor-input provider-editor-input"
            disabled={saving}
          />
          <button type="button" onClick={saveProvider} disabled={saving} className="cost-editor-save">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={cancel} disabled={saving} className="cost-editor-cancel" aria-label="Cancel">
            ×
          </button>
        </div>
        {error && <div className="cost-editor-error">{error}</div>}
      </div>
    )
  }

  if (editing === 'cost') {
    return (
      <div className="cost-editor">
        <div className="cost-editor-input-row">
          <span className="cost-editor-prefix">$</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={costValue}
            onChange={(e) => setCostValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveCost() }
              else if (e.key === 'Escape') { e.preventDefault(); cancel() }
            }}
            placeholder="0"
            className="cost-editor-input"
            disabled={saving}
          />
          <button type="button" onClick={saveCost} disabled={saving} className="cost-editor-save">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={cancel} disabled={saving} className="cost-editor-cancel" aria-label="Cancel">
            ×
          </button>
        </div>
        {error && <div className="cost-editor-error">{error}</div>}
      </div>
    )
  }

  return (
    <div className="visit-meta-links">
      <button
        type="button"
        onClick={() => startEdit('provider')}
        className={`cost-link ${visit.provider_name ? 'cost-link-filled' : 'cost-link-empty'}`}
      >
        {visit.provider_name ? (
          <><span>{providerShort}</span><Pencil /></>
        ) : (
          'Add provider'
        )}
      </button>

      <span className="visit-meta-sep" aria-hidden="true">·</span>

      <button
        type="button"
        onClick={() => startEdit('cost')}
        className={`cost-link ${costFormatted ? 'cost-link-filled' : 'cost-link-empty'}`}
      >
        {costFormatted ? (
          <><span>Cost {costFormatted}</span><Pencil /></>
        ) : (
          'Add cost'
        )}
      </button>
    </div>
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
