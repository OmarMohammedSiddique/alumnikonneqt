-- Keep fictional demo accounts and real members apart (#109).
-- Demo fixtures carry app_metadata.fictional = true (see lib/demo-switcher.ts).
-- 1. The database refuses a mentorship request or a connection between a
--    fictional and a non-fictional account, in both directions and for every
--    caller, including the service role.
-- 2. Discovery offers each account only Mentors of its own kind: both
--    discovery RPCs, and a computed field the model comparison pool filters on.
--
-- Existing cross requests are left untouched. Once this is applied, a pending
-- cross request can still be cancelled or declined, but accepting it is
-- refused because the connection insert is refused.

-- ---------------------------------------------------------------------------
-- 1. Account kind helpers
-- ---------------------------------------------------------------------------
-- Reads auth.users, so it is SECURITY DEFINER and not executable by clients.
-- A missing account or a missing marker counts as a real (non-fictional) account.
create or replace function public.is_fictional_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (u.raw_app_meta_data -> 'fictional') = 'true'::jsonb
     from auth.users u
     where u.id = p_user_id),
    false
  )
$$;

revoke execute on function public.is_fictional_account(uuid) from public, anon, authenticated;

-- True when the signed-in caller and p_other_id are the same kind of account.
create or replace function public.shares_account_kind(p_other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_fictional_account(auth.uid()) = public.is_fictional_account(p_other_id)
$$;

revoke execute on function public.shares_account_kind(uuid) from public, anon;
grant execute on function public.shares_account_kind(uuid) to authenticated;

-- Computed field for PostgREST: profiles?same_account_kind=is.true
create or replace function public.same_account_kind(p public.profiles)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select public.shares_account_kind(p.id)
$$;

revoke execute on function public.same_account_kind(public.profiles) from public, anon;
grant execute on function public.same_account_kind(public.profiles) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Refuse cross-kind requests and connections
-- ---------------------------------------------------------------------------
-- The app matches this exact message and SQLSTATE (lib/mentorship-request.ts).
create or replace function public.enforce_same_account_kind()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_fictional_account(new.mentee_id) <> public.is_fictional_account(new.mentor_id) then
    raise exception 'demo accounts and members cannot be paired'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_same_account_kind() from public, anon, authenticated;

drop trigger if exists enforce_same_account_kind on public.mentorship_requests;
create trigger enforce_same_account_kind
  before insert or update of mentee_id, mentor_id on public.mentorship_requests
  for each row execute function public.enforce_same_account_kind();

drop trigger if exists enforce_same_account_kind on public.connections;
create trigger enforce_same_account_kind
  before insert or update of mentee_id, mentor_id on public.connections
  for each row execute function public.enforce_same_account_kind();

-- ---------------------------------------------------------------------------
-- 3. Discovery offers only Mentors of the caller's kind
-- ---------------------------------------------------------------------------
-- Same definitions as 20261105000003_system_hardening_and_indexes.sql, plus
-- the account kind condition.
create or replace function public.match_mentors(
  query_embedding extensions.vector(384),
  match_count int default 10
)
returns table (
  id uuid,
  full_name text,
  headline text,
  bio text,
  skills text[],
  industry text,
  graduation_year int,
  accepting_requests boolean,
  similarity float,
  shared_skills text[]
)
language sql
stable
set search_path = pg_catalog, public, extensions
as $$
  with caller as (
    select coalesce(c.skills, '{}') as skills
    from public.profiles c
    where c.id = auth.uid()
  )
  select p.id, p.full_name, p.headline, p.bio, p.skills, p.industry,
         p.graduation_year, p.accepting_requests,
         1 - (p.embedding <=> query_embedding) as similarity,
         coalesce(
           (select array_agg(ps order by ps)
            from unnest(p.skills) ps
            where exists (
              select 1 from caller, unnest(caller.skills) cs
              where lower(cs) = lower(ps)
            )),
           '{}'
         ) as shared_skills
  from public.profiles p
  where p.role = 'mentor'
    and p.is_visible
    and p.embedding is not null
    and p.id is distinct from auth.uid()
    and not public.is_blocked_with(p.id)
    and public.shares_account_kind(p.id)
  order by p.embedding <=> query_embedding
  limit least(match_count, 50)
$$;

revoke execute on function public.match_mentors(extensions.vector, integer) from public, anon;
grant execute on function public.match_mentors(extensions.vector, integer) to authenticated;

create or replace function public.search_mentors(
  search_query text,
  match_count int default 10
)
returns table (
  id uuid,
  full_name text,
  headline text,
  bio text,
  skills text[],
  industry text,
  graduation_year int,
  accepting_requests boolean,
  rank real
)
language sql
stable
set search_path = pg_catalog, public, extensions
as $$
  select p.id, p.full_name, p.headline, p.bio, p.skills, p.industry,
         p.graduation_year, p.accepting_requests,
         ts_rank(p.fts, websearch_to_tsquery('english', search_query)) as rank
  from public.profiles p
  where p.role = 'mentor'
    and p.is_visible
    and p.fts @@ websearch_to_tsquery('english', search_query)
    and p.id is distinct from auth.uid()
    and not public.is_blocked_with(p.id)
    and public.shares_account_kind(p.id)
  order by rank desc
  limit least(match_count, 50)
$$;

revoke execute on function public.search_mentors(text, integer) from public, anon;
grant execute on function public.search_mentors(text, integer) to authenticated;
