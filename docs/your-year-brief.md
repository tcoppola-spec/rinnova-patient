# "Maintenance" — yearly plan / roadmap (design brief)

> Status: **draft for review — shape signed off by Tracy (Sep 2026).** Not built.
> Captures the shape, the hard constraints, and a sliced build path. Reacts to
> the same discipline as the hero card and area cadence — read those in
> CLAUDE.md §8 first.
>
> Working name in product: section title **"Maintenance"**, subtext **"Your
> yearly plan"**. (File keeps the `your-year` name for continuity.)

---

## 1. What it is

Most patients go in and get "whatever they or the provider thinks they need"
that day. They have no picture of the *year*: how many times they'll want tox,
filler, laser; which products to stay on; and what it will cost. "Maintenance"
gives them that picture — a **rough, flexible draft** of the year's expected
treatments and products, **with estimated price**, that they own, can edit, and
can bring to an appointment. It is explicitly **subject to change based on
real-time needs** — a starting point, not a commitment.

Natural extension of the thesis: Rinnova already tells you *what you've had*;
this tells you *what your year looks like* so you walk in informed instead of
improvising.

---

## 2. THE HARD LINE — who is allowed to say "you need this"

This shapes the whole design, so it comes first. Every existing Rinnova feature
holds one discipline: **descriptive, never prescriptive.** The hero card says
"may be wearing off," never "you need." Area cadence says "at your usual pace…,"
never "book now." Locked decision (CLAUDE.md §8, §13), and not just tone:

- Keeps Rinnova out of **giving medical/treatment advice** — a liability and a
  health-claim problem.
- Rinnova is **declared to Apple as NOT a regulated medical device.** A screen
  that generates "here's what you need to stay youthful for your age, N times a
  year" is prescriptive advice — the kind of thing that can pull the app *into*
  medical-device / health-claim scrutiny on review.
- "For your age" implies a normative standard we'd have to **invent**, and
  "never invent clinical data" is the deepest rule in the codebase.

The feature is right; the **authorship** has to be right. Two authors:

### Rinnova authors the PROJECTION (descriptive, from *their own* data)

Seeds the draft from the patient's own history: category cadence (`renewals.js`
duration ranges), their own per-area repeat intervals (`areaCadence.js` — the
code already calls itself the groundwork for this), and **their own past costs**.
Framed as "at your pace, about $Y" — never "you need." A category we can't place
gets no claim. Silence over invention.

### The patient owns and edits the PLAN; the provider informs it

It's the **patient's** draft — fully editable. "Adjust with the provider" for the
pilot = hand them the phone and edit together (same move as manual visit entry);
no provider login required. Anything framed as a clinical recommendation is the
patient's plan *informed by* their provider, not Rinnova telling them what to do.
A provider-authored, attributed plan ("Your plan with Dr. Del Campo") is Phase 2,
when providers are real entities.

**The framing is load-bearing: a rough draft the patient adjusts.** That both
delivers what patients want and keeps Rinnova descriptive.

---

## 3. Decided (Tracy, Sep 2026)

- **Name:** section title "Maintenance", subtext "Your yearly plan".
- **Placement:** collapsible section **under Products**, **collapsed by default**.
- **Collapsed header:** title + subtext + **pencil** (edit affordance). **NO
  rolled-up price in the header.** Per-item estimates + total live *inside* the
  expanded view.
- **Horizon:** a full year.
- **Year boundary:** **calendar year (Jan–Dec)** — see §6.
- **Edit mode:** the pencil toggles edit; **every field editable**; add/remove
  items.
