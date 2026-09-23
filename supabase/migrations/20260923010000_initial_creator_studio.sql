create extension if not exists "pgcrypto";

create type public.organization_role as enum ('owner', 'admin', 'editor', 'analyst');
create type public.campaign_status as enum ('draft', 'scheduled', 'active', 'ended', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  verified_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  cover_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  name text not null,
  event_type text not null,
  venue text,
  starts_at timestamptz,
  supply integer not null check (supply > 0),
  status public.campaign_status not null default 'draft',
  artwork_url text,
  stellar_asset_code text,
  stellar_transaction_hash text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_collaborators (
  collection_id uuid not null references public.collections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, organization_id)
);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.collections enable row level security;
alter table public.campaigns enable row level security;
alter table public.collection_collaborators enable row level security;

create function public.is_org_member(target_organization_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id and user_id = auth.uid()
  );
$$;

create function public.can_edit_org(target_organization_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
  );
$$;

create function public.is_org_admin(target_organization_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create policy "users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "members can read organizations" on public.organizations for select using (public.is_org_member(id));
create policy "members can read memberships" on public.organization_members for select using (public.is_org_member(organization_id));
create policy "admins can manage memberships" on public.organization_members for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "members can read collections" on public.collections for select using (public.is_org_member(organization_id));
create policy "editors can manage collections" on public.collections for all using (public.can_edit_org(organization_id)) with check (public.can_edit_org(organization_id));
create policy "members can read campaigns" on public.campaigns for select using (public.is_org_member(organization_id));
create policy "editors can manage campaigns" on public.campaigns for all using (public.can_edit_org(organization_id)) with check (public.can_edit_org(organization_id));
create policy "members can read collaborators" on public.collection_collaborators for select using (
  exists (select 1 from public.collections c where c.id = collection_id and public.is_org_member(c.organization_id))
);
create policy "editors can manage collaborators" on public.collection_collaborators for all using (
  exists (select 1 from public.collections c where c.id = collection_id and public.can_edit_org(c.organization_id))
) with check (
  exists (select 1 from public.collections c where c.id = collection_id and public.can_edit_org(c.organization_id))
);

create function public.create_organization(organization_name text, organization_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_organization_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.organizations (name, slug, created_by)
  values (organization_name, organization_slug, auth.uid()) returning id into new_organization_id;
  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, auth.uid(), 'owner');
  return new_organization_id;
end;
$$;

grant execute on function public.create_organization(text, text) to authenticated;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
