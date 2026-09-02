import { useState, useRef, useEffect } from 'react'
import { saveParsedVisit } from './saveVisit'
import { supabase } from './supabaseClient'
import AreaQuestions from './AreaQuestions'
import ManualVisitEntry from './ManualVisitEntry'
import FaceDiagram from './FaceDiagram'
import { getCoordinates } from './faceCoordinates'
import { apiUrl } from './apiBase'

// Accepted upload types for a document (note/receipt): images and PDFs. Roberta's
// notes arrive as PDFs — Anthropic reads them natively, all pages at once.
const ACCEPT = 'image/*,application/pdf'
const isAllowedType = (t) => t.startsWith('image/') || t === 'application/pdf'

// The parse request carries every page as base64 in one JSON body, and Netlify
// caps a function request at ~6 MB. base64 inflates bytes by ~4/3, so the raw
// total must stay well under that. 4 MB of originals ≈ 5.5 MB encoded — a safe
// margin, and far more than a text PDF or a few screenshots ever need. We
// reject over this rather than silently compress (the locked upload rule).
const MAX_TOTAL_BYTES = 4 * 1024 * 1024
const fmtMB = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

// Today as YYYY-MM-DD in local time — the format visit_date is stored in.
// en-CA renders exactly YYYY-MM-DD.
const todayISO = () => new Date().toLocaleDateString('en-CA')

