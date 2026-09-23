do $$ begin
  create type public.collectible_review_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

alter table public.campaigns
  add column if not exists description text,
  add column if not exists event_url text,
  add column if not exists ends_at timestamptz,
  add column if not exists audience text not null default 'Asistentes',
  add column if not exists tags text[] not null default '{}',
  add column if not exists qr_enabled boolean not null default true,
  add column if not exists qr_token text unique,
  add column if not exists qr_token_hash text,
  add column if not exists secret_word_hash text,
  add column if not exists review_status public.collectible_review_status not null default 'pending',
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists rejection_reason text,
  add column if not exists claimed_count integer not null default 0 check (claimed_count >= 0),
  add column if not exists first_claimed_at timestamptz;

create table if not exists public.app_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin', 'curator')),
  created_at timestamptz not null default now()
);

insert into public.app_admins (user_id, role)
select u.id, 'super_admin'
from auth.users u
left join public.public_usernames n on n.user_id = u.id
where lower(u.email) = 'fabiobuscio97@gmail.com' or lower(n.username) = 'fabit'
on conflict (user_id) do update set role = 'super_admin';

create table if not exists public.campaign_collaborators (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table if not exists public.collectible_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  collector_id uuid not null references public.profiles(id) on delete cascade,
  method text not null check (method in ('qr', 'secret', 'admin_link')),
  created_at timestamptz not null default now(),
  unique (campaign_id, collector_id)
);

alter table public.app_admins enable row level security;
alter table public.campaign_collaborators enable row level security;
alter table public.collectible_claims enable row level security;

create or replace function public.is_pills_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

create or replace function public.can_manage_campaign(target_campaign_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = target_campaign_id
      and (
        c.created_by = auth.uid()
        or public.is_pills_admin()
        or exists (
          select 1 from public.campaign_collaborators cc
          where cc.campaign_id = c.id and cc.user_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists "admins read admin roles" on public.app_admins;
create policy "admins read admin roles" on public.app_admins for select
  using (user_id = auth.uid() or public.is_pills_admin());

drop policy if exists "campaign managers read collaborators" on public.campaign_collaborators;
create policy "campaign managers read collaborators" on public.campaign_collaborators for select
  using (public.can_manage_campaign(campaign_id));

drop policy if exists "campaign owners add collaborators" on public.campaign_collaborators;
create policy "campaign owners add collaborators" on public.campaign_collaborators for insert
  with check (
    added_by = auth.uid()
    and exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = auth.uid())
  );

drop policy if exists "campaign owners remove collaborators" on public.campaign_collaborators;
create policy "campaign owners remove collaborators" on public.campaign_collaborators for delete
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = auth.uid()));

drop policy if exists "members can read campaigns" on public.campaigns;
drop policy if exists "editors with usernames can manage campaigns" on public.campaigns;
drop policy if exists "campaign participants read campaigns" on public.campaigns;
drop policy if exists "creators insert campaigns" on public.campaigns;
drop policy if exists "campaign managers update campaigns" on public.campaigns;

create policy "campaign participants read campaigns" on public.campaigns for select
  using (public.can_manage_campaign(id) or public.is_org_member(organization_id));

create policy "creators insert campaigns" on public.campaigns for insert
  with check (created_by = auth.uid() and public.can_edit_org(organization_id) and public.has_creator_username());

create policy "campaign managers update campaigns" on public.campaigns for update
  using (public.can_manage_campaign(id)) with check (public.can_manage_campaign(id));

drop policy if exists "collectors read own claims" on public.collectible_claims;
create policy "collectors read own claims" on public.collectible_claims for select
  using (collector_id = auth.uid() or public.can_manage_campaign(campaign_id));

create or replace function public.claim_collectible(target_campaign_id uuid, claim_method text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target public.campaigns; new_claim_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into target from public.campaigns where id = target_campaign_id for update;
  if target.id is null or target.review_status <> 'approved' then raise exception 'Collectible unavailable'; end if;
  if target.starts_at is not null and now() < target.starts_at then raise exception 'Collection has not started'; end if;
  if target.ends_at is not null and now() > target.ends_at then raise exception 'Collection has ended'; end if;
  if target.claimed_count >= target.supply then raise exception 'Supply exhausted'; end if;
  insert into public.collectible_claims (campaign_id, collector_id, method)
  values (target_campaign_id, auth.uid(), claim_method) returning id into new_claim_id;
  update public.campaigns set claimed_count = claimed_count + 1,
    first_claimed_at = coalesce(first_claimed_at, now()), updated_at = now()
  where id = target_campaign_id;
  return new_claim_id;
end;
$$;

create or replace function public.claim_collectible_by_qr(provided_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare campaign_id uuid;
begin
  select id into campaign_id from public.campaigns
  where qr_enabled and qr_token_hash = encode(digest(provided_token, 'sha256'), 'hex');
  if campaign_id is null then raise exception 'Invalid QR'; end if;
  return public.claim_collectible(campaign_id, 'qr');
end;
$$;

create or replace function public.claim_collectible_by_secret(target_campaign_id uuid, provided_secret text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.campaigns where id = target_campaign_id
      and secret_word_hash = encode(digest(lower(trim(provided_secret)), 'sha256'), 'hex')
  ) then raise exception 'Invalid secret phrase'; end if;
  return public.claim_collectible(target_campaign_id, 'secret');
end;
$$;

grant execute on function public.claim_collectible_by_qr(text) to authenticated;
grant execute on function public.claim_collectible_by_secret(uuid, text) to authenticated;

create or replace function public.protect_collectible_after_creation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_pills_admin() then
    new.updated_at := now();
    return new;
  end if;

  if new.event_type is distinct from old.event_type
    or new.venue is distinct from old.venue
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.supply is distinct from old.supply
    or new.artwork_url is distinct from old.artwork_url
    or new.event_url is distinct from old.event_url
    or new.audience is distinct from old.audience
    or new.tags is distinct from old.tags
    or new.qr_enabled is distinct from old.qr_enabled
    or new.secret_word_hash is distinct from old.secret_word_hash
    or new.review_status is distinct from old.review_status
    or new.status is distinct from old.status then
      raise exception 'Only title and description can be edited after submission';
  end if;

  if (old.claimed_count > 0 or old.first_claimed_at is not null)
    and (new.name is distinct from old.name or new.description is distinct from old.description) then
      raise exception 'This collectible is locked after its first collection';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_collectible_after_creation on public.campaigns;
create trigger protect_collectible_after_creation
before update on public.campaigns for each row execute function public.protect_collectible_after_creation();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('collectible-artwork', 'collectible-artwork', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'];

drop policy if exists "creators upload collectible artwork" on storage.objects;
create policy "creators upload collectible artwork" on storage.objects for insert to authenticated
  with check (bucket_id = 'collectible-artwork' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "public reads collectible artwork" on storage.objects;
create policy "public reads collectible artwork" on storage.objects for select to anon, authenticated
  using (bucket_id = 'collectible-artwork');

comment on table public.campaign_collaborators is
  'Creators who can manage a collectible when the original creator is unavailable.';
comment on column public.campaigns.review_status is
  'QR and secret-word distribution are unavailable until a curator approves the collectible.';
comment on column public.campaigns.first_claimed_at is
  'Once set, title and description become immutable.';
