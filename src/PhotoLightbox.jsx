import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { attachPhotoToVisit, detachPhotoFromVisit } from './photoVisitLink'

/**
 * PhotoLightbox
 *
 * Bottom-sheet modal showing a larger view of one photo. Supports:
 *   - View large photo (signed URL)
 *   - View notes + taken_date
 *   - Edit notes (inline link → inline edit)
 *
 * NAMING: the patient sees "Notes"; the DB column is still `photos.caption`.
 * The rename was a product change (captions are short labels, notes are where
 * someone describes a side effect), and renaming the column would mean a
 * migration touching every read path for no behavioural gain. If that drift
 * ever gets confusing, rename the column — don't rename the UI back.
 *   - Attach to / detach from a visit (people upload first and organise later,
 *     so this direction has to exist — not just "upload into a visit")
 *   - Delete photo (with inline "Delete? · Yes · No" confirm)
 *   - Close via X button, Escape key, or backdrop tap
 *
 * Props:
 *   photo: the photo row to display
 *   visits: the patient's visits, for the attach picker
 *   onClose: called when the user closes the lightbox
 *   onDeleted: called after a successful delete (parent refetches)
 *   onCaptionUpdated: called after a successful caption edit (refetch)
 *   onVisitLinkChanged: called after a successful attach/detach (refetch)
 *   onToast: brief confirmation pill — attach/detach results (the badge) live
 *            behind this modal, so they'd otherwise confirm invisibly
 */
function PhotoLightbox({
  photo,
  visits = [],
  onClose,
  onDeleted,
  onCaptionUpdated,
  onVisitLinkChanged,
  onToast,
}) {
  const [imageUrl, setImageUrl] = useState(null)
  const [imageError, setImageError] = useState(false)

  const [editingCaption, setEditingCaption] = useState(false)
  const [captionInput, setCaptionInput] = useState(photo?.caption || '')
  const [savingCaption, setSavingCaption] = useState(false)
  const [captionError, setCaptionError] = useState(null)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const [pickingVisit, setPickingVisit] = useState(false)
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState(null)

  const attachedVisit = photo?.visit_id
    ? visits.find((v) => v.id === photo.visit_id)
    : null

  async function handleAttach(visitId) {
    setLinkError(null)
    setLinking(true)
    try {
      // Throws if RLS refused it (zero rows) — see photoVisitLink.js.
      await attachPhotoToVisit(photo.id, visitId)
      setPickingVisit(false)
      if (onToast) onToast('Photo added to the visit')
      if (onVisitLinkChanged) await onVisitLinkChanged()
    } catch (e) {
      setLinkError(e.message)
    } finally {
      setLinking(false)
    }
  }

  async function handleDetach() {
    setLinkError(null)
    setLinking(true)
    try {
      await detachPhotoFromVisit(photo.id)
      if (onToast) onToast('Photo removed from the visit')
      if (onVisitLinkChanged) await onVisitLinkChanged()
    } catch (e) {
      setLinkError(e.message)
    } finally {
      setLinking(false)
    }
  }

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
            {/* Labelled "Added", because this sheet can show TWO dates: when
                the photo was added, and (below) the date of the visit it
                belongs to. They are often days apart — a photo taken after a
                visit still belongs to it — so a bare date here would be the
                same ambiguity that got both dates taken off the tile. */}
            {takenDateFormatted && (
              <div className="lightbox-date">Added {takenDateFormatted}</div>
            )}

            {editingCaption ? (
              <div className="lightbox-caption-edit">
                <textarea
                  value={captionInput}
                  onChange={(e) => setCaptionInput(e.target.value)}
                  placeholder="Notes (optional) — how it looked, how it felt, anything worth remembering"
                  className="form-textarea"
                  rows={4}
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
                  <div className="lightbox-caption-empty">No notes yet</div>
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

          {/* Attach to / detach from a visit. Detaching NEVER deletes — the
              photo stays in the archive and just loses its badge. */}
          <div className="lightbox-visit-link">
            {attachedVisit ? (
              <div className="lightbox-visit-row">
                <span className="lightbox-visit-label">
                  From your visit on{' '}
                  <strong>
                    {new Date(attachedVisit.visit_date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </strong>
                </span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={handleDetach}
                  disabled={linking}
                >
                  {linking ? '…' : 'Remove from visit'}
                </button>
              </div>
            ) : !pickingVisit ? (
              <button
                type="button"
                className="link-btn"
                onClick={() => { setLinkError(null); setPickingVisit(true) }}
                disabled={visits.length === 0}
              >
                {visits.length === 0 ? 'No visits to link to yet' : 'Add to a visit'}
              </button>
            ) : (
              <div className="lightbox-visit-picker">
                <span className="lightbox-visit-label">Which visit?</span>
                <div className="lightbox-visit-options">
                  {visits.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="lightbox-visit-option"
                      onClick={() => handleAttach(v.id)}
                      disabled={linking}
                    >
                      {new Date(v.visit_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setPickingVisit(false)}
                  disabled={linking}
                >
                  Cancel
                </button>
              </div>
            )}
            {linkError && <div className="form-error" style={{ marginTop: 8 }}>{linkError}</div>}
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
