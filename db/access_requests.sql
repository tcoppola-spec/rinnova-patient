-- access_requests.sql
--
-- Rinnova is invite-only. Until now the only way in was Tracy adding an address
-- to allowed_emails by hand, which meant anyone who found the link had no way
-- to ask. This is the front door: a request form on the public landing page.
--
-- REFERRAL IS REQUIRED, AND THAT IS THE POINT. Anyone can type an email
-- address; naming the person who recommended you is something only a real
-- referral can do, and it is checkable against someone Tracy already knows.
-- First AND last name, because "Sarah" is not a referral you can verify.
--
-- Approving a request is still manual and deliberately so:
--   insert into allowed_emails (email, note) values ('them@x.com', 'via Jane Doe');
--   update access_requests set status = 'approved' where id = '...';
-- Nothing here grants access on its own. A row in this table is a request, not
-- an account, and the enrollment trigger still gates signup on allowed_emails.
--
-- Run once, in the Supabase SQL editor.

create table if not exists access_requests (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  full_name            text not null,
  email                text not null,
  referrer_first_name  text not null,
  referrer_last_name   text not null,
  note                 text,
  status               text not null default 'pending'
                       check (status in ('pending', 'approved', 'declined'))
);

-- One request per address. A second submission from the same person is a
-- duplicate, not a new request; the app catches the unique violation and says
-- "we already have it" rather than showing an error.
create unique index if not exists access_requests_email_uniq
  on access_requests (lower(btrim(email)));

alter table access_requests enable row level security;

-- INSERT ONLY, and deliberately no SELECT/UPDATE/DELETE policy for anyone.
--
-- The form is on a public page, so `anon` has to be able to write. But with no
-- SELECT policy, nobody using the publishable API key can read the table back, so the
-- list of who has asked (real names, emails, who referred them) is not
-- enumerable by a visitor. Tondo reads it in the SQL editor, which bypasses RLS.
--
-- WITH CHECK enforces the required fields at the DATABASE, not just in the
-- form: a client-side check is trivially bypassed by posting straight to the
-- API, and an unverifiable request is exactly what this is meant to keep out.
drop policy if exists "Anyone may request access" on access_requests;

create policy "Anyone may request access"
  on access_requests
  for insert
  to anon, authenticated
  with check (
    btrim(full_name) <> ''
    and btrim(email) <> ''
    and position('@' in email) > 1
    and btrim(referrer_first_name) <> ''
    and btrim(referrer_last_name) <> ''
    -- Status is set server-side by the default; a request can never arrive
    -- pre-approved.
    and status = 'pending'
  );


-- Review pending requests (run in the SQL editor, which bypasses RLS):
--
--   select created_at, full_name, email,
--          referrer_first_name || ' ' || referrer_last_name as referred_by, note
--   from access_requests
--   where status = 'pending'
--   order by created_at;
