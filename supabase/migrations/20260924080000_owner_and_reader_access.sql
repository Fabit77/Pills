alter table public.campaigns alter column submitted_at drop not null;

update public.campaign_collaborators set role = 'reader' where role <> 'reader';
alter table public.campaign_collaborators alter column role set default 'reader';
alter table public.campaign_collaborators drop constraint if exists campaign_collaborators_role_check;
alter table public.campaign_collaborators add constraint campaign_collaborators_role_check
  check (role = 'reader');

create or replace function public.can_manage_campaign(target_campaign_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = target_campaign_id
      and (c.created_by = auth.uid() or public.is_pills_admin())
  );
$$;

drop policy if exists "campaign managers add managers" on public.campaign_collaborators;
drop policy if exists "campaign managers update managers" on public.campaign_collaborators;
drop policy if exists "campaign managers remove managers" on public.campaign_collaborators;
drop policy if exists "campaign owners add readers" on public.campaign_collaborators;
drop policy if exists "campaign owners remove readers" on public.campaign_collaborators;
create policy "campaign owners add readers" on public.campaign_collaborators for insert
  with check (
    role = 'reader' and added_by = auth.uid()
    and exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = auth.uid())
  );
create policy "campaign owners remove readers" on public.campaign_collaborators for delete
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = auth.uid()));

drop policy if exists "campaign owners delete private phrase" on public.campaign_secrets;
create policy "campaign owners delete private phrase" on public.campaign_secrets for delete
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = auth.uid()));

create or replace function public.submit_own_collectible(target_campaign_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.campaigns set
    submitted_at = now(), review_status = 'pending', rejection_reason = null,
    reviewed_at = null, reviewed_by = null, status = 'draft', updated_at = now()
  where id = target_campaign_id and created_by = auth.uid()
    and claimed_count = 0 and first_claimed_at is null;
  if not found then raise exception 'Only the creator can submit an uncollected Pill'; end if;
end;
$$;

create or replace function public.withdraw_own_collectible(target_campaign_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.campaigns set
    submitted_at = null, review_status = 'pending', rejection_reason = null,
    reviewed_at = null, reviewed_by = null, qr_token = null, qr_token_hash = null,
    status = 'draft', is_paused = false, paused_at = null, paused_by = null, updated_at = now()
  where id = target_campaign_id and created_by = auth.uid()
    and review_status in ('pending', 'rejected') and claimed_count = 0 and first_claimed_at is null;
  if not found then raise exception 'This Pill cannot return to draft'; end if;
end;
$$;

create or replace function public.revise_own_approved_collectible(
  target_campaign_id uuid, new_name text, new_description text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.campaigns set
    name = left(trim(new_name), 150), description = left(trim(new_description), 1500),
    review_status = 'pending', submitted_at = now(), reviewed_at = null, reviewed_by = null,
    rejection_reason = null, qr_token = null, qr_token_hash = null,
    status = 'draft', is_paused = false, paused_at = null, paused_by = null, updated_at = now()
  where id = target_campaign_id and created_by = auth.uid()
    and review_status = 'approved' and claimed_count = 0 and first_claimed_at is null
    and nullif(trim(new_name), '') is not null and nullif(trim(new_description), '') is not null;
  if not found then raise exception 'This approved Pill cannot be revised'; end if;
end;
$$;

create or replace function public.protect_collectible_after_creation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_pills_admin() then
    new.updated_at := now();
    return new;
  end if;

  if old.created_by = auth.uid() and old.submitted_at is null
    and old.claimed_count = 0 and old.first_claimed_at is null then
    new.created_by := old.created_by;
    new.organization_id := old.organization_id;
    new.claimed_count := old.claimed_count;
    new.first_claimed_at := old.first_claimed_at;
    new.updated_at := now();
    return new;
  end if;

  if old.created_by = auth.uid() and new.submitted_at is null
    and old.review_status in ('pending', 'rejected') and new.review_status = 'pending'
    and old.claimed_count = 0 and old.first_claimed_at is null then
    new.updated_at := now();
    return new;
  end if;

  if old.created_by = auth.uid() and old.review_status = 'approved' and new.review_status = 'pending'
    and old.claimed_count = 0 and old.first_claimed_at is null
    and new.event_type is not distinct from old.event_type
    and new.venue is not distinct from old.venue
    and new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at
    and new.supply is not distinct from old.supply
    and new.artwork_url is not distinct from old.artwork_url
    and new.event_url is not distinct from old.event_url
    and new.audience is not distinct from old.audience
    and new.tags is not distinct from old.tags
    and new.qr_enabled is not distinct from old.qr_enabled
    and new.secret_word_hash is not distinct from old.secret_word_hash then
    new.updated_at := now();
    return new;
  end if;

  if (old.claimed_count > 0 or old.first_claimed_at is not null)
    and (new.name is distinct from old.name or new.description is distinct from old.description) then
      raise exception 'This collectible is locked after its first collection';
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
    or new.submitted_at is distinct from old.submitted_at
    or new.review_status is distinct from old.review_status
    or new.status is distinct from old.status then
      raise exception 'Only title and description can be edited after submission';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.delete_own_draft_collectible(target_campaign_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare deleted_artwork text;
begin
  delete from public.campaigns
  where id = target_campaign_id and created_by = auth.uid()
    and submitted_at is null and status = 'draft' and claimed_count = 0
  returning artwork_url into deleted_artwork;
  if not found then raise exception 'Only the creator can delete an unsubmitted draft'; end if;
  return deleted_artwork;
end;
$$;

grant execute on function public.submit_own_collectible(uuid) to authenticated;
grant execute on function public.withdraw_own_collectible(uuid) to authenticated;
grant execute on function public.revise_own_approved_collectible(uuid, text, text) to authenticated;

comment on table public.campaign_collaborators is
  'Read-only access granted by the Pill creator. Ownership and management cannot be delegated.';
comment on column public.campaign_collaborators.role is
  'Always reader. The campaign creator is the sole owner.';
