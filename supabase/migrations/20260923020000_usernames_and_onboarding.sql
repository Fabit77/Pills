alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists bio text;

create table public.public_usernames (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9._]{3,24}$')
);

create unique index public_usernames_username_lower_idx
  on public.public_usernames (lower(username));

alter table public.public_usernames enable row level security;

create policy "usernames are public" on public.public_usernames
  for select to anon, authenticated using (true);

create policy "users create own username" on public.public_usernames
  for insert to authenticated with check (auth.uid() = user_id);

create policy "users update own username" on public.public_usernames
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create function public.has_creator_username() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.public_usernames where user_id = auth.uid()
  );
$$;

create function public.complete_creator_profile(
  requested_username text,
  requested_first_name text default null,
  requested_last_name text default null,
  requested_bio text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare normalized_username text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  normalized_username := lower(trim(requested_username));
  if normalized_username !~ '^[a-z0-9._]{3,24}$' then
    raise exception 'Invalid username';
  end if;

  insert into public.public_usernames (user_id, username)
  values (auth.uid(), normalized_username)
  on conflict (user_id) do update set
    username = excluded.username,
    updated_at = now();

  update public.profiles set
    first_name = nullif(trim(requested_first_name), ''),
    last_name = nullif(trim(requested_last_name), ''),
    bio = nullif(trim(requested_bio), ''),
    full_name = nullif(trim(concat_ws(' ', requested_first_name, requested_last_name)), ''),
    updated_at = now()
  where id = auth.uid();

  return normalized_username;
end;
$$;

grant execute on function public.complete_creator_profile(text, text, text, text) to authenticated;

drop policy if exists "editors can manage collections" on public.collections;
create policy "editors with usernames can manage collections" on public.collections
  for all using (public.can_edit_org(organization_id) and public.has_creator_username())
  with check (public.can_edit_org(organization_id) and public.has_creator_username());

drop policy if exists "editors can manage campaigns" on public.campaigns;
create policy "editors with usernames can manage campaigns" on public.campaigns
  for all using (public.can_edit_org(organization_id) and public.has_creator_username())
  with check (public.can_edit_org(organization_id) and public.has_creator_username());

revoke all on table public.profiles from anon;
grant select on table public.public_usernames to anon, authenticated;

comment on table public.public_usernames is
  'Public creator identity. Email remains private in auth.users and is never exposed here.';
