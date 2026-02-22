-- Orbit Phase 18: Live offerwall reward ingestion (AdGate-compatible)
-- Adds callback-safe reward ledger + atomic wallet credit RPC.

create table if not exists public.offerwall_reward_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  conversion_id text not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reward_points integer not null,
  payout_usd_cents integer not null default 0,
  offer_name text,
  state text not null default 'approved',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint offerwall_reward_events_provider_check check (length(trim(provider)) > 0),
  constraint offerwall_reward_events_conversion_check check (length(trim(conversion_id)) > 0),
  constraint offerwall_reward_events_reward_check check (reward_points > 0),
  constraint offerwall_reward_events_payout_check check (payout_usd_cents >= 0),
  unique (provider, conversion_id)
);

create index if not exists idx_offerwall_reward_events_profile_created
  on public.offerwall_reward_events (profile_id, created_at desc);

create or replace function public.orbit_apply_offerwall_reward(
  p_provider text,
  p_conversion_id text,
  p_profile_id uuid,
  p_reward_points integer,
  p_payout_usd_cents integer default 0,
  p_offer_name text default null,
  p_state text default 'approved',
  p_payload jsonb default '{}'::jsonb
)
returns table (
  applied boolean,
  balance integer,
  rewarded integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_provider text;
  normalized_conversion text;
  normalized_state text;
  event_id uuid;
  wallet_row public.profile_wallets%rowtype;
begin
  normalized_provider := upper(trim(coalesce(p_provider, '')));
  normalized_conversion := trim(coalesce(p_conversion_id, ''));
  normalized_state := lower(trim(coalesce(p_state, 'approved')));

  if normalized_provider = '' then
    raise exception 'Provider is required';
  end if;
  if normalized_conversion = '' then
    raise exception 'Conversion id is required';
  end if;
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;
  if p_reward_points is null or p_reward_points <= 0 then
    raise exception 'Reward points must be positive';
  end if;

  perform public.ensure_profile_monetization(p_profile_id);

  insert into public.offerwall_reward_events (
    provider,
    conversion_id,
    profile_id,
    reward_points,
    payout_usd_cents,
    offer_name,
    state,
    payload
  )
  values (
    normalized_provider,
    normalized_conversion,
    p_profile_id,
    p_reward_points,
    greatest(coalesce(p_payout_usd_cents, 0), 0),
    nullif(trim(coalesce(p_offer_name, '')), ''),
    normalized_state,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (provider, conversion_id) do nothing
  returning id into event_id;

  if event_id is null then
    select *
    into wallet_row
    from public.profile_wallets
    where profile_id = p_profile_id;

    return query
    select false, coalesce(wallet_row.starbits_balance, 0), 0;
    return;
  end if;

  update public.profile_wallets
  set
    starbits_balance = starbits_balance + p_reward_points,
    lifetime_earned = lifetime_earned + p_reward_points,
    updated_at = now()
  where profile_id = p_profile_id
  returning * into wallet_row;

  insert into public.profile_wallet_transactions (
    profile_id,
    amount,
    reason,
    metadata,
    balance_after
  )
  values (
    p_profile_id,
    p_reward_points,
    'OFFERWALL_REWARD',
    jsonb_build_object(
      'provider', normalized_provider,
      'conversion_id', normalized_conversion,
      'offer_name', nullif(trim(coalesce(p_offer_name, '')), ''),
      'payout_usd_cents', greatest(coalesce(p_payout_usd_cents, 0), 0),
      'state', normalized_state
    ),
    wallet_row.starbits_balance
  );

  return query
  select true, wallet_row.starbits_balance, p_reward_points;
end;
$$;

alter table public.offerwall_reward_events enable row level security;

drop policy if exists "offerwall_reward_events_select_own" on public.offerwall_reward_events;
create policy "offerwall_reward_events_select_own"
on public.offerwall_reward_events
for select
to authenticated
using (profile_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.offerwall_reward_events;
exception when duplicate_object then null;
end $$;
