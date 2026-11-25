-- Mentorship plan (#187): the two people in a connection agree objectives and
-- milestones, and both can see how progress compares with the plan.
--
-- Access follows connection_contacts: only the Mentee and Mentor in the
-- connection, and only while neither has blocked the other
-- (public.is_connection_participant). Staff moderation views of connections
-- deliberately do not include plan content, and nobody else can write it.

-- ---------------------------------------------------------------------------
-- 1. Objectives: at most 5 per connection.
-- ---------------------------------------------------------------------------
create table if not exists public.mentorship_objectives (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  constraint mentorship_objectives_title_length
    check (char_length(btrim(title)) between 3 and 120),
  -- No control characters or text-direction overrides, which can disguise text.
  constraint mentorship_objectives_no_hidden_characters
    check (title !~ '[[:cntrl:]\u0080-\u009f\u202a-\u202e\u2066-\u2069]'),
  -- Lets milestones prove they belong to the same connection as their objective.
  unique (id, connection_id)
);

create index if not exists mentorship_objectives_connection_idx
  on public.mentorship_objectives (connection_id, created_at);

-- ---------------------------------------------------------------------------
-- 2. Milestones: at most 8 per objective, each with an optional target date.
--    completed_at and completed_by are stamped by the server.
-- ---------------------------------------------------------------------------
create table if not exists public.mentorship_milestones (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null,
  connection_id uuid not null,
  title text not null,
  target_date date,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Deleting the objective (or its connection, which deletes the objective)
  -- deletes its milestones.
  constraint mentorship_milestones_objective_fkey
    foreign key (objective_id, connection_id)
    references public.mentorship_objectives (id, connection_id) on delete cascade,
  constraint mentorship_milestones_title_length
    check (char_length(btrim(title)) between 3 and 120),
  constraint mentorship_milestones_no_hidden_characters
    check (title !~ '[[:cntrl:]\u0080-\u009f\u202a-\u202e\u2066-\u2069]'),
  constraint mentorship_milestones_target_date_range
    check (target_date is null or target_date between date '2020-01-01' and date '2100-12-31'),
  constraint mentorship_milestones_completed_by_needs_time
    check (completed_by is null or completed_at is not null)
);

create index if not exists mentorship_milestones_objective_idx
  on public.mentorship_milestones (objective_id, created_at);
create index if not exists mentorship_milestones_connection_idx
  on public.mentorship_milestones (connection_id);

-- ---------------------------------------------------------------------------
-- 3. Limits and server-stamped fields.
--    SECURITY DEFINER so the count sees every row of the plan; an advisory
--    lock per parent stops two simultaneous inserts passing the same count.
-- ---------------------------------------------------------------------------
create or replace function public.guard_mentorship_objective()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.title := btrim(new.title);
  if tg_op = 'INSERT' then
    -- Outsiders are left to row-level security, so the limit never reveals
    -- how many objectives a plan holds.
    if auth.uid() is not null and not public.is_connection_participant(new.connection_id) then
      return new;
    end if;
    perform pg_advisory_xact_lock(hashtextextended('mentorship_objectives:' || new.connection_id::text, 0));
    if (select count(*) from public.mentorship_objectives
        where connection_id = new.connection_id) >= 5 then
      raise exception 'A mentorship plan can have at most 5 objectives'
        using errcode = 'check_violation', hint = 'objective_limit';
    end if;
    new.created_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_mentorship_objective() from public, anon, authenticated;

drop trigger if exists guard_mentorship_objective on public.mentorship_objectives;
create trigger guard_mentorship_objective
  before insert or update on public.mentorship_objectives
  for each row execute function public.guard_mentorship_objective();

create or replace function public.guard_mentorship_milestone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.title := btrim(new.title);
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_connection_participant(new.connection_id) then
      return new;
    end if;
    perform pg_advisory_xact_lock(hashtextextended('mentorship_milestones:' || new.objective_id::text, 0));
    if (select count(*) from public.mentorship_milestones
        where objective_id = new.objective_id) >= 8 then
      raise exception 'An objective can have at most 8 milestones'
        using errcode = 'check_violation', hint = 'milestone_limit';
    end if;
    new.created_at := now();
    new.completed_at := null;
    new.completed_by := null;
  elsif new.completed_at is null then
    new.completed_by := null;
  elsif old.completed_at is null then
    -- Marked done now: the server clock and the signed-in member, never the client.
    new.completed_at := now();
    new.completed_by := auth.uid();
  else
    -- Already done: keep the original time. Members cannot write completed_by
    -- (no column grant), and leaving it alone lets ON DELETE SET NULL work.
    new.completed_at := old.completed_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_mentorship_milestone() from public, anon, authenticated;

drop trigger if exists guard_mentorship_milestone on public.mentorship_milestones;
create trigger guard_mentorship_milestone
  before insert or update on public.mentorship_milestones
  for each row execute function public.guard_mentorship_milestone();

-- ---------------------------------------------------------------------------
-- 4. Row-level security: participants only.
-- ---------------------------------------------------------------------------
alter table public.mentorship_objectives enable row level security;
alter table public.mentorship_milestones enable row level security;

drop policy if exists "mentorship_objectives: participants read" on public.mentorship_objectives;
create policy "mentorship_objectives: participants read"
  on public.mentorship_objectives for select to authenticated
  using (public.is_connection_participant(connection_id));

drop policy if exists "mentorship_objectives: participants add" on public.mentorship_objectives;
create policy "mentorship_objectives: participants add"
  on public.mentorship_objectives for insert to authenticated
  with check (public.is_connection_participant(connection_id));

drop policy if exists "mentorship_objectives: participants change" on public.mentorship_objectives;
create policy "mentorship_objectives: participants change"
  on public.mentorship_objectives for update to authenticated
  using (public.is_connection_participant(connection_id))
  with check (public.is_connection_participant(connection_id));

drop policy if exists "mentorship_objectives: participants remove" on public.mentorship_objectives;
create policy "mentorship_objectives: participants remove"
  on public.mentorship_objectives for delete to authenticated
  using (public.is_connection_participant(connection_id));

drop policy if exists "mentorship_milestones: participants read" on public.mentorship_milestones;
create policy "mentorship_milestones: participants read"
  on public.mentorship_milestones for select to authenticated
  using (public.is_connection_participant(connection_id));

drop policy if exists "mentorship_milestones: participants add" on public.mentorship_milestones;
create policy "mentorship_milestones: participants add"
  on public.mentorship_milestones for insert to authenticated
  with check (public.is_connection_participant(connection_id));

drop policy if exists "mentorship_milestones: participants change" on public.mentorship_milestones;
create policy "mentorship_milestones: participants change"
  on public.mentorship_milestones for update to authenticated
  using (public.is_connection_participant(connection_id))
  with check (public.is_connection_participant(connection_id));

drop policy if exists "mentorship_milestones: participants remove" on public.mentorship_milestones;
create policy "mentorship_milestones: participants remove"
  on public.mentorship_milestones for delete to authenticated
  using (public.is_connection_participant(connection_id));

-- ---------------------------------------------------------------------------
-- 5. Grants. Hosted projects grant new public tables to anon and authenticated
--    by default, so start from nothing and grant only what the app uses.
--    Members write titles, dates and the done marker; ids, owners and
--    timestamps come from defaults and the triggers above.
-- ---------------------------------------------------------------------------
revoke all on public.mentorship_objectives, public.mentorship_milestones from anon, authenticated;

grant select, delete on public.mentorship_objectives, public.mentorship_milestones to authenticated;
grant insert (connection_id, title) on public.mentorship_objectives to authenticated;
grant update (title) on public.mentorship_objectives to authenticated;
grant insert (objective_id, connection_id, title, target_date) on public.mentorship_milestones to authenticated;
grant update (title, target_date, completed_at) on public.mentorship_milestones to authenticated;

grant all on public.mentorship_objectives, public.mentorship_milestones to service_role;
