alter table public.stellar_wallets
  add column if not exists wallet_provider text not null default 'passkey',
  add column if not exists provider_user_id text,
  add column if not exists provider_wallet_id text;

alter table public.stellar_wallets
  drop constraint if exists stellar_wallets_wallet_provider_check;

alter table public.stellar_wallets
  add constraint stellar_wallets_wallet_provider_check
  check (wallet_provider in ('passkey', 'privy'));

create unique index if not exists stellar_wallets_provider_wallet_unique
  on public.stellar_wallets (wallet_provider, provider_wallet_id)
  where provider_wallet_id is not null;

comment on column public.stellar_wallets.wallet_provider is
  'Key infrastructure provider. Privy wallets are created server-side after Pills authentication.';
comment on column public.stellar_wallets.provider_user_id is
  'Privy user identifier. Never contains a private key, seed phrase, OTP, or email address.';
comment on column public.stellar_wallets.provider_wallet_id is
  'Privy wallet identifier used for support and recovery. The public Stellar address is stored separately.';
