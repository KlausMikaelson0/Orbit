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
  ),
  (
    'profile-banner-neon-glow-bundle',
    'Neon Glow Bundle',
    'Flux neon bundle with avatar and profile styling.',
    'PROFILE_BANNER',
    'LEGENDARY',
    10990,
    null,
    'NEON',
    235
  ),
  (
    'profile-banner-drifting-glow-bundle',
    'Drifting Glow Bundle',
    'Blue/purple Flux bundle for profile identity.',
    'PROFILE_BANNER',
    'LEGENDARY',
    10990,
    null,
    'DRIFT',
    236
  ),
  (
    'profile-banner-electric-aura-bundle',
    'Electric Aura Bundle',
    'Electric monochrome Flux profile bundle.',
    'PROFILE_BANNER',
    'LEGENDARY',
    10990,
    null,
    'ELECTRIC',
    237
  ),
  (
    'avatar-frame-neon-glow',
    'Neon Glow',
    'Animated neon avatar ring.',
    'AVATAR_FRAME',
    'EPIC',
    5590,
    null,
    'NEON',
    238
  ),
  (
    'avatar-frame-drifting-glow',
    'Drifting Glow',
    'Soft drifting glow ring for avatar.',
    'AVATAR_FRAME',
    'EPIC',
    5590,
    null,
    'DRIFT',
    239
  ),
  (
    'avatar-frame-electric-aura',
    'Electric Aura',
    'Electric aura ring for premium profiles.',
    'AVATAR_FRAME',
    'EPIC',
    5590,
    null,
    'AURA',
    240
  ),
  (
    'profile-banner-jujutsu-black-flash',
    'Jujutsu: Black Flash',
    'Jujutsu Kaisen inspired profile banner.',
    'PROFILE_BANNER',
    'EPIC',
    3900,
    null,
    'BLACKFLASH',
    241
  ),
  (
    'profile-banner-jujutsu-six-eyes',
    'Jujutsu: Six Eyes',
    'Signature blue visual profile banner.',
    'PROFILE_BANNER',
    'EPIC',
    3900,
    null,
    'SIXEYES',
    242
  ),
  (
    'profile-effect-jujutsu-cursed-mark',
    'Jujutsu: Cursed Mark',
    'Animated cursed energy profile effect.',
    'PROFILE_EFFECT',
    'EPIC',
    4100,
    null,
    'CURSED',
    243
  ),
  (
    'avatar-frame-jujutsu-domain',
    'Jujutsu: Domain Ring',
    'Domain expansion themed avatar frame.',
    'AVATAR_FRAME',
    'EPIC',
    4100,
    null,
    'DOMAIN',
    244
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
