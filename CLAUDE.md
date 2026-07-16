# Rinnova — Claude Context File

> Read this entire document before making any changes to the Rinnova codebase.
> It encodes the product vision, architecture decisions, design system, and locked patterns that aren't obvious from the code alone.

---

## 1. What Rinnova is

**Rinnova** is a patient-facing aesthetic medicine record-keeping app. It exists so patients can own and understand their own treatment history — what products they've had, where on the body, when, by whom, and at what cost.

It's built by **Tondo LLC** (founder: Tracy Cappola). Rinnova is Tondo's flagship product.

The thesis: aesthetic medicine patients accumulate detailed treatment history (Botox lots, filler doses, hyaluronidase reversals, peel concentrations, retinoid strengths), but that history lives in scattered, provider-controlled records. Patients deserve a continuous, beautiful, AI-organized record they actually want to look at.

---

## 2. Who's who

- **Tracy Cappola** — founder of Tondo LLC. Lives in Connecticut. Designer by background. Beginner coder (~10-20 hrs/week on this project). Also serves as **Patient 0** — the first real Rinnova user.
- **Dr. Roberta Del Campo, MD** — Tracy's actual aesthetic provider at a Miami medspa. Five-plus year patient relationship. Pilot provider for Phase 1.
- **You (Claude / Claude Code)** — co-builder. Treat Tracy as a thoughtful product person learning to code, not as either a senior engineer or a complete novice. She has strong design instincts and product judgment — defer to her on aesthetic/UX calls. Explain technical concepts at depth she can grow into, not down at her.

---

## 3. Patient 0 reference data (Tracy's record)

These IDs are in the production Supabase database. Many flows depend on them.

```
Tracy's auth UUID:     dcf6359b-65a2-47f9-9c73-aee21eb7d2b0
Tracy's email:         tcoppola@tozadigital.com
Tracy's patient_id:    90d7b547-8dc5-4ab7-b297-6a6d1f15e5eb
Tracy's first visit:   cd0337f4-69ba-4a90-aba9-e85afb1ca2b4  (April 24, 2026)
Roberta provider_id:   fdda2aa6-e834-4514-ab2d-543b5229ac87
GitHub username:       tcoppola-spec
Local path:            ~/Documents/TONDO_LLC/Apps/_Rinnova/Patient_0
Production URL:        https://tondo-rinnova.netlify.app
GitHub repo:           github.com/tcoppola-spec/rinnova-patient
```

Tracy's April 24 visit contains:
- 4 treatments (Xeomin, Radiesse, Diluted Radiesse, RHA2)
- 17 treatment areas
- Total cost $2,500
- Provider: Dr. Roberta Del Campo, MD
- Body regions: "Face, neck, and lips"

This is the canonical example. When testing, this is the visit to compare against.

---

## 4. Stack

- **Frontend:** React 18 + Vite
- **Database / Auth / Storage:** Supabase (Postgres + Row Level Security + Storage buckets + email OTP code auth)
- **Hosting:** Netlify (free tier) with auto-deploy from main branch
- **Serverless backend:** Netlify Functions (Node.js, ES modules)
- **AI:** Anthropic Claude Sonnet 4.5 via `@anthropic-ai/sdk` (multimodal — text + vision)
- **Routing:** React Router (client-side; Netlify SPA redirects via `public/_redirects`)
- **Styling:** Plain CSS in a single `App.css` (~1700 lines, organized by section comments)

No Tailwind. No CSS-in-JS. No component library. Vanilla React + plain CSS by deliberate choice — Tracy needs to be able to read every line.

### Authentication — email OTP code

