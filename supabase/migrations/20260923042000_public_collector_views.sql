create or replace function public.preview_collectible_by_qr(provided_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description,
    'artwork_url', c.artwork_url, 'event_type', c.event_type,
    'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'supply', c.supply, 'claimed_count', c.claimed_count,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  )
  from public.campaigns c
  where c.review_status = 'approved'
    and c.qr_enabled
    and c.qr_token_hash = encode(extensions.digest(provided_token, 'sha256'), 'hex')
  limit 1;
$$;

create or replace function public.preview_collectible_by_admin_link(provided_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description,
    'artwork_url', c.artwork_url, 'event_type', c.event_type,
    'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'supply', c.supply, 'claimed_count', c.claimed_count,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  )
  from public.collectible_admin_links l
  join public.campaigns c on c.id = l.campaign_id
  where c.review_status = 'approved'
    and l.redeemed_at is null
    and l.token_hash = encode(extensions.digest(provided_token, 'sha256'), 'hex')
  limit 1;
$$;

create or replace function public.preview_collectible_by_id(target_campaign_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description,
    'artwork_url', c.artwork_url, 'event_type', c.event_type,
    'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'supply', c.supply, 'claimed_count', c.claimed_count,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  )
  from public.campaigns c
  where c.id = target_campaign_id and c.review_status = 'approved'
  limit 1;
$$;

create or replace function public.get_my_pills()
returns table (
  claim_id uuid, campaign_id uuid, method text, claimed_at timestamptz,
  name text, artwork_url text, event_type text, starts_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select cl.id, cl.campaign_id, cl.method, cl.created_at,
    c.name, c.artwork_url, c.event_type, c.starts_at
  from public.collectible_claims cl
  join public.campaigns c on c.id = cl.campaign_id
  where cl.collector_id = auth.uid()
  order by cl.created_at desc;
$$;

grant execute on function public.preview_collectible_by_qr(text) to anon, authenticated;
grant execute on function public.preview_collectible_by_admin_link(text) to anon, authenticated;
grant execute on function public.preview_collectible_by_id(uuid) to anon, authenticated;
grant execute on function public.get_my_pills() to authenticated;

comment on function public.preview_collectible_by_qr(text) is
  'Returns only public collectible fields for a valid approved QR token.';
comment on function public.preview_collectible_by_admin_link(text) is
  'Returns only public collectible fields for an unused individual link.';
comment on function public.get_my_pills() is
  'Returns the authenticated collector own Pills without exposing other claims.';
