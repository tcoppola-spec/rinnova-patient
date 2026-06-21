import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabaseClient'
import PhotoLightbox from './PhotoLightbox'

/**
 * PhotosSection
 *
 * Manages: upload state, lightbox open state.
 *
 * Tapping a photo tile opens the lightbox for that photo.
 * Edits and deletes in the lightbox call back to trigger refetch.
 *
 * Props:
 *   photos: array of photo rows from data.photos
 *   onRefetch: function called after a successful save/delete
 */
function PhotosSection({ photos, onRefetch }) {
  const galleryPhotos = (photos || []).filter(p => p.source === 'patient_upload')

  const [uploading, setUploading] = useState(false)
  const [uploadStartCount, setUploadStartCount] = useState(null)
  const [openPhotoId, setOpenPhotoId] = useState(null)

  // When upload completes, count goes up → clear uploading state
  useEffect(() => {
    if (uploading && uploadStartCount !== null && galleryPhotos.length > uploadStartCount) {
      setUploading(false)
      setUploadStartCount(null)
    }
  }, [galleryPhotos.length, uploading, uploadStartCount])

  // Safety: 15-second timer to clear uploading if something hung
  useEffect(() => {
    if (!uploading) return
    const timer = setTimeout(() => {
      setUploading(false)
      setUploadStartCount(null)
    }, 15000)
    return () => clearTimeout(timer)
  }, [uploading])

  // If the open photo gets deleted in the background, close lightbox automatically
  useEffect(() => {
    if (openPhotoId && !galleryPhotos.some(p => p.id === openPhotoId)) {
      setOpenPhotoId(null)
    }
  }, [galleryPhotos, openPhotoId])

  const openPhoto = openPhotoId ? galleryPhotos.find(p => p.id === openPhotoId) : null
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
              onClick={() => setOpenPhotoId(photo.id)}
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
          onClose={() => setOpenPhotoId(null)}
          onDeleted={async () => {
            setOpenPhotoId(null)
            if (onRefetch) await onRefetch()
          }}
          onCaptionUpdated={async () => {
            if (onRefetch) await onRefetch()
          }}
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

/**
 * PhotoTile — single tile in the grid. Wraps img in a button so it's
 * keyboard-accessible and clicking opens the lightbox.
 */
function PhotoTile({ photo, onClick }) {
  const [imageUrl, setImageUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchSignedUrl() {
      const { data, error: signedError } = await supabase
        .storage
        .from('patient-photos')
        .createSignedUrl(photo.storage_path, 3600)
      if (cancelled) return
      if (signedError || !data) {
        setError(true)
        return
      }
      setImageUrl(data.signedUrl)
    }
    fetchSignedUrl()
    return () => { cancelled = true }
  }, [photo.storage_path])

  return (
    <button type="button" onClick={onClick} className="photo-tile photo-tile-button">
      {error ? (
        <div className="photo-placeholder">⚠️</div>
      ) : imageUrl ? (
        <img src={imageUrl} alt={photo.caption || 'Patient photo'} className="photo-img" />
      ) : (
        <div className="photo-placeholder">…</div>
      )}
      {photo.caption && (
        <div className="photo-caption">{photo.caption}</div>
      )}
    </button>
  )
}

/**
 * AddPhotoFlow — unchanged from Steps 1-3
 */
function AddPhotoFlow({ onUploadStart, onUploadComplete, onUploadError }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  function openPicker() {
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  function handleFileSelect(e) {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (selected.size > 10 * 1024 * 1024) {
      setError('Photo is too large (max 10 MB)')
      return
    }
    if (!selected.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setError(null)
  }

  function cancelAdd() {
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setCaption('')
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSave() {
    if (!file) return
    setError(null)
    setSaving(true)
    if (onUploadStart) onUploadStart()

    const { data: patientData, error: patientLookupError } = await supabase
      .from('patients')
      .select('id')
      .single()

    if (patientLookupError || !patientData) {
      setSaving(false)
      setError('Could not save — try again')
      if (onUploadError) onUploadError()
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const randomId = crypto.randomUUID()
    const storagePath = `${patientData.id}/${randomId}.${ext}`

    const { error: uploadError } = await supabase
      .storage
      .from('patient-photos')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      setSaving(false)
      setError(uploadError.message || 'Upload failed')
      if (onUploadError) onUploadError()
      return
    }

    const { error: insertError } = await supabase
      .from('photos')
      .insert({
        patient_id: patientData.id,
        storage_path: storagePath,
        caption: caption.trim() === '' ? null : caption.trim(),
        taken_date: new Date().toISOString().split('T')[0],
        source: 'patient_upload',
      })

    if (insertError) {
      await supabase.storage.from('patient-photos').remove([storagePath])
      setSaving(false)
      setError(insertError.message || 'Could not save photo')
      if (onUploadError) onUploadError()
      return
    }

    cancelAdd()
    setSaving(false)
    if (onUploadComplete) await onUploadComplete()
  }

  if (file && previewUrl) {
    return (
      <div className="add-photo-form">
        <div className="add-photo-preview">
          <img src={previewUrl} alt="Photo preview" className="add-photo-preview-img" />
        </div>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption (optional)"
          className="form-input"
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
            {saving ? 'Uploading…' : 'Save'}
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
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button type="button" onClick={openPicker} className="add-prompt">
        <span className="add-prompt-icon" aria-hidden="true">+</span>
        <span className="add-prompt-text">Add a photo</span>
      </button>
      {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
    </>
  )
}

export default PhotosSection
