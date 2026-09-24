alter table public.campaigns
  add column if not exists is_paused boolean not null default false,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_by uuid references public.profiles(id);

create or replace function public.set_collectible_paused(target_campaign_id uuid, should_pause boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_curate_pills() then raise exception 'Curator access required'; end if;
  if not exists (select 1 from public.campaigns where id = target_campaign_id) then raise exception 'Collectible not found'; end if;
  if should_pause and not exists (
    select 1 from public.campaigns where id = target_campaign_id and review_status = 'approved'
  ) then raise exception 'Only approved collectibles can be paused'; end if;

  update public.campaigns set
    is_paused = should_pause,
    paused_at = case when should_pause then now() else null end,
    paused_by = case when should_pause then auth.uid() else null end,
    updated_at = now()
  where id = target_campaign_id;
end;
$$;

create or replace function public.delete_collectible_as_super_admin(target_campaign_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare deleted_artwork text;
begin
  if not public.is_pills_super_admin() then raise exception 'Super admin access required'; end if;
  delete from public.campaigns where id = target_campaign_id returning artwork_url into deleted_artwork;
  if not found then raise exception 'Collectible not found'; end if;
  return deleted_artwork;
end;
$$;

create or replace function public.review_collectible(
  target_campaign_id uuid,
  review_decision text,
  review_reason text default null
) returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text;
begin
  if not public.can_curate_pills() then raise exception 'Curator access required'; end if;
  if review_decision not in ('approved', 'rejected') then raise exception 'Invalid review decision'; end if;
  if review_decision = 'rejected' and nullif(trim(review_reason), '') is null then raise exception 'Rejection reason required'; end if;
  if not exists (select 1 from public.campaigns where id = target_campaign_id) then raise exception 'Collectible not found'; end if;
  if review_decision = 'approved' then raw_token := encode(extensions.gen_random_bytes(24), 'hex'); end if;
  update public.campaigns set
    review_status = review_decision::public.collectible_review_status,
    reviewed_at = now(), reviewed_by = auth.uid(),
    rejection_reason = case when review_decision = 'rejected' then left(trim(review_reason), 500) else null end,
    qr_token = raw_token,
    qr_token_hash = case when raw_token is null then null else encode(extensions.digest(raw_token, 'sha256'), 'hex') end,
    status = case when review_decision = 'approved' then 'scheduled'::public.campaign_status else 'draft'::public.campaign_status end,
    is_paused = false, paused_at = null, paused_by = null,
    updated_at = now()
  where id = target_campaign_id;
  return raw_token;
end;
$$;

create or replace function public.claim_collectible(target_campaign_id uuid, claim_method text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target public.campaigns; new_claim_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into target from public.campaigns where id = target_campaign_id for update;
  if target.id is null or target.review_status <> 'approved' or target.is_paused then raise exception 'Collectible unavailable'; end if;
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

create or replace function public.claim_collectible_by_secret_phrase(provided_secret text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare matching_campaign_id uuid; matching_count integer;
begin
  select count(*), (array_agg(c.id))[1] into matching_count, matching_campaign_id
  from public.campaigns c
  where c.review_status = 'approved' and not c.is_paused
    and c.secret_word_hash = encode(extensions.digest(lower(trim(provided_secret)), 'sha256'), 'hex')
    and (c.starts_at is null or now() >= c.starts_at)
    and (c.ends_at is null or now() <= c.ends_at)
    and c.claimed_count < c.supply;
  if matching_count = 0 then raise exception 'Invalid secret phrase'; end if;
  if matching_count > 1 then raise exception 'Multiple collectibles use this secret phrase'; end if;
  return public.claim_collectible(matching_campaign_id, 'secret');
end;
$$;

create or replace function public.claim_collectible_by_admin_link(provided_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_link public.collectible_admin_links; target_campaign public.campaigns; new_claim_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into target_link from public.collectible_admin_links
  where token_hash = encode(extensions.digest(provided_token, 'sha256'), 'hex') for update;
  if target_link.id is null then raise exception 'Invalid individual link'; end if;
  if target_link.redeemed_at is not null then raise exception 'Individual link already redeemed'; end if;
  select * into target_campaign from public.campaigns where id = target_link.campaign_id for update;
  if target_campaign.review_status <> 'approved' or target_campaign.is_paused then raise exception 'Collectible unavailable'; end if;
  if target_campaign.claimed_count >= target_campaign.supply then raise exception 'Supply exhausted'; end if;
  insert into public.collectible_claims (campaign_id, collector_id, method)
  values (target_link.campaign_id, auth.uid(), 'admin_link') returning id into new_claim_id;
  update public.collectible_admin_links set redeemed_by = auth.uid(), redeemed_at = now() where id = target_link.id;
  update public.campaigns set claimed_count = claimed_count + 1,
    first_claimed_at = coalesce(first_claimed_at, now()), updated_at = now()
  where id = target_link.campaign_id;
  return new_claim_id;
end;
$$;

create or replace function public.preview_collectible_by_qr(provided_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'artwork_url', c.artwork_url,
    'event_type', c.event_type, 'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'supply', c.supply, 'claimed_count', c.claimed_count,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  ) from public.campaigns c
  where c.review_status = 'approved' and not c.is_paused and c.qr_enabled
    and c.qr_token_hash = encode(extensions.digest(provided_token, 'sha256'), 'hex') limit 1;
$$;

create or replace function public.preview_collectible_by_admin_link(provided_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'artwork_url', c.artwork_url,
    'event_type', c.event_type, 'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'supply', c.supply, 'claimed_count', c.claimed_count,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  ) from public.collectible_admin_links l join public.campaigns c on c.id = l.campaign_id
  where c.review_status = 'approved' and not c.is_paused and l.redeemed_at is null
    and l.token_hash = encode(extensions.digest(provided_token, 'sha256'), 'hex') limit 1;
$$;

create or replace function public.preview_collectible_by_id(target_campaign_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description, 'artwork_url', c.artwork_url,
    'event_type', c.event_type, 'venue', c.venue, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'supply', c.supply, 'claimed_count', c.claimed_count,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by)
  ) from public.campaigns c
  where c.id = target_campaign_id and c.review_status = 'approved' and not c.is_paused limit 1;
$$;

grant execute on function public.set_collectible_paused(uuid, boolean) to authenticated;
grant execute on function public.delete_collectible_as_super_admin(uuid) to authenticated;
