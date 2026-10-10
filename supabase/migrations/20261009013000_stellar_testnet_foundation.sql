-- Stellar Testnet foundation for Pills.
-- Blockchain work is queued from database events and processed asynchronously.

create sequence if not exists public.pills_token_id_seq
  as bigint minvalue 1 maxvalue 4294967295;

alter table public.campaigns
  add column if not exists content_hash text,
  add column if not exists artwork_frozen_at timestamptz,
  add column if not exists artwork_removed_at timestamptz,
  add column if not exists blockchain_status text not null default 'not_registered',
  add column if not exists blockchain_network text,
  add column if not exists blockchain_contract_address text,
  add column if not exists blockchain_tx_hash text,
  add column if not exists blockchain_ledger bigint,
  add column if not exists blockchain_error text;

do $$ begin
  alter table public.campaigns add constraint campaigns_blockchain_status_check
    check (blockchain_status in ('not_registered', 'pending', 'submitted', 'ready', 'failed'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.campaigns add constraint campaigns_blockchain_network_check
    check (blockchain_network is null or blockchain_network in ('testnet', 'mainnet'));
exception when duplicate_object then null;
end $$;

alter table public.collectible_claims
  add column if not exists edition_number integer,
  add column if not exists token_id bigint,
  add column if not exists network text,
  add column if not exists contract_address text,
  add column if not exists mint_status text not null default 'pending',
  add column if not exists mint_tx_hash text,
  add column if not exists mint_ledger bigint,
  add column if not exists minted_at timestamptz,
  add column if not exists mint_error text,
  add column if not exists burn_tx_hash text,
  add column if not exists burn_ledger bigint,
  add column if not exists burned_at timestamptz,
  add column if not exists visibility text not null default 'active';

with numbered as (
  select
    id,
    row_number() over (partition by campaign_id order by created_at, id)::integer as edition_number,
    row_number() over (order by created_at, id)::bigint as token_id
  from public.collectible_claims
)
update public.collectible_claims claims
set
  edition_number = coalesce(claims.edition_number, numbered.edition_number),
  token_id = coalesce(claims.token_id, numbered.token_id)
from numbered
where claims.id = numbered.id
  and (claims.edition_number is null or claims.token_id is null);

do $$
declare highest_token_id bigint;
begin
  select max(token_id) into highest_token_id from public.collectible_claims;
  if highest_token_id is null then
    perform setval('public.pills_token_id_seq', 1, false);
  else
    perform setval('public.pills_token_id_seq', highest_token_id, true);
  end if;
end $$;

alter table public.collectible_claims
  alter column token_id set default nextval('public.pills_token_id_seq');

do $$ begin
  alter table public.collectible_claims add constraint collectible_claims_edition_positive
    check (edition_number is null or edition_number > 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.collectible_claims add constraint collectible_claims_token_id_range
    check (token_id is null or token_id between 1 and 4294967295);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.collectible_claims add constraint collectible_claims_network_check
    check (network is null or network in ('testnet', 'mainnet'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.collectible_claims add constraint collectible_claims_mint_status_check
    check (mint_status in ('pending', 'waiting_for_wallet', 'submitted', 'minted', 'failed', 'burned'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.collectible_claims add constraint collectible_claims_visibility_check
    check (visibility in ('active', 'hidden', 'burned'));
exception when duplicate_object then null;
end $$;

create unique index if not exists collectible_claims_campaign_edition_unique
  on public.collectible_claims (campaign_id, edition_number)
  where edition_number is not null;
create unique index if not exists collectible_claims_token_unique
  on public.collectible_claims (network, contract_address, token_id)
  where network is not null and contract_address is not null and token_id is not null;
create unique index if not exists collectible_claims_mint_tx_unique
  on public.collectible_claims (mint_tx_hash)
  where mint_tx_hash is not null;

create table if not exists public.stellar_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  network text not null check (network in ('testnet', 'mainnet')),
  deployment_key text not null default 'hackathon-testnet-v1',
  wallet_address text not null,
  wallet_kind text not null default 'smart_wallet' check (wallet_kind in ('smart_wallet', 'stellar_account')),
  status text not null default 'pending' check (status in ('pending', 'deploying', 'active', 'recovery', 'disabled')),
  deployment_tx_hash text,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (user_id, network, deployment_key),
  unique (network, wallet_address)
);

create table if not exists public.nft_contracts (
  id uuid primary key default gen_random_uuid(),
  network text not null check (network in ('testnet', 'mainnet')),
  deployment_key text not null,
  contract_address text not null,
  wasm_hash text not null,
  version text not null,
  deployer_address text not null,
  deployed_tx_hash text not null,
  deployed_ledger bigint,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (network, deployment_key),
  unique (network, contract_address)
);

create table if not exists public.blockchain_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('register_campaign', 'mint', 'burn', 'refresh_status', 'extend_ttl')),
  network text not null check (network in ('testnet', 'mainnet')),
  deployment_key text not null default 'hackathon-testnet-v1',
  campaign_id uuid references public.campaigns(id) on delete cascade,
  claim_id uuid references public.collectible_claims(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'submitted', 'completed', 'retry', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  transaction_hash text,
  ledger bigint,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists blockchain_jobs_ready_idx
  on public.blockchain_jobs (status, available_at, created_at)
  where status in ('pending', 'retry');

alter table public.stellar_wallets enable row level security;
alter table public.nft_contracts enable row level security;
alter table public.blockchain_jobs enable row level security;

drop policy if exists "users read own stellar wallet" on public.stellar_wallets;
create policy "users read own stellar wallet" on public.stellar_wallets for select
  using (user_id = auth.uid());

drop policy if exists "users read active nft contract" on public.nft_contracts;
create policy "users read active nft contract" on public.nft_contracts for select
  using (active);

create or replace function public.prepare_stellar_campaign_job()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.review_status = 'approved'
    and (tg_op = 'INSERT' or old.review_status is distinct from 'approved') then
    update public.campaigns
    set blockchain_status = 'pending', blockchain_network = 'testnet'
    where id = new.id;
    insert into public.blockchain_jobs (
      job_type, network, campaign_id, user_id, idempotency_key, payload
    ) values (
      'register_campaign',
      'testnet',
      new.id,
      new.created_by,
      'testnet:register_campaign:' || new.id::text,
      jsonb_build_object('campaign_id', new.id)
    ) on conflict (idempotency_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_stellar_campaign_job on public.campaigns;
create trigger prepare_stellar_campaign_job
after insert or update of review_status on public.campaigns
for each row execute function public.prepare_stellar_campaign_job();

create or replace function public.prepare_stellar_claim_job()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.campaigns where id = new.campaign_id for update;
  if new.edition_number is null then
    select coalesce(max(edition_number), 0) + 1
      into new.edition_number
    from public.collectible_claims
    where campaign_id = new.campaign_id;
  end if;
  if new.token_id is null then
    new.token_id := nextval('public.pills_token_id_seq');
  end if;
  new.network := coalesce(new.network, 'testnet');
  new.mint_status := coalesce(new.mint_status, 'pending');
  return new;
end;
$$;

drop trigger if exists prepare_stellar_claim on public.collectible_claims;
create trigger prepare_stellar_claim
before insert on public.collectible_claims
for each row execute function public.prepare_stellar_claim_job();

create or replace function public.enqueue_stellar_claim_job()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.blockchain_jobs (
    job_type, network, campaign_id, claim_id, user_id, idempotency_key, payload
  ) values (
    'mint',
    coalesce(new.network, 'testnet'),
    new.campaign_id,
    new.id,
    new.collector_id,
    coalesce(new.network, 'testnet') || ':mint:' || new.id::text,
    jsonb_build_object(
      'campaign_id', new.campaign_id,
      'claim_id', new.id,
      'token_id', new.token_id,
      'edition_number', new.edition_number
    )
  ) on conflict (idempotency_key) do nothing;
  return new;
end;
$$;

drop trigger if exists enqueue_stellar_claim_job on public.collectible_claims;
create trigger enqueue_stellar_claim_job
after insert on public.collectible_claims
for each row execute function public.enqueue_stellar_claim_job();

insert into public.blockchain_jobs (
  job_type, network, campaign_id, user_id, idempotency_key, payload
)
select
  'register_campaign', 'testnet', c.id, c.created_by,
  'testnet:register_campaign:' || c.id::text,
  jsonb_build_object('campaign_id', c.id)
from public.campaigns c
where c.review_status = 'approved'
on conflict (idempotency_key) do nothing;

update public.campaigns
set blockchain_status = 'pending', blockchain_network = 'testnet'
where review_status = 'approved' and blockchain_status = 'not_registered';

insert into public.blockchain_jobs (
  job_type, network, campaign_id, claim_id, user_id, idempotency_key, payload
)
select
  'mint', 'testnet', cl.campaign_id, cl.id, cl.collector_id,
  'testnet:mint:' || cl.id::text,
  jsonb_build_object(
    'campaign_id', cl.campaign_id,
    'claim_id', cl.id,
    'token_id', cl.token_id,
    'edition_number', cl.edition_number
  )
from public.collectible_claims cl
on conflict (idempotency_key) do nothing;

update public.collectible_claims
set network = 'testnet'
where network is null;

comment on table public.blockchain_jobs is
  'Idempotent outbox for asynchronous Stellar contract work. Service-role access only.';
comment on column public.stellar_wallets.deployment_key is
  'Separates disposable hackathon/testnet state from later pilots and mainnet.';

insert into public.nft_contracts (
  network,
  deployment_key,
  contract_address,
  wasm_hash,
  version,
  deployer_address,
  deployed_tx_hash,
  active
) values (
  'testnet',
  'hackathon-testnet-v1',
  'CD3TDAKQK2TXG2TXT7V3DU4MOHL3AYP7LBRKNBD7LDQDHYTSZA6W7JGN',
  'ab54a3d7db69ddf6a00169be4f6afae5797c267584a03ceb13cbc95e3c84d168',
  '0.1.0',
  'GDMXTP32767IZXLTUOX3AD6CHZK3IYU2BYY7YK7J4SH6P2ODBPAM3ERQ',
  '7fe13d5ae964d78137b17353f0eadee341fd22d7ed3bce4d8c8ab417b843f2cf',
  true
) on conflict (network, deployment_key) do update set
  contract_address = excluded.contract_address,
  wasm_hash = excluded.wasm_hash,
  version = excluded.version,
  deployer_address = excluded.deployer_address,
  deployed_tx_hash = excluded.deployed_tx_hash,
  active = true;

create or replace function public.claim_next_blockchain_job(
  worker_id text,
  target_network text default 'testnet'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare selected_job public.blockchain_jobs;
begin
  select * into selected_job
  from public.blockchain_jobs
  where network = target_network
    and status in ('pending', 'retry')
    and available_at <= now()
  order by created_at
  for update skip locked
  limit 1;

  if selected_job.id is null then return null; end if;

  update public.blockchain_jobs
  set
    status = 'processing',
    attempts = attempts + 1,
    locked_at = now(),
    locked_by = left(worker_id, 120),
    updated_at = now()
  where id = selected_job.id
  returning * into selected_job;

  return to_jsonb(selected_job);
end;
$$;

revoke all on function public.claim_next_blockchain_job(text, text) from public, anon, authenticated;
