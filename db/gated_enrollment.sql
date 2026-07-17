-- gated_enrollment.sql
--
-- Opens Rinnova to friends & family testers, safely. Two problems, one trigger:
--
--   1. GATE. Today anyone who knows the URL can enter an email, get an OTP, and
--      create an account in a database holding real medical history. Enrollment
--      must be closed to all but pre-approved emails -- enforced in the DATABASE,
--      not the browser (a client-side check is bypassable).
--   2. PROVISION. Nothing creates a `patients` row for a new signup, so a new
--      user currently lands in a broken "no patient record" state. Each approved
--      signup must get their OWN empty record (RLS already isolates them from
--      Tracy's data).
--
-- Both happen in handle_new_user(), a SECURITY DEFINER trigger on auth.users.
-- Gate = enrollment only; returning users signing in via OTP never re-trigger
-- it, so this never blocks an existing account (the enrollment-vs-authentication
-- distinction the providers brief calls out).
--
-- Run once, in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- STEP 1 -- THE ALLOWLIST
--
-- RLS on with NO policies => neither `anon` nor `authenticated` can read or
-- write it through the API. It's a list of invited people's emails (PII) and
-- must not leak. The trigger reads it as SECURITY DEFINER; you manage it from
-- the SQL editor (service role bypasses RLS).
-- ---------------------------------------------------------------------------
create table if not exists allowed_emails (
  email    text primary key,
  note     text,                     -- for your own reference: "my sister", etc.
  added_at timestamptz not null default now()
);

alter table allowed_emails enable row level security;

-- Tracy's own email, so nothing about her existing account depends on timing.
-- (She already has a patient row and an auth user, so she never actually hits
-- the trigger again -- this is just belt-and-suspenders.)
insert into allowed_emails (email, note)
values ('tcoppola@tozadigital.com', 'Tracy / Patient 0')
on conflict (email) do nothing;


-- ---------------------------------------------------------------------------
-- STEP 2 -- THE GATE + PROVISION TRIGGER
--
-- Fires when Supabase creates a new auth user (i.e. a first-time signup). If the
-- email isn't allowlisted it raises, which rolls back the auth.users insert --
-- so no account is created and signInWithOtp returns an error. If it is allowed,
-- it creates an empty patient record (no provider, per the f&f decision).
--
-- case-insensitive match: emails are compared lowercased.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from allowed_emails
    where lower(email) = lower(new.email)
  ) then
    raise exception 'Enrollment is not open for this email address.';
  end if;

  -- Provision the tester's own empty record. Guarded so a re-fire can't
  -- duplicate. No provider, no name yet — Greeting and the CTA degrade for that.
  if not exists (select 1 from patients where auth_user_id = new.id) then
    insert into patients (id, auth_user_id, email, onboarding_completed)
    values (gen_random_uuid(), new.id, new.email, false);
  end if;

  return new;
end;
$$;

-- Recreate cleanly in case a prior version exists.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ---------------------------------------------------------------------------
-- STEP 3 -- ADD YOUR TESTERS
--
-- One row per person. Re-run this any time you want to invite someone new.
-- ---------------------------------------------------------------------------
-- insert into allowed_emails (email, note) values
--   ('friend1@example.com', 'my sister'),
--   ('friend2@example.com', 'college roommate')
-- on conflict (email) do nothing;


-- ---------------------------------------------------------------------------
-- STEP 4 -- VERIFY
-- ---------------------------------------------------------------------------
select email, note from allowed_emails order by added_at;

select tgname, tgenabled
from pg_trigger
where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created';
-- expect: on_auth_user_created | O   (O = enabled)
