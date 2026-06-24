import { useState, useRef, useEffect } from 'react'

/**
 * LogVisitPrompt
 *
 * Two states:
 *   - idle: the "+ Log a visit" button
 *   - expanded: a multi-step flow (choose → input → parsing → result)
 */
function LogVisitPrompt() {
  const [expanded, setExpanded] = useState(false)

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="log-prompt"
      >
        <div className="log-prompt-text">
          <div className="log-prompt-title">Log a visit</div>
          <div className="log-prompt-sub">
            Paste a treatment note and let AI organize it for you.
          </div>
        </div>
        <span className="log-prompt-arrow" aria-hidden="true">→</span>
      </button>
    )
  }

  return <LogVisitFlow onClose={() => setExpanded(false)} />
}

/**
 * LogVisitFlow
 *
 * Sub-states:
 *   - 'choose' (default) — pick text or photo
 *   - 'text-input' — textarea + Parse button
 *   - 'photo-input' — file picker + preview + Parse button
 *   - 'parsing' — loading state
 *   - 'result' — display parsed JSON read-only
 */
function LogVisitFlow({ onClose }) {
  const [step, setStep] = useState('choose')
  const [text, setText] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null)
  const [photoBase64, setPhotoBase64] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (step === 'text-input' && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [step])

  function chooseText() {
    setError(null)
    setStep('text-input')
  }

  function choosePhoto() {
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  function handleFileSelect(e) {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (selected.size > 5 * 1024 * 1024) {
      setError('Photo is too large (max 5 MB for AI parsing)')
      return
    }

    if (!selected.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    setPhotoFile(selected)
    setPhotoPreviewUrl(URL.createObjectURL(selected))

    // Convert to base64 for AI parsing
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      // result is a data URL like "data:image/jpeg;base64,/9j/4AAQ..."
      // We need just the base64 part
      const base64 = result.split(',')[1]
      setPhotoBase64(base64)
    }
    reader.readAsDataURL(selected)

    setStep('photo-input')
  }

  function cancelPhoto() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setPhotoBase64(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setStep('choose')
  }

  async function handleParseText() {
    setError(null)
    const trimmed = text.trim()
    if (trimmed === '') {
      setError('Paste a treatment note first')
      return
    }
    setStep('parsing')
    try {
      const response = await fetch('/.netlify/functions/parse-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      const data = await response.json()
      if (!response.ok || data.error) {
        setError(data.error || 'Request failed (' + response.status + ')')
        setStep('text-input')
        return
      }
      if (!data.parsed) {
        setError('Parser returned no data')
        setStep('text-input')
        return
      }
      setParsed(data.parsed)
      setStep('result')
    } catch (e) {
      setError(e.message || 'Could not reach AI parser')
      setStep('text-input')
    }
  }

  async function handleParsePhoto() {
    setError(null)
    if (!photoBase64 || !photoFile) {
      setError('No photo selected')
      return
    }
    setStep('parsing')
    try {
      const response = await fetch('/.netlify/functions/parse-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: photoBase64,
          image_media_type: photoFile.type,
        }),
      })
      const data = await response.json()
      if (!response.ok || data.error) {
        setError(data.error || 'Request failed (' + response.status + ')')
        setStep('photo-input')
        return
      }
      if (!data.parsed) {
        setError('Parser returned no data')
        setStep('photo-input')
        return
      }
      setParsed(data.parsed)
      setStep('result')
    } catch (e) {
      setError(e.message || 'Could not reach AI parser')
      setStep('photo-input')
    }
  }

  function handleStartOver() {
    setText('')
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setPhotoBase64(null)
    setParsed(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setStep('choose')
  }

  // Choose step — two big buttons
  if (step === 'choose') {
    return (
      <div className="logvisit-flow">
        <div className="logvisit-flow-head">
          <h3 className="logvisit-flow-title">Log a visit</h3>
          <p className="logvisit-flow-sub">
            How do you have your treatment details?
          </p>
        </div>

        <div className="logvisit-choices">
          <button
            type="button"
            onClick={choosePhoto}
            className="logvisit-choice"
          >
            <div className="logvisit-choice-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 8h3.5l1.5-2h8l1.5 2H21v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><circle cx="12" cy="13.5" r="3.5" stroke="currentColor" strokeWidth="1.4"/></svg></div>
            <div className="logvisit-choice-text">
              <div className="logvisit-choice-title">Take a photo</div>
              <div className="logvisit-choice-sub">
                Of a printed receipt or note from your provider
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={chooseText}
            className="logvisit-choice"
          >
            <div className="logvisit-choice-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M14 3v5h5M8 13h7M8 17h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></div>
            <div className="logvisit-choice-text">
              <div className="logvisit-choice-title">Paste text</div>
              <div className="logvisit-choice-sub">
                From an email or copied notes
              </div>
            </div>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions" style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={onClose}
            className="form-cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Photo input step
  if (step === 'photo-input' && photoPreviewUrl) {
    return (
      <div className="logvisit-flow">
        <div className="logvisit-flow-head">
          <h3 className="logvisit-flow-title">Ready to parse</h3>
          <p className="logvisit-flow-sub">
            AI will read this photo and organize it.
          </p>
        </div>

        <div className="logvisit-photo-preview">
          <img
            src={photoPreviewUrl}
            alt="Photo preview"
            className="logvisit-photo-preview-img"
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions" style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={handleParsePhoto}
            className="form-save-btn"
          >
            Parse with AI
          </button>
          <button
            type="button"
            onClick={cancelPhoto}
            className="form-cancel-btn"
          >
            Different photo
          </button>
        </div>
      </div>
    )
  }

  // Parsing step
  if (step === 'parsing') {
    return (
      <div className="logvisit-flow">
        <div className="logvisit-parsing">
          <div className="logvisit-parsing-spinner" aria-hidden="true" />
          <div className="logvisit-parsing-label">AI is reading your note…</div>
          <div className="logvisit-parsing-sub">This usually takes 5–15 seconds.</div>
        </div>
      </div>
    )
  }

  // Result step
  if (step === 'result' && parsed) {
    return (
      <div className="logvisit-flow">
        <div className="logvisit-flow-head">
          <h3 className="logvisit-flow-title">Here's what we got</h3>
          <p className="logvisit-flow-sub">
            Save isn't wired up yet — this is a preview of the AI's interpretation.
          </p>
        </div>
        <ParsedVisitPreview parsed={parsed} />
        <div className="form-actions" style={{ marginTop: 20 }}>
          <button type="button" onClick={handleStartOver} className="form-cancel-btn">
            Start over
          </button>
          <button type="button" onClick={onClose} className="form-save-btn">
            Done
          </button>
        </div>
      </div>
    )
  }

  // Text input step (default fallback)
  return (
    <div className="logvisit-flow">
      <div className="logvisit-flow-head">
        <h3 className="logvisit-flow-title">Paste your note</h3>
        <p className="logvisit-flow-sub">
          AI will organize what you paste below.
        </p>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your treatment note here — for example, an email from your provider or copied notes."
        className="logvisit-textarea"
        rows={8}
      />
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions" style={{ marginTop: 12 }}>
        <button type="button" onClick={handleParseText} className="form-save-btn">
          Parse with AI
        </button>
        <button type="button" onClick={() => setStep('choose')} className="form-cancel-btn">
          Back
        </button>
      </div>
    </div>
  )
}

function ParsedVisitPreview({ parsed }) {
  const { visit, treatments, treatment_areas } = parsed

  const areasByTreatment = {}
  for (const area of treatment_areas || []) {
    const t = area.treatment_name
    if (!areasByTreatment[t]) areasByTreatment[t] = []
    areasByTreatment[t].push(area)
  }

  return (
    <div className="parsed-visit">
      <div className="parsed-visit-meta">
        {visit?.visit_date && (
          <div className="parsed-meta-row">
            <span className="parsed-meta-label">Date</span>
            <span className="parsed-meta-value">{visit.visit_date}</span>
          </div>
        )}
        {visit?.provider_name && (
          <div className="parsed-meta-row">
            <span className="parsed-meta-label">Provider</span>
            <span className="parsed-meta-value">{visit.provider_name}</span>
          </div>
        )}
        {visit?.body_regions && (
          <div className="parsed-meta-row">
            <span className="parsed-meta-label">Regions</span>
            <span className="parsed-meta-value">{visit.body_regions}</span>
          </div>
        )}
        {visit?.cost != null && (
          <div className="parsed-meta-row">
            <span className="parsed-meta-label">Cost</span>
            <span className="parsed-meta-value">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(visit.cost)}
            </span>
          </div>
        )}
      </div>

      {(treatments || []).map((t, idx) => (
        <div key={idx} className="parsed-treatment">
          <div className="parsed-treatment-head">
            <span
              className={'treatment-dot treatment-dot-' + (t.color_key || 'xeomin')}
              aria-hidden="true"
            />
            <div className="parsed-treatment-titles">
              <div className="parsed-treatment-name">{t.name}</div>
              {t.summary && (
                <div className="parsed-treatment-summary">{t.summary}</div>
              )}
              {t.total_dose && (
                <div className="parsed-treatment-dose">
                  {t.total_dose}
                  {t.lot_number && ' · Lot ' + t.lot_number}
                </div>
              )}
            </div>
          </div>

          {areasByTreatment[t.name]?.length > 0 && (
            <ul className="parsed-areas">
              {areasByTreatment[t.name].map((a, j) => (
                <li key={j} className="parsed-area">
                  <div className="parsed-area-name">
                    {a.friendly_name}
                    {a.mirror && (
                      <span className="parsed-area-mirror">{' '}· both sides</span>
                    )}
                  </div>
                  {(a.clinical_name || a.dose) && (
                    <div className="parsed-area-meta">
                      {a.clinical_name && (
                        <span className="parsed-area-clinical">{a.clinical_name}</span>
                      )}
                      {a.clinical_name && a.dose && (
                        <span> · </span>
                      )}
                      {a.dose && (
                        <span className="parsed-area-dose">{a.dose}</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

export default LogVisitPrompt
