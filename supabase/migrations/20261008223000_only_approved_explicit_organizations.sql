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
    'edition_number', (
      select count(*) from public.collectible_claims previous
      where previous.campaign_id = cl.campaign_id
        and (previous.created_at, previous.id) <= (cl.created_at, cl.id)
    ),
    'claimed_count', (
      select count(*) from public.collectible_claims current_claims
      where current_claims.campaign_id = cl.campaign_id
    ),
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

create or replace function public.add_campaign_attributions(target_campaign_id uuid, requested_entities jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.campaigns c
    where c.id = target_campaign_id and c.created_by = auth.uid()
  ) then raise exception 'Campaign owner required'; end if;

  insert into public.campaign_attributions (campaign_id, entity_type, entity_id, display_name, added_by)
  select target_campaign_id, 'artist', u.user_id, '@' || u.username, auth.uid()
  from jsonb_array_elements(coalesce(requested_entities, '[]'::jsonb)) item
  join public.public_usernames u on u.user_id = case when item ->> 'entity_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (item ->> 'entity_id')::uuid end
  where item ->> 'entity_type' = 'artist'
    and item ->> 'entity_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  on conflict do nothing;

  insert into public.campaign_attributions (campaign_id, entity_type, entity_id, display_name, added_by)
  select target_campaign_id, 'organization', o.id, o.name, auth.uid()
  from jsonb_array_elements(coalesce(requested_entities, '[]'::jsonb)) item
  join public.organizations o on o.id = case when item ->> 'entity_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (item ->> 'entity_id')::uuid end
  where item ->> 'entity_type' = 'organization'
    and item ->> 'entity_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and o.kind = 'official'
    and o.verification_status = 'approved'
  on conflict do nothing;
end;
$$;

revoke all on function public.get_my_pill_detail(uuid) from public;
revoke all on function public.add_campaign_attributions(uuid, jsonb) from public, anon;
grant execute on function public.get_my_pill_detail(uuid) to authenticated;
grant execute on function public.add_campaign_attributions(uuid, jsonb) to authenticated;

comment on function public.get_my_pill_detail(uuid) is
  'Returns a collected Pill and only its explicitly attributed, approved official organizations.';
