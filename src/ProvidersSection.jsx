import { useState, useRef, useEffect } from 'react'
import { addProvider, setPrimary, deleteProvider, updateProvider, formatPhone } from './patientProviders'

/**
 * ProvidersSection
 *
 * The patient's own list of providers (name + phone) — the contacts the "Book
 * an appointment" CTA dials. Three operations, mirroring ProductsSection:
 *   - View list (read), primary marked with a pill
 *   - Add provider (inline form)
 *   - Delete provider (× + inline confirm) / Make primary (quiet text link)
 *
 * Adding is possible here AND inline in the booking menu (both call the shared
 * helpers in patientProviders.js) — see docs/booking-providers-brief.md.
 *
 * Props:
 *   providers: array from data.providers ([] before the migration is run)
 *   onRefetch: reload data after a write
 */
function ProvidersSection({ providers = [], onRefetch }) {
  const hasAny = providers && providers.length > 0

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Your providers</h2>
        {hasAny && <span className="section-meta">{providers.length}</span>}
      </div>

      {!hasAny ? (
        <div className="empty-state">
          Add your injector or practice so you can book right from your record.
        </div>
      ) : (
        <ul className="providers-list">
          {providers.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              soloPrimary={providers.length === 1}
              onRefetch={onRefetch}
            />
          ))}
        </ul>
      )}

      <AddProviderForm hasExisting={hasAny} onSaved={onRefetch} />
    </section>
  )
}

/**
 * ProviderRow — name + phone, a Primary pill or a "Make primary" link, and a
 * delete with inline confirm.
 */
function ProviderRow({ provider, soloPrimary, onRefetch }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(provider.name)
  const [phone, setPhone] = useState(provider.phone || '')

  function startEdit() {
    setError(null)
    setName(provider.name)
    setPhone(provider.phone || '')
    setEditing(true)
  }

  async function handleSaveEdit() {
    setError(null)
    if (name.trim() === '') {
      setError('A name is required')
      return
    }
    setBusy(true)
    try {
      await updateProvider(provider.id, { name, phone })
      setEditing(false)
      if (onRefetch) await onRefetch()
    } catch (e) {
      setError(e.message || 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  async function handleMakePrimary() {
    setError(null)
    setBusy(true)
    try {
      await setPrimary(provider.id)
      if (onRefetch) await onRefetch()
    } catch (e) {
      setError(e.message || 'Could not update')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setError(null)
    setBusy(true)
    try {
      await deleteProvider(provider.id)
      setConfirming(false)
      if (onRefetch) await onRefetch()
    } catch (e) {
      setError(e.message || 'Could not delete')
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <li className="provider-item">
        <div className="add-product-form">
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Provider name"
            disabled={busy}
            autoFocus
          />
          <input
            type="tel"
            inputMode="tel"
            className="form-input"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="Phone number (optional)"
            disabled={busy}
          />
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="form-save-btn" onClick={handleSaveEdit} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="form-cancel-btn"
              onClick={() => { setEditing(false); setError(null) }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li className="provider-item">
      <div className="provider-row">
        <div className="provider-row-text">
          <div className="provider-name">
            {provider.name}
            {provider.is_primary && (
              <span className="provider-primary-pill">Primary</span>
            )}
          </div>
          {provider.phone ? (
            <div className="provider-phone">{provider.phone}</div>
          ) : (
            <div className="provider-phone provider-phone-missing">No number yet</div>
          )}
          <div className="provider-links">
            <button
              type="button"
              className="provider-link-btn"
              onClick={startEdit}
              disabled={busy}
            >
              Edit
              <svg className="edit-pencil" width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M10.5 1.5 L12.5 3.5 L4 12 L1.5 12.5 L2 10 L10.5 1.5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </button>
            {/* Only offer "Make primary" when there's a choice to make. */}
            {!provider.is_primary && !soloPrimary && (
              <button
                type="button"
                className="provider-link-btn"
                onClick={handleMakePrimary}
                disabled={busy}
              >
                Make primary
              </button>
            )}
          </div>
        </div>

        {!confirming ? (
          <button
            type="button"
            onClick={() => { setError(null); setConfirming(true) }}
            className="provider-remove-btn"
            aria-label={`Remove ${provider.name}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <div className="product-confirm-row">
            <span className="product-confirm-text">Remove?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="product-confirm-yes"
            >
              {busy ? '...' : 'Yes'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="product-confirm-no"
            >
              No
            </button>
          </div>
        )}
      </div>
      {error && <div className="form-error" style={{ marginTop: 6 }}>{error}</div>}
    </li>
  )
}

/**
 * AddProviderForm — name + phone. The first provider added becomes primary
 * automatically (so single-provider booking has a default target).
 */
function AddProviderForm({ hasExisting, onSaved }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (adding && nameInputRef.current) nameInputRef.current.focus()
  }, [adding])

  function startAdd() {
    setError(null)
    setName('')
    setPhone('')
    setAdding(true)
  }

  function cancelAdd() {
    setAdding(false)
    setName('')
    setPhone('')
    setError(null)
  }

  async function handleSave() {
    setError(null)
    if (name.trim() === '') {
      setError('A name is required')
      return
    }
    setSaving(true)
    try {
      await addProvider({ name, phone, makePrimary: !hasExisting })
      setAdding(false)
      setName('')
      setPhone('')
      if (onSaved) await onSaved()
    } catch (e) {
      setError(e.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelAdd()
    }
  }

  if (adding) {
    return (
      <div className="add-product-form">
        <input
          ref={nameInputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Provider name (e.g. Dr. Del Campo)"
          className="form-input"
          disabled={saving}
        />
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          onKeyDown={handleKeyDown}
          placeholder="Phone number (optional)"
          className="form-input"
          disabled={saving}
        />
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button type="button" onClick={handleSave} disabled={saving} className="form-save-btn">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={cancelAdd} disabled={saving} className="form-cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button type="button" onClick={startAdd} className="add-prompt">
      <span className="add-prompt-icon" aria-hidden="true">+</span>
      <span className="add-prompt-text">Add a provider</span>
    </button>
  )
}

export default ProvidersSection
