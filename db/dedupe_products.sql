-- dedupe_products.sql
--
-- Products could be filed twice. Two write paths (the Products section's add
-- form, and save_parsed_visit filing retail line items off a receipt) and
-- neither checked for an existing row, so re-parsing the same receipt — which
-- happens whenever a visit is deleted and re-uploaded — added the same serum
-- again every time.
--
-- The products list answers "what am I using?", not "what have I ever bought?".
-- One row per product is the right shape; buying the same serum twice is not a
-- second product. (If purchase history is ever wanted, that is a different
-- table with a date on each row, not repeated rows here.)
--
-- Enforced with a UNIQUE INDEX rather than app-side checks, for the same reason
-- photos.visit_id uses ON DELETE SET NULL in the FK: a rule the database holds
-- cannot be bypassed by a new code path, a future admin tool, or raw SQL.
--
-- Matching is case- and whitespace-insensitive, because "Skinbetter AlphaRet"
-- and "skinbetter alpharet " are the same tube.
--
-- ⚠️ STEP 2 DELETES ROWS. Run STEP 1 first and read what it lists.
--    Run the steps in order, in the Supabase SQL editor.


-- ── STEP 1 — PREVIEW (read-only). What would be merged away? ────────────────
-- Each row is a duplicate that STEP 2 will delete. `keeps` is the row that
-- survives. Nothing is removed by running this.

select
  p.id            as will_delete_id,
  p.name          as will_delete_name,
  p.added_at      as will_delete_added_at,
  k.id            as keeps_id,
  k.name          as keeps_name
from products p
join lateral (
  select p2.id, p2.name
  from products p2
  where p2.patient_id = p.patient_id
    and lower(btrim(p2.name)) = lower(btrim(p.name))
  order by p2.added_at asc nulls last, p2.id asc
  limit 1
) k on true
where p.id <> k.id
order by p.name, p.added_at;


-- ── STEP 2 — MERGE AND DELETE ──────────────────────────────────────────────
-- Keeps the EARLIEST row per product (its added_at is the honest "since when"),
-- but first rescues notes: if the survivor has none and a duplicate does, the
-- note moves across, so nothing the patient typed is lost.

update products keep
set notes = src.notes
from (
  select distinct on (lower(btrim(name)), patient_id)
         patient_id, lower(btrim(name)) as key, notes
  from products
  where notes is not null and btrim(notes) <> ''
  order by lower(btrim(name)), patient_id, added_at asc nulls last, id asc
) src
where keep.patient_id = src.patient_id
  and lower(btrim(keep.name)) = src.key
  and (keep.notes is null or btrim(keep.notes) = '');

delete from products p
using products k
where p.patient_id = k.patient_id
  and lower(btrim(p.name)) = lower(btrim(k.name))
  and p.id <> k.id
  and (k.added_at, k.id) < (p.added_at, p.id);


-- ── STEP 3 — THE GUARANTEE ─────────────────────────────────────────────────
-- Fails if STEP 2 missed anything, which is the point: it will not create an
-- index over duplicate data, so a clean creation IS the proof there are none.

create unique index if not exists products_patient_name_uniq
  on products (patient_id, lower(btrim(name)));


-- ── STEP 4 — TEACH THE SAVE RPC TO SKIP EXISTING ───────────────────────────
-- Without this, re-parsing a receipt now raises a unique violation and rolls
-- back the WHOLE visit save. `on conflict do nothing` makes the product filing
-- idempotent: the visit still saves, existing products are left exactly as they
-- are (an old note is never overwritten by a re-parse), new ones are added.
--
-- Only the products loop changes. Everything above it is byte-identical to
-- db/save_parsed_visit.sql — keep the two in step if you edit either.

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


-- ── STEP 5 — VERIFY (read-only). Expect zero rows. ─────────────────────────

select patient_id, lower(btrim(name)) as name, count(*)
from products
group by 1, 2
having count(*) > 1;
