-- seed_review_demo.sql
--
-- Gives the App Review demo account (appreview@rinnova.io) one realistic sample
-- visit, so a reviewer sees a populated record (face map, treatments) the moment
-- they sign in, instead of an empty app.
--
-- Idempotent: it does nothing if the demo account already has a visit, so it's
-- safe to re-run. Run in the Supabase SQL editor (service role bypasses RLS).
-- This only ever touches the appreview demo account — never a real patient.

with p as (
  select p.id as pid
  from patients p
  join auth.users u on u.id = p.auth_user_id
  where lower(u.email) = 'appreview@rinnova.io'
),
v as (
  insert into visits (patient_id, visit_date, provider_name, body_regions, status, cost, ai_parsed_at)
  select p.pid, date '2026-06-15', 'Dr. Roberta Del Campo, MD',
         'Forehead, cheeks, and lips', 'confirmed', 1850, now()
  from p
  where not exists (select 1 from visits vv where vv.patient_id = p.pid)
  returning id as vid
),
tox as (
  insert into treatments (visit_id, name, color_key, summary, total_dose, display_order)
  select vid, 'Botox', 'xeomin', 'Neurotoxin — softens expression lines', '30 units', 1 from v
  returning id as tid
),
tox_areas as (
  insert into treatment_areas (treatment_id, friendly_name, clinical_name, dose, mirror, x, y, display_order)
  select tid, 'Forehead', 'Frontalis', '10 units', false, 114.9, 83.4, 1 from tox
  union all select tid, 'Between the brows', 'Glabella', '12 units', false, 114.9, 100.4, 2 from tox
  union all select tid, 'Around the eyes', 'Orbicularis oculi', '8 units', true, 46.7, 148.5, 3 from tox
  returning 1
),
filler as (
  insert into treatments (visit_id, name, color_key, summary, total_dose, display_order)
  select vid, 'Juvéderm', 'rha', 'HA filler — restores volume', '2 syringes', 2 from v
  returning id as fid
),
filler_areas as (
  insert into treatment_areas (treatment_id, friendly_name, clinical_name, dose, mirror, x, y, display_order)
  select fid, 'Cheeks', 'Zygoma', '1 syringe', true, 47.7, 173.7, 1 from filler
  union all select fid, 'Lips', 'Lips', '1 syringe', false, 114.9, 220.8, 2 from filler
  returning 1
)
select 'seeded (or already had a visit)' as result;
