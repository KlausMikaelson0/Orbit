-- Orbit Phase 17: Shop showcase catalog refresh
-- Run after Phase 15 migration.

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
    'profile-banner-lone-wolf-bundle',
    'Lone Wolf Bundle',
    'Dark blue wolf-themed profile bundle set.',
    'PROFILE_BANNER',
    'LEGENDARY',
    11000,
    null,
    'WOLF',
    210
  ),
  (
    'profile-banner-hunny-bunnies-bundle',
    'Hunny Bunnies Bundle',
    'Playful purple profile bundle with sticker accents.',
    'PROFILE_BANNER',
    'LEGENDARY',
    11000,
    null,
    'BUNNY',
    211
  ),
  (
    'profile-banner-nevermore-bundle',
    'Nevermore Bundle',
    'Monochrome raven-inspired premium identity bundle.',
    'PROFILE_BANNER',
    'LEGENDARY',
    11000,
    null,
    'NEVERMORE',
    212
  ),
  (
    'profile-banner-dark-roses-bundle',
    'Dark Roses Bundle',
    'Gothic rose profile bundle for premium users.',
    'PROFILE_BANNER',
    'LEGENDARY',
    11000,
    null,
    'ROSE',
    213
  ),
  (
    'avatar-frame-nevermore',
    'Nevermore',
    'Raven-themed avatar frame.',
    'AVATAR_FRAME',
    'EPIC',
    4100,
    null,
    'WING',
    220
  ),
  (
    'avatar-frame-fallen-angel',
    'Fallen Angel',
    'Shadow wing frame for dramatic profile styling.',
    'AVATAR_FRAME',
    'EPIC',
    4100,
    null,
    'ANGEL',
    221
  ),
  (
    'avatar-frame-lone-wolf',
    'Lone Wolf',
    'Moonlit wolf ring frame for your avatar.',
    'AVATAR_FRAME',
    'EPIC',
    4100,
    null,
    'MOON',
    222
  ),
  (
    'profile-banner-blossoming-branch',
    'Blossoming Branch',
    'Elegant floral profile banner.',
    'PROFILE_BANNER',
    'EPIC',
    4100,
    null,
    'BRANCH',
    223
  ),
  (
    'profile-effect-angry',
    'Angry',
    'Animated rage aura effect around profile avatar.',
    'PROFILE_EFFECT',
    'EPIC',
    4100,
    null,
    'ANGRY',
    224
  ),
  (
    'profile-banner-infinite-swirl',
    'Infinite Swirl',
    'Neon spiral profile banner style.',
    'PROFILE_BANNER',
    'LEGENDARY',
    3500,
    null,
    'SWIRL',
    230
  ),
  (
    'profile-banner-magic-mists',
    'Magic Mists',
    'Mystic purple mist profile banner.',
    'PROFILE_BANNER',
    'LEGENDARY',
    3500,
    null,
    'MISTS',
    231
  ),
  (
    'profile-banner-pondering-portal',
    'Pondering Portal',
    'Portal-themed profile identity visual.',
    'PROFILE_BANNER',
    'LEGENDARY',
    3500,
    null,
    'PORTAL',
    232
  ),
  (
    'profile-flare-orbs-apprentice-badge',
    'Orbs Apprentice Badge',
    'Starter badge from the Orbs exclusive collection.',
    'PROFILE_FLARE',
    'RARE',
    1400,
    null,
    'APPRENTICE',
    233
  ),
  (
    'profile-flare-3day-pulse-credit',
    '3-Day Pulse Credit',
    'Temporary membership credit token.',
    'PROFILE_FLARE',
    'RARE',
    1400,
    null,
    'PULSE',
    234
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
