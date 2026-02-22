-- Orbit Phase 15: Expanded profile cosmetics + account connections
-- Run after Phase 14 migrations.

create extension if not exists "pgcrypto";

alter table public.orbit_store_items
  drop constraint if exists orbit_store_items_category_check;

alter table public.orbit_store_items
  add constraint orbit_store_items_category_check check (
    category in (
      'BACKGROUND',
      'PROFILE_FLARE',
      'SFX_PACK',
      'AVATAR_FRAME',
      'PROFILE_BANNER',
      'PROFILE_EFFECT'
    )
  );

alter table public.profiles
  add column if not exists active_avatar_frame_slug text,
  add column if not exists active_profile_banner_slug text,
  add column if not exists active_profile_effect_slug text;

insert into public.orbit_store_items (
  slug,
  name,
  description,
  category,
  rarity,
  price_starbits,
  css_background,
  preview_emoji,
  sort_order
)
values
  (
    'avatar-frame-orbit-ring',
    'Orbit Ring Frame',
    'Clean neon ring around your avatar.',
    'AVATAR_FRAME',
    'COMMON',
    220,
    null,
    'RING',
    110
  ),
  (
    'avatar-frame-gold-crown',
    'Crown Accent Frame',
    'Gold crown styling for standout profiles.',
    'AVATAR_FRAME',
    'RARE',
    420,
    null,
    'CROWN',
    111
  ),
  (
    'avatar-frame-cyber-grid',
    'Cyber Grid Frame',
    'Futuristic segmented frame with cyan glow.',
    'AVATAR_FRAME',
    'EPIC',
    620,
    null,
    'CYBER',
    112
  ),
  (
    'avatar-frame-prism-core',
    'Prism Core Frame',
    'Premium prismatic frame animation for avatars.',
    'AVATAR_FRAME',
    'LEGENDARY',
    960,
    null,
    'PRISM',
    113
  ),
  (
    'profile-banner-nova-night',
    'Nova Night Banner',
    'Dark galaxy card banner for your profile.',
    'PROFILE_BANNER',
    'COMMON',
    260,
    null,
    'NOVA',
    120
  ),
  (
    'profile-banner-sakura-drift',
    'Sakura Drift Banner',
    'Soft pink cinematic banner for profile headers.',
    'PROFILE_BANNER',
    'RARE',
    380,
    null,
    'SAKURA',
    121
  ),
  (
    'profile-banner-valor-fire',
    'Valor Fire Banner',
    'Action-themed banner with red tactical glow.',
    'PROFILE_BANNER',
    'EPIC',
    640,
    null,
    'VALOR',
    122
  ),
  (
    'profile-banner-royal-ice',
    'Royal Ice Banner',
    'Blue premium hero banner with high contrast.',
    'PROFILE_BANNER',
    'LEGENDARY',
    940,
    null,
    'ROYAL',
    123
  ),
  (
    'profile-effect-glow',
    'Soft Glow Effect',
    'Subtle animated glow around profile panels.',
    'PROFILE_EFFECT',
    'COMMON',
    200,
    null,
    'GLOW',
    130
  ),
  (
    'profile-effect-static-burst',
    'Static Burst Effect',
    'Energetic pulse sparks for profile presence.',
    'PROFILE_EFFECT',
    'RARE',
    390,
    null,
    'BURST',
    131
  ),
  (
    'profile-effect-holo-shift',
    'Holo Shift Effect',
    'Holographic sweep effect for premium identity.',
    'PROFILE_EFFECT',
    'EPIC',
    710,
    null,
    'HOLO',
    132
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  price_starbits = excluded.price_starbits,
  css_background = excluded.css_background,
  preview_emoji = excluded.preview_emoji,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

create or replace function public.set_active_store_cosmetic(
  target_category text,
  target_slug text default null
)
returns table (
  category text,
  active_slug text,
  active_css text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_category text := upper(trim(coalesce(target_category, '')));
  normalized_slug text := nullif(lower(trim(coalesce(target_slug, ''))), '');
  item_row public.orbit_store_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if normalized_category not in ('BACKGROUND', 'AVATAR_FRAME', 'PROFILE_BANNER', 'PROFILE_EFFECT') then
    raise exception 'Unsupported equip category';
  end if;

  if normalized_slug is null then
    if normalized_category = 'BACKGROUND' then
      update public.profiles
      set
        active_background_slug = null,
        active_background_css = null,
        updated_at = now()
      where id = auth.uid();
      return query select normalized_category, null::text, null::text;
      return;
    end if;

    if normalized_category = 'AVATAR_FRAME' then
      update public.profiles
      set
        active_avatar_frame_slug = null,
        updated_at = now()
      where id = auth.uid();
      return query select normalized_category, null::text, null::text;
      return;
    end if;

    if normalized_category = 'PROFILE_BANNER' then
      update public.profiles
      set
        active_profile_banner_slug = null,
        updated_at = now()
      where id = auth.uid();
      return query select normalized_category, null::text, null::text;
      return;
    end if;

    update public.profiles
    set
      active_profile_effect_slug = null,
      updated_at = now()
    where id = auth.uid();
    return query select normalized_category, null::text, null::text;
    return;
  end if;

  select *
  into item_row
  from public.orbit_store_items
  where slug = normalized_slug
    and category = normalized_category
    and is_active = true
  limit 1;

  if item_row.slug is null then
    raise exception 'Store item not found for this category';
  end if;

  if not exists (
    select 1
    from public.profile_store_inventory i
    where i.profile_id = auth.uid()
      and i.item_slug = item_row.slug
  ) then
    raise exception 'Item is not owned by this account';
  end if;

  if normalized_category = 'BACKGROUND' then
    update public.profiles
    set
      active_background_slug = item_row.slug,
      active_background_css = item_row.css_background,
      updated_at = now()
    where id = auth.uid();
    return query select normalized_category, item_row.slug, item_row.css_background;
    return;
  end if;

  if normalized_category = 'AVATAR_FRAME' then
    update public.profiles
    set
      active_avatar_frame_slug = item_row.slug,
      updated_at = now()
    where id = auth.uid();
    return query select normalized_category, item_row.slug, null::text;
    return;
  end if;

  if normalized_category = 'PROFILE_BANNER' then
    update public.profiles
    set
      active_profile_banner_slug = item_row.slug,
      updated_at = now()
    where id = auth.uid();
    return query select normalized_category, item_row.slug, null::text;
    return;
  end if;

  update public.profiles
  set
    active_profile_effect_slug = item_row.slug,
    updated_at = now()
  where id = auth.uid();

  return query select normalized_category, item_row.slug, null::text;
end;
$$;

create table if not exists public.profile_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  external_id text,
  display_name text not null,
  profile_url text,
  is_visible_on_profile boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, provider),
  constraint profile_connections_provider_check check (
    provider in (
      'STEAM',
      'TWITCH',
      'YOUTUBE',
      'SPOTIFY',
      'XBOX',
      'PLAYSTATION',
      'RIOT',
      'EPIC',
      'TIKTOK',
      'GITHUB'
    )
  ),
  constraint profile_connections_display_name_check check (
    length(trim(display_name)) between 2 and 80
  ),
  constraint profile_connections_profile_url_check check (
    profile_url is null
    or profile_url ~* '^https?://'
  )
);

create index if not exists idx_profile_connections_profile
  on public.profile_connections (profile_id, provider);

drop trigger if exists trg_profile_connections_updated_at on public.profile_connections;
create trigger trg_profile_connections_updated_at
before update on public.profile_connections
for each row execute function public.set_updated_at();

alter table public.profile_connections enable row level security;

drop policy if exists "profile_connections_select_own" on public.profile_connections;
create policy "profile_connections_select_own"
on public.profile_connections
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists "profile_connections_insert_own" on public.profile_connections;
create policy "profile_connections_insert_own"
on public.profile_connections
for insert
to authenticated
with check (profile_id = auth.uid());

drop policy if exists "profile_connections_update_own" on public.profile_connections;
create policy "profile_connections_update_own"
on public.profile_connections
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "profile_connections_delete_own" on public.profile_connections;
create policy "profile_connections_delete_own"
on public.profile_connections
for delete
to authenticated
using (profile_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.profile_connections;
exception when duplicate_object then null;
end $$;