// "August 11, 2026" from a YYYY-MM-DD string, without timezone drift.
function fmtVisitDate(d) {
  if (!d) return 'that day'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

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
function LogVisitPrompt({ onRefetch, visits = [], patientName = '', providerEmail = '' }) {
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

  return (
    <LogVisitFlow
      onClose={() => setExpanded(false)}
      onRefetch={onRefetch}
      visits={visits}
      patientName={patientName}
      providerEmail={providerEmail}
    />
  )
}

/**
 * Build a mailto: link asking the provider for a treatment record. Opens the
 * patient's own mail app with subject + body prefilled; they fill or confirm the
 * recipient. A zero-backend fallback for the "I don't have anything to log yet"
 * moment. Reliable on phones (where testers are); on desktop it needs a
 * configured mail client, which is an acceptable limit for a fallback.
 */
function recordRequestHref(patientName, providerEmail) {
  const subject = 'Request for my treatment record'
  const body =
    'Hi,\n\n' +
    'Could you please send me a copy of my treatment record from my most ' +
    'recent visit, including the products used, amounts, and treatment areas? ' +
    'A clinical note or an itemized receipt works perfectly.\n\n' +
    'Thank you!' +
    (patientName ? `\n${patientName}` : '')
  return `mailto:${providerEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
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
function LogVisitFlow({ onClose, onRefetch, visits = [], patientName = '', providerEmail = '' }) {
  const [step, setStep] = useState('choose')
  const [text, setText] = useState('')
  // When a visit already exists on this date, holds it so we can warn before
  // saving a possible duplicate (patient decides — proceed or cancel).
  const [pendingDup, setPendingDup] = useState(null)
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
        // result is a data URL "data:…;base64,…"; keep just the base64 part.
        resolve({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file,
          name: file.name,
          size: file.size,
          isPdf: file.type === 'application/pdf',
          // A PDF can't render in <img>; the tile shows a document icon instead,
          // so only images need an object URL.
          previewUrl: file.type === 'application/pdf' ? null : URL.createObjectURL(file),
          base64: String(reader.result).split(',')[1],
          mediaType: file.type,
        })
      }
      reader.onerror = () => reject(new Error('Could not read the file'))
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
      if (!isAllowedType(f.type)) {
        setError('Please choose photos or PDF files')
        return
      }
    }

    // Enforce the request-size ceiling across everything already added plus the
    // new files, so a multi-page note can't quietly exceed Netlify's limit.
    const existing = pages.reduce((sum, p) => sum + (p.size || 0), 0)
    const incoming = selected.reduce((sum, f) => sum + f.size, 0)
    if (existing + incoming > MAX_TOTAL_BYTES) {
      setError(
        `That's ${fmtMB(existing + incoming)} total — the limit is ${fmtMB(MAX_TOTAL_BYTES)}. ` +
          'Try fewer pages, or export the PDF at a smaller size.'
      )
      return
    }

    setReadingPages(true)
    try {
      const newPages = await Promise.all(selected.map(readPage))
      // Append, so pages can be added one at a time (a phone camera shoots one
      // page at a time) or several at once from the library.
      setPages((prev) => [...prev, ...newPages])
      setStep('photo-input')
    } catch {
      setError('Could not read one of the files. Please try again.')
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
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl)
      const next = prev.filter((p) => p.id !== id)
      if (next.length === 0) setStep('choose')
      return next
    })
  }

  function cancelPhoto() {
    pages.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
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
      const response = await fetch(apiUrl('/.netlify/functions/parse-visit'), {
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
      const response = await fetch(apiUrl('/.netlify/functions/parse-visit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Every file (images and/or PDFs) in one request — one visit.
          files: pages.map((p) => ({ data: p.base64, media_type: p.mediaType })),
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
    pages.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
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

  async function handleSave(force = false) {
    // Duplicate guard: if a visit already exists on this date, warn once and let
    // the patient decide. A soft check — same date is the signal — because two
    // real visits on one day are rare, and re-uploading the same note is not.
    // The parser leaves the date null when the document didn't state one; that
    // saves as today (see saveVisit), so we compare against today in that case.
    if (!force) {
      const effectiveDate = parsed?.visit?.visit_date || todayISO()
      const existing = (visits || []).find((v) => v.visit_date === effectiveDate)
      if (existing) {
        setPendingDup(existing)
        return
      }
    }
    setPendingDup(null)
    setSaveError(null)
    setSaving(true)
    // Snapshot existing visit ids so a failed request can be told apart from a
    // "response lost after the save committed". On native (WKWebView) an atomic
    // RPC can commit while its reply is dropped — surfacing as "TypeError: Load
    // failed" for a visit that actually saved. See the catch below.
    const priorVisitIds = new Set((visits || []).map((v) => v.id))
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
      // Before showing an error, check whether the visit landed anyway. The save
      // is atomic, so a NEW visit id means it committed and only the response was
      // lost in transit — treat that as success, not a scary false failure that
      // would tempt the patient to re-save and create a duplicate.
      let committed = false
      try {
        const { data: fresh } = await supabase.from('visits').select('id')
        committed = (fresh || []).some((v) => !priorVisitIds.has(v.id))
      } catch {
        /* couldn't verify — fall through to showing the error */
      }
      if (committed) {
        setSavedNote('')
        setSaved(true)
        if (onRefetch) {
          try {
            await onRefetch()
          } catch (err) {
            console.warn('[LogVisit] refetch after recovered save failed:', err)
          }
        }
      } else {
        setSaveError(e.message || 'Could not save your visit. Please try again.')
      }
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
              <div className="logvisit-choice-title">Photo or PDF</div>
              <div className="logvisit-choice-sub">
                A receipt or note from your provider — photos or a PDF, every page
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

          <button
            type="button"
            onClick={() => { setError(null); setStep('manual') }}
            className="logvisit-choice"
          >
            <div className="logvisit-choice-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></div>
            <div className="logvisit-choice-text">
              <div className="logvisit-choice-title">Add it myself</div>
              <div className="logvisit-choice-sub">
                Tap in what you had done — hand the phone to your injector
              </div>
            </div>
          </button>
        </div>

        {/* For the "I don't have anything to log yet" moment: a quiet fallback
            that opens the patient's mail app with a record request prefilled. */}
        <a
          href={recordRequestHref(patientName, providerEmail)}
          className="logvisit-request"
        >
          Don&apos;t have it yet? Ask your provider for your record
        </a>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
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

  // Manual entry step — build the visit by tapping (no receipt). It produces the
  // same `parsed` shape and then hands off to the shared result → save → success
  // path, so coordinates, the duplicate warning and the saved screen all reuse.
  if (step === 'manual') {
    return (
      <ManualVisitEntry
        onCancel={onClose}
        onBuilt={(built) => {
          setParsed(built)
          setAreaAnswers({})
          setSaveError(null)
          setStep('result')
        }}
      />
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
              ? `AI will read all ${pages.length} files as one visit.`
              : pages[0].isPdf
                ? 'AI will read every page of this PDF as one visit.'
                : 'AI will read this and organize it. Add more pages if your note runs long.'}
          </p>
        </div>

        <div className="logvisit-pages">
          {pages.map((p, i) => (
            <div key={p.id} className="logvisit-page">
              {p.isPdf ? (
                // A PDF can't preview in <img>; show a document tile with its
                // name so the patient can still tell pages apart.
                <div className="logvisit-page-pdf">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 2h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M14 2v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                  <span className="logvisit-page-pdf-name">{p.name}</span>
                </div>
              ) : (
                <img src={p.previewUrl} alt={`Page ${i + 1}`} className="logvisit-page-img" />
              )}
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

        {pendingDup ? (
          // Possible duplicate: a visit already exists on this date. Warn, don't
          // block — the patient decides.
          <div className="logvisit-dup">
            <p className="logvisit-dup-text">
              You already have a visit logged on{' '}
              <strong>{fmtVisitDate(pendingDup.visit_date)}</strong>
              {pendingDup.body_regions ? ` (${pendingDup.body_regions})` : ''}. This
              might be the same one.
            </p>
            <div className="form-actions">
              <button
                type="button"
                onClick={() => setPendingDup(null)}
                className="form-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="form-save-btn"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save anyway'}
              </button>
            </div>
          </div>
        ) : (
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
              onClick={() => handleSave()}
              className="form-save-btn"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save to my record'}
            </button>
          </div>
        )}
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

  // Build a face map for the review, resolving each area's coordinate so the
  // user can SEE the whole thing before saving. FaceDiagram does the rest (point
  // vs field, mirror, full-face, skipping unplaced). This is a preview: it omits
  // the duplicate fan-out that saveVisit applies, so two products at the exact
  // same region can overlap here — harmless for a review, and the saved map
  // separates them.
  const faceTreatments = (treatments || []).map((t, idx) => ({
    id: `${t.name}-${idx}`,
    name: t.name,
    color_key: t.color_key,
    treatment_areas: (areasByTreatment[t.name] || []).map((a, j) => {
      const coord = getCoordinates(a.clinical_name) || getCoordinates(a.friendly_name)
      return {
        id: `${t.name}-${idx}-${j}`,
        friendly_name: a.friendly_name,
        clinical_name: a.clinical_name,
        mirror: a.mirror,
        x: coord ? coord.x : null,
        y: coord ? coord.y : null,
      }
    }),
  }))
  const hasMarks = faceTreatments.some((t) => (t.treatment_areas || []).some((a) => a.x != null))

  return (
    <div className="parsed-visit">
      {hasMarks && (
        <div className="parsed-visit-face">
          <FaceDiagram treatments={faceTreatments} />
        </div>
      )}

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
