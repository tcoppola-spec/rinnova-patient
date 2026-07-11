-- add_onboarding_flag.sql
--
-- Moves the first-run onboarding flag from per-device localStorage to a
-- per-patient column, so it follows the account across devices and survives a
-- PWA reinstall.
--
-- Run once, in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------
alter table patients
  add column if not exists onboarding_completed boolean not null default false;


-- ---------------------------------------------------------------------------
-- 2. The write path
--
-- SECURITY DEFINER, deliberately.
--
-- `patients` has NO UPDATE policy, and it must stay that way: a policy broad
-- enough to let a patient set onboarding_completed would also let them rewrite
-- every other column of their own row (email, dob, provider, primary_provider_id
-- ...). Postgres RLS is row-level, not column-level, so there is no way to scope
-- an UPDATE policy to a single column.
--
-- This function is therefore the ONLY write path into patients. It runs as the
-- function owner (bypassing RLS), but it is deliberately narrow:
--   * it takes NO arguments, so there is nothing for a caller to spoof
--   * it resolves the patient server-side via get_my_patient_id()
--   * it sets exactly one column, on exactly one row -- the caller's own
--
-- `set search_path = public` is required on SECURITY DEFINER functions, so a
-- caller can't shadow `patients` or `get_my_patient_id` with their own objects.
-- ---------------------------------------------------------------------------
create or replace function complete_onboarding()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
begin
  v_patient_id := get_my_patient_id();
  if v_patient_id is null then
    raise exception 'No patient record found for the current user';
  end if;

  update patients
  set onboarding_completed = true
  where id = v_patient_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- 3. Only signed-in users may call it.
--
-- An anonymous caller would get a null patient_id and hit the raise above
-- anyway, but don't rely on that -- lock the grant down explicitly.
-- ---------------------------------------------------------------------------
revoke all on function complete_onboarding() from public;
revoke all on function complete_onboarding() from anon;
grant execute on function complete_onboarding() to authenticated;


-- ---------------------------------------------------------------------------
-- 4. NO BACKFILL -- on purpose.
--
-- Existing rows keep the default (false), so Tracy sees onboarding exactly once
-- more. That single run is the end-to-end proof that the column, the RPC, the
-- refetch and the DB-backed gate all work against a real account. After she taps
-- "Get started" the flag is true forever, on every device.
--
-- If you ever DO want to mark everyone as onboarded, it's:
--     update patients set onboarding_completed = true;
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 5. Verify
-- ---------------------------------------------------------------------------
select id, first_name, onboarding_completed from patients;
