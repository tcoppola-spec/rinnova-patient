import { FACE_REGIONS } from './faceRegions'

/**
 * AreaQuestions — the guided Q&A for one treatment that arrived with no
 * location (the receipt case). The patient taps the regions they remember;
 * each answer is a canonical Rinnova region, so it's guaranteed to land on the
 * face map — no free text, no fuzzy matching, nothing to parse.
 *
 * Design rules this encodes (deliberate — don't loosen them):
 *   - "I'm not sure" is FIRST-CLASS and as easy as any region. A patient who
 *     doesn't remember must have an honest exit; a forced choice would just
 *     move fabrication from the AI to the patient.
 *   - Dose is NEVER asked. Patients reliably remember WHERE, almost never how
 *     many units. A guessed dose is invented clinical data.
 *   - Off-axis regions default to "Both sides" (visible + flippable — the
 *     overwhelmingly common pattern for tox/filler). Midline regions get no
 *     side control: a bilateral midline area is the exact contradiction
 *     assertPlacement() rejects.
 *
 * Props:
 *   treatmentName — e.g. "Jeuveau"
 *   value         — { regions: [{ label, mirror }], notSure: boolean }
 *   onChange      — (nextValue) => void
 */
function AreaQuestions({ treatmentName, value, onChange }) {
  const regions = value?.regions || []
  const notSure = value?.notSure || false

  const isSelected = (label) => regions.some((r) => r.label === label)

  function toggleRegion(region) {
    if (isSelected(region.label)) {
      onChange({ notSure: false, regions: regions.filter((r) => r.label !== region.label) })
    } else {
      onChange({
        notSure: false, // picking a region clears "not sure"
        regions: [...regions, { label: region.label, mirror: !region.midline }],
      })
    }
  }

  function toggleNotSure() {
    // "Not sure" is exclusive: it clears any picked regions.
    onChange(notSure ? { notSure: false, regions } : { notSure: true, regions: [] })
  }

  function setMirror(label, mirror) {
    onChange({
      notSure: false,
      regions: regions.map((r) => (r.label === label ? { ...r, mirror } : r)),
    })
  }

  const selectedBilateral = regions.filter(
    (r) => !FACE_REGIONS.find((f) => f.label === r.label)?.midline
  )

  return (
    <div className="qa-block">
      <div className="qa-question">Where was {treatmentName} applied?</div>
      <p className="qa-sub">Tap all the areas you remember. It’s okay to skip.</p>

      <div className="qa-chips">
        {FACE_REGIONS.map((region) => (
          <button
            key={region.label}
            type="button"
            className={`qa-chip${isSelected(region.label) ? ' is-selected' : ''}`}
            onClick={() => toggleRegion(region)}
            aria-pressed={isSelected(region.label)}
          >
            {region.label}
          </button>
        ))}
        <button
          type="button"
          className={`qa-chip qa-chip-notsure${notSure ? ' is-selected' : ''}`}
          onClick={toggleNotSure}
          aria-pressed={notSure}
        >
          I’m not sure
        </button>
      </div>

      {selectedBilateral.length > 0 && (
        <div className="qa-sides">
          {selectedBilateral.map((r) => (
            <div key={r.label} className="qa-side-row">
              <span className="qa-side-label">{r.label}</span>
              <div className="qa-side-toggle" role="group" aria-label={`${r.label} sides`}>
                <button
                  type="button"
                  className={`qa-side-option${r.mirror ? ' is-active' : ''}`}
                  onClick={() => setMirror(r.label, true)}
                >
                  Both sides
                </button>
                <button
                  type="button"
                  className={`qa-side-option${!r.mirror ? ' is-active' : ''}`}
                  onClick={() => setMirror(r.label, false)}
                >
                  One side
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {notSure && (
        <p className="qa-notsure-note">
          No problem — this treatment will be saved without a spot on your face
          map. You can always ask your provider where it went.
        </p>
      )}
    </div>
  )
}

export default AreaQuestions
