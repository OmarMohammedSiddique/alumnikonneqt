-- Administrator deletions are audited (#142). Disposable rows, rolled back at the end.
-- Run with: psql <local db url> -v ON_ERROR_STOP=1 -f supabase/tests/admin_deletion_audit.sql
begin;
insert into auth.users(id, email, raw_user_meta_data) values
 ('55500000-0000-0000-0000-000000000001','audit-admin@example.test','{"role":"mentee","full_name":"Audit Admin"}'),
 ('55500000-0000-0000-0000-000000000002','audit-mentor@example.test','{"role":"mentor","full_name":"Audit Mentor"}'),
 ('55500000-0000-0000-0000-000000000003','audit-mentee@example.test','{"role":"mentee","full_name":"Audit Mentee"}'),
 ('55500000-0000-0000-0000-000000000004','audit-mentee2@example.test','{"role":"mentee","full_name":"Audit Second Mentee"}'),
 ('55500000-0000-0000-0000-000000000005','audit-member@example.test','{"role":"mentee","full_name":"Audit Member"}'),
 ('55500000-0000-0000-0000-000000000006','audit-mentee3@example.test','{"role":"mentee","full_name":"Audit Third Mentee"}'),
 ('55500000-0000-0000-0000-000000000007','audit-moderator@example.test','{"role":"mentee","full_name":"Audit Moderator"}'),
 ('55500000-0000-0000-0000-000000000008','audit-admin2@example.test','{"role":"mentee","full_name":"Audit Second Admin"}');
update public.profiles set role = 'admin'
where id in ('55500000-0000-0000-0000-000000000001', '55500000-0000-0000-0000-000000000008');
update public.profiles set role = 'moderator' where id = '55500000-0000-0000-0000-000000000007';
insert into public.mentorship_requests(id, mentor_id, mentee_id, status, message) values
 ('55500000-0000-0000-0000-000000000010','55500000-0000-0000-0000-000000000002','55500000-0000-0000-0000-000000000003','accepted','private introduction'),
 ('55500000-0000-0000-0000-000000000011','55500000-0000-0000-0000-000000000002','55500000-0000-0000-0000-000000000004','pending','private introduction'),
 ('55500000-0000-0000-0000-000000000012','55500000-0000-0000-0000-000000000002','55500000-0000-0000-0000-000000000006','accepted','private introduction');
insert into public.connections(id, request_id, mentor_id, mentee_id) values
 ('55500000-0000-0000-0000-000000000020','55500000-0000-0000-0000-000000000010','55500000-0000-0000-0000-000000000002','55500000-0000-0000-0000-000000000003'),
 ('55500000-0000-0000-0000-000000000022','55500000-0000-0000-0000-000000000012','55500000-0000-0000-0000-000000000002','55500000-0000-0000-0000-000000000006');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- TEST 0: clients cannot call the audit trigger function.
do $$ begin
  if has_function_privilege('anon', 'public.log_deletion()', 'execute')
     or has_function_privilege('authenticated', 'public.log_deletion()', 'execute') then
    raise exception 'FAIL 0: a client role can execute log_deletion';
  end if;
end $$;

-- TEST 1: members and moderators cannot delete profiles, connections or
-- requests, and nothing is audited.
set local role authenticated;
select pg_temp.act_as('55500000-0000-0000-0000-000000000005');
do $$
declare affected integer;
begin
  delete from public.profiles where id = '55500000-0000-0000-0000-000000000004';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL 1: a member deleted a profile'; end if;
  delete from public.connections where id = '55500000-0000-0000-0000-000000000020';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL 1: a member deleted a connection'; end if;
  begin
    delete from public.mentorship_requests where id = '55500000-0000-0000-0000-000000000011';
    raise exception 'FAIL 1: a member deleted a request';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.act_as('55500000-0000-0000-0000-000000000007');
do $$
declare affected integer;
begin
  delete from public.profiles where id = '55500000-0000-0000-0000-000000000004';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL 1: a moderator deleted a profile'; end if;
  delete from public.connections where id = '55500000-0000-0000-0000-000000000020';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL 1: a moderator deleted a connection'; end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.audit_logs where action like '%\_deleted'
             and target_id::text like '55500000-%') then
    raise exception 'FAIL 1: a refused deletion was audited';
  end if;
end $$;

