-- add_plan_items.sql
--
-- The "Maintenance" yearly plan: a patient-owned, editable rough draft of what
-- they expect to have done in a calendar year (treatments + products), with an
-- estimated per-occurrence cost. Progress ("1 of 4 done") is COMPUTED from
-- logged visits at read time — never stored here. See docs/your-year-brief.md.
--
-- Descriptive, not prescriptive: this is the patient's own plan, seeded from
-- their history and freely edited — Rinnova never tells them what they "need".
--
-- Run once in the Supabase SQL editor.

create table if not exists plan_items (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references patients(id) on delete cascade,
  plan_year      int not null,                       -- calendar year (Jan–Dec)
  kind           text not null default 'treatment',  -- 'treatment' | 'product'
  category       text,        -- a color_key for treatments; null for products
  title          text not null,
  planned_count  int not null default 1,
  est_cost       numeric,     -- estimate PER occurrence; nullable
  notes          text,        -- directions for products ("2x daily, 6 months")
  source         text not null default 'manual',     -- 'manual' | 'projection'
  display_order  int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint plan_items_kind_chk check (kind in ('treatment', 'product'))
);

create index if not exists plan_items_patient_year_idx
  on plan_items (patient_id, plan_year);

alter table plan_items enable row level security;

-- Standard per-patient RLS. DELETE from day one — editing removes rows, and a
-- missing DELETE policy fails silently (CLAUDE.md §14).
drop policy if exists "plan_items_select" on plan_items;
create policy "plan_items_select" on plan_items
  for select using (patient_id = get_my_patient_id());

drop policy if exists "plan_items_insert" on plan_items;
create policy "plan_items_insert" on plan_items
  for insert with check (patient_id = get_my_patient_id());

drop policy if exists "plan_items_update" on plan_items;
create policy "plan_items_update" on plan_items
  for update using (patient_id = get_my_patient_id())
  with check (patient_id = get_my_patient_id());

drop policy if exists "plan_items_delete" on plan_items;
create policy "plan_items_delete" on plan_items
  for delete using (patient_id = get_my_patient_id());
