/**
 * PhotosSection
 *
 * The "Photos" section — patient-uploaded photos and any note images
 * tied to visits. For V1, only patient_upload photos are shown here.
 *
 * Tapping the prompt is placeholder for the real upload flow (Chunk 5).
 *
 * Props:
 *   photos: array of photo objects from data.photos
 */
function PhotosSection({ photos }) {
  // Only show patient-upload photos in the gallery
  const galleryPhotos = (photos || []).filter(p => p.source === 'patient_upload')

  function handleAdd() {
    alert("Photo upload will be wired up in Chunk 5.")
  }

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Photos</h2>
        {galleryPhotos.length > 0 && (
          <span className="section-meta">{galleryPhotos.length}</span>
        )}
      </div>

      {galleryPhotos.length === 0 ? (
        <div className="empty-state">
          A space for your own photos — track progress, save inspiration,
          remember details.
        </div>
      ) : (
        <div className="photo-grid">
          {galleryPhotos.map((photo) => (
            <div key={photo.id} className="photo-tile">
              {/* For V1 we just show a placeholder; real image rendering
                  will use Supabase Storage URLs in Chunk 5 */}
              <div className="photo-placeholder">📷</div>
              {photo.caption && (
                <div className="photo-caption">{photo.caption}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={handleAdd} className="add-prompt">
        <span className="add-prompt-icon" aria-hidden="true">+</span>
        <span className="add-prompt-text">Add a photo</span>
      </button>
    </section>
  )
}

export default PhotosSection