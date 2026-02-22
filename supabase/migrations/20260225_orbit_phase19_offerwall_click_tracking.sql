-- Orbit Phase 19: Offerwall click tracking
-- Tracks outbound clicks before redirecting to partner offers.

create table if not exists public.offerwall_click_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  offer_id text not null,
  profile_id uuid null references public.profiles (id) on delete set null,
  destination_url text not null,
  ip_address text,
  country text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint offerwall_click_events_provider_check check (length(trim(provider)) > 0),
  constraint offerwall_click_events_offer_check check (length(trim(offer_id)) > 0),
  constraint offerwall_click_events_destination_check check (destination_url ~* '^https?://')
);

create index if not exists idx_offerwall_click_events_profile_created
  on public.offerwall_click_events (profile_id, created_at desc);

create index if not exists idx_offerwall_click_events_provider_created
  on public.offerwall_click_events (provider, created_at desc);

alter table public.offerwall_click_events enable row level security;

drop policy if exists "offerwall_click_events_select_own" on public.offerwall_click_events;
create policy "offerwall_click_events_select_own"
on public.offerwall_click_events
for select
to authenticated
using (profile_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.offerwall_click_events;
exception when duplicate_object then null;
end $$;
