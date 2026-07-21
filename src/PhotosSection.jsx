import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import PhotoLightbox from './PhotoLightbox'
import AddPhotoFlow from './AddPhotoFlow'

/**
 * PhotosSection
 *
 * The ONE photo archive. Every photo lives here, whether or not it belongs to a
 * visit — attaching to a visit is metadata, not a separate library. Photos with
 * a visit_id show a badge naming that visit, which taps through to it.
 *
 * Props:
 *   photos:      all of the patient's photos
 *   visits:      needed to resolve visit_id -> a date for the badge
 *   onRefetch:   called after a successful save/delete/attach
 *   onToast:     brief confirmation pill (deletes and attach/detach only)
 *   onOpenVisit: (visitId) => void — tapping a badge opens that visit
 */
function PhotosSection({ photos, visits = [], onRefetch, onToast, onOpenVisit }) {
  const galleryPhotos = photos || []
  const [uploading, setUploading] = useState(false)
  const [uploadStartCount, setUploadStartCount] = useState(null)
  const [openPhotoId, setOpenPhotoId] = useState(null)

  // Clear the optimistic tile once the refetched list actually grew.
  useEffect(() => {
    if (uploadStartCount !== null && galleryPhotos.length > uploadStartCount) {
      setUploading(false)
      setUploadStartCount(null)
    }
  }, [galleryPhotos.length, uploadStartCount])

  // If the open photo disappears (deleted elsewhere), close the lightbox.
  useEffect(() => {
    if (openPhotoId && !galleryPhotos.some((p) => p.id === openPhotoId)) {
      setOpenPhotoId(null)
    }
  }, [galleryPhotos, openPhotoId])

  const visitsById = {}
  for (const v of visits) visitsById[v.id] = v

  const openPhoto = openPhotoId ? galleryPhotos.find((p) => p.id === openPhotoId) : null
  const hasContent = galleryPhotos.length > 0 || uploading

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Photos</h2>
        {galleryPhotos.length > 0 && (
          <span className="section-meta">{galleryPhotos.length}</span>
        )}
      </div>

      {!hasContent ? (
        <div className="empty-state">
          A space for your own photos — track progress, save inspiration,
          remember details.
        </div>
      ) : (
        <div className="photo-grid">
          {uploading && <UploadingTile />}
          {galleryPhotos.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              visit={photo.visit_id ? visitsById[photo.visit_id] : null}
              onClick={() => setOpenPhotoId(photo.id)}
              onOpenVisit={onOpenVisit}
            />
          ))}
        </div>
      )}

      <AddPhotoFlow
        onUploadStart={() => {
          setUploadStartCount(galleryPhotos.length)
          setUploading(true)
        }}
        onUploadComplete={async () => {
          if (onRefetch) await onRefetch()
        }}
        onUploadError={() => {
          setUploading(false)
          setUploadStartCount(null)
        }}
      />

      {openPhoto && (
        <PhotoLightbox
          photo={openPhoto}
          visits={visits}
          onClose={() => setOpenPhotoId(null)}
          onDeleted={async () => {
            setOpenPhotoId(null)
            if (onToast) onToast('Photo deleted')
            if (onRefetch) await onRefetch()
          }}
          onCaptionUpdated={async () => {
            if (onRefetch) await onRefetch()
          }}
          onVisitLinkChanged={async () => {
            if (onRefetch) await onRefetch()
          }}
          onToast={onToast}
        />
      )}
    </section>
  )
}

function UploadingTile() {
  return (
    <div className="photo-tile photo-tile-uploading">
      <div className="photo-uploading-content">
        <div className="photo-uploading-spinner" aria-hidden="true" />
        <div className="photo-uploading-label">Adding photo…</div>
      </div>
    </div>
  )
}

/** Short label for a badge: "Apr 14, 2026". Not exported — a file that exports
    anything other than components breaks React Fast Refresh. */
function shortVisitDate(visitDate) {
  if (!visitDate) return ''
  return new Date(visitDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Two tap zones, deliberately separated (the VisitCard pattern): the tile opens
 * the photo; the badge opens the visit it belongs to. They must never bleed into
 * each other — hence the badge is its own <button>, not a nested click handler.
 */
function PhotoTile({ photo, visit, onClick, onOpenVisit }) {
  const [imageUrl, setImageUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: urlError } = await supabase
        .storage
        .from('patient-photos')
        .createSignedUrl(photo.storage_path, 3600)
      if (cancelled) return
      if (urlError || !data) setError(true)
      else setImageUrl(data.signedUrl)
    }
    load()
    return () => { cancelled = true }
  }, [photo.storage_path])

  return (
    <div className="photo-tile-wrap">
      <button type="button" onClick={onClick} className="photo-tile-button">
        {error ? (
          <div className="photo-placeholder">—</div>
        ) : imageUrl ? (
          <img src={imageUrl} alt={photo.caption || 'Patient photo'} className="photo-img" />
        ) : (
          <div className="photo-placeholder" />
        )}
        {/* The tile shows the DATE, not the note. Notes are free text — a
            patient documenting a side effect writes sentences — and a tile is
            ~150px wide, so it either truncated to uselessness or covered the
            photo. The date is short, always present, and it's what you scan a
            photo archive by. The note is one tap away in the lightbox. */}
        {photo.taken_date && (
          <div className="photo-date">{shortVisitDate(photo.taken_date)}</div>
        )}
      </button>

      {visit && (
        <button
          type="button"
          className="photo-visit-badge"
          onClick={() => onOpenVisit && onOpenVisit(visit.id)}
          title={`From your visit on ${shortVisitDate(visit.visit_date)}`}
        >
          {shortVisitDate(visit.visit_date)}
        </button>
      )}
    </div>
  )
}

export default PhotosSection
