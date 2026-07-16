-- add_visit_products.sql
--
-- The AI parser now separates take-home / retail PRODUCTS (serums, supplements,
-- skincare) from injected TREATMENTS. Previously a retail line item on a receipt
-- (e.g. "PAV Bioadaptive Stress Repair") was silently dropped. This teaches the
-- save RPC to write the parsed `products[]` array into the products list.
--
-- Only save_parsed_visit changes -- one added loop at the end. No schema change:
-- the products table already exists, and products are patient-level (not linked
-- to a visit) for now. `create or replace` swaps the function in place and keeps
-- its grants. Run once, in the Supabase SQL editor.

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
        nullif(a.elem ->> 'x', '')::double precision,
        nullif(a.elem ->> 'y', '')::double precision,
        a.ord::int
      );
    end loop;
  end loop;

  -- NEW: retail / take-home products. Not injected -> no visit/area link; they
  -- land in the patient's products list.
  for a in
    select elem
    from jsonb_array_elements(coalesce(payload -> 'products', '[]'::jsonb)) as x(elem)
  loop
    insert into products (patient_id, name, notes)
    values (
      v_patient_id,
      a.elem ->> 'name',
      nullif(a.elem ->> 'notes', '')
    );
  end loop;

  return v_visit_id;
end;
$$;
