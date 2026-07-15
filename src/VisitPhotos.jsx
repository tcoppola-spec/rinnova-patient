import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import AddPhotoFlow from './AddPhotoFlow'
import { attachPhotoToVisit } from './photoVisitLink'

/**
 * VisitPhotos — the photo strip inside a visit's detail sheet.
 *
 * Built for MULTIPLE photos from the start (before/after, several angles): the
 * FK lives on the photo, so a visit can hold as many as it likes.
 *
 * Two ways in, both required:
 *   1. Upload straight into this visit (reuses AddPhotoFlow with a visitId, so
 *      there is only ever one upload path).
 *   2. Attach a photo already sitting in the archive. People upload first and
 *      organise later — without this, anything already in the archive could
 *      never be connected to a visit.
 *
 * Detaching lives in the photo's lightbox, next to the photo itself.
 *
 * Props:
 *   visitId   — the visit these photos belong to
 *   photos    — ALL the patient's photos; we filter
 *   onRefetch — after add / attach
 */
function VisitPhotos({ visitId, photos = [], onRefetch }) {
  const [picking, setPicking] = useState(false)
  const [attaching, setAttaching] = useState(false)
  const [attachError, setAttachError] = useState(null)
  const [uploading, setUploading] = useState(false)

  const attached = photos.filter((p) => p.visit_id === visitId)
  // Only unattached photos can be picked. A photo belongs to at most one visit,
  // so offering an already-attached one would mean silently stealing it.
  const attachable = photos.filter((p) => !p.visit_id)

  async function handleAttach(photoId) {
    setAttachError(null)
    setAttaching(true)
    try {
      await attachPhotoToVisit(photoId, visitId)
      setPicking(false)
      if (onRefetch) await onRefetch()
    } catch (e) {
      setAttachError(e.message)
    } finally {
      setAttaching(false)
    }
  }

  return (
    <div className="visit-photos">
      <div className="visit-photos-head">
        <h3 className="visit-photos-title">Photos</h3>
        {attached.length > 0 && (
          <span className="section-meta">{attached.length}</span>
        )}
      </div>

      {attached.length > 0 && (
        <div className="visit-photos-strip">
          {attached.map((p) => (
            <VisitPhotoThumb key={p.id} photo={p} />
          ))}
          {uploading && <div className="visit-photo-thumb visit-photo-thumb-loading" />}
        </div>
      )}

      {attached.length === 0 && !uploading && (
        <p className="visit-photos-empty">
          No photos on this visit yet. They’ll also stay in your photo archive.
        </p>
      )}

      <AddPhotoFlow
        visitId={visitId}
        label="Add a photo to this visit"
        onUploadStart={() => setUploading(true)}
        onUploadComplete={async () => {
          setUploading(false)
          if (onRefetch) await onRefetch()
        }}
        onUploadError={() => setUploading(false)}
      />

      {!picking ? (
        <button
          type="button"
          className="link-btn"
          onClick={() => { setAttachError(null); setPicking(true) }}
          disabled={attachable.length === 0}
        >
          {attachable.length === 0
            ? 'No unattached photos in your archive'
            : 'Or choose one from your photos'}
        </button>
      ) : (
        <div className="visit-photos-picker">
          <span className="visit-photos-picker-label">Choose a photo to add</span>
          <div className="visit-photos-strip">
            {attachable.map((p) => (
              <VisitPhotoThumb
                key={p.id}
                photo={p}
                onClick={() => handleAttach(p.id)}
                disabled={attaching}
              />
            ))}
          </div>
          <button
            type="button"
            className="link-btn"
            onClick={() => setPicking(false)}
            disabled={attaching}
          >
            Cancel
          </button>
        </div>
      )}

      {attachError && <div className="form-error" style={{ marginTop: 8 }}>{attachError}</div>}
    </div>
  )
}

/** A thumbnail. Rendered as a button only when it's pickable. */
function VisitPhotoThumb({ photo, onClick, disabled }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: e } = await supabase
        .storage
        .from('patient-photos')
        .createSignedUrl(photo.storage_path, 3600)
      if (cancelled) return
      if (e || !data) setError(true)
      else setUrl(data.signedUrl)
    }
    load()
    return () => { cancelled = true }
  }, [photo.storage_path])

  const inner = error ? (
    <div className="photo-placeholder">—</div>
  ) : url ? (
    <img src={url} alt={photo.caption || 'Visit photo'} className="photo-img" />
  ) : (
    <div className="photo-placeholder" />
  )

  if (!onClick) {
    return <div className="visit-photo-thumb">{inner}</div>
  }

  return (
    <button
      type="button"
      className="visit-photo-thumb visit-photo-thumb-pick"
      onClick={onClick}
      disabled={disabled}
    >
      {inner}
    </button>
  )
}

export default VisitPhotos