- **Adding items:** treatments **and products**, added via the **same picker as
  manual "do it yourself" entry** (reuse `manualEntry.js`'s menu). No forecasted
  injection amounts — the plan is coarse. Price is an **estimate**.
- **Products are included** in the plan, with **directions/notes** (e.g. "use 2×
  daily for 6 months").
- **Status tracking:** as real visits are logged, each item shows progress —
  e.g. "**1 of 4** Botox done this year".
- **Going OVER plan is NOT an alert.** Exceeding a planned count is not a bad
  thing — likely good, just "new." Account for it quietly with a **subtle,
  positive-neutral visual cue**; never red, never a warning icon, never
  "exceeded / over budget" language. See §5.

---

## 4. Shape of the plan — rows with counts + progress (not a strict timeline)

The unit is a **category/product row**, not four precisely-dated appointments.
This matches "rough draft," and it's what makes the status counter work:

```
Botox        planned 4×   1 done    ~$650 each
Lip filler   planned 2×   0 done    ~$800 each
Laser        planned 1×   0 done    ~$1,200
Retinol      daily        —         ~$90 · restock ~3× · "2× daily, 6 months"
```

- **Progress is computed, not entered.** A logged visit of a given category ticks
  its row up. Match by `color_key`; **a DATE is one event, not a row** (same rule
  as area cadence — Radiesse + diluted Radiesse the same day is one filler event).
- **Precise month placement is soft/optional**, not the backbone. (A light
  timeline visual can come later; lead with rows + progress.)
- Estimated **total shows inside the expanded view** (a range / "about"), never
  in the collapsed header.
- Copy discipline throughout: "planned," "at your pace," "about $Y," "subject to
  change." Never "you need," never "book now," never a per-age normative claim.
- Thin/empty history → projection has little to say → offer a **blank template**
  to fill in. Confidence gating like area cadence (don't invent a rhythm from one
  date).

---

## 5. Over-plan (going beyond the draft) — quiet, not an alarm

Decided: exceeding a planned count is surfaced quietly and read as neutral-to-good.

- The count keeps climbing past the target: **"5 done · planned 4."** Factual.
- A **subtle positive-neutral cue** on the row — e.g. the progress indicator
  fills completely and the overage reads as a soft magenta accent (a faint
  over-fill or a small "+1"). **No red, no warning icon** (magenta-only palette),
  no "exceeded / over budget" wording (sounds like a violation).
- Because it's "new," optionally offer gentle framing — *"a bit ahead of your
  draft"* — as an easy nudge to bump the plan up, never a scold. The plan is a
  rough draft that flexes to real life; this is the draft catching up to reality.

---

## 6. Related change to ship FIRST — products on the log-a-visit confirm view

Independently useful, smaller, and a prerequisite for products being first-class
enough to plan around. **Ship before the Maintenance section.**

Today the AI parser returns `products: [{name, notes}]` and `save_parsed_visit`
files them, but **the confirm/preview screen never shows them** — the patient
can't see or annotate what got filed. Change:

- **Show parsed products on the confirm view** (both AI-parse and manual entry),
  before save.
- **Editable directions/notes field** per product ("use 2× daily for 6 months")
  → maps to the existing **`products.notes`** column. **No schema change.**
- **Manual "do it yourself" entry** gains product-adding too.

This is Slice 0 below.

---

## 7. Year boundary — calendar year (Jan–Dec)

Considered three; picking calendar year:

- **Rolling 12 months** — rejected. The status counter ("1 of 4 this year")
  needs a fixed denominator and a fixed window; a sliding window has neither and
  never "completes."
- **Year-from-join (anniversary)** — rejected. Always a full 12 months, but "your
  year ends next October" is unintuitive; maintenance is seasonal/annual in real
  life (budgets, memberships), so the boundary should match how people think.
- **Calendar year (Jan–Dec)** — chosen. Legible ("your 2026 plan"), gives the
  status counter a stable window, matches real life.

Join-anytime handling: default to the **current** calendar year; a simple
**◀ 2026 ▶ switcher** lets someone build next year. **If a patient joins late
(past ~October), default the view to *next* year**, since little of the current
one remains to plan.

---

## 8. Data model sketch (not final)

Projection is **computed live** from history — not stored. Only the **edited
plan** persists. Progress is **computed** from logged visits — not stored.

- `plan_items` (patient-owned, standard RLS — SELECT/INSERT/UPDATE/**DELETE**
  from day one, all `patient_id = get_my_patient_id()`; the DELETE policy matters
  so edits don't fail silently — §7/§14 silent-RLS trap):
  - `id`, `patient_id`
  - `plan_year` INTEGER (the calendar year this item belongs to)
  - `kind` ('treatment' | 'product')
  - `category` (a `color_key`, for treatments) / product `name`
  - `title` (patient-facing)
  - `planned_count` INTEGER (e.g. 4)
  - `est_cost` NUMERIC per occurrence (nullable — estimate)
  - `directions` / `notes` TEXT (products: "2× daily for 6 months")
  - `source` ('rinnova_projection' | 'manual')
  - `display_order`, `created_at`, `updated_at`
- **Progress** = count of the patient's logged visits (distinct dates) matching
  `category` within `plan_year`. Computed at read time; nothing stored. Over-plan
  is simply progress > planned_count — rendered per §5, no special flag stored.
- A `plans` parent + provider attribution is **Phase 2**; for the pilot, items
  keyed by `patient_id` + `plan_year` are enough.
- Writes stay narrow + RLS-scoped. Never open an UPDATE policy on `patients`
  (CLAUDE.md §7) — use a narrow RPC if a patient-writable field is ever implied.

---

## 9. Slices

**Slice 0 — products on the confirm view (ship first, small):**
1. Show parsed products on the log-a-visit confirm (AI-parse + manual).
2. Editable directions/notes per product → `products.notes` (no schema change).
3. Product-adding in manual entry.

**Slice 1 — the Maintenance section (V1, no provider accounts):**
1. `plan_items` table + RLS (incl. DELETE policy).
2. Collapsible "Maintenance" section under Products, collapsed by default,
   pencil-to-edit, no price in the header.
3. Projection seeds the draft from `renewals.js` + `areaCadence.js` + own costs.
4. Rows with planned count, estimated cost, and **computed progress** (N of M),
   including the quiet over-plan cue (§5).
5. Edit mode: all fields editable; add treatments/products via the manual-entry
   picker; directions/notes on products.
6. Calendar-year scope + ◀/▶ year switcher; smart default for late joiners.
7. Blank template for thin-history patients.

**Phase 2 (needs providers as real entities — `docs/providers-and-invites-brief.md`):**
- Provider editing a *shared* plan remotely; attributed "Your plan with Dr. <name>",
  provider-quoted prices.
- Tie-in with parked **reminders** (opt-in, per area, email via Resend) —
  Maintenance is the natural surface those fire from.

---

## 10. Open questions

1. Confidence floor before the projection shows a category — reuse area cadence's
   "3+ dates = established," or looser for a year view?
2. Estimated total inside the expanded view — always shown, or its own toggle?
3. Keep a light timeline visual at all in V1, or purely rows + progress?
4. When a patient edits a projected item, do we note "Rinnova suggested 4, you
   set 3," or silently replace?
5. Un-planned category that got treated (e.g. a laser they never planned) —
   surface it as a gentle "add to your plan?" suggestion, or leave it out?

**Resolved:** over/under-completion display → §5 (quiet cue, no alert).

---

End of brief. Nothing ships until Tracy signs off on each slice.
