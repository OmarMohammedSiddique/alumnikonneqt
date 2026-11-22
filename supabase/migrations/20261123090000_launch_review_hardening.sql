-- Launch review hardening (docs/verification/security-review-2026-11-22.md).
-- 1. Staff checks no longer pass for a signed-in caller with no profile row.
-- 2. Members cannot forge the review fields of a report, and staff change
--    reports only through review_report(), which writes the audit log.
-- 3. A mentee cancelling a request can change its status and nothing else.
-- 4. Table privileges that no code path uses are revoked.
-- 5. Every SECURITY DEFINER function pins pg_temp last in its search_path.

-- ---------------------------------------------------------------------------
-- 1. NULL-safe staff checks
-- ---------------------------------------------------------------------------
create or replace function public.review_report(
  p_report_id uuid,
  p_action text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_role public.user_role := public.current_user_role();
  r record;
begin
  -- A caller with no profile row has a NULL role. `NULL not in (...)` is NULL,
  -- which an IF treats as false, so the NULL case is rejected explicitly.
  if caller_role is null or caller_role not in ('moderator', 'admin') then
    raise exception 'only moderators or admins can review reports';
  end if;
  if p_action not in ('dismiss', 'hide_profile') then
    raise exception 'invalid review action';
  end if;

  select * into r from public.reports where id = p_report_id and status = 'pending';
  if not found then
    raise exception 'pending report not found';
  end if;

  if p_action = 'hide_profile' then
    update public.profiles
    set is_visible = false, staff_hidden = true
    where id = r.reported_id;

    update public.reports
    set status = 'actioned',
        action_taken = 'profile_hidden',
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_report_id;

    insert into public.audit_logs (actor_id, action, target_table, target_id, detail)
    values (auth.uid(), 'report_actioned_hide_profile', 'reports', p_report_id,
            jsonb_build_object('reported_id', r.reported_id, 'reason', r.reason, 'note', p_note));
  else
    update public.reports
    set status = 'dismissed',
        action_taken = 'dismissed',
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_report_id;

    insert into public.audit_logs (actor_id, action, target_table, target_id, detail)
    values (auth.uid(), 'report_dismissed', 'reports', p_report_id,
            jsonb_build_object('reported_id', r.reported_id, 'reason', r.reason, 'note', p_note));
  end if;

  return jsonb_build_object('ok', true, 'status', case when p_action = 'hide_profile' then 'actioned' else 'dismissed' end);
end;
$$;

revoke execute on function public.review_report(uuid, text, text) from public, anon;
grant execute on function public.review_report(uuid, text, text) to authenticated;

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  caller_role public.user_role := public.current_user_role();
  is_service boolean := coalesce(auth.role(), '') = 'service_role'
                        or auth.uid() is null; -- direct SQL (postgres) sessions
begin
  -- Role changes remain admin-only
  if new.role is distinct from old.role and not (is_service or coalesce(caller_role = 'admin', false)) then
    raise exception 'only admins can change roles';
  end if;

  -- Embeddings remain server-only
  if new.embedding is distinct from old.embedding and not is_service then
    raise exception 'embeddings are written server-side only';
  end if;

  -- Staff moderation flag can only be altered by moderators, admins or service role
  if new.staff_hidden is distinct from old.staff_hidden and not (is_service or coalesce(caller_role in ('moderator', 'admin'), false)) then
    raise exception 'only moderators or admins can change staff moderation status';
  end if;

  -- Normal members cannot edit someone else's profile
  if old.id <> auth.uid() and not (is_service or coalesce(caller_role in ('moderator', 'admin'), false)) then
    raise exception 'cannot edit another member profile';
  end if;

  -- Moderators editing another user's profile may ONLY toggle staff moderation / visibility
  if caller_role = 'moderator' and old.id <> auth.uid() and (
    new.role            is distinct from old.role or
    new.full_name       is distinct from old.full_name or
    new.headline        is distinct from old.headline or
    new.bio             is distinct from old.bio or
    new.skills          is distinct from old.skills or
    new.industry        is distinct from old.industry or
    new.graduation_year is distinct from old.graduation_year or
    new.member_visible  is distinct from old.member_visible
  ) then
    raise exception 'moderators may only change visibility on other profiles';
  end if;

  -- Compute effective is_visible and enforce staff moderation priority:
  if coalesce(caller_role in ('moderator', 'admin'), false) or is_service then
    if new.is_visible is distinct from old.is_visible then
      if new.is_visible = false then
        new.staff_hidden := true;
      else
        new.staff_hidden := false;
        if new.member_visible is not distinct from old.member_visible then
          new.member_visible := true;
        end if;
        new.is_visible := new.member_visible;
      end if;
    elsif new.staff_hidden is distinct from old.staff_hidden then
      new.is_visible := new.member_visible and not new.staff_hidden;
    else
      new.is_visible := new.member_visible and not new.staff_hidden;
    end if;
  else
    -- Member self-service update: cannot override staff moderation
    new.staff_hidden := old.staff_hidden;
    if new.member_visible is distinct from old.member_visible then
      new.is_visible := new.member_visible and not new.staff_hidden;
    elsif new.is_visible is distinct from old.is_visible then
      new.member_visible := new.is_visible;
      new.is_visible := new.member_visible and not new.staff_hidden;
    else
      new.is_visible := new.member_visible and not new.staff_hidden;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.protect_profile_columns() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Reports: members write only the fields they own
-- ---------------------------------------------------------------------------
drop policy if exists "reports: insert authenticated" on public.reports;
create policy "reports: insert authenticated"
  on public.reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and reporter_id <> reported_id
    and status = 'pending'
    and action_taken = 'none'
    and reviewed_by is null
    and reviewed_at is null
  );

-- Staff review goes through review_report() so every decision is audited.
drop policy if exists "reports: update staff" on public.reports;

revoke all on public.reports from authenticated;
grant select on public.reports to authenticated;
grant insert (reporter_id, reported_id, reason, details) on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Requests: the only direct update is a mentee cancelling, status only
-- ---------------------------------------------------------------------------
revoke all on public.mentorship_requests from authenticated;
grant select, insert on public.mentorship_requests to authenticated;
grant update (status) on public.mentorship_requests to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Unused table privileges
-- ---------------------------------------------------------------------------
-- Hosted projects grant new public tables to anon and authenticated by default.
-- No policy targets anon, so anon needs nothing on these tables.
revoke all on public.profiles, public.mentorship_requests, public.connections,
  public.audit_logs, public.blocks, public.reports from anon;

-- TRUNCATE is not subject to row-level security.
revoke truncate, references, trigger on public.profiles, public.connections,
  public.audit_logs, public.blocks, public.connection_contacts from authenticated;

-- Audit rows come only from SECURITY DEFINER triggers and functions.
revoke insert, update, delete on public.audit_logs from authenticated;

-- ---------------------------------------------------------------------------
-- 5. search_path
-- ---------------------------------------------------------------------------
alter function public.current_user_role() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.log_request_changes() set search_path = public, pg_temp;
alter function public.respond_to_request(uuid, boolean) set search_path = public, pg_temp;
