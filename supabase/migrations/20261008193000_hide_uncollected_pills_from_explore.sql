create or replace function public.search_public_collectibles(
  pill_title text default null,
  creator_username text default null
)
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
    and c.claimed_count > 0
    and (
      nullif(trim(pill_title), '') is null
      or c.name ilike '%' || trim(pill_title) || '%'
    )
    and (
      nullif(trim(both '@' from trim(creator_username)), '') is null
      or coalesce(u.username, '') ilike '%' || trim(both '@' from trim(creator_username)) || '%'
    )
  order by c.created_at desc;
$$;

revoke all on function public.search_public_collectibles(text, text) from public;
grant execute on function public.search_public_collectibles(text, text) to anon, authenticated;

comment on function public.search_public_collectibles(text, text) is
  'Searches approved Pills with at least one collection by title and creator without exposing collector identities.';
