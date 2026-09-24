create or replace function public.get_my_pill_detail(target_claim_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'claim_id', cl.id,
    'campaign_id', c.id,
    'method', cl.method,
    'claimed_at', cl.created_at,
    'name', c.name,
    'description', c.description,
    'artwork_url', c.artwork_url,
    'event_type', c.event_type,
    'venue', c.venue,
    'starts_at', c.starts_at,
    'ends_at', c.ends_at,
    'event_url', c.event_url,
    'audience', c.audience,
    'tags', c.tags,
    'creator', (select u.username from public.public_usernames u where u.user_id = c.created_by),
    'edition_number', (
      select count(*) from public.collectible_claims previous
      where previous.campaign_id = cl.campaign_id
        and (previous.created_at, previous.id) <= (cl.created_at, cl.id)
    ),
    'supply', c.supply
  )
  from public.collectible_claims cl
  join public.campaigns c on c.id = cl.campaign_id
  where cl.id = target_claim_id and cl.collector_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_my_pill_detail(uuid) to authenticated;

comment on function public.get_my_pill_detail(uuid) is
  'Returns the authenticated collector own claim with the public collectible details.';
