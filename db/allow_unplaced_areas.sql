-- allow_unplaced_areas.sql
--
-- BUG (April 14 Belotero visit): a bilateral "Tear trough (undereyes)" rendered
-- as a SINGLE dot on the bridge of the nose.
--
-- ROOT CAUSE -- one cause, both symptoms:
--   "tear trough" was missing from src/faceCoordinates.js, so the lookup missed
--   and saveVisit fell back to DEFAULT_COORDINATE = (114.9, 175). But 114.9 is
--   MIRROR_AXIS -- the FIXED POINT of the mirror (229.8 - 114.9 = 114.9). So:
--     * position  -> the dot is midline, because the fallback is midline
--     * laterality-> mirror=true DID store, and DID draw two dots. They landed
--                    on the same pixel and stacked. (Confirmed in the DB:
--                    x=114.9, y=175, mirror=true.)
--
-- THE PRODUCT RULE (Tracy): an injection always has a location. If we can't plot
-- it, that's a gap in our lookup -- not a licence to invent a coordinate. A
-- plausible dot in the wrong place silently falsifies a medical record, which is
-- worse than no dot at all.
--
-- So "we don't know" must be representable: x/y become NULLABLE. There is no
-- fallback coordinate any more. Unplaceable regions save with NULL, draw no dot,
-- and the patient is told which ones. (This also gives us non-injectables for
-- free -- a laser or peel has no discrete point.)
--
-- Run once, in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- STEP 0 -- FINGERPRINT. Existing dots must not move. Keep this result.
-- ---------------------------------------------------------------------------
select
  count(*) as area_count,
  count(*) filter (where x is not null) as placed,
  md5(string_agg(coalesce(x::text,'~') || ',' || coalesce(y::text,'~'), '|' order by id)) as coord_fingerprint
from treatment_areas;


-- ---------------------------------------------------------------------------
-- STEP 1 -- ALLOW "UNPLACED"
--
-- Dropping NOT NULL does not touch a single existing value. Every current row
-- has coordinates and keeps them.
-- ---------------------------------------------------------------------------
alter table treatment_areas
  alter column x drop not null,
  alter column y drop not null;


-- ---------------------------------------------------------------------------
-- STEP 2 -- RPC: pass NULL coordinates through instead of erroring
--
-- Only the two x/y lines change. `a.elem ->> 'x'` yields SQL NULL when the JSON
-- value is null, and NULL::double precision is NULL -- so this already does the
-- right thing. The explicit nullif() guards the '' case.
-- ---------------------------------------------------------------------------
create or replace function save_parsed_visit(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_patient_id   uuid;
  v_visit_id     uuid;
  v_treatment_id uuid;
  t record;
  a record;
begin
  v_patient_id := get_my_patient_id();
  if v_patient_id is null then
    raise exception 'No patient record found for the current user';
  end if;

  insert into visits (
    patient_id, visit_date, provider_name, body_regions, cost,
    status, ai_parsed_at
  )
  values (
    v_patient_id,
    (payload -> 'visit' ->> 'visit_date')::date,
    payload -> 'visit' ->> 'provider_name',
    payload -> 'visit' ->> 'body_regions',
    nullif(payload -> 'visit' ->> 'cost', '')::numeric,
    'pending_review',
    now()
  )
  returning id into v_visit_id;

  for t in
    select elem, ord
    from jsonb_array_elements(coalesce(payload -> 'treatments', '[]'::jsonb))
         with ordinality as x(elem, ord)
  loop
    insert into treatments (
      visit_id, name, summary, total_dose, color_key, display_order
    )
    values (
      v_visit_id,
      t.elem ->> 'name',
      t.elem ->> 'summary',
      t.elem ->> 'total_dose',
      coalesce(nullif(t.elem ->> 'color_key', ''), 'xeomin'),
      t.ord::int
    )
    returning id into v_treatment_id;

    for a in
      select elem, ord
      from jsonb_array_elements(coalesce(t.elem -> 'areas', '[]'::jsonb))
           with ordinality as y(elem, ord)
    loop
      insert into treatment_areas (
        treatment_id, friendly_name, clinical_name, dose, mirror,
        x, y, display_order
      )
      values (
        v_treatment_id,
        a.elem ->> 'friendly_name',
        a.elem ->> 'clinical_name',
        nullif(a.elem ->> 'dose', ''),
        coalesce((a.elem ->> 'mirror')::boolean, false),
        -- fractional AND nullable: NULL means "we could not place this region",
        -- which is a real answer. Never invent a coordinate for an injection.
        nullif(a.elem ->> 'x', '')::double precision,
        nullif(a.elem ->> 'y', '')::double precision,
        a.ord::int
      );
    end loop;
  end loop;

  return v_visit_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- STEP 3 -- REPAIR THE ONE BAD ROW (the April 14 tear trough)
--
-- It is currently at the face-centre fallback (114.9, 175). The correct tear
-- trough, measured against the artwork (lower lid y=159.5, iris centre x=74.6,
-- inner canthus x=96.4), is (84, 168) -- and being off-axis it now mirrors to
-- (145.8, 168), giving the TWO dots the note actually describes.
--
-- Scoped by id so it can only ever touch this one row. Look before you leap:
-- ---------------------------------------------------------------------------
select ta.id, ta.friendly_name, ta.x, ta.y, ta.mirror, tr.name as treatment
from treatment_areas ta
join treatments tr on tr.id = ta.treatment_id
join visits v on v.id = tr.visit_id
where v.visit_date = '2026-04-14'
  and ta.x = 114.9 and ta.y = 175;
-- ^ confirm this returns exactly the tear trough row, then run the update:

update treatment_areas ta
set x = 84, y = 168
from treatments tr, visits v
where ta.treatment_id = tr.id
  and tr.visit_id = v.id
  and v.visit_date = '2026-04-14'
  and ta.x = 114.9
  and ta.y = 175;
-- expect: UPDATE 1


-- ---------------------------------------------------------------------------
-- STEP 4 -- VERIFY
--
-- The April 24 rows must be untouched. Compare `placed` and the April-24 subset
-- against Step 0 -- the only row whose coordinates changed is the tear trough.
-- ---------------------------------------------------------------------------
select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'treatment_areas'
  and column_name in ('x', 'y');
-- expect: x / YES / double precision, y / YES / double precision

select v.visit_date, tr.name as treatment, ta.friendly_name, ta.x, ta.y, ta.mirror
from treatment_areas ta
join treatments tr on tr.id = ta.treatment_id
join visits v on v.id = tr.visit_id
order by v.visit_date, tr.display_order, ta.display_order;

-- Fingerprint of the April 24 visit ONLY -- must match what it was before.
select md5(string_agg(ta.x::text || ',' || ta.y::text, '|' order by ta.id)) as april24_fingerprint
from treatment_areas ta
join treatments tr on tr.id = ta.treatment_id
join visits v on v.id = tr.visit_id
where v.visit_date = '2026-04-24';
