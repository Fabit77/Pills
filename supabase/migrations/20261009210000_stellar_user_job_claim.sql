-- Allows an authenticated account to request immediate processing of only its
-- own mint queue. The API calls this function with the service role after it
-- has independently verified the Supabase session.

create or replace function public.claim_next_blockchain_job_for_user(
  worker_id text,
  target_user uuid,
  target_network text default 'testnet'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare selected_job public.blockchain_jobs;
begin
  select * into selected_job
  from public.blockchain_jobs
  where network = target_network
    and user_id = target_user
    and job_type = 'mint'
    and status in ('pending', 'retry', 'failed')
    and (status = 'failed' or available_at <= now())
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

revoke all on function public.claim_next_blockchain_job_for_user(text, uuid, text)
  from public, anon, authenticated;
