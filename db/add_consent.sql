-- add_consent.sql
--
-- First-run consent. Before using Rinnova the patient acknowledges that it is a
-- personal record-keeping tool (NOT medical advice), that they are responsible
-- for what they enter, and accepts the Terms + Privacy Policy.
--
-- We RECORD the acceptance -- a timestamp and a version string -- on the patient
-- row, so there is a durable record of who agreed and to which version, not just
-- a client-side flag a reinstall would forget. If the consent text materially
-- changes, bump CONSENT_VERSION in the app and (later) re-prompt on mismatch.
--
-- Same pattern as onboarding_completed (db/add_onboarding_flag.sql): `patients`
-- has NO UPDATE policy on purpose, so the ONLY write path is this narrow
-- SECURITY DEFINER RPC, which sets exactly these two columns on the caller's own
-- row (resolved server-side via get_my_patient_id()). Run once in the SQL editor.

alter table patients
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists consent_version     text;

create or replace function accept_consent(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update patients
     set consent_accepted_at = now(),
         consent_version      = p_version
   where id = get_my_patient_id();
end;
$$;

-- Signed-in users only, and it can only ever write the caller's OWN row
-- (get_my_patient_id resolves from auth.uid()).
revoke all on function accept_consent(text) from public, anon;
grant execute on function accept_consent(text) to authenticated;

-- Verify
select column_name from information_schema.columns
where table_name = 'patients' and column_name like 'consent%';
