-- allow_product_note_edit.sql
--
-- Products can now be annotated after the fact ("retinol, 2 nights a week",
-- "neck only"). That needs an UPDATE policy on `products`, which never existed:
-- until now the app only ever INSERTed and DELETEd from this table, and RLS
-- policies here are created lazily, when a use case appears.
--
-- ⚠️ Without this, saving a note fails SILENTLY. PostgREST returns success with
-- zero rows affected, so the UI would report "saved" over a note that was never
-- written. This is the same trap that hid the missing DELETE policies on
-- products, photos and visits (CLAUDE.md §14). The client checks the returned
-- rows and surfaces an empty result as a real failure, but the policy is what
-- actually makes it work.
--
-- USING = which rows I may touch. WITH CHECK = what the row may become. Both
-- are required: USING alone would let a patient move one of their products onto
-- someone else's patient_id, since nothing would constrain the resulting row.
--
-- Safe to re-run. Run once, in the Supabase SQL editor.

drop policy if exists "Patients can update their own products" on products;

create policy "Patients can update their own products"
  on products
  for update
  using (patient_id = get_my_patient_id())
  with check (patient_id = get_my_patient_id());


-- Verify: expect one row per command (select / insert / update / delete).
select cmd, policyname
from pg_policies
where tablename = 'products'
order by cmd;
