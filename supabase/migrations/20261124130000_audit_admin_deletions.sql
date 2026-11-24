-- Audit administrator deletions (#142, launch review check 30).
-- Members cannot delete profiles, connections or mentorship requests: only
-- admins (the "admin delete" policies), the service role and direct database
-- sessions can, and deleting a profile cascades to its requests and
-- connections. Every such deletion now writes an audit row, cascaded ones
-- included, recording who deleted it and in what capacity.
--
-- The rows hold identifiers and roles only, never names or message text, so a
-- deleted member's personal details do not survive in the audit log.
-- Retention of audit rows is a separate decision (#142).

create or replace function public.log_deletion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_detail jsonb := jsonb_build_object(
    -- 'admin' for an administrator, 'service_role' for server code, and
    -- 'database' for a direct SQL session such as the dashboard editor.
    'actor_role', coalesce(public.current_user_role()::text, nullif(auth.role(), ''), 'database'),
    -- The database login that ran the deletion, for example authenticator
    -- (the API), supabase_auth_admin (deleting an Auth user) or postgres.
    'db_user', session_user::text,
    -- True when the row went because a parent row was deleted.
    'cascaded', pg_trigger_depth() > 1
  );
begin
  if tg_table_name = 'profiles' then
    v_detail := v_detail || jsonb_build_object('role', old.role);
  elsif tg_table_name = 'mentorship_requests' then
    v_detail := v_detail || jsonb_build_object(
      'mentee_id', old.mentee_id, 'mentor_id', old.mentor_id, 'status', old.status);
  elsif tg_table_name = 'connections' then
    v_detail := v_detail || jsonb_build_object(
      'request_id', old.request_id, 'mentee_id', old.mentee_id, 'mentor_id', old.mentor_id);
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, detail)
  values (auth.uid(),
          case tg_table_name
            when 'profiles' then 'profile_deleted'
            when 'mentorship_requests' then 'request_deleted'
            when 'connections' then 'connection_deleted'
          end,
          tg_table_name, old.id, v_detail);
  return old;
end;
$$;

revoke execute on function public.log_deletion() from public, anon, authenticated;

drop trigger if exists log_profile_deletion on public.profiles;
create trigger log_profile_deletion
  after delete on public.profiles
  for each row execute function public.log_deletion();

drop trigger if exists log_request_deletion on public.mentorship_requests;
create trigger log_request_deletion
  after delete on public.mentorship_requests
  for each row execute function public.log_deletion();

drop trigger if exists log_connection_deletion on public.connections;
create trigger log_connection_deletion
  after delete on public.connections
  for each row execute function public.log_deletion();
