create or replace function public.preview_collectible_by_id(target_campaign_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'artwork_url', c.artwork_url,
    'event_type', c.event_type, 'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'event_url', c.event_url, 'supply', c.supply, 'claimed_count', c.claimed_count,
    'qr_enabled', c.qr_enabled, 'secret_enabled', c.secret_word_hash is not null,
    'public_slug', c.public_slug,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  ) from public.campaigns c
  join public.profiles p on p.id = c.created_by and p.account_status = 'active'
  where c.id = target_campaign_id and c.review_status = 'approved' and not c.is_paused limit 1;
$$;

create or replace function public.preview_collectible_by_qr(provided_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'artwork_url', c.artwork_url,
    'event_type', c.event_type, 'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'event_url', c.event_url, 'supply', c.supply, 'claimed_count', c.claimed_count,
    'qr_enabled', c.qr_enabled, 'secret_enabled', c.secret_word_hash is not null,
    'public_slug', c.public_slug,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  ) from public.campaigns c
  join public.profiles p on p.id = c.created_by and p.account_status = 'active'
  where c.review_status = 'approved' and not c.is_paused and c.qr_enabled
    and c.qr_token_hash = encode(extensions.digest(provided_token, 'sha256'), 'hex') limit 1;
$$;

create or replace function public.preview_collectible_by_admin_link(provided_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'artwork_url', c.artwork_url,
    'event_type', c.event_type, 'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'event_url', c.event_url, 'supply', c.supply, 'claimed_count', c.claimed_count,
    'qr_enabled', c.qr_enabled, 'secret_enabled', c.secret_word_hash is not null,
    'public_slug', c.public_slug,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  ) from public.collectible_admin_links l
  join public.campaigns c on c.id = l.campaign_id
  join public.profiles p on p.id = c.created_by and p.account_status = 'active'
  where c.review_status = 'approved' and not c.is_paused and l.redeemed_at is null
    and l.token_hash = encode(extensions.digest(provided_token, 'sha256'), 'hex') limit 1;
$$;

create or replace function public.preview_collectible_by_slug(provided_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'artwork_url', c.artwork_url,
    'event_type', c.event_type, 'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'event_url', c.event_url, 'supply', c.supply, 'claimed_count', c.claimed_count,
    'qr_enabled', c.qr_enabled, 'secret_enabled', c.secret_word_hash is not null,
    'public_slug', c.public_slug,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  ) from public.campaigns c
  join public.profiles p on p.id = c.created_by and p.account_status = 'active'
  where lower(c.public_slug) = lower(trim(provided_slug))
    and c.review_status = 'approved' and not c.is_paused limit 1;
$$;

grant execute on function public.preview_collectible_by_id(uuid) to anon, authenticated;
grant execute on function public.preview_collectible_by_qr(text) to anon, authenticated;
grant execute on function public.preview_collectible_by_admin_link(text) to anon, authenticated;
grant execute on function public.preview_collectible_by_slug(text) to anon, authenticated;

comment on function public.preview_collectible_by_slug(text) is
  'Returns public Pill details and distribution availability so the collector flow can choose QR link or secret phrase.';
