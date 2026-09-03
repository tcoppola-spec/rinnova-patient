-- pilot_metrics.sql
--
-- A saved one-row snapshot of pilot numbers, so checking them is a one-liner:
--   select * from pilot_metrics;
--
-- It's just a stored query (a Postgres view), not a dashboard. Run this file
-- once in the Supabase SQL editor to create it. It counts across ALL patients,
-- which is why it's revoked from the app roles (anon/authenticated) and only
-- readable here in the SQL editor (service role) — a patient must never be able
-- to read totals about everyone.

create or replace view pilot_metrics as
select
  (select count(*) from patients)                                      as signups,
  (select count(*) from patients where first_name is not null)         as named,
  (select count(*) from patients where consent_accepted_at is not null) as consented,
  (select count(distinct patient_id) from visits)                      as logged_a_visit,
  (select count(*) from visits)                                        as total_visits,
  (select count(*) from photos)                                        as total_photos,
  (select count(*) from products)                                      as total_products;

revoke all on pilot_metrics from anon, authenticated;

-- Read it:
select * from pilot_metrics;