Sign-in is passwordless via an **email OTP code**, not a magic link. Flow (see `Login.jsx`): enter email → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` → enter the emailed code → `supabase.auth.verifyOtp({ email, token, type: 'email' })` → on success `Login` calls `navigate('/')` itself (App isn't mounted on `/login`, so its auth listener can't do the redirect).

**Why OTP, not magic link:** a magic link opens in Safari, a *separate storage context* from an installed iOS PWA, so the PWA never receives the session — the user is bounced back to sign-in on every launch. A typed code works identically in Safari, the installed PWA, and on Android.

**Dashboard dependency (easy to miss):** the emailed code is rendered by the Supabase **"Magic Link" email template**, which MUST include `{{ .Token }}`. Default templates render only `{{ .ConfirmationURL }}` (the link), so without editing the template the code never appears. If codes ever stop arriving, check that template first. The code expires in 1 hour by default.

**Code length is a dashboard setting, not fixed at 6.** Supabase's **Authentication → Providers → Email → Email OTP Length** is configurable (6–10 digits; default 6, but the pilot project is set to 8). `Login.jsx` therefore validates `^\d{6,10}$` — do NOT hard-code 6, or a dashboard change silently truncates the input and rejects every code (this exact bug locked out sign-in once).

**Email delivery — custom SMTP (Resend), configured (July 10, 2026).** Sends now go through Resend (`smtp.resend.com`, verified sender domain), which clears Supabase's built-in ~2 emails/hour cap. Verified end-to-end: code arrives, on-brand template renders, not flagged as spam. Before Resend this was the hard V1 blocker (the built-in sender made sign-in single-tester-only). Configured in Supabase → Project Settings → Authentication → SMTP Settings.

**`AuthCallback.jsx` is legacy.** The `/auth/callback` route is retained only as a safety net for any magic link already sitting in an inbox (they expire ~1h). It is unused by the OTP flow and can be deleted once no old links matter.

**Parked auth work (see §11):** magic-link-as-primary (needs iOS Universal Links) and Face ID / WebAuthn unlock for PWA re-entry.

---

## 5. Directory layout

```
Patient_0/
├── public/
│   ├── _redirects                  # Netlify SPA routing config: /* → /index.html 200
│   ├── favicon.svg                 # Browser tab mark (Rinnova logo)
│   ├── manifest.webmanifest        # PWA manifest (Chunk 7): standalone, brand colors, icons
│   ├── icon-192.png                # PWA icon (Chunk 7) — Fraunces "R" on brand gradient
│   ├── icon-512.png                # PWA icon (Chunk 7)
│   └── apple-touch-icon.png        # iOS Add-to-Home icon, 180px (Chunk 7)
├── netlify/
│   └── functions/
│       └── parse-visit.js          # Server-side Claude API call (text + image input)
├── db/
│   ├── save_parsed_visit.sql       # Atomic RPC that saves a parsed visit (Chunk 6 Step 4)
│   ├── migrate_face_coordinates.sql # One-off: old 200x260 dots → new face's space
│   ├── add_onboarding_flag.sql     # patients.onboarding_completed + complete_onboarding() RPC
│   ├── fix_coordinate_precision.sql # x/y integer → double precision (fractional coords)
│   ├── allow_unplaced_areas.sql    # x/y nullable ("we can't place this") + repair the tear trough
│   ├── allow_visit_delete.sql      # DELETE policy on visits (children cascade)
│   ├── add_visit_photos.sql        # photos.visit_id (ON DELETE SET NULL) + WITH CHECK attach policy
│   └── add_visit_products.sql      # save_parsed_visit also files parsed retail products
├── scripts/
│   ├── icon-source.svg             # App-icon source: white Fraunces "R" (vector) on gradient
│   ├── generate-icons.mjs          # Renders public/ PNG icons from the source (sharp, dev-only)
│   ├── new-face.svg                # Source artwork for FaceDiagram (Illustrator export)
│   └── onboarding-face-icon.svg    # Source artwork for the Onboarding screen-3 face icon
├── docs/
│   └── onboarding-brief.md         # Original design brief for the onboarding flow (see §18)
├── src/
│   ├── main.jsx                    # React entry
│   ├── App.jsx                     # Root component, routes, auth state
│   ├── App.css                     # All styles (sectioned with /* === HEADER === */ comments)
│   ├── index.css                   # Reset + design tokens (CSS vars)
│   ├── supabaseClient.js           # Supabase client init
│   ├── usePatientData.js           # Custom hook: fetches all patient data, exposes refetch
│   ├── saveVisit.js                # Shapes parsed data + calls save_parsed_visit RPC (Chunk 6)
│   ├── faceCoordinates.js          # friendly_name → {x,y} lookup for face dots (Chunk 6)
│   ├── faceRegions.js              # Universal region list for the guided area Q&A
│   ├── AreaQuestions.jsx           # Guided Q&A card: region chips + both-sides toggle
│   ├── faceGeometry.js             # Face SVG coordinate space: viewBox, mirror axis, dot radius
│   ├── Login.jsx                   # Sign-in: two-step email → 6-digit OTP code (verifyOtp)
│   ├── AuthCallback.jsx            # LEGACY magic-link redirect handler (kept for in-flight links)
│   ├── Greeting.jsx                # "Hi, Tracy" header
│   ├── HeroCard.jsx                # Magenta gradient "Make an appointment" card
│   ├── LogVisitPrompt.jsx          # AI-parsing visit log flow (text/photo → parse → save)
│   ├── VisitsTimeline.jsx          # Section + list of VisitCards
│   ├── VisitCard.jsx               # Compact visit card with inline cost editing
│   ├── VisitDetailModal.jsx        # Bottom-sheet modal: face diagram + treatments + photos + delete
│   ├── VisitPhotos.jsx             # Photo strip inside a visit (upload-into / attach-from-archive)
│   ├── FaceDiagram.jsx             # Line-art SVG face with treatment dots (right half, mirrored)
│   ├── PhotosSection.jsx           # The one photo archive; badges visit-linked photos
│   ├── PhotoLightbox.jsx           # Bottom-sheet photo viewer: caption + attach/detach + delete
│   ├── AddPhotoFlow.jsx            # Shared upload flow (archive + into-a-visit via optional visitId)
│   ├── photoVisitLink.js           # attach/detach helpers (row-count checked)
│   ├── ProductsSection.jsx         # Products list + add form + delete
│   ├── SubscriptionsSection.jsx    # Currently empty state only
│   ├── Onboarding.jsx              # First-run 3-screen carousel (see §18)
│   └── PageFooter.jsx              # Tondo brand footer
├── index.html                      # HTML shell — PWA manifest link + iOS Add-to-Home meta tags
├── netlify.toml                    # Build config + header rule (manifest MIME type)
├── package.json                    # sharp is a devDependency (icon generation only)
├── .env                            # Local Supabase + Anthropic keys (gitignored)
├── .env.local                      # Netlify Dev auto-generated (gitignored)
└── .gitignore                      # Includes .env*, .netlify, node_modules
```

---

## 6. Environment variables

**Three required env vars, configured in two places:**

| Variable | Where it's used | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend (browser) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend (browser) | Supabase publishable key (safe to expose) |
| `ANTHROPIC_API_KEY` | Server (Netlify Function) | NEVER expose to frontend. Real secret. |

**Configured in:**
1. **Local development:** `.env` file (read by Vite) and/or `.env.local` (Netlify Dev creates this automatically and prefers it over `.env`)
2. **Production:** Netlify project → Site Configuration → Environment Variables. All three must be present in **All Deploy Contexts** OR at minimum Production.

**Critical:** the `ANTHROPIC_API_KEY` must be marked as **Secret** in Netlify (masks value in logs and UI). The Supabase publishable key does NOT need this — it's designed to be public.

If login ever shows "Invalid API key" or 401 errors against `supabase.co`, the Supabase key has likely drifted between local and Netlify, or it got rotated. Check by visiting Supabase → Settings → API and comparing.

---

## 7. Database schema

All tables have Row Level Security (RLS) enabled. The helper function `get_my_patient_id()` returns the patient_id for the currently authenticated user (resolved via `auth_user_id`).

### `patients`
- `id` UUID PK
- `auth_user_id` UUID (links to Supabase auth.users)
- `first_name`, `last_name`, `email`, `dob`, `provider_name`, `provider_phone`
- `primary_provider_id` UUID → providers
- `onboarding_completed` BOOLEAN **NOT NULL**, default `false` — gates the first-run flow (§18). Added by `db/add_onboarding_flag.sql`.
- Created in Chunk 1.

**`patients` has NO UPDATE policy — keep it that way.** Postgres RLS is row-level, not column-level, so any UPDATE policy broad enough to let a patient set `onboarding_completed` would also let them rewrite `email`, `dob`, `primary_provider_id`, etc. The only write path into this table is the narrow `complete_onboarding()` SECURITY DEFINER RPC, which takes no arguments, resolves the patient via `get_my_patient_id()`, and sets exactly one column on exactly one row. If you ever need another patient-writable field, add another narrow RPC — do not open up UPDATE.

### `providers`
- `id` UUID PK
- `name`, `credentials`, `practice_name`, `address`, `phone`, `email`

### `visits`
- `id` UUID PK
- `patient_id` UUID → patients (ON DELETE CASCADE)
- `provider_id` UUID → providers (nullable, ON DELETE SET NULL) — frequently left null; the UI reads `provider_name`, not this join
- `provider_name` TEXT (nullable) — human-readable provider string shown in VisitCard / VisitDetailModal
- `visit_date` DATE **NOT NULL**
- `status` TEXT **NOT NULL** — CHECK `status IN ('pending_review', 'confirmed')`, default `pending_review`. Patient-logged AI visits save as `pending_review`; `confirmed` is a Tondo-verified visit.
- `cost` NUMERIC (nullable, inline-editable from VisitCard)
- `body_regions` TEXT (added in Chunk 3 — short human summary like "Face, neck, and lips")
- `follow_up_text` TEXT (nullable)
- `raw_note_photo_url` TEXT (nullable) — reserved for storing the source note/receipt image
- `ai_parsed_at` TIMESTAMPTZ (nullable) — stamped when a visit is saved via the AI parse flow
- `tondo_confirmed_at` TIMESTAMPTZ (nullable) — stamped when Tondo confirms the visit
- `created_at`, `updated_at` TIMESTAMPTZ

### `treatments`
- `id` UUID PK
- `visit_id` UUID → visits (ON DELETE CASCADE)
- `name` TEXT **NOT NULL** (e.g., "Xeomin", "Radiesse", "Diluted Radiesse", "RHA2")
- `color_key` TEXT **NOT NULL** — one of `xeomin` (purple), `radiesse` (magenta), `radiesse-light` (coral, for diluted Radiesse), `rha` (orange). No DB CHECK enforces this — keep values in sync with the COLORS map in `FaceDiagram.jsx`.
- `summary` TEXT (one-line patient-friendly description)
- `total_dose` TEXT (e.g., "2.7cc", "1 syringe")
- `cost` NUMERIC (nullable) — per-treatment cost; not currently surfaced in the UI
- `display_order` INTEGER
- `created_at` TIMESTAMPTZ
- **No `lot_number` column.** The AI parser returns `lot_number` and the parse preview displays it, but it is dropped on save. Add a column if you ever need to persist it.

### `treatment_areas`
- `id` UUID PK
- `treatment_id` UUID → treatments (ON DELETE CASCADE)
- `friendly_name` TEXT **NOT NULL** (e.g., "Between the brows", "Cheekbones")
- `clinical_name` TEXT (e.g., "Glabella", "Zygoma")
- `dose` TEXT (amount at this specific area)
- `mirror` BOOLEAN (true = bilateral, renders a second dot mirrored across the axis of symmetry)
- `x`, `y` DOUBLE PRECISION **NOT NULL** — position on the FaceDiagram SVG, **viewBox 0–231.2 (x) × 0–324.1 (y)**. (NOT `x_coord`/`y_coord`.) **These were `integer` until July 11, 2026** and that broke saving: the coordinate space is fractional (the axis of symmetry is x = 114.9), and Postgres will not cast the text `'114.9'` to `int` — it raises `invalid input syntax for type integer`. Widened by `db/fix_coordinate_precision.sql`. **The column type and the `save_parsed_visit` cast must stay in step:** if the column were still `integer`, a numeric cast in the RPC would *silently round* on insert and drift every dot by up to half a unit, with no error at all. The axis of symmetry is **x = 114.9**, which is NOT the viewBox centre (115.6) — the illustration is drawn 0.7 units off-centre. For a bilateral area, store the LEFT-side point (x < 114.9); FaceDiagram reflects it to (229.8 − x). All of this lives in one place: **`src/faceGeometry.js`**. Before the face-illustration swap this was a 200 × 260 box with axis x=100; existing rows were migrated by `db/migrate_face_coordinates.sql`.
- `display_order` INTEGER
- `created_at` TIMESTAMPTZ
- **Coordinates on save:** the AI does NOT return x/y. `src/faceCoordinates.js` resolves `friendly_name → {x, y}` at save time.

  **⚠️ There is NO fallback coordinate, on purpose. Do not add one.** An injection always has a location, so a region we can't place is a *gap in the lookup table*, not a licence to invent a position — a plausible-looking dot in the wrong place silently falsifies a medical record, which is worse than no dot. Unplaceable regions save with **`x`/`y` NULL**, render no dot, and are named to the patient in the save confirmation. (NULL also gives us non-injectables for free: a laser or peel has no discrete point.)

  This replaced a `DEFAULT_COORDINATE` of (114.9, 175), which caused a real bug — see the invariant below.

- **⚠️ THE BILATERAL INVARIANT: a `mirror = true` area must have an OFF-AXIS x.** `MIRROR_AXIS` is 114.9, so x = 114.9 is the *fixed point* of the reflection (229.8 − 114.9 = 114.9). A bilateral area sitting on the axis draws both of its dots on the same pixel — they stack and look like one. This is exactly how the April 14 tear-trough bug presented: "tear trough" was missing from the lookup, fell back to the old face-centre default (114.9, 175), and rendered as a **single midline dot** for a **bilateral** region. One root cause, both symptoms. `assertPlacement()` in `faceCoordinates.js` now enforces this at save time.

- **Duplicate regions fan out.** Two products at the same area (Radiesse + Diluted Radiesse at "Cheekbones") would otherwise resolve to the identical point and stack. `saveVisit.js` nudges the Nth by a fixed delta — medially+down for bilateral, **down only** for midline (moving a midline area's x would push it off the axis of symmetry, which is anatomically wrong).

- **Matching is token-based, not exact-string.** The AI writes "Tear trough (undereyes)", "Tear troughs", "Under-eye hollows" for the same anatomy. `getCoordinates()` strips parentheticals, handles plurals, and does a token-subset match where the most specific key wins ("lower cheeks" beats "cheeks"). Exact-string matching against free-text AI output is too brittle and was the underlying weakness.

**The face illustration (`scripts/new-face.svg`).** It's line art — every "stroke" is a filled shape (Illustrator expanded them), so there is no `stroke-width` to tune, and there is **no skin fill**: dots sit on the warm gradient of `.face-diagram-wrap`. The source artwork's LEFT half has an uneven outline (the crown swells from ~5.5 to ~9.0 units thick); the right half is uniform. So `FaceDiagram` clips to `x >= 114.4` and draws that half **twice** — once as-is, once mirrored — which yields a symmetric face without touching the artwork. If the `.ai` file is ever fixed and re-exported symmetrically, delete the clip/mirror and render the paths once.

**If the artwork is ever replaced again:** the dot coordinates are denormalized into the DB, so a new illustration means a data migration. Fit an affine to landmarks that don't depend on line weight (iris centres, mouth centre — a filled disc's centre is its centre regardless of stroke). Do **not** re-resolve rows from `faceCoordinates.js` by name: the DB deliberately offsets the Radiesse and Diluted Radiesse dots (e.g. Cheekbones at (44,172) vs (53,175)) so both stay visible, and a name-based re-resolve would collapse them onto one point. See `db/migrate_face_coordinates.sql` for the worked example.

### `photos`
- `id` UUID PK
- `patient_id` UUID → patients (ON DELETE CASCADE — a photo can't outlive its patient)
- `storage_path` TEXT (path inside `patient-photos` Storage bucket)
- `caption` TEXT
- `taken_date` DATE — when the photo was ADDED. **Never rewritten when a photo is attached to a visit** (a photo taken 3 days after a visit still belongs to it; the date is the one thing we can't reconstruct).
- `source` TEXT (`'patient_upload'` for self-uploaded photos)
- `visit_id` UUID → visits, **nullable**, **`ON DELETE SET NULL`** (added July 2026, `db/add_visit_photos.sql`). Optionally attaches a photo to a visit. See below.

**There is ONE photo library, not two.** Every photo lives in `photos` and shows in the archive; attaching to a visit just sets `visit_id`. A visit can hold *many* photos (the FK is on the photo, so one-to-many is free); a photo belongs to *at most one* visit (no join table, on purpose — "which visit is this from?" must stay unambiguous).

**⚠️ `visit_id` is `ON DELETE SET NULL`, NOT cascade. Do not "tidy" it into a cascade by analogy with treatments.** `visits` cascades to `treatments` → `treatment_areas` because those are *derived* from the visit. It must stop dead at photos: a mis-parsed visit costs minutes to re-add, but a photo of the patient's own face is the single least-recoverable thing in the app. Putting SET NULL *in the FK* makes this a database guarantee, not app discipline — deleting a visit (from the app, raw SQL, a future admin tool, anything) can only null the badge, never destroy the photo.

**Attach/detach security — plain RLS, no RPC.** The brief suggested a `SECURITY DEFINER` RPC; it wasn't needed. The `photos` UPDATE policy uses `WITH CHECK` to reject any `visit_id` that isn't one of the caller's own visits (`USING` = which rows I may touch; `WITH CHECK` = what the row may become). A DEFINER function is only for rules RLS *can't* express (like `complete_onboarding`, which needs column-level scoping). The attach/detach helpers live in `src/photoVisitLink.js` and **check the returned rows, not just the error** — a WITH-CHECK rejection returns zero rows with no error (the §14 silent-RLS trap), so an empty result is surfaced as a real failure.

### `products`
- `id` UUID PK
- `patient_id` UUID → patients
- `name` TEXT
- `notes` TEXT
- `added_at` TIMESTAMPTZ
- Two write paths: the Products section (manual add), and `save_parsed_visit` — the AI parser separates take-home retail items from injected treatments and files them here (patient-level; not linked to the visit for now). See §9.

### `subscriptions` (V1 scaffold only — no UI flow yet)
- `id` UUID PK
- `patient_id` UUID → patients
- `name`, `cadence`, `status`

### RLS pattern
Every table has these policies (some are created lazily — when a new use case appears):
- SELECT — `patient_id = get_my_patient_id()` (or chain through joins)
- INSERT — `WITH CHECK (patient_id = get_my_patient_id())`
- UPDATE — same
- DELETE — same

**Important historical pattern:** DELETE policies are easy to forget, and forgetting one **fails silently** — PostgREST returns success with zero rows affected, so the UI happily reports "deleted" while the row sits there untouched. They were added late for `products` and `photos` after exactly that bug, and again for `visits` (July 2026) when the delete button did nothing.

Current state:
- **`visits` HAS a DELETE policy** (`db/allow_visit_delete.sql`, added when visit deletion shipped).
- **`treatments` and `treatment_areas` deliberately have NO DELETE policy.** Their FKs are `ON DELETE CASCADE`, and cascading deletes are referential actions performed by the system — they are **not** subject to RLS on the child tables. So deleting a visit removes its treatments and dots automatically, and there is no way to orphan-delete a treatment out from under its visit. Keep it that way.

The visit **save** still uses an atomic Postgres function (`save_parsed_visit`) rather than client-side insert-then-cleanup: the whole write commits or rolls back as one transaction, so partial writes are impossible.

**When you build any delete feature: check the returned rows, not just the error.** `VisitDetailModal.handleDelete` does `.delete().eq(...).select('id')` and treats an empty result as a failure. Without that check a missing policy is indistinguishable from success.

### Storage RLS for `patient-photos` bucket
- Private bucket (no public read)
- Path structure: `<patient_id>/<uuid>.<ext>` — patient_id is the first folder
- Policies on `storage.objects` table:
  - INSERT, SELECT, DELETE all check: `bucket_id = 'patient-photos' AND (storage.foldername(name))[1] = get_my_patient_id()::text`
- Photos render via **signed URLs** with 1-hour expiration, fetched per-tile on mount

---

## 8. Design system

### Color tokens (defined in `src/index.css` :root)

```css
--ink:           #17172E   /* primary text */
--body:          #3A3A55   /* secondary text */
--muted:         #8A8AA3   /* tertiary text, captions */
--line:          #E5E2DD   /* borders */
--line-soft:     #F5F1EB   /* subtle borders, backgrounds */
--card:          #FFFEFC   /* card backgrounds, slightly warm white */
--page:          #FAF7F2   /* page background, soft cream */

