-- migrate_face_coordinates.sql
--
-- Moves every existing treatment_areas row from the OLD face diagram's
-- coordinate space (viewBox 200 x 260, axis x=100) to the NEW illustration's
-- space (viewBox 231.2 x 324.1, axis x=114.9).
--
-- Run once, in the Supabase SQL editor. Safe to re-run: the targets are
-- explicit per-row values, not arithmetic, so a second run is a no-op.
--
-- HOW THE TARGETS WERE DERIVED
--   An affine fitted to two landmarks that don't depend on line weight — the
--   iris centres and the mouth centre:
--
--       x' = 114.9 + (x - 100) * 1.6812
--       y' = 1.3093 * y + 4.805
--
--   Out of sample it predicts the brow centre to within 1.0 unit. Then three
--   hand corrections, because the new artwork has ears and a thick outline that
--   the old one did not:
--
--     * "Around the eyes"  -> moved onto the outer canthus (crow's feet). The
--       stored value sat between the iris and the eye corner; harmless on the
--       old cartoon eye, but it reads as "on the pupil" now that the art draws
--       an actual iris.
--     * "Outer cheeks"     -> +7.3 medially. The affine position spilled past
--       the silhouette and clipped the ear.
--     * "Jawline corners"  -> +6.5 medially. The affine position hung off the
--       jaw where it narrows. It still overlaps the jaw line, as it should.
--
--   The nudges are applied per AREA NAME, so the deliberate offset between the
--   Radiesse and Diluted Radiesse dots survives (compare the cheekbone pairs).
--   A name-based re-resolve would have collapsed them onto one point.
--
--   x and y are `integer NOT NULL`, so the targets below are rounded.
--   Keep these values in sync with src/faceCoordinates.js.

-- ---------------------------------------------------------------------------
-- STEP 0 — BACK UP FIRST. Run this and save the output before going further.
-- ---------------------------------------------------------------------------
select json_agg(row_to_json(t) order by t.id)
from (
  select ta.id, ta.friendly_name, tr.name as treatment_name, ta.x, ta.y
  from treatment_areas ta
  join treatments tr on tr.id = ta.treatment_id
) t;


-- ---------------------------------------------------------------------------
-- STEP 1 — MIGRATE
-- ---------------------------------------------------------------------------
begin;

update treatment_areas as ta
set x = v.x, y = v.y
from (values
  -- Xeomin
  ('8ce48454-1abe-4b3c-a554-cbc1478e9e36'::uuid, 115, 100),  -- Between the brows  (100,73)
  ('c11961ab-4705-42d0-bd1d-8a1ddb85ab6c'::uuid, 115,  83),  -- Forehead           (100,60)
  ('f0e3f1cb-6b44-47a7-a397-d6d611db488a'::uuid,  75, 112),  -- Brows              (76,82)
  ('fa4a04f4-2457-456c-a7c7-eaffecfda4d9'::uuid,  47, 149),  -- Around the eyes    (70,110)  [corrected: outer canthus]
  ('edd8eb34-270b-4d9b-a5af-d005718187ba'::uuid, 115, 155),  -- Sides of nose      (100,115)
  ('c06268c8-e9a7-4b33-b13a-b7b1883660dc'::uuid,  88, 225),  -- Corners of mouth   (84,168)
  ('13d26c4c-f916-4d88-8254-c5034f975aab'::uuid, 115, 251),  -- Chin               (100,188)
  ('126fe72e-5301-415b-a05d-326084bae7de'::uuid, 115, 286),  -- Upper neck         (100,215)
  -- Radiesse
  ('93f083f5-6834-4206-b05f-7cadb421ca64'::uuid,  44, 172),  -- Cheekbones         (58,128)
  ('d02ed34d-aa55-452b-8bfd-5b2f386ea2b3'::uuid,  54, 204),  -- Lower cheeks       (64,152)
  ('aa2247df-f89c-4f7d-aba4-cfab69e4694c'::uuid,  35, 191),  -- Outer cheeks       (48,142)  [nudged +7.3]
  ('f5b7ee33-2b67-48b5-a83d-d186a5b96270'::uuid,  58, 234),  -- Jawline corners    (62,175)  [nudged +6.5]
  -- Diluted Radiesse
  ('99916aac-f6f8-4404-a0ef-df74b303cc63'::uuid,  53, 175),  -- Cheekbones         (63,130)
  ('277ed809-8c4d-43ee-a942-8b59288b66f7'::uuid,  63, 206),  -- Lower cheeks       (69,154)
  ('09d579c5-7cd2-44a9-ac46-688f578a036b'::uuid,  43, 193),  -- Outer cheeks       (53,144)  [nudged +7.3]
  ('bf74ca34-56cf-4bd2-bcb9-3811f7364bb1'::uuid,  66, 237),  -- Jawline corners    (67,177)  [nudged +6.5]
  -- RHA2
  ('7a1ce01a-0d25-4e26-afa1-7c23d190d08c'::uuid, 115, 221)   -- Lips               (100,165)
) as v(id, x, y)
where ta.id = v.id;

-- Sanity check: every area must now be inside the new 231.2 x 324.1 viewBox.
do $$
declare bad int;
begin
  select count(*) into bad
  from treatment_areas
  where x < 0 or x > 231 or y < 0 or y > 324;
  if bad > 0 then
    raise exception 'Migration aborted: % row(s) fall outside the new viewBox', bad;
  end if;
end $$;

commit;


-- ---------------------------------------------------------------------------
-- STEP 2 — VERIFY
-- ---------------------------------------------------------------------------
select tr.name as treatment, ta.friendly_name, ta.x, ta.y, ta.mirror
from treatment_areas ta
join treatments tr on tr.id = ta.treatment_id
order by tr.display_order, ta.display_order;


-- ---------------------------------------------------------------------------
-- ROLLBACK — restores the original 200 x 260 coordinates.
-- Only needed if we revert to the old FaceDiagram.
-- ---------------------------------------------------------------------------
-- begin;
-- update treatment_areas as ta
-- set x = v.x, y = v.y
-- from (values
--   ('8ce48454-1abe-4b3c-a554-cbc1478e9e36'::uuid, 100,  73),
--   ('c11961ab-4705-42d0-bd1d-8a1ddb85ab6c'::uuid, 100,  60),
--   ('f0e3f1cb-6b44-47a7-a397-d6d611db488a'::uuid,  76,  82),
--   ('fa4a04f4-2457-456c-a7c7-eaffecfda4d9'::uuid,  70, 110),
--   ('edd8eb34-270b-4d9b-a5af-d005718187ba'::uuid, 100, 115),
--   ('c06268c8-e9a7-4b33-b13a-b7b1883660dc'::uuid,  84, 168),
--   ('13d26c4c-f916-4d88-8254-c5034f975aab'::uuid, 100, 188),
--   ('126fe72e-5301-415b-a05d-326084bae7de'::uuid, 100, 215),
--   ('93f083f5-6834-4206-b05f-7cadb421ca64'::uuid,  58, 128),
--   ('d02ed34d-aa55-452b-8bfd-5b2f386ea2b3'::uuid,  64, 152),
--   ('aa2247df-f89c-4f7d-aba4-cfab69e4694c'::uuid,  48, 142),
--   ('f5b7ee33-2b67-48b5-a83d-d186a5b96270'::uuid,  62, 175),
--   ('99916aac-f6f8-4404-a0ef-df74b303cc63'::uuid,  63, 130),
--   ('277ed809-8c4d-43ee-a942-8b59288b66f7'::uuid,  69, 154),
--   ('09d579c5-7cd2-44a9-ac46-688f578a036b'::uuid,  53, 144),
--   ('bf74ca34-56cf-4bd2-bcb9-3811f7364bb1'::uuid,  67, 177),
--   ('7a1ce01a-0d25-4e26-afa1-7c23d190d08c'::uuid, 100, 165)
-- ) as v(id, x, y)
-- where ta.id = v.id;
-- commit;
