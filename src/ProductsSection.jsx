import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabaseClient'

/**
 * ProductsSection
 *
 * "Products you use" section. Three operations:
 *   - View product list (read)
 *   - Add product (inline form)
 *   - Delete product (trash icon + inline confirm)
 *
 * Props:
 *   products: array of product objects from data.products
 *   onRefetch: function called after save/delete to reload data
 */
function ProductsSection({ products, onRefetch }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Products you use</h2>
        {products && products.length > 0 && (
          <span className="section-meta">{products.length}</span>
        )}
      </div>

      {(!products || products.length === 0) ? (
        <div className="empty-state">
          A running list of skincare and other products in your routine.
        </div>
      ) : (
        <ul className="products-list">
          {products.map((product) => (
            <ProductRow key={product.id} product={product} onRefetch={onRefetch} />
          ))}
        </ul>
      )}

      <AddProductForm onSaved={onRefetch} />
    </section>
  )
}

/**
 * ProductRow
 *
 * A single product item with a trash icon. Tapping the trash icon
 * reveals an inline "Delete? · Yes · No" confirmation. Tap Yes →
 * deletes the product and refetches.
 */
function ProductRow({ product, onRefetch }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const [editingNote, setEditingNote] = useState(false)
  const [noteInput, setNoteInput] = useState(product.notes || '')
  const [savingNote, setSavingNote] = useState(false)

  /**
   * Notes are what a product is FOR — "retinol, 2 nights a week", "only on the
   * neck". Products filed off a receipt arrive with no note at all, which is
   * exactly when the patient needs to write one, so this can't be add-time only.
   *
   * Checks the returned rows, not just the error. `products` had no UPDATE
   * policy before this shipped, and a missing policy doesn't error — it updates
   * nothing and reports success (see CLAUDE.md §14). An empty result is a real
   * failure and says so rather than showing a saved note that isn't saved.
   */
  async function saveNote() {
    setError(null)
    setSavingNote(true)

    const next = noteInput.trim() === '' ? null : noteInput.trim()
    const { data, error: saveError } = await supabase
      .from('products')
      .update({ notes: next })
      .eq('id', product.id)
      .select('id')

    setSavingNote(false)

    if (saveError) {
      setError(saveError.message || 'Could not save your note.')
      return
    }
    if (!data || data.length === 0) {
      setError('Nothing was saved — the update permission may be missing. Please tell Tondo.')
      return
    }

    setEditingNote(false)
    if (onRefetch) onRefetch()
  }

  async function handleDelete() {
    setError(null)
    setDeleting(true)

    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id)

    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message || 'Could not delete')
      return
    }

    setConfirming(false)
    if (onRefetch) onRefetch()
  }

  return (
    <li className="product-item">
      <div className="product-row">
        <div className="product-row-text">
          <div className="product-name">{product.name}</div>

          {editingNote ? (
            <div className="product-note-edit">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="What do you use it for?"
                className="form-textarea"
                rows={2}
                disabled={savingNote}
                autoFocus
              />
              <div className="form-actions">
                <button
                  type="button"
                  onClick={saveNote}
                  disabled={savingNote}
                  className="form-save-btn"
                >
                  {savingNote ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNoteInput(product.notes || '')
                    setEditingNote(false)
                    setError(null)
                  }}
                  disabled={savingNote}
                  className="form-cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {product.notes && (
                <div className="product-notes">{product.notes}</div>
              )}
              {/* Quiet text link, the cost-editor affordance — the products
                  list should stay calm, not sprout a button per row. */}
              <button
                type="button"
                className="product-note-btn"
                onClick={() => {
                  setNoteInput(product.notes || '')
                  setEditingNote(true)
                }}
              >
                {product.notes ? 'Edit note' : 'Add a note'}
              </button>
            </>
          )}
        </div>

        {!confirming ? (
          <button
            type="button"
            onClick={() => { setError(null); setConfirming(true) }}
            className="product-trash-btn"
            aria-label="Delete product"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 4h8M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M4 4l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <div className="product-confirm-row">
            <span className="product-confirm-text">Delete?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="product-confirm-yes"
            >
              {deleting ? '...' : 'Yes'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
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
 * AddProductForm — unchanged from Step 2
 */
function AddProductForm({ onSaved }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (adding && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [adding])

  function startAdd() {
    setError(null)
    setName('')
    setNotes('')
    setAdding(true)
  }

  function cancelAdd() {
    setAdding(false)
    setName('')
    setNotes('')
    setError(null)
  }

  async function handleSave() {
    setError(null)
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setError('Name is required')
      return
    }

    setSaving(true)

    const { data: patientData, error: patientLookupError } = await supabase
      .from('patients')
      .select('id')
      .single()

    if (patientLookupError || !patientData) {
      setSaving(false)
      setError('Could not save — try again')
      return
    }

    const payload = {
      patient_id: patientData.id,
      name: trimmedName,
      notes: notes.trim() === '' ? null : notes.trim(),
    }

    const { error: saveError } = await supabase
      .from('products')
      .insert(payload)

    setSaving(false)

    if (saveError) {
      // 23505 = unique violation. The DB enforces one row per product per
      // patient (db/dedupe_products.sql), matched case- and space-insensitively,
      // so this fires for "alpharet" when "AlphaRet" is already listed. Say what
      // happened in plain words — the raw constraint text is meaningless here.
      if (saveError.code === '23505') {
        setError(`${trimmedName} is already in your products list.`)
        return
      }
      setError(saveError.message || 'Could not save')
      return
    }

    setAdding(false)
    setName('')
    setNotes('')
    if (onSaved) onSaved()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.target.tagName === 'INPUT') {
        e.preventDefault()
        handleSave()
      }
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
          placeholder="Product name (e.g. SkinMedica TNS)"
          className="form-input"
          disabled={saving}
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Notes (optional)"
          className="form-textarea"
          rows={2}
          disabled={saving}
        />
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="form-save-btn"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={cancelAdd}
            disabled={saving}
            className="form-cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button type="button" onClick={startAdd} className="add-prompt">
      <span className="add-prompt-icon" aria-hidden="true">+</span>
      <span className="add-prompt-text">Add a product</span>
    </button>
  )
}

export default ProductsSection
