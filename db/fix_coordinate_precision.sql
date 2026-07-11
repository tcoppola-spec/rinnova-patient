-- fix_coordinate_precision.sql
--
-- BUG: saving an AI-parsed visit failed with
--        invalid input syntax for type integer: "114.9"
--
-- The face coordinate space became fractional when the new illustration landed
-- (the axis of symmetry is x = 114.9, and most seeds in src/faceCoordinates.js
-- carry one decimal place). But TWO things still assumed integers:
--
--   1. treatment_areas.x / .y were `integer`
--   2. save_parsed_visit() cast the incoming text with ::int
--
-- The ::int cast is what threw: Postgres will not cast the text '114.9' to int,
-- it errors. Note that fixing ONLY the cast would be worse than the crash --
-- with the column still `integer`, a numeric cast would SILENTLY ROUND on
-- insert and drift every dot by up to half a unit, with no error at all. Both
-- have to move together, which is why they're in one migration.
--
-- Why double precision (not numeric): these are SVG geometry coordinates, not
-- money. float8 is the natural type, it is unambiguously serialised as a JSON
-- number by PostgREST, and FaceDiagram feeds x/y straight into SVG cx/cy.
--
-- Run once, in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- STEP 0 -- FINGERPRINT THE EXISTING DOTS FIRST.
--
-- Tracy's April 24 rows carry deliberately hand-offset coordinates from Chunk 1
-- (the Radiesse / Diluted Radiesse pairs). Widening integer -> double precision
-- is value-preserving (115 stays exactly 115), so this hash MUST be identical
-- after the migration. Run this now and keep the result.
-- ---------------------------------------------------------------------------
select
  count(*) as area_count,
  md5(string_agg(x::text || ',' || y::text, '|' order by id)) as coord_fingerprint
from treatment_areas;


-- ---------------------------------------------------------------------------
-- STEP 1 -- WIDEN THE COLUMNS
--
-- integer -> double precision is a widening conversion: every existing value is
-- preserved exactly (115 -> 115). Nothing is rounded, nothing moves.
-- NOT NULL is retained.
-- ---------------------------------------------------------------------------
alter table treatment_areas
  alter column x type double precision,
  alter column y type double precision;


-- ---------------------------------------------------------------------------
-- STEP 2 -- REPLACE THE RPC SO ITS CASTS MATCH THE NEW COLUMN TYPES
--
-- Identical to db/save_parsed_visit.sql except the x/y casts. Everything else
-- (atomicity, server-side patient_id/status, SECURITY INVOKER) is unchanged.
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
        -- the fix: fractional coordinates, matching the widened columns
        (a.elem ->> 'x')::double precision,
        (a.elem ->> 'y')::double precision,
        a.ord::int
      );
    end loop;
  end loop;

  return v_visit_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- STEP 3 -- VERIFY THE DOTS DID NOT MOVE
--
-- Re-run the fingerprint. area_count and coord_fingerprint must BOTH be
-- identical to Step 0. If they are, every existing dot -- including the
-- hand-offset Radiesse / Diluted Radiesse pairs -- is exactly where it was.
-- ---------------------------------------------------------------------------
select
  count(*) as area_count,
  md5(string_agg(x::text || ',' || y::text, '|' order by id)) as coord_fingerprint
from treatment_areas;

-- And confirm the column types actually changed:
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'treatment_areas'
  and column_name in ('x', 'y');
-- expect: double precision, double precision
