alter table public.campaigns
  add column if not exists approval_email_sent_at timestamptz,
  add column if not exists approval_email_id text;

comment on column public.campaigns.approval_email_sent_at is 'When the creator was notified that this Pill was approved.';
