# Booking CTA + patient provider list (design brief)

> Status: **draft, shape signed off by Tracy (Sep 2026).** Not built. Scheduled
> **after Slice 0** (products on the confirm view — see `your-year-brief.md`).
>
> This is the **lightweight** version: providers as patient-owned *contacts*
> (name + number) that power a "Book an appointment" CTA. It is NOT the parked
> provider-accounts / invite-code system in
> `docs/providers-and-invites-brief.md` — no accounts, no logins, no invite
> codes. No dependency on that track.

---

## 1. What it is

Bring back a **"Book an appointment"** button in the hero card, driven by a
patient-managed list of their own providers (name + phone). Plus a **Providers
section** where they add / delete providers. Tapping Book dials the right
provider; if there's none, it invites them to add one.

---

## 2. Book button behavior (never a dead button — locked rule, CLAUDE.md §8)

- **0 providers** → tap opens add-provider capture (name + phone) → save → dial.
  (This **un-hides** the CTA for f&f testers who currently see nothing — good, it
  invites setup.)
- **1 provider with a phone** → button names them: **"Book with Dr. Roberta →"**;
  tap dials directly via `tel:` (works in the native WKWebView shell and mobile
  web).
- **1 provider, no phone on file** → tap prompts "add a number for Dr. Roberta"
  rather than dialing nothing.
- **2+ providers** → tap opens a chooser listing each ("Book with Dr. …"), the
  **primary first**, with "Add new provider" below. Pick → dial.

Copy: name the target when known ("Book with Dr. Roberta →") — more personal, and
the direction CLAUDE.md already set. Generic "Book an appointment" only when the
target isn't yet known (0 or 2+ before choosing).

---

## 3. Where providers get added — BOTH places, one shared write

- **Providers section** = canonical management home (add / delete / set primary).
- **Book flow** = inline add too. Tapping Book with no/other provider is the
  highest-intent moment; forcing a detour to the Providers section and back is
  friction exactly when they want to act. "Add new provider" in the book sheet
  captures name + number right there, saves to the same list, and proceeds to
  dial.

Same write surfaced in two spots — matches the app's inline-create pattern (add
product, manual visit entry).

---

## 4. Data model

New **patient-owned** table, standard RLS:

- `patient_providers` (SELECT / INSERT / UPDATE / **DELETE**, all
  `patient_id = get_my_patient_id()`; the DELETE policy from day one, or delete
  fails silently — §14 trap):
  - `id`, `patient_id`
  - `name` TEXT
  - `phone` TEXT (nullable — a provider can exist without a number)
  - `is_primary` BOOLEAN (default false; at most one true per patient — enforce in
    the setter, e.g. a narrow RPC that clears the others, rather than trusting the
    client)
  - `created_at`, `updated_at`

**Deliberately NOT the existing shared `providers` table** — it's entangled with
`visits.provider_id`, `patients.primary_provider_id`, and the parked entity work.
Bending it toward "a patient's phone contacts" muddies what it means. A clean,
separate, patient-scoped list is lower risk and matches everything else.

**Coexistence / seeding:** the test account already has Roberta on
`patients.provider_name` / `provider_phone`. On first load, if `patient_providers`
is empty and those fields are set, **seed the list from them** (once) so she
appears automatically and never vanishes or doubles up.

---

## 5. Decided defaults (Tracy)

- **Primary provider:** mark one as primary; it's the single-provider default and
  is listed first in the chooser.
- **Button copy:** name the provider when the target is known.

---

## 6. Scope / sequencing

- Self-contained slice: the provider list + the book CTA build **together** (the
  button reads the list). **No dependency on the Maintenance section.**
- **Placement of the Providers section:** near Products for now; tuck it **under
  Maintenance** once that section ships (Tracy's eventual home for it).
- Build **after Slice 0**.

**Later layer (decided-but-unbuilt, CLAUDE.md §8):** the CTA *follows the
insight* — a "your Xeomin is fading" card books with whoever did that Xeomin
(from the visit's `provider_name`). Nice enhancement on top; V1 stays with the
primary-or-chooser model above.

---

## 7. Open questions

1. Delete a provider that's referenced by past visits' `provider_name` — pure
   text copy on visits, so deleting the contact leaves history intact. Confirm
   that's the intended behavior (it is, but worth stating).
2. Do we ever want practice name / address on a contact, or is name + phone
   enough for V1? (Name + phone is enough to dial.)
3. Desktop web: `tel:` is inert on most desktops. Fine for a phone-first app, but
   should the button show the number as fallback text there?

---

End of brief. Build after Slice 0; nothing ships until Tracy signs off.
