-- access_codes.sql
--
-- Adds a SHARED invite-code path to enrollment, alongside the per-email
-- allowlist (db/gated_enrollment.sql). Motivation: for the friends & family
-- pilot Tracy hands out a link + one shared code; anyone with both may create
-- their own record. She should NOT have to add each tester's email by hand.
-- The gate stays server-side, in the same handle_new_user() trigger.
--
-- A signup is now allowed if EITHER:
--   * the email is on allowed_emails (unchanged), OR
--   * the request carried a valid, active access code.
--
-- The code rides in on signInWithOtp({ options: { data: { access_code } } }),
-- which Supabase writes into auth.users.raw_user_meta_data at user creation --
-- readable by this AFTER INSERT trigger. As before, a rejected signup raises,
-- which rolls back the auth.users insert; Login maps that to neutral
-- invite-only copy that never reveals which of email/code was wrong.
--
-- Run once, in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- STEP 1 -- THE CODES TABLE
--
-- RLS on, no policies => unreadable/unwritable through the API (anon or
-- authenticated). The trigger reads it as SECURITY DEFINER; you manage codes
-- from the SQL editor (the service role bypasses RLS). `active` lets you retire
-- a code without deleting it: turning it off stops NEW signups on that code and
-- never touches accounts already created (enrollment != authentication).
-- ---------------------------------------------------------------------------
create table if not exists access_codes (
  code     text primary key,
  note     text,
  active   boolean not null default true,
  added_at timestamptz not null default now()
);

alter table access_codes enable row level security;

-- The pilot code. To rotate: insert a new one, then set this one active=false.
insert into access_codes (code, note)
values ('RINNOVA-PILOT', 'Friends & family pilot')
on conflict (code) do nothing;


-- ---------------------------------------------------------------------------
-- STEP 2 -- TEACH THE GATE ABOUT CODES
--
-- Replaces handle_new_user() from gated_enrollment.sql. Provisioning is
-- identical; the ONLY change is that the allow test now also accepts a valid
-- access code. Matching is case-insensitive and whitespace-trimmed on both
-- sides, so "rinnova-pilot" and " RINNOVA-PILOT " both pass.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text := btrim(coalesce(new.raw_user_meta_data->>'access_code', ''));
  v_allowed boolean;
begin
  -- 1) Email on the allowlist? (existing path -- Tracy, hand-added testers,
  --    and the App Review demo account.)
  v_allowed := exists (
    select 1 from allowed_emails
    where lower(email) = lower(new.email)
  );

  -- 2) Otherwise, a valid active shared code?
  if not v_allowed and v_code <> '' then
    v_allowed := exists (
      select 1 from access_codes
      where active and lower(code) = lower(v_code)
    );
  end if;

  if not v_allowed then
    raise exception 'Enrollment is not open for this email address.';
  end if;

  -- Provision the tester's own empty record (unchanged). Guarded against a
  -- re-fire; no provider, no name yet -- Greeting and the CTA degrade for that.
  if not exists (select 1 from patients where auth_user_id = new.id) then
    insert into patients (id, auth_user_id, email, onboarding_completed)
    values (gen_random_uuid(), new.id, new.email, false);
  end if;

  return new;
end;
$$;

-- Trigger definition is unchanged from gated_enrollment.sql; recreate it for
-- idempotency in case this file is ever run on its own / a fresh database.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ---------------------------------------------------------------------------
-- STEP 3 -- VERIFY
-- ---------------------------------------------------------------------------
select code, note, active from access_codes order by added_at;

select tgname, tgenabled
from pg_trigger
where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created';
-- expect: on_auth_user_created | O   (O = enabled)
