-- add_visit_photos.sql
--
-- Photos can optionally belong to a visit. ONE photo library, not two: a photo
-- attached to a visit also stays in the archive, badged.
--
-- Run in the Supabase SQL editor, step by step. Step 0 shows you exactly what
-- Step 2 is going to replace -- read it before running Step 2.

-- ---------------------------------------------------------------------------
-- STEP 0 -- LOOK AT WHAT YOU'RE ABOUT TO REPLACE
--
-- Step 2 drops and recreates the UPDATE policy on `photos`. Run this first and
-- read it. You should see one UPDATE policy whose qual is
--   (patient_id = get_my_patient_id())
-- and whose with_check is either the same or NULL.
--
-- If with_check is NULL, Postgres silently reuses `qual` as the check -- which
-- is exactly the hole we're closing: nothing would stop a patient from setting
-- visit_id to SOMEONE ELSE'S visit.
--
-- If you see anything OTHER than the standard patient_id policy, STOP and say
-- so, because Step 2 will drop it.
-- ---------------------------------------------------------------------------
select cmd, policyname, qual, with_check
from pg_policies
where tablename = 'photos'
order by cmd;


-- ---------------------------------------------------------------------------
-- STEP 1 -- THE COLUMN
--
-- Nullable visit_id ON THE PHOTO (not photo_id on the visit): the relationship
-- is one-to-many, so a visit can hold several photos (before/after, angles) and
-- a photo belongs to at most one visit.
--
-- ⚠️ ON DELETE SET NULL -- THIS IS THE WHOLE POINT. NOT CASCADE.
--
-- `visits` cascades to treatments -> treatment_areas, because those are DERIVED
-- from the visit and meaningless without it. It must STOP DEAD at photos.
--
-- A mis-parsed visit costs five minutes to re-add. A photo of the patient's own
-- face from a year ago is the single least recoverable thing in this app. The
-- blast radius of a cheap delete must never include the irreplaceable thing.
--
-- Putting SET NULL in the FOREIGN KEY makes that a GUARANTEE, not a convention:
-- Postgres itself nulls the visit_id when a visit is deleted. It holds for a
-- delete from the app, a raw DELETE in this editor, a future admin tool, or a
-- cascade arriving from anywhere else. It is structurally impossible for
-- deleting a visit to destroy a photo. Do not "tidy" this into a CASCADE.
-- ---------------------------------------------------------------------------
alter table photos
  add column if not exists visit_id uuid
    references visits(id) on delete set null;

create index if not exists photos_visit_id_idx on photos (visit_id);


-- ---------------------------------------------------------------------------
-- STEP 2 -- CLOSE THE ATTACH HOLE (RLS)
--
-- The existing UPDATE policy only proves "this photo is mine". It says nothing
-- about visit_id, so a patient could attach their photo to ANOTHER patient's
-- visit -- leaking that a visit exists, and putting their photo in someone
-- else's record.
--
-- A plain RLS policy CAN express this, so no SECURITY DEFINER RPC is needed:
--   USING      -> which rows I may touch      (my photos)
--   WITH CHECK -> what the row may BECOME     (visit_id must be one of MY visits)
--
-- WITH CHECK is evaluated against the NEW row, which is precisely what we need.
-- This is strictly better than an RPC: no SECURITY DEFINER to audit, and the
-- constraint sits declaratively next to the data.
--
-- Dropped dynamically so we don't depend on the policy's exact name -- and so a
-- second, weaker UPDATE policy can't survive. (RLS policies are OR'd together:
-- one leftover permissive policy would defeat the WITH CHECK entirely.)
-- ---------------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where tablename = 'photos' and cmd = 'UPDATE'
  loop
    execute format('drop policy %I on photos', p.policyname);
  end loop;
end $$;

create policy "Patients can update their own photos"
  on photos
  for update
  using (
    patient_id = get_my_patient_id()
  )
  with check (
    patient_id = get_my_patient_id()
    and (
      visit_id is null
      or visit_id in (select id from visits where patient_id = get_my_patient_id())
    )
  );


-- ---------------------------------------------------------------------------
-- STEP 3 -- VERIFY
-- ---------------------------------------------------------------------------

-- The FK must be SET NULL. If this says CASCADE, stop -- photos would be
-- destroyed when a visit is deleted.
select
  con.conname,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
where rel.relname = 'photos' and con.contype = 'f';
-- expect: FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL

-- The UPDATE policy must now carry a with_check that mentions visits.
select cmd, policyname, with_check
from pg_policies
where tablename = 'photos' and cmd = 'UPDATE';

-- All existing photos are unattached, as expected.
select count(*) as total, count(visit_id) as attached from photos;
