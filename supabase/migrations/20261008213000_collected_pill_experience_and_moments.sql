create table if not exists public.pill_moments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  description text not null check (char_length(trim(description)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists pill_moments_campaign_created_idx
  on public.pill_moments (campaign_id, created_at desc);

alter table public.pill_moments enable row level security;

drop policy if exists "collectors read pill moments" on public.pill_moments;
create policy "collectors read pill moments" on public.pill_moments for select to authenticated
  using (exists (
    select 1 from public.collectible_claims claim
    where claim.campaign_id = pill_moments.campaign_id
      and claim.collector_id = auth.uid()
  ));

drop policy if exists "collectors create pill moments" on public.pill_moments;
create policy "collectors create pill moments" on public.pill_moments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.collectible_claims claim
      where claim.campaign_id = pill_moments.campaign_id
        and claim.collector_id = auth.uid()
    )
  );

drop policy if exists "authors delete pill moments" on public.pill_moments;
create policy "authors delete pill moments" on public.pill_moments for delete to authenticated
  using (uploaded_by = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pill-moments', 'pill-moments', false, 8388608, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "collectors read moment images" on storage.objects;
create policy "collectors read moment images" on storage.objects for select to authenticated
  using (
    bucket_id = 'pill-moments'
    and exists (
      select 1 from public.collectible_claims claim
      where claim.campaign_id::text = (storage.foldername(name))[1]
        and claim.collector_id = auth.uid()
    )
  );

drop policy if exists "collectors upload moment images" on storage.objects;
create policy "collectors upload moment images" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pill-moments'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.collectible_claims claim
      where claim.campaign_id::text = (storage.foldername(name))[1]
        and claim.collector_id = auth.uid()
    )
  );

drop policy if exists "authors delete moment images" on storage.objects;
create policy "authors delete moment images" on storage.objects for delete to authenticated
  using (
    bucket_id = 'pill-moments'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

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
      select jsonb_agg(names.display_name order by names.display_name)
      from (
        select a.display_name
        from public.campaign_attributions a
        where a.campaign_id = c.id and a.entity_type = 'organization'
        union
        select o.name
        from public.organizations o
        where o.id = c.organization_id
      ) names
    ), '[]'::jsonb)
  )
  from public.collectible_claims cl
  join public.campaigns c on c.id = cl.campaign_id
  where cl.id = target_claim_id and cl.collector_id = auth.uid()
  limit 1;
$$;

drop function if exists public.get_collectors_for_owned_pill(uuid);
create function public.get_collectors_for_owned_pill(target_campaign_id uuid)
returns table (username text, display_name text, claimed_at timestamptz, is_current_user boolean)
language sql stable security definer set search_path = '' as $$
  select u.username,
    nullif(trim(coalesce(p.full_name, concat_ws(' ', p.first_name, p.last_name))), '') as display_name,
    cl.created_at,
    cl.collector_id = auth.uid()
  from public.collectible_claims cl
  join public.profiles p on p.id = cl.collector_id
  left join public.public_usernames u on u.user_id = cl.collector_id
  where cl.campaign_id = target_campaign_id
    and exists (
      select 1 from public.collectible_claims mine
      where mine.campaign_id = target_campaign_id and mine.collector_id = auth.uid()
    )
  order by cl.created_at asc, cl.id asc;
$$;

create or replace function public.get_moments_for_owned_pill(target_campaign_id uuid)
returns table (
  id uuid,
  storage_path text,
  description text,
  username text,
  display_name text,
  created_at timestamptz,
  is_owner boolean
)
language sql stable security definer set search_path = '' as $$
  select m.id, m.storage_path, m.description, u.username,
    nullif(trim(coalesce(p.full_name, concat_ws(' ', p.first_name, p.last_name))), '') as display_name,
    m.created_at,
    m.uploaded_by = auth.uid()
  from public.pill_moments m
  join public.profiles p on p.id = m.uploaded_by
  left join public.public_usernames u on u.user_id = m.uploaded_by
  where m.campaign_id = target_campaign_id
    and exists (
      select 1 from public.collectible_claims mine
      where mine.campaign_id = target_campaign_id and mine.collector_id = auth.uid()
    )
  order by m.created_at desc;
$$;

revoke all on function public.get_my_pill_detail(uuid) from public;
revoke all on function public.get_collectors_for_owned_pill(uuid) from public;
revoke all on function public.get_moments_for_owned_pill(uuid) from public;
grant execute on function public.get_my_pill_detail(uuid) to authenticated;
grant execute on function public.get_collectors_for_owned_pill(uuid) to authenticated;
grant execute on function public.get_moments_for_owned_pill(uuid) to authenticated;

comment on table public.pill_moments is
  'Private collector photos attached to a Pill. These images are not NFTs and descriptions are immutable.';
comment on function public.get_moments_for_owned_pill(uuid) is
  'Returns private moments only when the authenticated user owns the same Pill.';
