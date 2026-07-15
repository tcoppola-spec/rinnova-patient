import { useState, useRef } from 'react'
import { supabase } from './supabaseClient'

/**
 * AddPhotoFlow
 *
 * Upload a photo. Extracted from PhotosSection so the visit detail view can
 * reuse the exact same upload path rather than growing a second, drifting copy.
 *
 * Props:
 *   visitId          — optional. When set, the photo is attached to that visit
 *                      on insert. It still lands in the one photo archive; the
 *                      attachment is metadata, not a separate library.
 *   label            — button text ("Add a photo" / "Add a photo to this visit")
 *   onUploadStart    — called when the upload begins (for the optimistic tile)
 *   onUploadComplete — called after a successful insert (refetch)
 *   onUploadError    — called if it fails
 */
function AddPhotoFlow({
  visitId = null,
  label = 'Add a photo',
  onUploadStart,
  onUploadComplete,
  onUploadError,
}) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  function openPicker() {
    setError(null)
    if (fileInputRef.current) fileInputRef.current.click()
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
    if (fileInputRef.current) fileInputRef.current.value = ''
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
      .upload(storagePath, file, { contentType: file.type, upsert: false })

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
        // NOTE: taken_date is when the photo was ADDED, and is never rewritten to
        // match a visit's date. A photo taken three days after the visit still
        // belongs to that visit — the date is the one thing we can't reconstruct.
        taken_date: new Date().toISOString().split('T')[0],
        source: 'patient_upload',
        visit_id: visitId,
      })

    if (insertError) {
      // The row failed, so don't leave the file orphaned in storage.
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
          <button type="button" onClick={handleSave} disabled={saving} className="form-save-btn">
            {saving ? 'Uploading…' : 'Save'}
          </button>
          <button type="button" onClick={cancelAdd} disabled={saving} className="form-cancel-btn">
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
        <span className="add-prompt-text">{label}</span>
      </button>
      {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
    </>
  )
}

export default AddPhotoFlow
