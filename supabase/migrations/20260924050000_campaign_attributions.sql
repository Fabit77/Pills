create table if not exists public.campaign_attributions (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  entity_type text not null check (entity_type in ('artist', 'organization')),
  entity_id uuid not null,
  display_name text not null,
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (campaign_id, entity_type, entity_id)
);

alter table public.campaign_attributions enable row level security;

create policy "campaign managers read attributions" on public.campaign_attributions
  for select to authenticated using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and (
        c.created_by = auth.uid() or exists (
          select 1 from public.campaign_collaborators cc
          where cc.campaign_id = c.id and cc.user_id = auth.uid()
        )
      )
    )
  );

create policy "campaign owners add attributions" on public.campaign_attributions
  for insert to authenticated with check (
    added_by = auth.uid() and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.created_by = auth.uid()
    )
  );

create function public.search_platform_entities(search_term text)
returns table(entity_type text, entity_id uuid, display_name text, secondary_text text)
language sql stable security definer set search_path = '' as $$
  with matches as (
    select
      'artist'::text as entity_type,
      u.user_id as entity_id,
      ('@' || u.username)::text as display_name,
      'Artista o creador'::text as secondary_text,
      1 as position
    from public.public_usernames u
    where u.username ilike '%' || trim(search_term) || '%'

    union all

    select
      'organization'::text,
      o.id,
      o.name,
      'Organización'::text,
      2
    from public.organizations o
    where o.name ilike '%' || trim(search_term) || '%'
  )
  select matches.entity_type, matches.entity_id, matches.display_name, matches.secondary_text
  from matches
  order by matches.position, matches.display_name
  limit 8;
$$;

revoke all on function public.search_platform_entities(text) from public, anon;
grant execute on function public.search_platform_entities(text) to authenticated;

create function public.add_campaign_attributions(target_campaign_id uuid, requested_entities jsonb)
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
  on conflict do nothing;
end;
$$;

revoke all on function public.add_campaign_attributions(uuid, jsonb) from public, anon;
grant execute on function public.add_campaign_attributions(uuid, jsonb) to authenticated;
