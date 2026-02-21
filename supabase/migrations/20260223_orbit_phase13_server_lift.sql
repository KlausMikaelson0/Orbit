-- Orbit Phase 13: Server profile settings + Orbit Lift boosts
-- Apply after previous Orbit migrations.

alter table public.servers
  add column if not exists description text;

alter table public.servers
  drop constraint if exists servers_description_length_check;

alter table public.servers
  add constraint servers_description_length_check
  check (description is null or length(description) <= 320);

create table if not exists public.server_orbit_lifts (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tier_snapshot text not null default 'FREE',
  boost_points integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint server_orbit_lifts_unique_server_profile unique (server_id, profile_id),
  constraint server_orbit_lifts_tier_check check (tier_snapshot in ('FREE', 'PULSE', 'PULSE_PLUS')),
  constraint server_orbit_lifts_points_check check (boost_points between 1 and 3)
);

create index if not exists idx_server_orbit_lifts_server_active
  on public.server_orbit_lifts (server_id, is_active, created_at desc);

create index if not exists idx_server_orbit_lifts_profile
  on public.server_orbit_lifts (profile_id, is_active, created_at desc);

drop trigger if exists trg_server_orbit_lifts_updated_at on public.server_orbit_lifts;
create trigger trg_server_orbit_lifts_updated_at
before update on public.server_orbit_lifts
for each row execute function public.set_updated_at();

alter table public.server_orbit_lifts enable row level security;

drop policy if exists "server_orbit_lifts_select_members" on public.server_orbit_lifts;
create policy "server_orbit_lifts_select_members"
on public.server_orbit_lifts
for select
to authenticated
using (public.is_server_member(server_id));

drop policy if exists "server_orbit_lifts_insert_self_member" on public.server_orbit_lifts;
create policy "server_orbit_lifts_insert_self_member"
on public.server_orbit_lifts
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.is_server_member(server_id)
);

drop policy if exists "server_orbit_lifts_update_self_or_staff" on public.server_orbit_lifts;
create policy "server_orbit_lifts_update_self_or_staff"
on public.server_orbit_lifts
for update
to authenticated
using (
  profile_id = auth.uid()
  or public.is_server_staff(server_id)
)
with check (
  profile_id = auth.uid()
  or public.is_server_staff(server_id)
);

drop policy if exists "server_orbit_lifts_delete_self_or_staff" on public.server_orbit_lifts;
create policy "server_orbit_lifts_delete_self_or_staff"
on public.server_orbit_lifts
for delete
to authenticated
using (
  profile_id = auth.uid()
  or public.is_server_staff(server_id)
);

do $$
begin
  alter publication supabase_realtime add table public.server_orbit_lifts;
exception when duplicate_object then null;
end $$;
