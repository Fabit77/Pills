create or replace function public.create_own_collectible(
  target_organization_id uuid,
  collectible_name text,
  collectible_description text,
  collectible_city text,
  collectible_starts_at timestamptz,
  collectible_ends_at timestamptz,
  collectible_event_url text,
  collectible_supply integer,
  collectible_artwork_url text,
  collectible_qr_enabled boolean,
  collectible_secret_word_hash text,
  collectible_public_slug text,
  submit_for_review boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_collectible_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_creator_username() then
    raise exception 'Creator username required';
  end if;

  if not public.can_edit_org(target_organization_id) then
    raise exception 'Creator workspace access required';
  end if;

  insert into public.campaigns (
    organization_id,
    name,
    description,
    event_type,
    venue,
    starts_at,
    ends_at,
    event_url,
    tags,
    supply,
    audience,
    status,
    artwork_url,
    qr_enabled,
    secret_word_hash,
    public_slug,
    review_status,
    submitted_at,
    created_by
  ) values (
    target_organization_id,
    left(trim(collectible_name), 150),
    left(trim(collectible_description), 1500),
    'Experiencia',
    left(trim(collectible_city), 180),
    collectible_starts_at,
    collectible_ends_at,
    collectible_event_url,
    array[]::text[],
    greatest(1, least(collectible_supply, 100)),
    'Cualquier persona',
    'draft',
    collectible_artwork_url,
    collectible_qr_enabled,
    collectible_secret_word_hash,
    lower(trim(collectible_public_slug)),
    'pending',
    case when submit_for_review then now() else null end,
    auth.uid()
  ) returning id into new_collectible_id;

  return new_collectible_id;
end;
$$;

revoke all on function public.create_own_collectible(uuid, text, text, text, timestamptz, timestamptz, text, integer, text, boolean, text, text, boolean) from public;
grant execute on function public.create_own_collectible(uuid, text, text, text, timestamptz, timestamptz, text, integer, text, boolean, text, text, boolean) to authenticated;

comment on function public.create_own_collectible(uuid, text, text, text, timestamptz, timestamptz, text, integer, text, boolean, text, text, boolean) is
  'Creates a Pill for the authenticated creator after checking username and workspace ownership.';
