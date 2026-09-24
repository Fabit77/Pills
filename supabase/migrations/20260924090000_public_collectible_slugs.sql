alter table public.campaigns add column if not exists public_slug text;

update public.campaigns
set public_slug = 'pill-legacy-' || substr(replace(id::text, '-', ''), 1, 8)
where public_slug is null;

alter table public.campaigns alter column public_slug set not null;
alter table public.campaigns drop constraint if exists campaigns_public_slug_format;
alter table public.campaigns add constraint campaigns_public_slug_format
  check (public_slug ~ '^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$');
create unique index if not exists campaigns_public_slug_unique on public.campaigns (lower(public_slug));

create or replace function public.protect_campaign_public_slug()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.public_slug is distinct from old.public_slug then
    raise exception 'The public link cannot be changed after creation';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_campaign_public_slug on public.campaigns;
create trigger protect_campaign_public_slug
before update of public_slug on public.campaigns
for each row execute function public.protect_campaign_public_slug();

create or replace function public.is_campaign_slug_available(candidate text)
returns boolean language sql stable security definer set search_path = '' as $$
  select candidate ~ '^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$'
    and not exists (select 1 from public.campaigns where lower(public_slug) = lower(candidate));
$$;

create or replace function public.preview_collectible_by_slug(provided_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'artwork_url', c.artwork_url,
    'event_type', c.event_type, 'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'supply', c.supply, 'claimed_count', c.claimed_count, 'qr_enabled', c.qr_enabled,
    'secret_enabled', c.secret_word_hash is not null, 'public_slug', c.public_slug,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  ) from public.campaigns c
  where lower(c.public_slug) = lower(trim(provided_slug))
    and c.review_status = 'approved' and not c.is_paused limit 1;
$$;

create or replace function public.claim_collectible_by_slug(provided_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare campaign_id uuid;
begin
  select id into campaign_id from public.campaigns
  where lower(public_slug) = lower(trim(provided_slug)) and qr_enabled;
  if campaign_id is null then raise exception 'Invalid public collectible link'; end if;
  return public.claim_collectible(campaign_id, 'qr');
end;
$$;

grant execute on function public.is_campaign_slug_available(text) to authenticated;
grant execute on function public.preview_collectible_by_slug(text) to anon, authenticated;
grant execute on function public.claim_collectible_by_slug(text) to authenticated;

comment on column public.campaigns.public_slug is
  'Immutable, globally unique three-part path used by the public link and QR code.';
