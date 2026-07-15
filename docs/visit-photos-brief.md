# Rinnova — Visit Photos Brief

**For:** Claude Code
**Status:** Design brief. Confirm the schema and the delete behavior with me before running migrations.

## The idea

Photos can optionally belong to a visit. There is **one photo library**, not two — a photo attached to a visit also appears in the archive, badged, so the patient can see the relationship.

The archive stays as it is: a place to upload photos that aren't tied to anything (progress shots, selfies, whatever). Attaching to a visit is an *addition*, not a separate system.

---

## Schema

**Nullable `visit_id` on the photo record** — a FK → `visits.id`, null for unattached archive photos.

Explicitly **not** a `photo_id` on the visit. The relationship is one-to-many: **a visit can have several photos** (before/after, multiple angles), and a photo belongs to at most one visit. Putting the FK on the photo gives us multi-photo for free; putting it on the visit would cap us at one and force a migration later.

## Behavior

**Upload into a visit.** From a visit's detail view, a patient can add one or more photos. They land in that visit *and* in the archive.

**Attach an existing archive photo to a visit, after the fact.** People upload first and organize later. If the only path is "upload into a visit," anyone who already dumped photos into the archive can never connect them. Support both directions.

**Detach.** If a patient can attach, they need to be able to un-attach — sets `visit_id` back to null; the photo stays in the archive.

**Badge in the archive.** Any photo with a `visit_id` shows a badge. The badge should name the visit (e.g. "April 14, 2026"), not just say "linked" — and ideally tap through to that visit. Knowing *which* visit is the useful part.

**Multi-photo display in the visit.** A visit renders all photos pointing at it. Design for more than one from the start.

---

## Delete behavior — decide this deliberately

Visit delete is currently a **hard delete with cascade** (treatments and `treatment_areas` go with it).

**Photos must NOT cascade.** My strong recommendation: on visit delete, set the photos' `visit_id` to null so they stay in the archive and simply lose their badge.

The reasoning: a mis-parsed visit is cheap to lose and easy to re-add. **A photo of the patient's own face from a year ago is the single least recoverable thing in the app.** Someone clearing a bad test save should not silently destroy their before/after photos. The blast radius of a delete should never include the irreplaceable thing.

Implement this explicitly — do not let the existing `ON DELETE CASCADE` pattern get applied to photos by default or by analogy.

## Security

Same posture as the rest of the app. A patient can only attach a photo to **their own** visit, and only see their own photos. If a plain RLS policy can't express "this photo and this visit both belong to the caller," use a narrow `SECURITY DEFINER` RPC — same pattern as `save_parsed_visit`, `complete_onboarding`, and the visit delete.

Watch for the **silent-RLS trap** documented in CLAUDE.md §14: an update with no matching policy returns success with zero rows affected. Check the returned rows, not just the absence of an error, so a failed attach tells the patient the truth instead of pretending it worked.

---

## Acceptance criteria

- [ ] A visit can hold multiple photos.
- [ ] Photos uploaded to a visit also appear in the archive, badged.
- [ ] An existing archive photo can be attached to a visit after the fact.
- [ ] A photo can be detached; it remains in the archive.
- [ ] The badge identifies *which* visit and ideally links to it.
- [ ] **Deleting a visit does not delete its photos** — they persist in the archive, unbadged.
- [ ] A patient cannot attach a photo to, or view photos of, another patient's visit.
- [ ] A failed attach surfaces an error rather than a false success.
