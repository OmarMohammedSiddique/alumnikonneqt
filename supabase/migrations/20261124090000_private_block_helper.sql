-- Keep the block helper out of the Data API (issue 147, launch review check 12).
--
-- public.is_blocked_with(uuid) is SECURITY DEFINER and sat in the exposed
-- `public` schema, so a signed-in member could call it directly as an RPC with
-- any member id. A true answer for someone the caller had not blocked revealed
-- that the other member had blocked them.
--
-- The helper moves to a `private` schema, which PostgREST does not expose
-- (supabase/config.toml lists only public and graphql_public). Row-level
-- security policies store a reference to the function itself rather than its
-- name, so the profiles, mentorship request and profile photo policies keep
-- working after the move. Functions whose bodies name the helper are
-- redefined below with the new name and are otherwise unchanged.

-- ---------------------------------------------------------------------------
-- 1. Private schema: reachable from SQL run by signed-in members (policies and
--    invoker functions), never from the Data API.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_blocked_with(uuid) set schema private;

revoke execute on function private.is_blocked_with(uuid) from public, anon;
grant execute on function private.is_blocked_with(uuid) to authenticated, service_role;

comment on function private.is_blocked_with(uuid) is
  'True when the signed-in member and the given member have blocked each other in either direction. Private: used by policies and functions, not callable through the Data API.';

-- ---------------------------------------------------------------------------
-- 2. Discovery functions (last defined in 20261105000003).
-- ---------------------------------------------------------------------------
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
    and not private.is_blocked_with(p.id)
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
    and not private.is_blocked_with(p.id)
  order by rank desc
  limit least(match_count, 50)
$$;

revoke execute on function public.search_mentors(text, integer) from public, anon;
grant execute on function public.search_mentors(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Connection journey functions (last defined in 20261116120000).
-- ---------------------------------------------------------------------------
create or replace function public.set_first_conversation(
  p_connection_id uuid,
  p_held boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.connections%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_connection from public.connections where id = p_connection_id;
  if not found
     or auth.uid() not in (v_connection.mentee_id, v_connection.mentor_id) then
    raise exception 'Connection not found' using errcode = '42501';
  end if;

  if private.is_blocked_with(
       case when auth.uid() = v_connection.mentee_id
            then v_connection.mentor_id else v_connection.mentee_id end) then
    raise exception 'Connection unavailable' using errcode = '42501';
  end if;

  update public.connections
     set first_conversation_at = case
           when p_held then coalesce(first_conversation_at, now())
           else null end
   where id = p_connection_id
  returning first_conversation_at into v_connection.first_conversation_at;

  return v_connection.first_conversation_at;
end;
$$;

revoke execute on function public.set_first_conversation(uuid, boolean) from public, anon;
grant execute on function public.set_first_conversation(uuid, boolean) to authenticated;

create or replace function public.is_connection_participant(p_connection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.connections c
    where c.id = p_connection_id
      and auth.uid() in (c.mentee_id, c.mentor_id)
      and not private.is_blocked_with(
        case when auth.uid() = c.mentee_id then c.mentor_id else c.mentee_id end)
  );
$$;

revoke execute on function public.is_connection_participant(uuid) from public, anon;
grant execute on function public.is_connection_participant(uuid) to authenticated;
