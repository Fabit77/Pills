create or replace function public.list_public_collectibles(search_query text default null)
returns table (
  id uuid,
  public_slug text,
  name text,
  description text,
  artwork_url text,
  event_type text,
  venue text,
  starts_at timestamptz,
  created_at timestamptz,
  claimed_count integer,
  creator text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.public_slug,
    c.name,
    c.description,
    c.artwork_url,
    c.event_type,
    c.venue,
    c.starts_at,
    c.created_at,
    c.claimed_count,
    u.username
  from public.campaigns c
  join public.profiles p on p.id = c.created_by and p.account_status = 'active'
  left join public.public_usernames u on u.user_id = c.created_by
  where c.review_status = 'approved'
    and not c.is_paused
    and (
      nullif(trim(search_query), '') is null
      or c.name ilike '%' || trim(search_query) || '%'
      or coalesce(c.description, '') ilike '%' || trim(search_query) || '%'
      or coalesce(c.event_type, '') ilike '%' || trim(search_query) || '%'
      or coalesce(c.venue, '') ilike '%' || trim(search_query) || '%'
      or coalesce(u.username, '') ilike '%' || trim(search_query) || '%'
    )
  order by c.created_at desc;
$$;

create or replace function public.get_collectors_for_owned_pill(target_campaign_id uuid)
returns table (
  username text,
  claimed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.username, cl.created_at
  from public.collectible_claims cl
  join public.public_usernames u on u.user_id = cl.collector_id
  where cl.campaign_id = target_campaign_id
    and exists (
      select 1
      from public.collectible_claims mine
      where mine.campaign_id = target_campaign_id
        and mine.collector_id = auth.uid()
    )
  order by cl.created_at asc, cl.id asc;
$$;

revoke all on function public.list_public_collectibles(text) from public;
revoke all on function public.get_collectors_for_owned_pill(uuid) from public;
grant execute on function public.list_public_collectibles(text) to anon, authenticated;
grant execute on function public.get_collectors_for_owned_pill(uuid) to authenticated;

comment on function public.list_public_collectibles(text) is
  'Lists approved public Pills and aggregate claim counts without exposing collector identities.';
comment on function public.get_collectors_for_owned_pill(uuid) is
  'Lists public usernames of collectors only when the authenticated user owns the same Pill.';
