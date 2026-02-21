-- Orbit Phase 12: Live call soundboard (built-in + server custom sounds)
-- Apply after previous Orbit migrations.

create table if not exists public.server_soundboard_items (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  title text not null,
  sound_url text not null,
  icon_emoji text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  usage_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint server_soundboard_items_title_check check (length(trim(title)) between 1 and 80),
  constraint server_soundboard_items_sound_url_check check (length(trim(sound_url)) > 0),
  constraint server_soundboard_items_usage_count_check check (usage_count >= 0)
);

create index if not exists idx_server_soundboard_items_server_created
  on public.server_soundboard_items (server_id, created_at desc);

create index if not exists idx_server_soundboard_items_active
  on public.server_soundboard_items (server_id, is_active, created_at desc);

drop trigger if exists trg_server_soundboard_items_updated_at on public.server_soundboard_items;
create trigger trg_server_soundboard_items_updated_at
before update on public.server_soundboard_items
for each row execute function public.set_updated_at();

alter table public.server_soundboard_items enable row level security;

drop policy if exists "server_soundboard_items_select_members" on public.server_soundboard_items;
create policy "server_soundboard_items_select_members"
on public.server_soundboard_items
for select
to authenticated
using (public.is_server_member(server_id));

drop policy if exists "server_soundboard_items_insert_staff" on public.server_soundboard_items;
create policy "server_soundboard_items_insert_staff"
on public.server_soundboard_items
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_server_staff(server_id)
);

drop policy if exists "server_soundboard_items_update_creator_or_staff" on public.server_soundboard_items;
create policy "server_soundboard_items_update_creator_or_staff"
on public.server_soundboard_items
for update
to authenticated
using (
  created_by = auth.uid()
  or public.is_server_staff(server_id)
)
with check (
  created_by = auth.uid()
  or public.is_server_staff(server_id)
);

drop policy if exists "server_soundboard_items_delete_creator_or_staff" on public.server_soundboard_items;
create policy "server_soundboard_items_delete_creator_or_staff"
on public.server_soundboard_items
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_server_staff(server_id)
);

do $$
begin
  alter publication supabase_realtime add table public.server_soundboard_items;
exception when duplicate_object then null;
end $$;
