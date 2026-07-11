-- allow_visit_delete.sql
--
-- There was no way to delete a visit — and it wasn't just a missing button.
-- `visits` had INSERT / SELECT / UPDATE policies but NO DELETE policy, so a
-- client-side delete would have SILENTLY NO-OPPED: PostgREST returns 204 with
-- zero rows affected and no error. The UI would have looked like it worked.
-- (This is the exact silent-RLS failure mode called out in CLAUDE.md §14.)
--
-- Run once, in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- The policy
--
-- Only `visits` needs one. treatments -> visits and treatment_areas ->
-- treatments are both ON DELETE CASCADE, and cascading deletes are referential
-- actions performed by the system — they are NOT subject to RLS on the child
-- tables. So deleting a visit removes its treatments and areas automatically,
-- and treatments / treatment_areas deliberately keep NO delete policy of their
-- own. There is no way to orphan-delete a treatment out from under its visit.
-- ---------------------------------------------------------------------------
drop policy if exists "Patients can delete their own visits" on visits;

create policy "Patients can delete their own visits"
  on visits
  for delete
  using (patient_id = get_my_patient_id());


-- ---------------------------------------------------------------------------
-- Verify: visits should now show all four of SELECT / INSERT / UPDATE / DELETE.
-- treatments and treatment_areas should still show NO delete row — that's
-- correct, they cascade.
-- ---------------------------------------------------------------------------
select tablename, cmd, policyname
from pg_policies
where tablename in ('visits', 'treatments', 'treatment_areas')
order by tablename, cmd;
