alter table public.campaigns
  add column if not exists ends_at timestamptz,
  add column if not exists qr_enabled boolean not null default true,
  add column if not exists qr_token_hash text,
  add column if not exists secret_word_hash text;

alter table public.campaigns
  add constraint campaigns_valid_window
  check (ends_at is null or starts_at is null or ends_at > starts_at);

create table if not exists public.collectible_admin_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  token_hash text not null unique,
  recipient_label text,
  created_by uuid not null references public.profiles(id),
  redeemed_by uuid references public.profiles(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.collectible_admin_links enable row level security;

create policy "campaign admins manage individual links"
on public.collectible_admin_links for all
using (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_id and public.can_edit_org(c.organization_id)
  )
)
with check (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_id and public.can_edit_org(c.organization_id)
  )
);

comment on column public.campaigns.ends_at is
  'QR and secret-word collection stop after this timestamp.';
comment on table public.collectible_admin_links is
  'Unique one-to-one claim links created by collectible admins. They do not expire and can be redeemed once.';
