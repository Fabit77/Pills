alter table public.app_admins drop constraint if exists app_admins_role_check;
alter table public.app_admins add constraint app_admins_role_check
  check (role in ('super_admin', 'curator', 'admin'));

create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.app_admins where user_id = auth.uid();
$$;

create or replace function public.is_pills_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'super_admin', false);
$$;

create or replace function public.can_curate_pills()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() in ('super_admin', 'curator', 'admin'), false);
$$;

create or replace function public.is_pills_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() in ('super_admin', 'admin'), false);
$$;

drop policy if exists "campaign participants read campaigns" on public.campaigns;
create policy "campaign participants read campaigns" on public.campaigns for select
  using (public.can_manage_campaign(id) or public.is_org_member(organization_id) or public.can_curate_pills());

create or replace function public.review_collectible(
  target_campaign_id uuid,
  review_decision text,
  review_reason text default null
) returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text;
begin
  if not public.can_curate_pills() then raise exception 'Curator access required'; end if;
  if review_decision not in ('approved', 'rejected') then raise exception 'Invalid review decision'; end if;
  if review_decision = 'rejected' and nullif(trim(review_reason), '') is null then raise exception 'Rejection reason required'; end if;
  if not exists (select 1 from public.campaigns where id = target_campaign_id) then raise exception 'Collectible not found'; end if;

  if review_decision = 'approved' then raw_token := encode(extensions.gen_random_bytes(24), 'hex'); end if;
  update public.campaigns set
    review_status = review_decision::public.collectible_review_status,
    reviewed_at = now(), reviewed_by = auth.uid(),
    rejection_reason = case when review_decision = 'rejected' then left(trim(review_reason), 500) else null end,
    qr_token = raw_token,
    qr_token_hash = case when raw_token is null then null else encode(extensions.digest(raw_token, 'sha256'), 'hex') end,
    status = case when review_decision = 'approved' then 'scheduled'::public.campaign_status else 'draft'::public.campaign_status end,
    updated_at = now()
  where id = target_campaign_id;
  return raw_token;
end;
$$;

create or replace function public.protect_collectible_after_creation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.can_curate_pills() then
    new.updated_at := now();
    return new;
  end if;
  if new.event_type is distinct from old.event_type or new.venue is distinct from old.venue
    or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
    or new.supply is distinct from old.supply or new.artwork_url is distinct from old.artwork_url
    or new.event_url is distinct from old.event_url or new.audience is distinct from old.audience
    or new.tags is distinct from old.tags or new.qr_enabled is distinct from old.qr_enabled
    or new.secret_word_hash is distinct from old.secret_word_hash or new.review_status is distinct from old.review_status
    or new.status is distinct from old.status then
      raise exception 'Only title and description can be edited after submission';
  end if;
  if (old.claimed_count > 0 or old.first_claimed_at is not null)
    and (new.name is distinct from old.name or new.description is distinct from old.description) then
      raise exception 'This collectible is locked after its first collection';
  end if;
  new.updated_at := now(); return new;
end;
$$;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_pills_super_admin() to authenticated;
grant execute on function public.can_curate_pills() to authenticated;
grant execute on function public.review_collectible(uuid, text, text) to authenticated;

comment on table public.app_admins is
  'Administrative access. super_admin has full control, curator reviews content, and admin manages operations.';
