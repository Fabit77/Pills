alter table public.campaign_collaborators
  add column if not exists role text not null default 'admin';

alter table public.campaign_collaborators drop constraint if exists campaign_collaborators_role_check;
alter table public.campaign_collaborators add constraint campaign_collaborators_role_check
  check (role in ('admin', 'reader'));

alter table public.collectible_admin_links
  add column if not exists token_value_encrypted text;

create table if not exists public.campaign_secrets (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  secret_word_encrypted text not null,
  created_at timestamptz not null default now()
);

alter table public.campaign_secrets enable row level security;

create or replace function public.can_view_campaign(target_campaign_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = target_campaign_id and (
      c.created_by = auth.uid()
      or public.can_curate_pills()
      or public.is_org_member(c.organization_id)
      or exists (
        select 1 from public.campaign_collaborators cc
        where cc.campaign_id = c.id and cc.user_id = auth.uid()
      )
    )
  );
$$;

create or replace function public.can_manage_campaign(target_campaign_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = target_campaign_id and (
      c.created_by = auth.uid()
      or public.is_pills_admin()
      or exists (
        select 1 from public.campaign_collaborators cc
        where cc.campaign_id = c.id and cc.user_id = auth.uid() and cc.role = 'admin'
      )
    )
  );
$$;

drop policy if exists "campaign participants read campaigns" on public.campaigns;
create policy "campaign viewers read campaigns" on public.campaigns for select
  using (public.can_view_campaign(id));

drop policy if exists "campaign managers read collaborators" on public.campaign_collaborators;
create policy "campaign viewers read managers" on public.campaign_collaborators for select
  using (public.can_view_campaign(campaign_id));

drop policy if exists "campaign owners add collaborators" on public.campaign_collaborators;
drop policy if exists "campaign owners remove collaborators" on public.campaign_collaborators;
create policy "campaign managers add managers" on public.campaign_collaborators for insert
  with check (public.can_manage_campaign(campaign_id) and added_by = auth.uid());
create policy "campaign managers update managers" on public.campaign_collaborators for update
  using (public.can_manage_campaign(campaign_id)) with check (public.can_manage_campaign(campaign_id));
create policy "campaign managers remove managers" on public.campaign_collaborators for delete
  using (public.can_manage_campaign(campaign_id));

drop policy if exists "collectors read own claims" on public.collectible_claims;
create policy "collectors and campaign viewers read claims" on public.collectible_claims for select
  using (collector_id = auth.uid() or public.can_view_campaign(campaign_id));

drop policy if exists "campaign managers manage individual links" on public.collectible_admin_links;
create policy "campaign viewers read individual links" on public.collectible_admin_links for select
  using (public.can_view_campaign(campaign_id));
create policy "campaign managers create individual links" on public.collectible_admin_links for insert
  with check (public.can_manage_campaign(campaign_id) and created_by = auth.uid());
create policy "campaign managers update individual links" on public.collectible_admin_links for update
  using (public.can_manage_campaign(campaign_id)) with check (public.can_manage_campaign(campaign_id));
create policy "campaign managers delete individual links" on public.collectible_admin_links for delete
  using (public.can_manage_campaign(campaign_id));

create policy "campaign viewers read private phrase" on public.campaign_secrets for select
  using (public.can_view_campaign(campaign_id));
create policy "campaign managers create private phrase" on public.campaign_secrets for insert
  with check (public.can_manage_campaign(campaign_id));
create policy "campaign managers update private phrase" on public.campaign_secrets for update
  using (public.can_manage_campaign(campaign_id)) with check (public.can_manage_campaign(campaign_id));

create or replace function public.delete_own_draft_collectible(target_campaign_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare deleted_artwork text;
begin
  delete from public.campaigns
  where id = target_campaign_id and created_by = auth.uid() and status = 'draft' and claimed_count = 0
  returning artwork_url into deleted_artwork;
  if not found then raise exception 'Only the creator can delete an uncollected draft'; end if;
  return deleted_artwork;
end;
$$;

grant execute on function public.can_view_campaign(uuid) to authenticated;
grant execute on function public.delete_own_draft_collectible(uuid) to authenticated;

comment on column public.campaign_collaborators.role is
  'admin can manage the Pill; reader can inspect analytics and distribution without making changes.';
comment on table public.campaign_secrets is
  'Server-encrypted recoverable distribution phrases, readable only by authorized campaign viewers.';
