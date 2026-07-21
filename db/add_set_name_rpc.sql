-- add_set_name_rpc.sql
--
-- New testers are provisioned with no name (db/gated_enrollment.sql), so the
-- greeting reads "Good morning" with nobody's name. This lets a patient set
-- their own first name.
--
-- Like complete_onboarding, this is the ONLY sanctioned write into `patients`
-- for this field. `patients` deliberately has NO UPDATE policy (RLS is
-- row-level, not column-level, so a broad UPDATE policy would let a patient
-- rewrite email / dob / provider too). So this is a narrow SECURITY DEFINER
-- function: no target patient argument (resolved server-side), sets exactly one
-- column on exactly one row -- the caller's own.
--
-- Run once, in the Supabase SQL editor.

create or replace function set_my_name(p_first_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_name       text;
begin
  v_patient_id := get_my_patient_id();
  if v_patient_id is null then
    raise exception 'No patient record found for the current user';
  end if;

  v_name := nullif(btrim(p_first_name), '');
  if v_name is null then
    raise exception 'Name cannot be empty';
  end if;
  v_name := left(v_name, 60); -- guard against absurd input

  update patients set first_name = v_name where id = v_patient_id;
end;
$$;

revoke all on function set_my_name(text) from public;
revoke all on function set_my_name(text) from anon;
grant execute on function set_my_name(text) to authenticated;
