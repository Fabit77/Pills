create or replace function public.claim_collectible_by_qr(provided_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare campaign_id uuid;
begin
  select id into campaign_id from public.campaigns
  where qr_enabled
    and qr_token_hash = encode(extensions.digest(provided_token, 'sha256'), 'hex');
  if campaign_id is null then raise exception 'Invalid QR'; end if;
  return public.claim_collectible(campaign_id, 'qr');
end;
$$;

create or replace function public.claim_collectible_by_secret(target_campaign_id uuid, provided_secret text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.campaigns where id = target_campaign_id
      and secret_word_hash = encode(extensions.digest(lower(trim(provided_secret)), 'sha256'), 'hex')
  ) then raise exception 'Invalid secret phrase'; end if;
  return public.claim_collectible(target_campaign_id, 'secret');
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
  if target_campaign.review_status <> 'approved' then raise exception 'Collectible unavailable'; end if;
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

grant execute on function public.claim_collectible_by_qr(text) to authenticated;
grant execute on function public.claim_collectible_by_secret(uuid, text) to authenticated;
grant execute on function public.claim_collectible_by_admin_link(text) to authenticated;
