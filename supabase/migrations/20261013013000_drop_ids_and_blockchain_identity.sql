-- A Drop identifies the original Pill. Each collected edition keeps its own
-- token_id, while drop_id groups every edition under one immutable identity.

create sequence if not exists public.pills_drop_id_seq as bigint minvalue 1;

alter table public.campaigns
  add column if not exists drop_id bigint;

with numbered as (
  select id, row_number() over (order by created_at, id)::bigint as drop_id
  from public.campaigns
)
update public.campaigns c
set drop_id = numbered.drop_id
from numbered
where c.id = numbered.id and c.drop_id is null;

do $$
declare highest_drop_id bigint;
begin
  select max(drop_id) into highest_drop_id from public.campaigns;
  if highest_drop_id is null then
    perform setval('public.pills_drop_id_seq', 1, false);
  else
    perform setval('public.pills_drop_id_seq', highest_drop_id, true);
  end if;
end $$;

alter table public.campaigns
  alter column drop_id set default nextval('public.pills_drop_id_seq'),
  alter column drop_id set not null;

create unique index if not exists campaigns_drop_id_unique
  on public.campaigns (drop_id);

create or replace function public.protect_campaign_drop_id()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.drop_id is distinct from new.drop_id then
    raise exception 'Drop ID is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_campaign_drop_id on public.campaigns;
create trigger protect_campaign_drop_id
before update of drop_id on public.campaigns
for each row execute function public.protect_campaign_drop_id();

comment on column public.campaigns.drop_id is
  'Short immutable identity for the original Pill. Its Stellar registration is stored in blockchain_tx_hash; collected editions use their own token_id.';

create or replace function public.preview_collectible_by_slug(provided_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id,
    'drop_id', c.drop_id,
    'name', c.name,
    'description', c.description,
    'artwork_url', c.artwork_url,
    'event_type', c.event_type,
    'venue', c.venue,
    'starts_at', c.starts_at,
    'ends_at', c.ends_at,
    'event_url', c.event_url,
    'supply', c.supply,
    'claimed_count', c.claimed_count,
    'qr_enabled', c.qr_enabled,
    'secret_enabled', c.secret_word_hash is not null,
    'public_slug', c.public_slug,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by),
    'drop_blockchain_status', c.blockchain_status,
    'drop_network', c.blockchain_network,
    'drop_contract_address', c.blockchain_contract_address,
    'drop_tx_hash', c.blockchain_tx_hash
  )
  from public.campaigns c
  join public.profiles p on p.id = c.created_by and p.account_status = 'active'
  where lower(c.public_slug) = lower(trim(provided_slug))
    and c.review_status = 'approved'
    and not c.is_paused
  limit 1;
$$;

revoke all on function public.preview_collectible_by_slug(text) from public;
grant execute on function public.preview_collectible_by_slug(text) to anon, authenticated;

create or replace function public.get_my_pill_detail(target_claim_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'claim_id', cl.id,
    'campaign_id', c.id,
    'drop_id', c.drop_id,
    'method', cl.method,
    'claimed_at', cl.created_at,
    'name', c.name,
    'description', c.description,
    'artwork_url', c.artwork_url,
    'event_type', c.event_type,
    'venue', c.venue,
    'starts_at', c.starts_at,
    'ends_at', c.ends_at,
    'created_at', c.created_at,
    'event_url', c.event_url,
    'audience', c.audience,
    'tags', c.tags,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by),
    'collector_username', (select u.username from public.public_usernames u where u.user_id = cl.collector_id),
    'collector_name', (
      select nullif(trim(coalesce(p.full_name, concat_ws(' ', p.first_name, p.last_name))), '')
      from public.profiles p where p.id = cl.collector_id
    ),
    'edition_number', coalesce(cl.edition_number, (
      select count(*) from public.collectible_claims previous
      where previous.campaign_id = cl.campaign_id
        and (previous.created_at, previous.id) <= (cl.created_at, cl.id)
    )),
    'claimed_count', (
      select count(*) from public.collectible_claims current_claims
      where current_claims.campaign_id = cl.campaign_id
    ),
    'drop_blockchain_status', c.blockchain_status,
    'drop_network', c.blockchain_network,
    'drop_contract_address', c.blockchain_contract_address,
    'drop_tx_hash', c.blockchain_tx_hash,
    'token_id', cl.token_id,
    'mint_status', cl.mint_status,
    'mint_tx_hash', cl.mint_tx_hash,
    'network', cl.network,
    'contract_address', cl.contract_address,
    'artists', coalesce((
      select jsonb_agg(a.display_name order by a.display_name)
      from public.campaign_attributions a
      where a.campaign_id = c.id and a.entity_type = 'artist'
    ), '[]'::jsonb),
    'organizations', coalesce((
      select jsonb_agg(o.name order by o.name)
      from public.campaign_attributions a
      join public.organizations o on o.id = a.entity_id
      where a.campaign_id = c.id
        and a.entity_type = 'organization'
        and o.kind = 'official'
        and o.verification_status = 'approved'
    ), '[]'::jsonb)
  )
  from public.collectible_claims cl
  join public.campaigns c on c.id = cl.campaign_id
  where cl.id = target_claim_id and cl.collector_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_pill_detail(uuid) from public;
grant execute on function public.get_my_pill_detail(uuid) to authenticated;

comment on function public.preview_collectible_by_slug(text) is
  'Returns the public Pill and its Drop registration without exposing collector token IDs.';
comment on function public.get_my_pill_detail(uuid) is
  'Returns an owned Pill with both its Drop registration and the collector NFT identity.';
