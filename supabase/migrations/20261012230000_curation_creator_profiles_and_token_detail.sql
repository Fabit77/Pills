-- Give collectors the on-chain identity of their concrete Pill edition and
-- keep a private audit trail for curator-to-creator questions.

create table if not exists public.curation_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 140),
  message text not null check (char_length(message) between 10 and 3000),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  delivery_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists curation_messages_recipient_idx
  on public.curation_messages (recipient_id, created_at desc);
create index if not exists curation_messages_campaign_idx
  on public.curation_messages (campaign_id, created_at desc);

alter table public.curation_messages enable row level security;

comment on table public.curation_messages is
  'Private audit log of questions sent by Pills curators to creators. Email addresses are never exposed to the browser.';

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
    'edition_number', coalesce(cl.edition_number, (
      select count(*) from public.collectible_claims previous
      where previous.campaign_id = cl.campaign_id
        and (previous.created_at, previous.id) <= (cl.created_at, cl.id)
    )),
    'claimed_count', (
      select count(*) from public.collectible_claims current_claims
      where current_claims.campaign_id = cl.campaign_id
    ),
    'token_id', cl.token_id,
    'mint_status', cl.mint_status,
    'mint_tx_hash', cl.mint_tx_hash,
    'network', cl.network,
    'contract_address', cl.contract_address,
    'artists', coalesce((
      select jsonb_agg(a.display_name order by a.display_name)
      from public.campaign_attributions a
      where a.campaign_id = c.id and a.entity_type = 'artist'
    ), '[]'::jsonb),
    'organizations', coalesce((
      select jsonb_agg(o.name order by o.name)
      from public.campaign_attributions a
      join public.organizations o on o.id = a.entity_id
      where a.campaign_id = c.id
        and a.entity_type = 'organization'
        and o.kind = 'official'
        and o.verification_status = 'approved'
    ), '[]'::jsonb)
  )
  from public.collectible_claims cl
  join public.campaigns c on c.id = cl.campaign_id
  where cl.id = target_claim_id and cl.collector_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_pill_detail(uuid) from public;
grant execute on function public.get_my_pill_detail(uuid) to authenticated;

comment on function public.get_my_pill_detail(uuid) is
  'Returns an owned Pill, its approved attributions, and the blockchain identity of that concrete edition.';
