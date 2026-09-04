-- add_patient_providers.sql
--
-- A patient-owned list of their providers as simple CONTACTS (name + phone),
-- powering the hero "Book an appointment" CTA and a Providers section. This is
-- the LIGHTWEIGHT version — NOT the parked provider-accounts / invite-code
-- system in docs/providers-and-invites-brief.md. No accounts, no logins.
--
-- Deliberately a SEPARATE table from `providers`: that one is entangled with
-- visits.provider_id and patients.primary_provider_id, so bending it toward
-- "a patient's phone contacts" would muddy what it means. See
-- docs/booking-providers-brief.md.
--
-- Run this once in the Supabase SQL editor.

create table if not exists patient_providers (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id) on delete cascade,
  name        text not null,
  phone       text,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists patient_providers_patient_idx
  on patient_providers (patient_id);

-- At most ONE primary provider per patient, guaranteed by the database. The
-- helper clears existing primaries before setting a new one; this index makes a
-- double-primary impossible even from raw SQL or a future admin tool.
create unique index if not exists patient_providers_one_primary
  on patient_providers (patient_id)
  where is_primary;

alter table patient_providers enable row level security;

-- Standard per-patient RLS. DELETE included FROM DAY ONE — a missing DELETE
-- policy fails silently (returns success, deletes nothing; CLAUDE.md §14), and
-- the delete helper checks returned rows so it would surface as a real error.
drop policy if exists "patient_providers_select" on patient_providers;
create policy "patient_providers_select" on patient_providers
  for select using (patient_id = get_my_patient_id());

drop policy if exists "patient_providers_insert" on patient_providers;
create policy "patient_providers_insert" on patient_providers
  for insert with check (patient_id = get_my_patient_id());

drop policy if exists "patient_providers_update" on patient_providers;
create policy "patient_providers_update" on patient_providers
  for update using (patient_id = get_my_patient_id())
  with check (patient_id = get_my_patient_id());

drop policy if exists "patient_providers_delete" on patient_providers;
create policy "patient_providers_delete" on patient_providers
  for delete using (patient_id = get_my_patient_id());

-- One-time backfill: seed each existing patient's current provider (from the
-- joined providers row, else the denormalized patients.provider_* fields) as
-- their primary, so nobody's provider vanishes when the CTA switches to this
-- list. Runs as admin in the SQL editor, so it bypasses RLS. Idempotent: skips
-- any patient who already has a row here.
insert into patient_providers (patient_id, name, phone, is_primary)
select p.id,
       coalesce(pr.name, p.provider_name),
       coalesce(pr.phone, p.provider_phone),
       true
from patients p
left join providers pr on pr.id = p.primary_provider_id
where coalesce(pr.name, p.provider_name) is not null
  and not exists (
    select 1 from patient_providers pp where pp.patient_id = p.id
  );