-- TEST 2: an admin deleting a connection writes an audit row naming the admin.
set local role authenticated;
select pg_temp.act_as('55500000-0000-0000-0000-000000000001');
delete from public.connections where id = '55500000-0000-0000-0000-000000000020';
reset role;
do $$ begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'connection_deleted' and target_table = 'connections'
      and target_id = '55500000-0000-0000-0000-000000000020'
      and actor_id = '55500000-0000-0000-0000-000000000001'
      and detail ->> 'actor_role' = 'admin'
      and (detail ->> 'cascaded')::boolean = false
      and detail ->> 'request_id' = '55500000-0000-0000-0000-000000000010'
      and detail ->> 'mentee_id' = '55500000-0000-0000-0000-000000000003'
      and detail ->> 'mentor_id' = '55500000-0000-0000-0000-000000000002'
  ) then
    raise exception 'FAIL 2: the admin connection deletion was not audited';
  end if;
end $$;

-- TEST 3: an admin deleting a profile audits the profile and each cascaded request.
set local role authenticated;
select pg_temp.act_as('55500000-0000-0000-0000-000000000001');
delete from public.profiles where id = '55500000-0000-0000-0000-000000000004';
reset role;
do $$ begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'profile_deleted' and target_table = 'profiles'
      and target_id = '55500000-0000-0000-0000-000000000004'
      and actor_id = '55500000-0000-0000-0000-000000000001'
      and detail ->> 'actor_role' = 'admin'
      and detail ->> 'role' = 'mentee'
      and (detail ->> 'cascaded')::boolean = false
  ) then
    raise exception 'FAIL 3: the admin profile deletion was not audited';
  end if;
  if not exists (
    select 1 from public.audit_logs
    where action = 'request_deleted' and target_table = 'mentorship_requests'
      and target_id = '55500000-0000-0000-0000-000000000011'
      and actor_id = '55500000-0000-0000-0000-000000000001'
      and detail ->> 'status' = 'pending'
      and (detail ->> 'cascaded')::boolean = true
  ) then
    raise exception 'FAIL 3: the cascaded request deletion was not audited';
  end if;
end $$;

-- TEST 4: a service role deletion is audited with no actor and its role.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
delete from public.profiles where id = '55500000-0000-0000-0000-000000000006';
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'profile_deleted' and target_id = '55500000-0000-0000-0000-000000000006'
      and actor_id is null and detail ->> 'actor_role' = 'service_role'
  ) then
    raise exception 'FAIL 4: the service role profile deletion was not audited';
  end if;
  if not exists (
    select 1 from public.audit_logs
    where action = 'connection_deleted' and target_id = '55500000-0000-0000-0000-000000000022'
      and actor_id is null and (detail ->> 'cascaded')::boolean = true
  ) or not exists (
    select 1 from public.audit_logs
    where action = 'request_deleted' and target_id = '55500000-0000-0000-0000-000000000012'
      and actor_id is null and (detail ->> 'cascaded')::boolean = true
  ) then
    raise exception 'FAIL 4: the cascaded connection or request deletion was not audited';
  end if;
end $$;

-- TEST 5: deleting an Auth user directly in the database audits the cascaded profile.
delete from auth.users where id = '55500000-0000-0000-0000-000000000003';
do $$ begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'profile_deleted' and target_id = '55500000-0000-0000-0000-000000000003'
      and actor_id is null and detail ->> 'actor_role' = 'database'
      and detail ->> 'db_user' = 'postgres' -- CI runs this suite as postgres
      and (detail ->> 'cascaded')::boolean = true
  ) or not exists (
    select 1 from public.audit_logs
    where action = 'request_deleted' and target_id = '55500000-0000-0000-0000-000000000010'
  ) then
    raise exception 'FAIL 5: deleting an Auth user was not audited';
  end if;
end $$;

-- TEST 6: deletion audit rows keep no names or message text, and members cannot read them.
do $$ begin
  if exists (
    select 1 from public.audit_logs
    where action like '%\_deleted' and target_id::text like '55500000-%'
      and (detail::text like '%Audit%' or detail::text like '%private introduction%')
  ) then
    raise exception 'FAIL 6: a deletion audit row holds a name or message text';
  end if;
end $$;
set local role authenticated;
select pg_temp.act_as('55500000-0000-0000-0000-000000000005');
do $$ begin
  if exists (select 1 from public.audit_logs) then
    raise exception 'FAIL 6: a member can read audit rows';
  end if;
end $$;
reset role;

-- TEST 7: an admin deleting their own profile is still recorded as an admin.
set local role authenticated;
select pg_temp.act_as('55500000-0000-0000-0000-000000000008');
delete from public.profiles where id = auth.uid();
reset role;
do $$ begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'profile_deleted' and target_id = '55500000-0000-0000-0000-000000000008'
      and actor_id = '55500000-0000-0000-0000-000000000008'
      and detail ->> 'actor_role' = 'admin'
      and (detail ->> 'cascaded')::boolean = false
  ) then
    raise exception 'FAIL 7: an admin deleting their own profile was not audited as an admin';
  end if;
end $$;

select 'ALL ADMIN DELETION AUDIT TESTS PASSED' as result;
rollback;
