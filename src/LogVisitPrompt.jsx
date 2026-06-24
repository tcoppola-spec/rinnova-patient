import { useState, useRef, useEffect } from 'react'

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

function LogVisitFlow({ onClose }) {
  const [step, setStep] = useState('input')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (step === 'input' && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [step])

  async function handleParse() {
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
        setStep('input')
        return
      }
      if (!data.parsed) {
        setError('Parser returned no data')
        setStep('input')
        return
      }
      setParsed(data.parsed)
      setStep('result')
    } catch (e) {
      setError(e.message || 'Could not reach AI parser')
      setStep('input')
    }
  }

  function handleStartOver() {
    setText('')
    setParsed(null)
    setError(null)
    setStep('input')
  }

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

  return (
    <div className="logvisit-flow">
      <div className="logvisit-flow-head">
        <h3 className="logvisit-flow-title">Log a visit</h3>
        <p className="logvisit-flow-sub">
          Paste in the treatment note or details from your provider. AI will organize it.
        </p>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your treatment note here — for example, a receipt, a follow-up email, or anything your provider sent you."
        className="logvisit-textarea"
        rows={8}
      />
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions" style={{ marginTop: 12 }}>
        <button type="button" onClick={handleParse} className="form-save-btn">
          Parse with AI
        </button>
        <button type="button" onClick={onClose} className="form-cancel-btn">
          Cancel
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
