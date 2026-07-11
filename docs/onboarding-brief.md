# Rinnova — First-Run Onboarding Brief

**For:** Claude Code
**Goal:** Add a 3-screen first-run onboarding flow that explains, in plain language, what Rinnova is and how a new patient adds a visit (photo of a note/receipt **or** just telling Rinnova what they had done). Shows once, then never again.

---

## Behavior & placement

- **First-run only.** Show on first authenticated entry, before the main app UI.
- **Gate on a completion flag.** Preferred: a boolean on the patient's profile row (`onboarding_completed`) so it follows the account across devices. Acceptable fallback for V1: a local flag in the PWA. Set the flag on **either** "Get started" (screen 3) **or** "Skip."
- **Do not re-show** after completion or skip.

## Pattern

- Horizontal **swipeable carousel**, 3 screens.
- **Dot indicator** at the bottom (active dot is a wider pill).
- **"Skip"** link, top-right, on screens 1–2.
- Screen 3's primary action is the **"Get started"** button (also advances/dismisses).
- Swipe on touch; also fine to advance on button/tap. Keep it simple.

## Tech notes

- React, consistent with the existing app (same stack as `FaceDiagram.jsx` / `Login.jsx`).
- **Reuse the existing design tokens** already defined in the app's CSS (`--gradient`, `--cream`, `--ink`, `--body`, `--muted`, `--border`, `--f-display`, `--f-body`). Do **not** hardcode new hex values — the ones below are provided only so you can verify you're pulling the right tokens.

---

## Design tokens (verify against existing CSS vars)

| Purpose | Value | Existing var |
|---|---|---|
| Brand gradient (R mark, icons, button) | `linear-gradient(135deg, #7B2CBF 0%, #D63384 50%, #FF8C42 100%)` | `--gradient` |
| Card background | `#FAF7F2` | `--cream` |
| Card border | `#E8E0D5` | `--border` |
| Headline text | `#17172E` | `--ink` |
| Description text | `#3A3A55` | `--body` |
| Eyebrow / muted | `#8A8AA3` | `--muted` |
| Display font (headlines, R mark) | Fraunces | `--f-display` |
| Body font (eyebrow, description, button) | Inter Tight | `--f-body` |

## Layout (per screen)

Centered vertical stack, `text-align: center`, `align-items: center`:

1. **Eyebrow** — 11px, uppercase, letter-spacing ~0.08em, muted. Fixed-height row.
2. **Icon zone** — fixed **52px** height, centered. Gradient-filled (see icons below).
3. **Headline** — Fraunces, ~22px, line-height ~1.22, ink. **Locked to a fixed 56px block** so all three descriptions start on the same plane regardless of copy. Text top-aligns within the block. Two lines each.
4. **Description** — Inter Tight, 13px, line-height ~1.55, body color, `max-width: ~196px`. Three lines each.
5. **Footer** — pushed to bottom (`margin-top: auto`): dots (all screens); on screen 3, the "Get started" button sits above the dots.

**Icons** are gradient-filled via `background-clip: text` on the glyph (same technique for the Fraunces "R" and the line icons), so they read as one family:
- Screen 1: Fraunces **"R"** (~42px), gradient fill. This is the welcome mark — match the app icon / home-screen R.
- Screen 2: **camera** + a small muted "or" + **microphone** (outline line icons, ~34px), gradient fill.
- Screen 3: **face** outline (~38px), gradient fill. *Placeholder currently `ti-face-id` — swap for the real face glyph that matches `FaceDiagram` if one exists.*

---

## Content (final copy)

Headline line breaks are intentional (shown with `/`). Keep them or let them flow — designer's call, but the two-line rhythm is deliberate.

| # | Eyebrow | Icon | Headline | Description |
|---|---|---|---|---|
| 1 | Welcome | Gradient "R" (Fraunces) | Your aesthetic history, / all in one place | A private record of every treatment you've had — what, where, and when — kept just for you. |
| 2 | Adding a visit | camera + mic | Snap a photo, / or just say it | Photograph your visit note or receipt, or simply tell Rinnova what you had done — it fills in the details. |
| 3 | Your map | face outline | See it mapped / onto your face | Every treatment lands on your face map with its date, building a visual timeline you can watch grow. |

Screen 3 button label: **Get started**

---

## Accessibility

- Each screen is a labeled slide; dots are buttons with `aria-label` ("Go to screen 2 of 3") and reflect current position.
- "Skip" and "Get started" are real buttons, keyboard-focusable.
- Decorative icons `aria-hidden`; the meaning lives in the headline/description text.
- Gradient-on-text must keep sufficient contrast — headlines/descriptions are solid ink/body color, not gradient, so only the icons and R mark use gradient fill.

## Acceptance criteria

- [ ] Shows on first authenticated entry; never again after "Get started" or "Skip."
- [ ] Flag persists (profile column preferred).
- [ ] 3 centered screens, brand gradient on R + icons + button, cream cards.
- [ ] Fraunces headlines / Inter Tight body, pulled from existing tokens.
- [ ] All three descriptions start on the same vertical plane (fixed 56px headline block).
- [ ] Swipe + dots + Skip + Get started all work; dots reflect position.
- [ ] Real face glyph swapped in for the screen-3 placeholder (or ticket logged if deferred).

---

*Design reference (colors/type/layout) was finalized in the Rinnova product chat; this brief is the source of truth for copy and tokens.*
