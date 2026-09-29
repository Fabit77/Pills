alter table public.organizations
  add column if not exists kind text not null default 'official',
  add column if not exists username text,
  add column if not exists description text,
  add column if not exists website_url text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_evidence text,
  add column if not exists rejection_reason text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

update public.organizations set kind = 'personal', verification_status = 'approved'
where name like 'Espacio de @%' and username is null;

alter table public.organizations drop constraint if exists organizations_kind_check;
alter table public.organizations add constraint organizations_kind_check check (kind in ('personal', 'official'));
alter table public.organizations drop constraint if exists organizations_verification_status_check;
alter table public.organizations add constraint organizations_verification_status_check check (verification_status in ('pending', 'approved', 'rejected'));
alter table public.organizations drop constraint if exists organizations_username_format_check;
alter table public.organizations add constraint organizations_username_format_check check (username is null or username ~ '^[a-z0-9._]{3,24}$');
create unique index if not exists organizations_username_lower_idx on public.organizations(lower(username)) where username is not null;

alter table public.collections
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.collection_contributors (
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'contributor' check (role = 'contributor'),
  added_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);
alter table public.collection_contributors enable row level security;

create or replace function public.guard_shared_username()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'organizations' and new.username is not null and exists (
    select 1 from public.public_usernames where lower(username) = lower(new.username)
  ) then raise exception 'Username already in use'; end if;
  if tg_table_name = 'public_usernames' and exists (
    select 1 from public.organizations where username is not null and lower(username) = lower(new.username)
  ) then raise exception 'Username already in use'; end if;
  return new;
end;
$$;
drop trigger if exists guard_organization_username on public.organizations;
create trigger guard_organization_username before insert or update of username on public.organizations
for each row execute function public.guard_shared_username();
drop trigger if exists guard_person_username on public.public_usernames;
create trigger guard_person_username before insert or update of username on public.public_usernames
for each row execute function public.guard_shared_username();

create or replace function public.create_organization(organization_name text, organization_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_organization_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.organizations (name, slug, created_by, kind, verification_status)
  values (organization_name, organization_slug, auth.uid(), 'personal', 'approved') returning id into new_organization_id;
  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, auth.uid(), 'owner');
  return new_organization_id;
end;
$$;

create or replace function public.create_official_organization(
  organization_name text, organization_username text, organization_description text,
  organization_website text, ownership_evidence text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; normalized text;
begin
  if auth.uid() is null or not public.is_account_active(auth.uid()) then raise exception 'Authentication required'; end if;
  normalized := lower(trim(organization_username));
  if normalized !~ '^[a-z0-9._]{3,24}$' then raise exception 'Invalid organization username'; end if;
  if length(trim(organization_name)) < 2 or length(trim(ownership_evidence)) < 10 then raise exception 'Organization evidence required'; end if;
  insert into public.organizations (
    name, slug, username, description, website_url, verification_evidence, verification_status,
    submitted_at, created_by, kind
  ) values (
    left(trim(organization_name), 120), normalized || '-' || substr(auth.uid()::text, 1, 8), normalized,
    nullif(left(trim(organization_description), 600), ''), nullif(left(trim(organization_website), 500), ''),
    left(trim(ownership_evidence), 1500), 'pending', now(), auth.uid(), 'official'
  ) returning id into new_id;
  insert into public.organization_members (organization_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;

create or replace function public.review_organization(target_organization_id uuid, decision text, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_curate_pills() then raise exception 'Admin access required'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'Invalid decision'; end if;
  if decision = 'rejected' and nullif(trim(reason), '') is null then raise exception 'Reason required'; end if;
  update public.organizations set verification_status = decision,
    verified_at = case when decision = 'approved' then now() else null end,
    rejection_reason = case when decision = 'rejected' then left(trim(reason), 500) else null end,
    reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now()
  where id = target_organization_id and kind = 'official';
  if not found then raise exception 'Organization not found'; end if;
end;
$$;

drop policy if exists "members can read collections" on public.collections;
create policy "collection participants read collections" on public.collections for select using (
  created_by = auth.uid() or exists (
    select 1 from public.collection_contributors cc where cc.collection_id = id and cc.user_id = auth.uid()
  )
);
drop policy if exists "editors with usernames can manage collections" on public.collections;
drop policy if exists "editors can manage collections" on public.collections;
create policy "collection owners manage collections" on public.collections for all
  using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "participants read collection contributors" on public.collection_contributors;
create policy "participants read collection contributors" on public.collection_contributors for select using (
  user_id = auth.uid() or exists (select 1 from public.collections c where c.id = collection_id and c.created_by = auth.uid())
);
drop policy if exists "owners manage collection contributors" on public.collection_contributors;
create policy "owners manage collection contributors" on public.collection_contributors for all
  using (exists (select 1 from public.collections c where c.id = collection_id and c.created_by = auth.uid()))
  with check (added_by = auth.uid() and exists (select 1 from public.collections c where c.id = collection_id and c.created_by = auth.uid()));

create or replace function public.search_platform_entities(search_term text)
returns table(entity_type text, entity_id uuid, display_name text, secondary_text text)
language sql stable security definer set search_path = '' as $$
  with matches(entity_type, entity_id, display_name, secondary_text, position) as (
    select 'artist'::text, u.user_id, ('@' || u.username)::text, 'Artista o creador'::text, 1
    from public.public_usernames u join public.profiles p on p.id = u.user_id and p.account_status = 'active'
    where u.username ilike '%' || trim(search_term) || '%'
    union all
    select 'organization'::text, o.id, ('@' || o.username)::text, o.name::text, 2
    from public.organizations o join public.profiles p on p.id = o.created_by and p.account_status = 'active'
    where o.kind = 'official' and o.verification_status = 'approved'
      and (o.username ilike '%' || trim(search_term) || '%' or o.name ilike '%' || trim(search_term) || '%')
  )
  select matches.entity_type, matches.entity_id, matches.display_name, matches.secondary_text from matches
  order by matches.position, matches.display_name limit 8;
$$;

grant execute on function public.create_official_organization(text, text, text, text, text) to authenticated;
grant execute on function public.review_organization(uuid, text, text) to authenticated;

comment on table public.collection_contributors is 'Creators invited to add their own Pills to a collection without owning it.';
comment on column public.organizations.kind is 'personal is an internal creator workspace; official is a public organization profile requiring verification.';
