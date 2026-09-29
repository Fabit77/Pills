alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists moderation_reason text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references public.profiles(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'paused', 'blocked'));

create or replace function public.current_account_status()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select account_status from public.profiles where id = auth.uid()), 'blocked');
$$;

create or replace function public.is_account_active(target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select account_status = 'active' from public.profiles where id = target_user_id), false);
$$;

grant execute on function public.current_account_status() to authenticated;
grant execute on function public.is_account_active(uuid) to anon, authenticated;

create or replace function public.search_platform_entities(search_term text)
returns table(entity_type text, entity_id uuid, display_name text, secondary_text text)
language sql stable security definer set search_path = '' as $$
  with matches as (
    select 'artist'::text as entity_type, u.user_id as entity_id,
      ('@' || u.username)::text as display_name, 'Artista o creador'::text as secondary_text, 1 as position
    from public.public_usernames u
    join public.profiles p on p.id = u.user_id and p.account_status = 'active'
    where u.username ilike '%' || trim(search_term) || '%'
    union all
    select 'organization'::text, o.id, o.name, 'Organización'::text, 2
    from public.organizations o
    join public.profiles p on p.id = o.created_by and p.account_status = 'active'
    where o.name ilike '%' || trim(search_term) || '%'
  )
  select matches.entity_type, matches.entity_id, matches.display_name, matches.secondary_text
  from matches order by matches.position, matches.display_name limit 8;
$$;

create or replace function public.preview_collectible_by_id(target_campaign_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'artwork_url', c.artwork_url,
    'event_type', c.event_type, 'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'event_url', c.event_url, 'supply', c.supply, 'claimed_count', c.claimed_count,
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
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  ) from public.campaigns c
  join public.profiles p on p.id = c.created_by and p.account_status = 'active'
  where c.public_slug = lower(trim(provided_slug)) and c.review_status = 'approved' and not c.is_paused limit 1;
$$;

create or replace function public.claim_collectible(target_campaign_id uuid, claim_method text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target public.campaigns; new_claim_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_account_active(auth.uid()) then raise exception 'Account unavailable'; end if;
  select * into target from public.campaigns where id = target_campaign_id for update;
  if target.id is null or target.review_status <> 'approved' or target.is_paused
    or not public.is_account_active(target.created_by) then raise exception 'Collectible unavailable'; end if;
  if target.starts_at is not null and now() < target.starts_at then raise exception 'Collection has not started'; end if;
  if target.ends_at is not null and now() > target.ends_at then raise exception 'Collection has ended'; end if;
  if target.claimed_count >= target.supply then raise exception 'Supply exhausted'; end if;
  insert into public.collectible_claims (campaign_id, collector_id, method)
  values (target_campaign_id, auth.uid(), claim_method) returning id into new_claim_id;
  update public.campaigns set claimed_count = claimed_count + 1,
    first_claimed_at = coalesce(first_claimed_at, now()), updated_at = now()
  where id = target_campaign_id;
  return new_claim_id;
end;
$$;

comment on column public.profiles.account_status is
  'active allows access; paused is reversible moderation; blocked prevents access until a super admin restores it.';
