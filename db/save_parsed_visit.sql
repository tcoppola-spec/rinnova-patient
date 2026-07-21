-- save_parsed_visit(payload jsonb) -> uuid
--
-- Atomically writes an AI-parsed visit across three tables (visits ->
-- treatments -> treatment_areas). Because it all runs inside one function
-- call, it commits together or rolls back together — a visit can never be
-- left half-written. Called from the browser via supabase.rpc().
--
-- SECURITY INVOKER (the default): the function runs as the logged-in user, so
-- Row-Level Security still applies and patient_id is resolved server-side via
-- get_my_patient_id() — the client can't spoof whose record it writes to.
--
-- Expected payload shape:
--   {
--     "visit": { "visit_date", "provider_name", "body_regions", "cost" },
--     "treatments": [
--       { "name", "summary", "total_dose", "color_key",
--         "areas": [ { "friendly_name", "clinical_name", "dose",
--                      "mirror", "x", "y" } ] }
--     ]
--   }
--
-- Returns the new visit's id.
--
-- Product filing is idempotent (ON CONFLICT DO NOTHING against the unique
-- index from db/dedupe_products.sql), so re-parsing the same receipt cannot
-- duplicate the patient's products list.

create or replace function save_parsed_visit(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_patient_id  uuid;
  v_visit_id    uuid;
  v_treatment_id uuid;
  t record;
  a record;
begin
  v_patient_id := get_my_patient_id();
  if v_patient_id is null then
    raise exception 'No patient record found for the current user';
  end if;

  -- 1) The visit. status/ai_parsed_at are set here, not trusted from the client.
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

  -- 2) Each treatment, in payload order (display_order = position).
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

    -- 3) That treatment's areas, in order. x/y come pre-resolved from the client.
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
        -- double precision AND nullable. Fractional because the axis of symmetry
        -- is x=114.9 (int cast of '114.9' errors, and an int column would
        -- SILENTLY ROUND). NULL because an injection we can't place gets no dot
        -- rather than an invented one. See db/fix_coordinate_precision.sql and
        -- db/allow_unplaced_areas.sql.
        nullif(a.elem ->> 'x', '')::double precision,
        nullif(a.elem ->> 'y', '')::double precision,
        a.ord::int
      );
    end loop;
  end loop;

  -- Retail / take-home products (serums, supplements). Not injected, so they
  -- have no visit/area link — they go to the patient's products list.
  --
  -- ON CONFLICT DO NOTHING makes this idempotent. Re-parsing the same receipt
  -- (which happens whenever a visit is deleted and re-uploaded) used to file
  -- every product again; now the visit still saves, existing products are left
  -- exactly as they are — a re-parse never overwrites a note the patient
  -- wrote — and only genuinely new products are added. Without it the unique
  -- index would raise and roll back the ENTIRE visit save.
  --
  -- Blank names are skipped: a nameless product isn't a product, and NULL name
  -- would slip past the unique index (NULLs don't collide in Postgres).
  for a in
    select elem
    from jsonb_array_elements(coalesce(payload -> 'products', '[]'::jsonb)) as x(elem)
  loop
    if nullif(btrim(coalesce(a.elem ->> 'name', '')), '') is not null then
      insert into products (patient_id, name, notes)
      values (
        v_patient_id,
        btrim(a.elem ->> 'name'),
        nullif(btrim(coalesce(a.elem ->> 'notes', '')), '')
      )
      on conflict (patient_id, lower(btrim(name))) do nothing;
    end if;
  end loop;

  return v_visit_id;
end;
$$;
