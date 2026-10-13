-- Expose the on-chain identities already issued for a public Pill. A campaign
-- may have several token IDs because every collected edition is minted as its
-- own NFT.

create or replace function public.preview_collectible_by_slug(provided_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id,
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
    'tokens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'token_id', cl.token_id,
        'network', cl.network,
        'contract_address', cl.contract_address,
        'mint_tx_hash', cl.mint_tx_hash
      ) order by cl.token_id)
      from public.collectible_claims cl
      where cl.campaign_id = c.id
        and cl.token_id is not null
        and cl.mint_status = 'minted'
    ), '[]'::jsonb)
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

comment on function public.preview_collectible_by_slug(text) is
  'Returns a public Pill preview plus every minted Stellar token ID issued for that Pill.';
