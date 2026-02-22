import type { OrbitProfile, OrbitStoreCategory, OrbitStoreItem } from "@/src/types/orbit";

export type OrbitStoreEquipCategory =
  | "BACKGROUND"
  | "AVATAR_FRAME"
  | "PROFILE_BANNER"
  | "PROFILE_EFFECT";

export const ORBIT_EQUIPPABLE_STORE_CATEGORIES: OrbitStoreEquipCategory[] = [
  "BACKGROUND",
  "AVATAR_FRAME",
  "PROFILE_BANNER",
  "PROFILE_EFFECT",
];

export function isOrbitEquippableCategory(
  category: OrbitStoreCategory,
): category is OrbitStoreEquipCategory {
  return ORBIT_EQUIPPABLE_STORE_CATEGORIES.includes(category as OrbitStoreEquipCategory);
}

export function getOrbitEquippedSlugForCategory(
  profile: OrbitProfile | null | undefined,
  category: OrbitStoreCategory,
): string | null {
  if (!profile) {
    return null;
  }

  switch (category) {
    case "BACKGROUND":
      return profile.active_background_slug ?? null;
    case "AVATAR_FRAME":
      return profile.active_avatar_frame_slug ?? null;
    case "PROFILE_BANNER":
      return profile.active_profile_banner_slug ?? null;
    case "PROFILE_EFFECT":
      return profile.active_profile_effect_slug ?? null;
    default:
      return null;
  }
}

export function applyOrbitStoreEquipToProfile(
  profile: OrbitProfile,
  category: OrbitStoreEquipCategory,
  item: OrbitStoreItem | null,
): OrbitProfile {
  switch (category) {
    case "BACKGROUND":
      return {
        ...profile,
        active_background_slug: item?.slug ?? null,
        active_background_css: item?.css_background ?? null,
      };
    case "AVATAR_FRAME":
      return {
        ...profile,
        active_avatar_frame_slug: item?.slug ?? null,
      };
    case "PROFILE_BANNER":
      return {
        ...profile,
        active_profile_banner_slug: item?.slug ?? null,
      };
    case "PROFILE_EFFECT":
      return {
        ...profile,
        active_profile_effect_slug: item?.slug ?? null,
      };
    default:
      return profile;
  }
}
