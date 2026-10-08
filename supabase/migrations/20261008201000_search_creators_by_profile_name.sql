create or replace function public.search_public_collectibles(
  pill_title text default null,
  creator_username text default null
)
returns table (id uuid, public_slug text, name text, description text, artwork_url text, event_type text, venue text, starts_at timestamptz, created_at timestamptz, claimed_count integer, creator text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.public_slug, c.name, c.description, c.artwork_url, c.event_type, c.venue,
    c.starts_at, c.created_at, c.claimed_count, u.username
  from public.campaigns c
  join public.profiles p on p.id = c.created_by and p.account_status = 'active'
  left join public.public_usernames u on u.user_id = c.created_by
  where c.review_status = 'approved' and not c.is_paused and c.claimed_count > 0
    and (nullif(trim(pill_title), '') is null or c.name ilike '%' || trim(pill_title) || '%')
    and (
      nullif(trim(both '@' from trim(creator_username)), '') is null
      or coalesce(u.username, '') ilike '%' || trim(both '@' from trim(creator_username)) || '%'
      or coalesce(p.first_name, '') ilike '%' || trim(creator_username) || '%'
      or coalesce(p.last_name, '') ilike '%' || trim(creator_username) || '%'
      or coalesce(p.full_name, '') ilike '%' || trim(creator_username) || '%'
    )
  order by c.created_at desc;
$$;

create or replace function public.search_public_creators(creator_query text)
returns table (username text, display_name text, pill_count bigint)
language sql stable security definer set search_path = '' as $$
  select u.username,
    nullif(trim(coalesce(p.full_name, concat_ws(' ', p.first_name, p.last_name))), '') as display_name,
    count(c.id) as pill_count
  from public.public_usernames u
  join public.profiles p on p.id = u.user_id and p.account_status = 'active'
  join public.campaigns c on c.created_by = u.user_id
    and c.review_status = 'approved' and not c.is_paused and c.claimed_count > 0
  where length(trim(coalesce(creator_query, ''))) >= 2
    and (
      u.username ilike '%' || trim(both '@' from trim(creator_query)) || '%'
      or coalesce(p.first_name, '') ilike '%' || trim(creator_query) || '%'
      or coalesce(p.last_name, '') ilike '%' || trim(creator_query) || '%'
      or coalesce(p.full_name, '') ilike '%' || trim(creator_query) || '%'
    )
  group by u.username, p.full_name, p.first_name, p.last_name
  order by case when lower(u.username) = lower(trim(both '@' from trim(creator_query))) then 0 else 1 end,
    count(c.id) desc, u.username
  limit 6;
$$;

revoke all on function public.search_public_collectibles(text, text) from public;
grant execute on function public.search_public_collectibles(text, text) to anon, authenticated;
revoke all on function public.search_public_creators(text) from public;
grant execute on function public.search_public_creators(text) to anon, authenticated;

comment on function public.search_public_creators(text) is
  'Suggests active creators by public username or profile name when they have at least one visible Pill.';
