drop function if exists public.get_collectors_for_owned_pill(uuid);
create function public.get_collectors_for_owned_pill(target_campaign_id uuid)
returns table (
  username text,
  display_name text,
  avatar_url text,
  claimed_at timestamptz,
  is_current_user boolean
)
language sql stable security definer set search_path = '' as $$
  select u.username,
    nullif(trim(coalesce(p.full_name, concat_ws(' ', p.first_name, p.last_name))), '') as display_name,
    coalesce(
      nullif(trim(p.avatar_url), ''),
      nullif(trim(au.raw_user_meta_data ->> 'avatar_url'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'picture'), '')
    ) as avatar_url,
    cl.created_at,
    cl.collector_id = auth.uid()
  from public.collectible_claims cl
  join public.profiles p on p.id = cl.collector_id
  join auth.users au on au.id = cl.collector_id
  left join public.public_usernames u on u.user_id = cl.collector_id
  where cl.campaign_id = target_campaign_id
    and exists (
      select 1 from public.collectible_claims mine
      where mine.campaign_id = target_campaign_id and mine.collector_id = auth.uid()
    )
  order by cl.created_at asc, cl.id asc;
$$;

revoke all on function public.get_collectors_for_owned_pill(uuid) from public;
grant execute on function public.get_collectors_for_owned_pill(uuid) to authenticated;

comment on function public.get_collectors_for_owned_pill(uuid) is
  'Returns collectors and their profile photos only when the authenticated user owns the same Pill.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;
