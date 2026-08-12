import { useState, useRef, useEffect } from 'react'
import { saveParsedVisit } from './saveVisit'
import AreaQuestions from './AreaQuestions'

/**
 * LogVisitPrompt
 *
 * Two states:
 *   - idle: the "+ Log a visit" button
 *   - expanded: a multi-step flow (choose → input → parsing → result)
 *
 * Props:
 *   onRefetch — refetch fn from usePatientData; called after a successful save
 *               so the timeline picks up the new visit.
 */
function LogVisitPrompt({ onRefetch }) {
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

  return <LogVisitFlow onClose={() => setExpanded(false)} onRefetch={onRefetch} />
}

/**
 * LogVisitFlow
 *
 * Sub-states:
 *   - 'choose' (default) — pick text or photo
 *   - 'text-input' — textarea + Parse button
 *   - 'photo-input' — file picker + preview + Parse button
 *   - 'parsing' — loading state
 *   - 'result' — review the parsed visit, then save it
 */
function LogVisitFlow({ onClose, onRefetch }) {
  const [step, setStep] = useState('choose')
  const [text, setText] = useState('')
  // A note can run several pages, and they are ONE visit. Each page is
  // { id, file, previewUrl, base64, mediaType }; all pages go to the parser
  // together. (Progress photos in the archive are still one-per-tile — this
  // multi-page flow is only for reading a document.)
  const [pages, setPages] = useState([])
  const [readingPages, setReadingPages] = useState(false)
  const [parsed, setParsed] = useState(null)
  // Guided-Q&A answers for treatments the document gave no location for:
  // { [treatmentName]: { regions: [{ label, mirror }], notSure: bool } }
  const [areaAnswers, setAreaAnswers] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [savedNote, setSavedNote] = useState('')
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

  // Read one file into a page object (base64 for the parser + a preview URL).
  function readPage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        // result is a data URL "data:image/jpeg;base64,…"; keep just the base64.
        resolve({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          base64: String(reader.result).split(',')[1],
          mediaType: file.type,
        })
      }
      reader.onerror = () => reject(new Error('Could not read the image'))
      reader.readAsDataURL(file)
    })
  }

  async function handleFileSelect(e) {
    setError(null)
    const selected = Array.from(e.target.files || [])
    // Reset the input now, so re-picking the SAME file later still fires change.
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (selected.length === 0) return

    for (const f of selected) {
      if (!f.type.startsWith('image/')) {
        setError('Please choose image files only')
        return
      }
      if (f.size > 5 * 1024 * 1024) {
        setError('Each page must be under 5 MB')
        return
      }
    }

    setReadingPages(true)
    try {
      const newPages = await Promise.all(selected.map(readPage))
      // Append, so pages can be added one at a time (camera captures one shot
      // at a time on phones) or several at once from the library.
      setPages((prev) => [...prev, ...newPages])
      setStep('photo-input')
    } catch {
      setError('Could not read one of the images. Please try again.')
    } finally {
      setReadingPages(false)
    }
  }

  function addMorePages() {
    setError(null)
    if (fileInputRef.current) fileInputRef.current.click()
  }

  function removePage(id) {
    setPages((prev) => {
      const gone = prev.find((p) => p.id === id)
      if (gone) URL.revokeObjectURL(gone.previewUrl)
      const next = prev.filter((p) => p.id !== id)
      if (next.length === 0) setStep('choose')
      return next
    })
  }

  function cancelPhoto() {
    pages.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setPages([])
    if (fileInputRef.current) fileInputRef.current.value = ''
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
      setAreaAnswers({}) // answers belong to one parse; a new parse starts clean
      setStep('result')
    } catch (e) {
      setError(e.message || 'Could not reach AI parser')
      setStep('text-input')
    }
  }

  async function handleParsePhoto() {
    setError(null)
    if (pages.length === 0) {
      setError('Add at least one page')
      return
    }
    setStep('parsing')
    try {
      const response = await fetch('/.netlify/functions/parse-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // All pages of the note in one request — one document, one visit.
          images: pages.map((p) => ({ data: p.base64, media_type: p.mediaType })),
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
      setAreaAnswers({}) // answers belong to one parse; a new parse starts clean
      setStep('result')
    } catch (e) {
      setError(e.message || 'Could not reach AI parser')
      setStep('photo-input')
    }
  }

  function handleStartOver() {
    setText('')
    pages.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setPages([])
    setParsed(null)
    setAreaAnswers({})
    setError(null)
    setSaveError(null)
    setSaved(false)
    setSavedNote('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setStep('choose')
  }

  /**
   * Treatments the document named but gave NO location for (the receipt case).
   * These get the guided Q&A. A treatment that came with real areas from a
   * clinical note is left alone — the document is a better source than memory.
   */
  function treatmentsNeedingAreas() {
    if (!parsed) return []
    const withAreas = new Set(
      (parsed.treatment_areas || []).map((a) => a.treatment_name)
    )
    return (parsed.treatments || []).filter((t) => t?.name && !withAreas.has(t.name))
  }

  /**
   * Merge the Q&A answers into the parsed result as ordinary treatment_areas.
   * The labels come from FACE_REGIONS (our own vocabulary), so every one is
   * guaranteed to resolve to a coordinate in saveVisit — same pipeline, same
   * fan-out, same bilateral invariant. dose stays null: we never ask for it.
   *
   * Also composes visit.body_regions (the VisitCard title, "Forehead, cheeks,
   * and lips") from the answers when the document didn't provide one. A receipt
   * has no locations so the parser correctly leaves body_regions null — but a
   * summary of what the PATIENT just told us is their own answer, not an
   * invention. Without this, receipt visits render with no title line.
   */
  function mergeAreaAnswers(base) {
    const extra = []
    for (const [treatmentName, answer] of Object.entries(areaAnswers)) {
      if (answer?.notSure) continue
      for (const r of answer?.regions || []) {
        extra.push({
          treatment_name: treatmentName,
          friendly_name: r.label,
          clinical_name: null,
          dose: null,
          mirror: r.mirror === true,
        })
      }
    }
    if (extra.length === 0) return base

    const merged = {
      ...base,
      treatment_areas: [...(base.treatment_areas || []), ...extra],
    }

    if (!base.visit?.body_regions) {
      // Distinct regions, in the order picked; duplicates across products
      // (Radiesse + Diluted at "Cheeks") collapse to one mention.
      const labels = [...new Set(extra.map((a) => a.friendly_name))]
      merged.visit = { ...base.visit, body_regions: regionsSummary(labels) }
    }

    return merged
  }

  async function handleSave() {
    setSaveError(null)
    setSaving(true)
    try {
      const { usedToday, unplaced, savedProducts, mappedCount, hasTreatments } =
        await saveParsedVisit(mergeAreaAnswers(parsed))
      const notes = []
      if (usedToday) {
        notes.push("We used today's date since the note didn't include one.")
      }
      if (savedProducts > 0) {
        notes.push(
          `${savedProducts} take-home ${savedProducts === 1 ? 'product' : 'products'} added to your products list.`
        )
      }
      if (unplaced?.length) {
        // A named region we couldn't map — deliberately no invented dot.
        const list = [...new Set(unplaced)].join(', ')
        notes.push(
          `We couldn't place ${list} on your face map, so ${
            unplaced.length > 1 ? 'those areas have' : 'that area has'
          } no dot yet.`
        )
      } else if (hasTreatments && mappedCount === 0) {
        // Real treatments but zero placed dots — the document had no locations
        // and the patient skipped (or wasn't sure in) the guided questions.
        // Frame it as an upgrade path, not a failure.
        notes.push(
          'This visit has no face map yet — the document didn’t say where each treatment went. A clinical note from your provider can fill that in anytime.'
        )
      }
      setSavedNote(notes.join(' '))
      setSaved(true)
      // Best-effort refresh so the timeline shows the new visit. The save has
      // already committed at this point, so a refetch hiccup shouldn't error.
      if (onRefetch) {
        try {
          await onRefetch()
        } catch (e) {
          console.warn('[LogVisit] refetch after save failed:', e)
        }
      }
    } catch (e) {
      setSaveError(e.message || 'Could not save your visit. Please try again.')
    } finally {
      setSaving(false)
    }
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
                A receipt or note from your provider — add every page
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
          multiple
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

  // Photo input step — one or more pages of a document.
  if (step === 'photo-input' && pages.length > 0) {
    const multi = pages.length > 1
    return (
      <div className="logvisit-flow">
        <div className="logvisit-flow-head">
          <h3 className="logvisit-flow-title">Ready to parse</h3>
          <p className="logvisit-flow-sub">
            {multi
              ? `AI will read all ${pages.length} pages as one visit.`
              : 'AI will read this and organize it. Add more pages if your note runs long.'}
          </p>
        </div>

        <div className="logvisit-pages">
          {pages.map((p, i) => (
            <div key={p.id} className="logvisit-page">
              <img src={p.previewUrl} alt={`Page ${i + 1}`} className="logvisit-page-img" />
              <span className="logvisit-page-num">{i + 1}</span>
              <button
                type="button"
                className="logvisit-page-remove"
                onClick={() => removePage(p.id)}
                aria-label={`Remove page ${i + 1}`}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}

          <button
            type="button"
            className="logvisit-page-add"
            onClick={addMorePages}
            disabled={readingPages}
          >
            <span className="logvisit-page-add-plus" aria-hidden="true">+</span>
            {readingPages ? 'Adding…' : 'Add page'}
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions" style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={handleParsePhoto}
            className="form-save-btn"
            disabled={readingPages}
          >
            {multi ? `Parse ${pages.length} pages with AI` : 'Parse with AI'}
          </button>
          <button
            type="button"
            onClick={cancelPhoto}
            className="form-cancel-btn"
          >
            Start over
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

  // Saved confirmation
  if (step === 'result' && saved) {
    return (
      <div className="logvisit-flow">
        <div className="logvisit-saved">
          <div className="logvisit-saved-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="logvisit-saved-title">Saved to your record</div>
          <div className="logvisit-saved-sub">
            Your visit is now in your timeline.{savedNote ? ' ' + savedNote : ''}
          </div>
        </div>
        <div className="form-actions" style={{ marginTop: 20 }}>
          <button type="button" onClick={onClose} className="form-save-btn">
            Done
          </button>
        </div>
      </div>
    )
  }

  // Result step — review, then save
  if (step === 'result' && parsed) {
    return (
      <div className="logvisit-flow">
        <div className="logvisit-flow-head">
          <h3 className="logvisit-flow-title">Here's what we got</h3>
          <p className="logvisit-flow-sub">
            Look it over, then save it to your record.
          </p>
        </div>
        <ParsedVisitPreview parsed={parsed} />

        {/* Guided Q&A — only for treatments the document gave no location for
            (the receipt case). The patient's picks come from our own region
            vocabulary, so they always land on the face map. */}
        {treatmentsNeedingAreas().length > 0 && (
          <div className="qa-section">
            <div className="qa-section-head">
              <div className="qa-section-title">Help map this visit</div>
              <p className="qa-section-sub">
                This document doesn’t say where each treatment went. If you
                remember, tap the areas and they’ll show on your face map.
              </p>
            </div>
            {treatmentsNeedingAreas().map((t) => (
              <AreaQuestions
                key={t.name}
                treatmentName={t.name}
                value={areaAnswers[t.name]}
                onChange={(next) =>
                  setAreaAnswers((prev) => ({ ...prev, [t.name]: next }))
                }
              />
            ))}
          </div>
        )}

        {saveError && <div className="form-error">{saveError}</div>}
        <div className="form-actions" style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={handleStartOver}
            className="form-cancel-btn"
            disabled={saving}
          >
            Start over
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="form-save-btn"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save to my record'}
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

/**
 * "Forehead, around the eyes, and cheeks" — the same shape as the AI's own
 * body_regions summaries ("Face, neck, and lips"): first word capitalised,
 * the rest lowercase, Oxford comma.
 */
function regionsSummary(labels) {
  const lower = labels.map((l) => l.toLowerCase())
  let s
  if (lower.length === 1) s = lower[0]
  else if (lower.length === 2) s = `${lower[0]} and ${lower[1]}`
  else s = `${lower.slice(0, -1).join(', ')}, and ${lower[lower.length - 1]}`
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function ParsedVisitPreview({ parsed }) {
  const { visit, treatments, treatment_areas } = parsed
  const products = parsed.products || []

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

      {products.length > 0 && (
        <div className="parsed-products">
          <div className="parsed-products-label">Products (take-home)</div>
          {products.map((p, idx) => (
            <div key={idx} className="parsed-product">
              <span className="parsed-product-name">{p.name}</span>
              {p.notes && <span className="parsed-product-notes"> · {p.notes}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default LogVisitPrompt
