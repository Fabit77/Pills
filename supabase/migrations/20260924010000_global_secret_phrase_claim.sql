create or replace function public.claim_collectible_by_secret_phrase(provided_secret text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  matching_campaign_id uuid;
  matching_count integer;
begin
  select count(*), (array_agg(c.id))[1]
    into matching_count, matching_campaign_id
  from public.campaigns c
  where c.review_status = 'approved'
    and c.secret_word_hash = encode(extensions.digest(lower(trim(provided_secret)), 'sha256'), 'hex')
    and (c.starts_at is null or now() >= c.starts_at)
    and (c.ends_at is null or now() <= c.ends_at)
    and c.claimed_count < c.supply;

  if matching_count = 0 then raise exception 'Invalid secret phrase'; end if;
  if matching_count > 1 then raise exception 'Multiple collectibles use this secret phrase'; end if;
  return public.claim_collectible(matching_campaign_id, 'secret');
end;
$$;

grant execute on function public.claim_collectible_by_secret_phrase(text) to authenticated;

comment on function public.claim_collectible_by_secret_phrase(text) is
  'Claims the single active approved collectible matching a secret phrase without requiring its campaign URL.';
