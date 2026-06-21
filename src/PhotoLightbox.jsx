import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

/**
 * PhotoLightbox
 *
 * Bottom-sheet modal pattern (matches VisitDetailModal aesthetic) showing
 * a larger view of one photo. Supports:
 *   - View large photo (signed URL)
 *   - View caption + taken_date
 *   - Edit caption (inline link → inline edit)
 *   - Delete photo (with inline "Delete? · Yes · No" confirm)
 *   - Close via X button, Escape key, or backdrop tap
 *
 * Props:
 *   photo: the photo row to display
 *   onClose: function called when user closes the lightbox
 *   onDeleted: function called after a successful delete (parent refetches)
 *   onCaptionUpdated: function called after successful caption edit (refetch)
 */
function PhotoLightbox({ photo, onClose, onDeleted, onCaptionUpdated }) {
  const [imageUrl, setImageUrl] = useState(null)
  const [imageError, setImageError] = useState(false)

  const [editingCaption, setEditingCaption] = useState(false)
  const [captionInput, setCaptionInput] = useState(photo?.caption || '')
  const [savingCaption, setSavingCaption] = useState(false)
  const [captionError, setCaptionError] = useState(null)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  // Escape key closes
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape' && !deleting && !savingCaption) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose, deleting, savingCaption])

  // Fetch signed URL when photo changes
  useEffect(() => {
    if (!photo) return
    let cancelled = false
    async function fetchSignedUrl() {
      const { data, error } = await supabase
        .storage
        .from('patient-photos')
        .createSignedUrl(photo.storage_path, 3600)
      if (cancelled) return
      if (error || !data) {
        setImageError(true)
        return
      }
      setImageUrl(data.signedUrl)
    }
    fetchSignedUrl()
    return () => { cancelled = true }
  }, [photo])

  if (!photo) return null

  const takenDateFormatted = photo.taken_date
    ? new Date(photo.taken_date + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  // Caption edit handlers
  function startEditCaption() {
    setCaptionInput(photo.caption || '')
    setCaptionError(null)
    setEditingCaption(true)
  }
  function cancelEditCaption() {
    setEditingCaption(false)
    setCaptionInput(photo.caption || '')
    setCaptionError(null)
  }
  async function saveCaption() {
    setCaptionError(null)
    setSavingCaption(true)
    const newCaption = captionInput.trim() === '' ? null : captionInput.trim()
    const { error } = await supabase
      .from('photos')
      .update({ caption: newCaption })
      .eq('id', photo.id)
    setSavingCaption(false)
    if (error) {
      setCaptionError(error.message || 'Could not save')
      return
    }
    setEditingCaption(false)
    if (onCaptionUpdated) onCaptionUpdated()
  }

  // Delete handlers
  async function handleDelete() {
    setDeleteError(null)
    setDeleting(true)

    // Delete the DB row first. If that succeeds, then the storage file.
    // (If DB fails, the storage file is still safe. If storage fails after,
    //  the orphaned file is hidden from the UI anyway — patient sees it gone.)
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photo.id)

    if (dbError) {
      setDeleting(false)
      setDeleteError(dbError.message || 'Could not delete')
      return
    }

    // Best-effort storage cleanup
    await supabase
      .storage
      .from('patient-photos')
      .remove([photo.storage_path])

    setDeleting(false)
    if (onDeleted) onDeleted()
  }

  function handleBackdropClick() {
    if (deleting || savingCaption) return
    onClose()
  }

  return (
    <>
      <div className="modal-backdrop" onClick={handleBackdropClick} />

      <div className="lightbox-sheet" role="dialog" aria-modal="true" aria-label="Photo detail">
        <div className="modal-handle" />

        <button
          type="button"
          onClick={onClose}
          disabled={deleting || savingCaption}
          className="modal-close"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="lightbox-body">
          <div className="lightbox-image-wrap">
            {imageError ? (
              <div className="lightbox-image-error">Could not load photo</div>
            ) : imageUrl ? (
              <img src={imageUrl} alt={photo.caption || 'Patient photo'} className="lightbox-image" />
            ) : (
              <div className="lightbox-image-loading">…</div>
            )}
          </div>

          <div className="lightbox-meta">
            {takenDateFormatted && (
              <div className="lightbox-date">{takenDateFormatted}</div>
            )}

            {editingCaption ? (
              <div className="lightbox-caption-edit">
                <input
                  type="text"
                  value={captionInput}
                  onChange={(e) => setCaptionInput(e.target.value)}
                  placeholder="Caption (optional)"
                  className="form-input"
                  disabled={savingCaption}
                  autoFocus
                />
                {captionError && <div className="form-error">{captionError}</div>}
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={saveCaption}
                    disabled={savingCaption}
                    className="form-save-btn"
                  >
                    {savingCaption ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditCaption}
                    disabled={savingCaption}
                    className="form-cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="lightbox-caption-row">
                {photo.caption ? (
                  <div className="lightbox-caption-text">{photo.caption}</div>
                ) : (
                  <div className="lightbox-caption-empty">No caption</div>
                )}
                <button
                  type="button"
                  onClick={startEditCaption}
                  className="lightbox-caption-edit-btn"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          <div className="lightbox-actions">
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => { setDeleteError(null); setConfirmingDelete(true) }}
                className="lightbox-delete-btn"
              >
                Delete photo
              </button>
            ) : (
              <div className="lightbox-confirm-row">
                <span className="lightbox-confirm-text">Delete this photo?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="product-confirm-yes"
                >
                  {deleting ? '…' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="product-confirm-no"
                >
                  Cancel
                </button>
              </div>
            )}
            {deleteError && <div className="form-error" style={{ marginTop: 8 }}>{deleteError}</div>}
          </div>
        </div>
      </div>
    </>
  )
}

export default PhotoLightbox