--magenta:       #D63384   /* PRIMARY ACTION COLOR */
--magenta-soft:  #FCE7F0   /* magenta backgrounds */
--magenta-soft-2:#FAD3E3   /* magenta hover backgrounds */

--purple:        #7B2CBF   /* Xeomin treatment color */
--coral:         #F06E89   /* Diluted Radiesse treatment color */
--orange:        #FF8C42   /* RHA treatment color */
/* Radiesse uses --magenta */

--gradient-brand: linear-gradient(135deg, #7B2CBF 0%, #D63384 50%, #FF8C42 100%)
```

### Typography

```css
--f-display: 'Fraunces', serif    /* H1/H2, treatment names, dates */
--f-body:    'Inter', sans-serif  /* everything else */

--phone-width: 480px  /* the design column width on desktop */
```

### Established UI patterns

1. **Phone-first layout** — designed for ~480px column. On desktop, the column centers with a cream-colored background around it. Don't fight this.
2. **Bottom-sheet modal** — for deep views (visit detail, photo lightbox). Slides up from bottom on phone, centers + max-widths on desktop. ESC, X button, backdrop tap all close it. Body scroll lock while open.
3. **Inline expansion** — for create/edit forms (add product, edit cost, log visit). The button transforms into the form in-place. Save returns to button.
4. **Wait-and-show saves** — NOT optimistic UI. Form → Supabase write → refetch → UI updates. Brief "Saving…" label on button. We tried optimistic, pushed back on it for V1 complexity reasons.
5. **Subtle text-link affordances** — small underlined text with a pencil icon for "edit" actions (cost editor). NOT big buttons. The patient page is quiet by default.
6. **Magenta for ALL actions** — Save, primary CTAs, AND destructive confirms. We tried coral for destructive; it felt dull. Magenta with clear context (e.g., "Yes, delete" after tapping a trash icon) is the pattern.
7. **No emoji icons in production** — replace any 📷📝🔥 with stroke-based SVGs that inherit `currentColor`. The emoji-as-placeholder is a code smell.
8. **Strong design discipline** — Tracy will pushback on anything that feels off-brand. Listen carefully. Examples she pushed back on and was right: red destructive button (broke palette), beige cost strip (too prominent), emoji icons (felt placeholder).

### Component patterns to mimic

- **VisitCard.jsx** — two-zone pattern: main tappable area opens modal, secondary cost link is its own button that opens an inline editor. Tap zones never bleed into each other.
- **PhotoLightbox.jsx** — full bottom-sheet pattern with inline edit + delete confirmation. Reference for any future "detail view with edit" UI.
- **ProductsSection.jsx** — three operations cleanly separated: read (list), create (`AddProductForm` sub-component), delete (`ProductRow` sub-component with inline confirm).

---

## 9. AI parsing system (Chunk 6)

### `netlify/functions/parse-visit.js`

A single function accepts EITHER text OR a base64-encoded image. The system prompt is a detailed instruction defining the Rinnova JSON schema.

Input shapes:
```js
// Text input
{ text: "April 24 2026 visit with Dr. Roberta..." }

// Image input
{ image: "base64string...", image_media_type: "image/jpeg" }
```

Output shape (always):
```js
{
  parsed: {
    visit: { visit_date, provider_name, body_regions, cost },
    treatments: [{ name, summary, total_dose, lot_number, color_key }],   // injected
    treatment_areas: [{ treatment_name, friendly_name, clinical_name, dose, mirror }],
    products: [{ name, notes }]   // take-home / retail — NOT injected, no face location
  }
}
```

**Save (Chunk 6 Step 4):** the parse function itself only parses. Saving is a separate frontend step: `LogVisitPrompt.jsx` shows the parsed result with "Save to my record" → `src/saveVisit.js` shapes the payload (groups areas under treatments, resolves face coordinates, passes products through) → calls the `save_parsed_visit` RPC, which atomically writes visits → treatments → treatment_areas → **products** (into the patient's products list; `db/add_visit_products.sql`). `lot_number` is parsed/previewed but not persisted (no column).

### What Claude is told (system prompt)

**⚠️ The #1 rule: NEVER invent clinical data. This is the whole reason the prompt was rewritten (July 2026).** A *receipt* is a billing document — it records what was charged, not where on the body it went or how much was used. Those clinical fields are usually ABSENT, and a missing field must stay missing; a plausible guess in a health record is worse than a blank. Concretely the prompt forbids inventing:
- **Location** — no `treatment_area` unless a body location is literally stated. A receipt with products + prices but no anatomy → `treatment_areas: []`. (The old prompt fabricated a generic `"Face", mirror:true` — this was the tear-trough-cousin bug on Aly's Boulevard receipt.)
- **Dose / units** — "PER UNIT" is a *pricing* label, not a quantity. No units stated → `dose`/`total_dose` null. (The old prompt guessed `"1 unit"`.)
- **Laterality** — `mirror` only on an area you're actually emitting.

This is the same "never invent a coordinate" principle from the save path, moved UPSTREAM to the parser — which is where the fabrication actually originates.

**Treatments vs products:** injected/administered things (tox, filler, biostimulator) → `treatments`; take-home retail (serums, creams, supplements) → `products`. Retail has no face location and never gets a `treatment_area`.

- color_key is a colour category: any neurotoxin → `xeomin` (purple); Radiesse → `radiesse`; diluted → `radiesse-light`; any HA filler → `rha`. (So Jeuveau, Botox, Dysport, Daxxify all map to `xeomin`.)
- Return ONLY JSON. No prose, no markdown fences.

### Coordinates are resolved at save time, not by the AI
`treatment_areas` come back with NO `x`/`y` — the AI doesn't know Rinnova's SVG geometry. `src/faceCoordinates.js` resolves `friendly_name → {x, y}` at save time. An unmatched name resolves to **null → no dot** (never face-centre — see §7), and the region is surfaced to the patient.

### Receipts vs clinical notes (the core parsing reality)
Most real-world documents patients have are **receipts** (billing: date, cost, product names, practice) — not **clinical notes** (which also carry location, dose, laterality). Rinnova turns a receipt into a real visit + products, but **can't build a face map from a receipt that has no locations, and won't fake one.** The path to a map for receipt visits is the **guided Q&A** (below), which lets the patient supply locations from *their* memory.

### Guided area Q&A (shipped July 2026)
On the parse-result screen, any treatment that arrived with **no location** gets a question card: "Where was {name} applied?" The patient taps regions from `src/faceRegions.js` — a **universal, fixed list of 15 regions** — plus a per-region "Both sides / One side" toggle for off-axis regions. Component: `src/AreaQuestions.jsx`; answers merge into `parsed.treatment_areas` in `LogVisitPrompt.mergeAreaAnswers()` before the ordinary save. **No DB or RPC changes** — the answers ride the existing pipeline (coordinate resolution, duplicate fan-out, bilateral invariant).

Why this shape — these rules are deliberate, don't loosen them:
- **It inverts the matching problem.** Free text has to be fuzzy-matched onto our coordinate vocabulary; a pick-list *is* the vocabulary, so every answer is guaranteed to resolve. There's a check that every `faceRegions.js` label resolves via `getCoordinates()` and that its `midline` flag matches the axis — rerun it if either file changes.
- **"I'm not sure" is first-class** and exclusive (clears picks). A forced choice would just move fabrication from the AI to a patient guessing under UI pressure. Not-sure → no areas → honest empty map.
- **Dose is NEVER asked.** Patients remember where; they almost never know units. A guessed dose is invented clinical data.
- **Off-axis regions default to "Both sides"** (visible + flippable — the overwhelming norm for tox/filler). Midline regions get no side control (a bilateral midline area is the `assertPlacement()` contradiction).
- Treatments that came WITH areas from a clinical note are left alone — the document beats memory.
- **Known limitation:** "One side" renders the dot on the illustration's left side regardless of which side it really was — left/right disambiguation (with its mirror-image ambiguity) was deliberately cut from V1.
- **Provenance is deliberately deferred:** Q&A-supplied areas are stored identically to note-parsed ones (visits are all `pending_review` anyway). If provider verification ever lands, revisit whether patient-recalled locations need a source marker.

### Multimodal note
Claude Sonnet 4.5 handles images up to ~5MB. The frontend enforces a 5MB cap and rejects larger files. We don't compress; we reject.

---

## 10. Build sequence (chunks) — historical context

The V1 build was organized into 8 chunks. Status:

| Chunk | Description | Status |
|---|---|---|
| 0 | Infrastructure: Vite + Supabase client + Anthropic SDK install | ✅ Done |
| 1 | Schema + RLS + Tracy's April 24 real data | ✅ Done |
| 2 | Magic link auth + React Router + SPA redirects | ✅ Done (auth later switched to email OTP — see §4 Authentication) |
| 3 | Patient page UI: face diagram, modal, visit card, all sections | ✅ Done |
| 4 | Forms: inline cost editing + add/delete products | ✅ Done |
| 5 | Photos: upload + signed URL grid + lightbox + edit/delete | ✅ Done |
| 6 | AI parsing | ✅ Done (Step 4 shipped as Option A; edit-before-save UI deferred) |
| 7 | Polish: PWA, Add to Home Screen, accessibility | 🟨 Slice 1 done (installable PWA + iOS A2HS); offline SW + a11y pending |
| 8 | Show Roberta: demo prep + recording + the conversation | ⬜ Not started |

### Chunk 6 Step 4 — shipped (Option A, July 6 2026)

The V1 loop is closed: a patient can parse a note/photo and save it as a real visit, verified end-to-end.

**Part B — Save logic (done).** The write is a single atomic Postgres function, `save_parsed_visit(payload jsonb)` (source in `db/save_parsed_visit.sql`), not client-side sequential inserts. It inserts `visits` → `treatments` → `treatment_areas` in one transaction, resolves `patient_id`/`status` server-side via `get_my_patient_id()`, and rolls back entirely on any failure — so partial writes / orphan rows are impossible (this replaced the original "insert-then-cleanup" plan, which wasn't viable: these tables have no DELETE policy). The frontend side is `src/saveVisit.js` (payload shaping) called from `LogVisitPrompt.jsx` ("Save to my record" button + saved-confirmation view), with `onRefetch` threaded from `App.jsx` so the timeline updates.

**Part C — Face dot coordinate mapping (done).** `src/faceCoordinates.js` maps `friendly_name → {x, y}`, seeded from Tracy's 17 April-24 areas plus common AI-phrasing aliases. Unmatched names fall back to `DEFAULT_COORDINATE` (face-center) and log a warning to flag the gap.

**Part A — Edit-before-save UI (deferred, parked polish).** The parsed result is still read-only before save. Making each field inline-editable so the patient can correct AI mistakes pre-commit is the natural next enhancement — not required for the V1 loop. Two known gaps to fold in when Part A is built: `lot_number` is parsed/previewed but not persisted (no column), and a missing `visit_date` currently silently defaults to today.

### Chunk 7 — slice 1 shipped (installable PWA + Add to Home Screen, July 9 2026)

Rinnova is now installable — on iOS it adds to the home screen and opens full-screen (no browser chrome), with a branded icon.

- **App icon:** a white capital **R** in **Fraunces** (opsz 144, wght 600 — the brand display face) on `--gradient-brand`. The glyph is baked into `scripts/icon-source.svg` as a **vector outline** (extracted from the Fraunces variable font with fonttools), so there's no font dependency at build time. `scripts/generate-icons.mjs` renders the PNGs with `sharp` (dev dependency only); the resulting `public/icon-192.png`, `public/icon-512.png`, and `public/apple-touch-icon.png` are committed. To change the icon: edit the source SVG (or re-extract the glyph), then `node scripts/generate-icons.mjs`. The icon is deliberately sized to ~50% so Android's circular maskable crop stays clean.
- **Manifest:** `public/manifest.webmanifest` — `display: standalone`, brand `theme_color`/`background_color` (`#FAF7F2`), 192 + 512 icons (`purpose: "any maskable"`). `netlify.toml` has a header rule serving it as `application/manifest+json` (Netlify defaults to octet-stream, which Chrome ignores).
- **Install tags:** `index.html` has the manifest link, `apple-touch-icon`, and the iOS meta tags (`apple-mobile-web-app-capable`, `-status-bar-style` = default, `-title` = Rinnova).

**Still pending in Chunk 7 (future slices):**
- **Offline / service worker** — iOS A2HS needs no SW, but Android/Chrome's *install prompt* and any offline shell caching do. Deferred (low V1 value — data needs network anyway). When added, the manifest MIME fix above is already in place.
- **Accessibility pass** — modal focus traps (VisitDetailModal, PhotoLightbox), aria labels, keyboard nav, `prefers-reduced-motion`, contrast audit.
- **Apple splash screens** — optional; iOS shows a plain `background_color` splash without device-specific `apple-touch-startup-image` sets.

---

## 11. Future features parking lot

Capture in `Rinnova_Future_Features_Parking_Lot.docx` (in Tracy's `_Rinnova` folder). Current entries:

1. **Loyalty program** — Phase 2+
2. **Product education pages** — V1 alternative: surface existing `summary` field inline (done)
3. **Native mobile app** — V1 alternative: PWA (Chunk 7)
4. **Desktop-optimized layout** — V1 alternative: Level 2 polish (done)
5. **Patient onboarding flow** — ✅ **BUILT** (July 10–11, 2026). A first-run 3-screen carousel, gated on `patients.onboarding_completed` via the `complete_onboarding()` RPC, so the flag follows the account across devices. Fully shipped; see §18. Nothing left parked here.

6. **Magic link as a primary sign-in option (alongside OTP)** — *Phase 2+, likely needs a native wrapper.*
   - **Question:** Should tapping a magic link be a first-class sign-in, including inside the installed iOS PWA?
   - **Why parked / the real tradeoff:** magic links open in Safari, a separate storage context from the standalone PWA, so the session never reaches the app (this is the exact bug that drove the OTP switch). Making a link open the PWA requires **iOS Universal Links**: an `apple-app-site-association` file served from the domain + an Associated Domains entitlement — which in practice needs a real native app wrapper, not just a PWA. Non-trivial platform work.
   - **Open product questions:** Is a link meaningfully better UX than the code for our patients, or just familiar? Do we ever ship a native App Store wrapper (which would make Universal Links natural)? Offer both link + code, or commit to one? Does a link in email reintroduce a phishing/misdirection surface the code avoids?
   - **Earliest build window:** Phase 2, realistically only if/when a native wrapper exists.
   - **V1 alternative (shipped):** 6-digit email OTP code.

7. **Face ID / biometric unlock (WebAuthn passkeys) for PWA re-entry** — *Phase 2 polish.*
   - **Question:** After first sign-in, can returning users unlock with Face ID / Touch ID instead of another email code?
   - **Why it matters:** Supabase sessions persist, but they expire or get cleared; re-entry then means another email round-trip. Biometric unlock via **WebAuthn passkeys** (`navigator.credentials`) would make daily re-entry instant and feel native — a real retention/feel win for Patient 0.
   - **Open product questions:** Passkey as an *unlock gate* over a stored Supabase session, vs. a full passwordless *primary* credential (register at first sign-in, sign in with it thereafter)? Does WebAuthn work reliably in iOS standalone-PWA mode? Fallback when biometrics are unavailable or on a new device (always keep email OTP as recovery). Storage/verify: Supabase has no native passkey primitive yet, so this needs either a custom challenge/verify (Netlify Function + a credentials table storing public keys) or a third-party (Hanko / Passage / Clerk) — which one, and what does it cost in complexity?
   - **Earliest build window:** Phase 2, after multi-patient auth hardening.
   - **V1 alternative:** persisted Supabase session + email OTP on expiry.

When something new comes up that's NOT in V1 scope, add it to the parking lot rather than building it. The standard template includes: the question, decision (in/out and why), open product questions, rough schema/system sketch, earliest plausible build window, V1 alternative.

---

## 12. Conventions and patterns to follow

### Code style
- Plain JavaScript, not TypeScript (V1 choice)
- Functional React components, hooks
- File-per-component
- Comments at the top of each component explaining what it does and its props
- `async/await`, not `.then()`
- Destructure props in function signature

### Naming
- Components: PascalCase (e.g., `VisitCard.jsx`)
- Hooks: camelCase starting with `use` (e.g., `usePatientData`)
- CSS classes: kebab-case (e.g., `visit-card-cost-row`)
- DB columns: snake_case (e.g., `body_regions`, `storage_path`)

### Supabase queries
- Use `.single()` when expecting one row. It will throw if zero or multiple.
- Always destructure `{ data, error }` from Supabase responses and handle error explicitly.
- For nested data, use the foreign-key join syntax: `.select('*, provider:providers(*)')`
- For RLS-protected mutations: ALWAYS look up the patient_id via `.from('patients').select('id').single()` first, then use that for the insert payload's `patient_id` field. Don't trust client-side patient_id.

### File mutation safety
**Critical historical pattern:** Long file rewrites via heredoc (`cat > file << 'EOF'`) have repeatedly truncated or duplicated content in past sessions. When working in Claude Code, prefer direct file editing tools. When generating new content, verify file length and key string counts after writing:

```bash
wc -l <filepath>
grep -c <key-pattern> <filepath>
```

This caught multiple paste-truncation bugs during V1 build.

### Production safety
- Run `npm run build` locally before pushing any significant CSS changes. Vite dev mode tolerates invalid CSS; production minification doesn't. We hit this in Chunk 6 — stray heredoc text in App.css broke production builds while dev worked fine.
- After deploying, verify the live site loads. Don't assume "push succeeded" = "deploy succeeded."
- ALWAYS check `git status` before committing — verify `.env`, `.env.local` are NOT staged. They're in `.gitignore` but mistakes happen.

### Security
- **Never reproduce API keys in conversations.** Anthropic and Supabase secret keys are real secrets. The Supabase **publishable** key is safe to expose (works only alongside RLS). The Supabase **secret** key (`sb_secret_...`) and the **Anthropic key** (`sk-ant-...`) are not.
- If a secret key is accidentally pasted anywhere it shouldn't be, revoke it immediately and create a new one.
- `.env*` files are in `.gitignore`. Never remove them from `.gitignore`.

### Refetch chain
The `usePatientData` hook exposes a `refetch` function. When App.jsx instantiates the hook, it must pass `refetch` down to every component that triggers mutations (PhotosSection, ProductsSection, VisitsTimeline → VisitCard, LogVisitPrompt eventually). Forgetting to pass `onRefetch` causes silent UI-not-updating bugs. This bit us once in Chunk 5.

---

## 13. Locked product decisions

A list of decisions that should NOT be re-litigated without a strong reason:

- **V1 is single-patient.** Just Tracy. No multi-tenant work, no admin UI. Phase 2 is when this changes. (The **first-run onboarding flow is now built** — see §18. It was previously excluded from V1, but was pulled in once Resend cleared the way for real pilot patients.)
- **Phone-first design.** Desktop is centered phone-column. Level 3 responsive is parked.
- **Private storage with signed URLs.** Aesthetic photos are sensitive. Never public bucket, even for V1 convenience.
- **Magenta is the only action color.** Including destructive. Don't introduce red.
- **No emoji in production UI.** SVGs only.
- **Wait-and-show saves**, not optimistic UI.
- **No HIPAA stack for V1.** Tracy is using Rinnova as Patient 0; HIPAA-compliant infra (BAAs, audit logging, encryption-at-rest configs) is required only when a second patient enrolls under Roberta in Phase 1.
- **No Tondo admin tool yet.** Patients log their own visits via the AI parsing flow. Admin tooling can come later if needed.
- **Anthropic Claude Sonnet 4.5 as the AI.** Model string: `claude-sonnet-4-5`. Don't downgrade without a real reason.

### Known V1 blockers (must clear before pilot patients)

- **Custom SMTP (Resend) — ✅ CLEARED (July 10, 2026).** Was the hard blocker: Supabase's built-in email caps at ~2/hour project-wide, which would rate-limit real patients out of sign-in. Now sending via **Resend** (Supabase → Project Settings → Authentication → SMTP Settings; host `smtp.resend.com`, verified sender domain), so OTP delivery works at volume. Verified end-to-end. No known email-delivery blocker remains before the Phase 1 pilot.

### Later / non-blockers (known issues to pick up, not shipping-critical)

These are real and worth doing, but none blocks the Phase 1 pilot. Roughly in priority order:

1. **Chunk 7 remainder.** (a) **Offline / service worker** — needed for Android/Chrome's install prompt and any offline shell caching; iOS A2HS already works without it. The manifest MIME fix is already in place. (b) **Accessibility pass** — modal focus traps (VisitDetailModal, PhotoLightbox), aria labels, keyboard nav, `prefers-reduced-motion`, contrast audit.
2. **Delete `AuthCallback.jsx`.** The `/auth/callback` route is a legacy safety net for magic links already sitting in inboxes (they expire ~1h). Once no old links matter, delete the component, its route in `main.jsx`, and this note.

---

## 14. Anti-patterns and gotchas

### Things that have bitten us during V1 build

1. **Paste truncation in long heredocs.** Files written via `cat > file << 'EOF'` can truncate mid-paste, especially when the editor/terminal interaction is interrupted. Always verify with `wc -l` and key-string `grep -c`.

2. **Stray shell directives in CSS.** A paste accident wrote `cat > src/App.css << 'EOF'` AS content INTO App.css. Vite dev tolerated it; production minify did not. Verify CSS files don't contain `cat`, `EOF`, etc.

3. **Silent RLS failures.** When a `DELETE` or `INSERT` returns no error but no effect, the most common cause is a missing RLS policy. Check `pg_policies` in Supabase first.

4. **Refetch not wired through props.** If a save succeeds in the DB but the UI doesn't update, check that `onRefetch` is being passed all the way down the component tree.

5. **`.env` key drift.** The Supabase publishable key can be rotated in the dashboard. If login fails with 401 against `supabase.co`, the local `.env` and the Netlify env vars may have drifted from the current key. Compare.

6. **Wrong dev server port.** `npm run dev` runs Vite-only at `localhost:5173` (no Netlify Functions). `netlify dev` runs both at `localhost:8888` (Vite + Functions). When testing AI parsing, use `netlify dev` and `localhost:8888`.

7. **PATH issues with Netlify CLI in fresh terminals.** Installed globally via npm into `~/.npm-global/bin`. New terminal tabs opened before `.zshrc` ran won't find `netlify`. Run `source ~/.zshrc` if `netlify: command not found`.

8. **Email OTP: two separate limits, plus a template dependency.** (a) The **built-in email sender** is capped at ~2 emails/hour project-wide — this was the blocker for real testing and onboarding; the fix, custom SMTP via Resend, is now configured (see §13 Known V1 blockers). If sends ever regress, this cap is the first thing to check. (b) Separately, Supabase rate-limits ~4 OTP requests per email address per hour; bump it in Authentication → Rate Limits. (c) The 6-digit code only appears in the email if the "Magic Link" template includes `{{ .Token }}` (see §4 Authentication) — a missing token is a silent "code never arrives" failure.

---

## 15. How to start a session

When picking up Rinnova work from a fresh Claude Code session:

1. Read this entire file first.
2. Check `git status` and `git log --oneline -10` to see current state.
3. Ask Tracy what she wants to work on (don't assume Chunk 6 Step 4 next).
4. Confirm dev environment:
   - `cd ~/Documents/TONDO_LLC/Apps/_Rinnova/Patient_0`
   - `source ~/.zshrc` (in case PATH needs reloading)
   - `netlify dev` (NOT `npm run dev` — we need Functions)
   - Open `http://localhost:8888/`
   - Verify login works (sometimes `.env` drift requires fixing first)

---

## 16. Tracy's working style

- She'll often say "lets keep going" — interpret as "continue at the small focused session cadence we've been using."
- She has strong design instincts. When she pushes back on an aesthetic choice ("the coral feels dull," "the beige strip is too prominent"), trust her and iterate. She's right more often than not.
- She'll sometimes paste an entire long prompt + Terminal output. Read it as context, not as a literal instruction.
- She wants honest framings, not flattery. If a path is wrong, say so. If a scope is too big for one session, say so.
- She prefers small, focused, shippable sessions over marathons.
- She'll ask "is X possible?" — often the right answer is "yes, here's the real tradeoff" rather than just "yes."
- She values commit hygiene. Don't accumulate uncommitted work across sessions.
- She'll usually want to commit, push, and verify production at the end of each session.

---

## 17. What to do at the end of every session

1. Run `git status` and verify only intended files are modified.
2. Confirm `.env` and `.env.local` are NOT in the staged changes.
3. Run `npm run build` if there are CSS changes — production minification is stricter than dev.
4. Commit with a descriptive message: `"Chunk <N> Step <M>: <what>"`.
5. Push to GitHub.
6. Wait for the Netlify deploy and verify it published (not failed).
7. Visit `https://tondo-rinnova.netlify.app` and confirm the site still loads.
8. Update this file (`CLAUDE.md`) if anything material changed in patterns, decisions, or schema.

---

## 18. Onboarding flow (first-run) — shipped July 10, 2026

A 3-screen swipeable carousel shown once, on first authenticated entry, before the main UI. Built from `docs/onboarding-brief.md`.

**Files:** `src/Onboarding.jsx` (component), the `.onboarding*` block at the end of `src/App.css`, the gate + flag helpers at the top of `src/App.jsx`, and `scripts/onboarding-face-icon.svg` (screen-3 icon source, inlined into the component the same way `new-face.svg` is inlined into `FaceDiagram`).

**The gate (DB-backed since July 11, 2026).** `App.jsx` shows the flow when `!patient.onboarding_completed && !onboardingDismissed`. The flag lives on the **patient row**, so it follows the account across devices and survives a PWA reinstall.

Two things about this that are load-bearing:

1. **The gate sits AFTER the `dataLoading` / `dataError` checks, not before.** The flag comes from the patient record, so rendering earlier would flash the carousel at someone who has already completed it, for as long as the fetch takes. If you ever move this check earlier "so it doesn't wait on data," you reintroduce that flash.
2. **The write is best-effort and fails OPEN.** `completeOnboarding()` sets `onboardingDismissed` *first*, then calls the RPC. A failed write therefore can never trap a patient in onboarding — they get into the app, and simply see the flow again next session, which is the correct retry. Don't "fix" this by awaiting the RPC before dismissing.

**Persistence:** the `complete_onboarding()` RPC (`db/add_onboarding_flag.sql`) — a narrow `SECURITY DEFINER` function, because `patients` deliberately has no UPDATE policy. See the note under the `patients` schema (§7) for why that must not change. On success `App.jsx` calls `refetch()` so the in-memory patient record picks up the new value.

**No backfill was run.** The column defaults to `false`, so existing rows (Tracy's) saw onboarding exactly once after the migration — which served as the end-to-end proof that the column, RPC, refetch and gate all work. New patients correctly default to `false` and see it on first entry.

**⚠️ Mobile-Safari viewport trap (this cost three failed attempts — read it).** The dots kept ending up hidden under Safari's bottom toolbar. It was NOT a spacing problem, and adding padding did nothing. `#root` and `.app-shell` both set `min-height: 100vh` — the **large** viewport, i.e. the height with the toolbar *hidden*. Rendering Onboarding inside `.app-shell` forced the document taller than the visible screen, which makes the page scrollable, which keeps Safari's bottom bar expanded over the content. An inner `100svh` can't win against a `100vh` ancestor. The fix, all three parts required:
1. `App.jsx` returns `<Onboarding>` **directly — not wrapped in `.app-shell`.**
2. `.onboarding` is `position: fixed; inset: 0; height: 100svh` — `svh` is the toolbar-*visible* height, so the container's bottom edge is the top of the toolbar. (In the installed PWA there's no toolbar, so `svh` is just the full screen.) **Never use `dvh` here** — the dynamic viewport can be the toolbar-hidden height, which reintroduces the bug.
3. Onboarding locks background scroll on mount (same pattern as `VisitDetailModal`) — a scrollable page is what keeps the toolbar expanded.

**Design notes worth keeping:**
- The eyebrow row (18px), the icon zone (64px), and the headline block (68px) are all **fixed height** on purpose. That's what keeps the icon, headline and description landing on the same vertical plane on every slide, so nothing jumps as you swipe. `.onboarding-desc` also has a `min-height` sized to the *longest* description, so every stack is the same total height. Change any of those to `auto` and the screens will visibly jitter between swipes.
- **The CTA slot (`.onboarding-cta-slot`) is always rendered, even on screens 1–2 where it's empty.** "Get started" only appears on screen 3, and the footer is shared — without the reserved slot the footer grows on arrival at screen 3, shrinking the viewport and jolting the content upward mid-swipe.
- Everything gradient (the Fraunces "R", the line icons, the button) pulls `--gradient-brand`. The SVG icons use a shared inline `<linearGradient id="onboarding-grad">` whose stops are `var(--purple/--magenta/--orange)` — **no hardcoded hex anywhere.**
- Screen 3 uses the **simplified** face icon, not `FaceDiagram`'s artwork: the real face has ears, irises and a neck that turn to mush at this size. The icon is *filled outlines*, so its line weight is baked into the geometry (it measured 1.83px on screen vs 2.80px for the stroked camera/mic). It's stroked in the same gradient at `stroke-width: 1.7` to bring it to 2.80px, so all three icons carry equal weight.
- **Dev-only preview:** `/preview-onboarding` (guarded by `import.meta.env.DEV` in `main.jsx`) renders the flow with no sign-in, so the design can be reviewed without burning OTP codes against Supabase's ~4/hour per-email limit. It is stripped from production builds — verified absent from the bundle.

**Copy:** `docs/onboarding-brief.md` has been kept in sync with the shipped copy, so the brief and `Onboarding.jsx` agree. If you change one, change the other.

**Tokens:** the brief's token table has been corrected to the real vars (it originally listed `--gradient` and `--border`, which don't exist — the real ones are **`--gradient-brand`** and **`--line`**). `src/index.css` remains the source of truth; verify against it rather than trusting any brief.

---

End of file. When in doubt, ask Tracy.
