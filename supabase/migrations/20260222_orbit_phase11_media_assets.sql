-- Orbit Phase 11: Server custom GIF + Sticker assets
-- Run after previous Orbit migrations.

create table if not exists public.server_media_assets (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  kind text not null default 'GIF',
  title text not null,
  media_url text not null,
  preview_url text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  usage_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint server_media_assets_kind_check check (kind in ('GIF', 'STICKER')),
  constraint server_media_assets_title_check check (length(trim(title)) between 1 and 120),
  constraint server_media_assets_media_url_check check (length(trim(media_url)) > 0),
  constraint server_media_assets_usage_check check (usage_count >= 0)
);

create index if not exists idx_server_media_assets_server_kind_created
  on public.server_media_assets (server_id, kind, created_at desc);

create index if not exists idx_server_media_assets_active
  on public.server_media_assets (server_id, is_active, created_at desc);

drop trigger if exists trg_server_media_assets_updated_at on public.server_media_assets;
create trigger trg_server_media_assets_updated_at
before update on public.server_media_assets
for each row execute function public.set_updated_at();

alter table public.server_media_assets enable row level security;

drop policy if exists "server_media_assets_select_members" on public.server_media_assets;
create policy "server_media_assets_select_members"
on public.server_media_assets
for select
to authenticated
using (public.is_server_member(server_id));

drop policy if exists "server_media_assets_insert_staff" on public.server_media_assets;
create policy "server_media_assets_insert_staff"
on public.server_media_assets
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_server_staff(server_id)
);

drop policy if exists "server_media_assets_update_creator_or_staff" on public.server_media_assets;
create policy "server_media_assets_update_creator_or_staff"
on public.server_media_assets
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

drop policy if exists "server_media_assets_delete_creator_or_staff" on public.server_media_assets;
create policy "server_media_assets_delete_creator_or_staff"
on public.server_media_assets
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_server_staff(server_id)
);

do $$
begin
  alter publication supabase_realtime add table public.server_media_assets;
exception when duplicate_object then null;
end $$;
