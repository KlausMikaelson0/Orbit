"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Gem,
  Heart,
  Palette,
  Search,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ORBIT_EQUIPPABLE_STORE_CATEGORIES,
  applyOrbitStoreEquipToProfile,
  getOrbitEquippedSlugForCategory,
  isOrbitEquippableCategory,
} from "@/src/lib/orbit-store";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { getOrbitLocalStoreItems } from "@/src/lib/orbit-local-data";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type {
  OrbitInventoryItem,
  OrbitProfile,
  OrbitProfileWallet,
  OrbitStoreCategory,
  OrbitStoreItem,
} from "@/src/types/orbit";

type ShopTab = "FEATURED" | "BROWSE" | "ORBS_EXCLUSIVE";
type ShopSort = "RECENT" | "POPULAR" | "PRICE_ASC" | "PRICE_DESC" | "NAME" | "RARITY";
type BrowseCategory =
  | "SHOP_ALL"
  | "AVATAR_DECORATIONS"
  | "PROFILE_EFFECTS"
  | "NAMEPLATES"
  | "BUNDLES";
type ShowOnlyFilter =
  | "AVATAR_DECORATIONS"
  | "PROFILE_EFFECTS"
  | "NAMEPLATES"
  | "BUNDLES"
  | "ORBS_ELIGIBLE";
type ColorFilterName =
  | "purple"
  | "blue"
  | "green"
  | "orange"
  | "yellow"
  | "red"
  | "pink"
  | "white"
  | "gray";
type ThemeFilterName =
  | "anime"
  | "gaming"
  | "cute"
  | "scifi"
  | "food"
  | "fantasy"
  | "animals"
  | "sports"
  | "movies"
  | "dark";

interface ShopPresentationMeta {
  colors: ColorFilterName[];
  themes: ThemeFilterName[];
  collection: "FLUX" | "JUJUTSU" | "GENERAL";
  isBundle: boolean;
}

const SHOP_TAB_OPTIONS: Array<{ key: ShopTab; label: string }> = [
  { key: "FEATURED", label: "Featured" },
  { key: "BROWSE", label: "Browse" },
  { key: "ORBS_EXCLUSIVE", label: "Orbs Exclusive" },
];

const SHOP_SORTS: Array<{ key: ShopSort; label: string }> = [
  { key: "RECENT", label: "Recently Added" },
  { key: "POPULAR", label: "Popular" },
  { key: "PRICE_ASC", label: "Price: Low to High" },
  { key: "PRICE_DESC", label: "Price: High to Low" },
  { key: "NAME", label: "Name" },
  { key: "RARITY", label: "Rarity" },
];

const BROWSE_OPTIONS: Array<{ key: BrowseCategory; label: string }> = [
  { key: "SHOP_ALL", label: "Shop All" },
  { key: "AVATAR_DECORATIONS", label: "Avatar Decorations" },
  { key: "PROFILE_EFFECTS", label: "Profile Effects" },
  { key: "NAMEPLATES", label: "Nameplates" },
  { key: "BUNDLES", label: "Bundles" },
];

const SHOW_ONLY_FILTER_OPTIONS: Array<{ key: ShowOnlyFilter; label: string }> = [
  { key: "AVATAR_DECORATIONS", label: "Avatar Decorations" },
  { key: "PROFILE_EFFECTS", label: "Profile Effects" },
  { key: "NAMEPLATES", label: "Nameplates" },
  { key: "BUNDLES", label: "Bundles" },
  { key: "ORBS_ELIGIBLE", label: "Orbs Eligible" },
];

const COLOR_FILTERS: Array<{ key: ColorFilterName; label: string; hex: string }> = [
  { key: "purple", label: "Purple", hex: "#a855f7" },
  { key: "blue", label: "Blue", hex: "#3b82f6" },
  { key: "green", label: "Green", hex: "#22c55e" },
  { key: "orange", label: "Orange", hex: "#f97316" },
  { key: "yellow", label: "Yellow", hex: "#eab308" },
  { key: "red", label: "Red", hex: "#ef4444" },
  { key: "pink", label: "Pink", hex: "#ec4899" },
  { key: "white", label: "White", hex: "#e4e4e7" },
  { key: "gray", label: "Gray", hex: "#71717a" },
];

const THEME_FILTERS: Array<{ key: ThemeFilterName; label: string }> = [
  { key: "anime", label: "Anime" },
  { key: "gaming", label: "Gaming" },
  { key: "cute", label: "Cute & Cozy" },
  { key: "scifi", label: "Sci-Fi" },
  { key: "food", label: "Food & Drinks" },
  { key: "fantasy", label: "Fantasy" },
  { key: "animals", label: "Animals & Pets" },
  { key: "sports", label: "Sports" },
  { key: "movies", label: "Movies & TV" },
  { key: "dark", label: "Dark & Moody" },
];

const ORBS_EXCLUSIVE_MIN_PRICE = 3500;

const CATEGORY_LABELS: Record<OrbitStoreCategory, string> = {
  BACKGROUND: "Background",
  AVATAR_FRAME: "Avatar Decorations",
  PROFILE_BANNER: "Nameplates",
  PROFILE_EFFECT: "Profile Effects",
  PROFILE_FLARE: "Profile Effects",
  SFX_PACK: "Bundles",
};

const ITEM_META_OVERRIDES: Record<string, Partial<ShopPresentationMeta>> = {
  "profile-banner-neon-glow-bundle": {
    colors: ["pink", "purple"],
    themes: ["gaming", "scifi", "dark"],
    collection: "FLUX",
    isBundle: true,
  },
  "profile-banner-drifting-glow-bundle": {
    colors: ["blue", "purple"],
    themes: ["gaming", "scifi", "dark"],
    collection: "FLUX",
    isBundle: true,
  },
  "profile-banner-electric-aura-bundle": {
    colors: ["blue", "gray", "purple"],
    themes: ["scifi", "dark"],
    collection: "FLUX",
    isBundle: true,
  },
  "avatar-frame-neon-glow": {
    colors: ["pink", "purple", "blue"],
    themes: ["scifi", "gaming", "dark"],
    collection: "FLUX",
  },
  "avatar-frame-drifting-glow": {
    colors: ["blue", "purple", "green"],
    themes: ["scifi", "gaming"],
    collection: "FLUX",
  },
  "avatar-frame-electric-aura": {
    colors: ["gray", "white", "purple"],
    themes: ["scifi", "dark"],
    collection: "FLUX",
  },
  "profile-banner-lone-wolf-bundle": {
    colors: ["blue", "purple", "gray"],
    themes: ["animals", "dark", "fantasy"],
    collection: "GENERAL",
    isBundle: true,
  },
  "profile-banner-hunny-bunnies-bundle": {
    colors: ["pink", "purple", "blue"],
    themes: ["cute", "animals"],
    collection: "GENERAL",
    isBundle: true,
  },
  "profile-banner-nevermore-bundle": {
    colors: ["gray", "white", "purple"],
    themes: ["dark", "fantasy"],
    collection: "GENERAL",
    isBundle: true,
  },
  "profile-banner-dark-roses-bundle": {
    colors: ["pink", "gray", "purple"],
    themes: ["dark", "fantasy"],
    collection: "GENERAL",
    isBundle: true,
  },
  "profile-banner-jujutsu-black-flash": {
    colors: ["red", "gray", "blue"],
    themes: ["anime", "dark"],
    collection: "JUJUTSU",
  },
  "profile-banner-jujutsu-six-eyes": {
    colors: ["blue", "white", "gray"],
    themes: ["anime", "scifi"],
    collection: "JUJUTSU",
  },
  "profile-effect-jujutsu-cursed-mark": {
    colors: ["red", "purple", "gray"],
    themes: ["anime", "dark", "fantasy"],
    collection: "JUJUTSU",
  },
  "avatar-frame-jujutsu-domain": {
    colors: ["purple", "blue", "red"],
    themes: ["anime", "dark", "fantasy"],
    collection: "JUJUTSU",
  },
};

function rarityScore(rarity: string) {
  switch (rarity.toUpperCase()) {
    case "LEGENDARY":
      return 5;
    case "EPIC":
      return 4;
    case "RARE":
      return 3;
    case "UNCOMMON":
      return 2;
    default:
      return 1;
  }
}

function popularityScore(item: OrbitStoreItem) {
  const base =
    rarityScore(item.rarity) * 320 +
    Math.min(2400, Math.round(item.price_starbits * 0.18)) +
    (item.name.toLowerCase().includes("bundle") ? 320 : 0);

  return base + Math.max(0, 1200 - item.sort_order);
}

function pseudoRandomForKey(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isOrbsExclusive(item: OrbitStoreItem) {
  return (
    item.price_starbits >= ORBS_EXCLUSIVE_MIN_PRICE ||
    rarityScore(item.rarity) >= 5 ||
    item.name.toLowerCase().includes("infinite") ||
    item.name.toLowerCase().includes("magic mists") ||
    item.name.toLowerCase().includes("nevermore")
  );
}

function isBundleItem(item: OrbitStoreItem) {
  return (
    item.name.toLowerCase().includes("bundle") ||
    item.category === "SFX_PACK" ||
    item.slug.includes("bundle")
  );
}

function getPreviewStyle(item: OrbitStoreItem) {
  if (item.slug.includes("neon-glow")) {
    return {
      background:
        "radial-gradient(120% 120% at 18% 18%, rgba(244,63,94,0.35), transparent 50%), linear-gradient(145deg,#210a24 0%,#2c1b6e 58%,#111827 100%)",
    };
  }
  if (item.slug.includes("drifting-glow")) {
    return {
      background:
        "radial-gradient(120% 120% at 84% 24%, rgba(59,130,246,0.36), transparent 52%), linear-gradient(145deg,#0a1029 0%,#1d2b7a 55%,#111827 100%)",
    };
  }
  if (item.slug.includes("electric-aura")) {
    return {
      background:
        "radial-gradient(120% 120% at 50% 20%, rgba(148,163,184,0.35), transparent 52%), linear-gradient(145deg,#0f1220 0%,#2a2a3f 58%,#111827 100%)",
    };
  }
  if (item.slug.includes("nevermore")) {
    return {
      background:
        "radial-gradient(120% 140% at 78% 22%, rgba(148,163,184,0.34), transparent 45%), linear-gradient(145deg,#090b10 0%,#111827 55%,#18181b 100%)",
    };
  }
  if (item.slug.includes("lone-wolf")) {
    return {
      background:
        "radial-gradient(120% 120% at 18% 18%, rgba(59,130,246,0.32), transparent 48%), linear-gradient(145deg,#0b1022 0%,#1e1b4b 60%,#18181b 100%)",
    };
  }
  if (item.slug.includes("hunny-bunnies")) {
    return {
      background:
        "radial-gradient(130% 130% at 22% 18%, rgba(236,72,153,0.35), transparent 44%), linear-gradient(145deg,#29112b 0%,#4c1d95 58%,#1f2937 100%)",
    };
  }
  if (item.slug.includes("dark-roses")) {
    return {
      background:
        "radial-gradient(120% 120% at 80% 20%, rgba(244,63,94,0.26), transparent 44%), linear-gradient(145deg,#120c1f 0%,#1f123b 55%,#111827 100%)",
    };
  }
  if (item.slug.includes("infinite-swirl") || item.slug.includes("magic-mists")) {
    return {
      background:
        "radial-gradient(120% 120% at 20% 20%, rgba(96,165,250,0.34), transparent 46%), radial-gradient(130% 130% at 82% 76%, rgba(192,132,252,0.3), transparent 48%), linear-gradient(145deg,#0a1020 0%,#312e81 58%,#1f2937 100%)",
    };
  }
  if (item.slug.includes("jujutsu")) {
    return {
      background:
        "radial-gradient(120% 120% at 20% 20%, rgba(239,68,68,0.28), transparent 48%), linear-gradient(145deg,#1b0d0d 0%,#2f1a1a 50%,#111827 100%)",
    };
  }

  if (item.category === "BACKGROUND" && item.css_background) {
    return { background: item.css_background };
  }

  if (item.category === "AVATAR_FRAME") {
    return {
      background:
        "radial-gradient(120% 120% at 18% 18%, rgba(192,132,252,0.45), transparent 48%), linear-gradient(145deg,#111428,#241446)",
    };
  }

  if (item.category === "PROFILE_BANNER") {
    return {
      background:
        "radial-gradient(120% 120% at 84% 20%, rgba(56,189,248,0.36), transparent 50%), linear-gradient(145deg,#0f1527,#1f1140)",
    };
  }

  if (item.category === "PROFILE_EFFECT") {
    return {
      background:
        "radial-gradient(120% 120% at 50% 50%, rgba(167,139,250,0.35), transparent 52%), linear-gradient(150deg,#0a0d1a,#17142e)",
    };
  }

  return {
    background:
      "radial-gradient(120% 120% at 16% 18%, rgba(99,102,241,0.3), transparent 48%), linear-gradient(140deg,#0f1120,#1d1538)",
  };
}

function getPreviewText(item: OrbitStoreItem) {
  if (item.preview_emoji) {
    return item.preview_emoji;
  }

  switch (item.category) {
    case "AVATAR_FRAME":
      return "Frame";
    case "PROFILE_BANNER":
      return "Nameplate";
    case "PROFILE_EFFECT":
      return "Effect";
    case "SFX_PACK":
      return "Bundle";
    case "PROFILE_FLARE":
      return "Flare";
    default:
      return "Preview";
  }
}

function getRaritySwatches(rarity: string) {
  switch (rarity.toUpperCase()) {
    case "LEGENDARY":
      return ["#f97316", "#ec4899", "#a855f7"];
    case "EPIC":
      return ["#8b5cf6", "#6366f1", "#22d3ee"];
    case "RARE":
      return ["#38bdf8", "#818cf8", "#60a5fa"];
    default:
      return ["#52525b", "#71717a", "#a1a1aa"];
  }
}

function formatCoinPrice(value: number) {
  return value.toLocaleString();
}

function resolveMeta(item: OrbitStoreItem): ShopPresentationMeta {
  const override = ITEM_META_OVERRIDES[item.slug];
  const defaultColors: ColorFilterName[] =
    item.category === "AVATAR_FRAME"
      ? ["purple", "blue"]
      : item.category === "PROFILE_EFFECT"
        ? ["pink", "purple"]
        : item.category === "PROFILE_BANNER"
          ? ["blue", "purple"]
          : ["gray", "white"];
  const defaultThemes: ThemeFilterName[] =
    item.category === "PROFILE_EFFECT"
      ? ["scifi", "gaming"]
      : item.category === "AVATAR_FRAME"
        ? ["gaming", "fantasy"]
        : ["dark"];

  return {
    colors: override?.colors ?? defaultColors,
    themes: override?.themes ?? defaultThemes,
    collection: override?.collection ?? "GENERAL",
    isBundle: override?.isBundle ?? isBundleItem(item),
  };
}

export function OrbitShopView() {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const localMode = !isSupabaseReady();
  const { profile, setProfile } = useOrbitNavStore(
    useShallow((state) => ({
      profile: state.profile,
      setProfile: state.setProfile,
    })),
  );

  const [tab, setTab] = useState<ShopTab>("FEATURED");
  const [browseCategory, setBrowseCategory] = useState<BrowseCategory>("SHOP_ALL");
  const [sortBy, setSortBy] = useState<ShopSort>("RECENT");
  const [showFiltersRail, setShowFiltersRail] = useState(true);
  const [showOnlyFilters, setShowOnlyFilters] = useState<ShowOnlyFilter[]>([]);
  const [selectedColors, setSelectedColors] = useState<ColorFilterName[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<ThemeFilterName[]>([]);
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [wallet, setWallet] = useState<OrbitProfileWallet | null>(null);
  const [storeItems, setStoreItems] = useState<OrbitStoreItem[]>([]);
  const [inventory, setInventory] = useState<OrbitInventoryItem[]>([]);

  const ownedSlugs = useMemo(
    () => new Set(inventory.map((item) => item.item_slug)),
    [inventory],
  );

  const activeEquippedCategories = useMemo(
    () =>
      ORBIT_EQUIPPABLE_STORE_CATEGORIES.filter((category) =>
        Boolean(getOrbitEquippedSlugForCategory(profile, category)),
      ),
    [profile],
  );

  const fetchShopState = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseReady()) {
      const now = new Date().toISOString();
      const localItems = getOrbitLocalStoreItems();
      setStoreItems(localItems);
      setWallet({
        profile_id: profile?.id ?? "local-user",
        starbits_balance: 1450,
        lifetime_earned: 1450,
        last_daily_claim_at: null,
        created_at: now,
        updated_at: now,
      });
      const activeOwnedSlugs = [
        profile?.active_background_slug,
        profile?.active_avatar_frame_slug,
        profile?.active_profile_banner_slug,
        profile?.active_profile_effect_slug,
      ].filter((value): value is string => Boolean(value));
      setInventory(
        activeOwnedSlugs.map((itemSlug) => ({ item_slug: itemSlug, purchased_at: now })),
      );
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError(userError?.message ?? "You must be signed in.");
      setLoading(false);
      return;
    }

    const [walletResult, itemResult, inventoryResult] = await Promise.all([
      supabase
        .from("profile_wallets")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle(),
      supabase
        .from("orbit_store_items")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("profile_store_inventory")
        .select("item_slug, purchased_at")
        .eq("profile_id", user.id),
    ]);

    if (walletResult.error) {
      setError(walletResult.error.message);
      setLoading(false);
      return;
    }
    if (itemResult.error) {
      setError(itemResult.error.message);
      setLoading(false);
      return;
    }
    if (inventoryResult.error) {
      setError(inventoryResult.error.message);
      setLoading(false);
      return;
    }

    setWallet((walletResult.data ?? null) as OrbitProfileWallet | null);
    setStoreItems((itemResult.data ?? []) as OrbitStoreItem[]);
    setInventory((inventoryResult.data ?? []) as OrbitInventoryItem[]);
    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    void fetchShopState();
  }, [fetchShopState]);

  async function buyItem(item: OrbitStoreItem) {
    setActionKey(`buy:${item.slug}`);
    setError(null);
    setSuccess(null);

    if (!isSupabaseReady()) {
      const currentWallet = wallet;
      if (!currentWallet) {
        setError("Wallet is not available.");
        setActionKey(null);
        return;
      }
      if (currentWallet.starbits_balance < item.price_starbits) {
        setError("Not enough Starbits.");
        setActionKey(null);
        return;
      }
      setWallet({
        ...currentWallet,
        starbits_balance: currentWallet.starbits_balance - item.price_starbits,
        updated_at: new Date().toISOString(),
      });
      setInventory((current) => {
        if (current.some((row) => row.item_slug === item.slug)) {
          return current;
        }
        return [...current, { item_slug: item.slug, purchased_at: new Date().toISOString() }];
      });
      setSuccess(`${item.name} purchased successfully.`);
      setActionKey(null);
      return;
    }

    const { error } = await supabase.rpc("buy_store_item", {
      target_slug: item.slug,
    });

    if (error) {
      setError(error.message);
      setActionKey(null);
      return;
    }

    setSuccess(`${item.name} purchased successfully.`);
    await fetchShopState();
    setActionKey(null);
  }

  async function equipItem(category: OrbitStoreCategory, item: OrbitStoreItem | null) {
    if (!isOrbitEquippableCategory(category)) {
      return;
    }

    const actionSlug = item?.slug ?? `default-${category.toLowerCase()}`;
    setActionKey(`equip:${category}:${actionSlug}`);
    setError(null);
    setSuccess(null);

    if (!isSupabaseReady()) {
      if (profile) {
        setProfile(applyOrbitStoreEquipToProfile(profile as OrbitProfile, category, item));
      }
      setSuccess(item ? `${item.name} equipped.` : `${CATEGORY_LABELS[category]} cleared.`);
      setActionKey(null);
      return;
    }

    const result =
      category === "BACKGROUND"
        ? await supabase.rpc("set_active_store_background", {
            target_slug: item?.slug ?? null,
          })
        : await supabase.rpc("set_active_store_cosmetic", {
            target_category: category,
            target_slug: item?.slug ?? null,
          });

    if (result.error) {
      const missingFunction =
        category !== "BACKGROUND" &&
        /set_active_store_cosmetic|does not exist/i.test(result.error.message);
      setError(
        missingFunction
          ? "Profile cosmetics need Phase 15 migration on Supabase."
          : result.error.message,
      );
      setActionKey(null);
      return;
    }

    if (profile) {
      setProfile(applyOrbitStoreEquipToProfile(profile as OrbitProfile, category, item));
    }
    setSuccess(item ? `${item.name} equipped.` : `${CATEGORY_LABELS[category]} cleared.`);
    setActionKey(null);
  }

  function toggleMultiValue<T extends string>(current: T[], value: T) {
    if (current.includes(value)) {
      return current.filter((item) => item !== value);
    }
    return [...current, value];
  }

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = storeItems.filter((item) => {
      if (!normalizedQuery) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery)
      );
    });

    if (tab === "BROWSE") {
      rows = rows.filter((item) => {
        if (browseCategory === "SHOP_ALL") {
          return true;
        }
        if (browseCategory === "AVATAR_DECORATIONS") {
          return item.category === "AVATAR_FRAME";
        }
        if (browseCategory === "PROFILE_EFFECTS") {
          return item.category === "PROFILE_EFFECT" || item.category === "PROFILE_FLARE";
        }
        if (browseCategory === "NAMEPLATES") {
          return item.category === "PROFILE_BANNER";
        }
        if (browseCategory === "BUNDLES") {
          return isBundleItem(item);
        }
        return true;
      });
    }
    if (tab === "ORBS_EXCLUSIVE") {
      rows = rows.filter((item) => isOrbsExclusive(item));
    }

    rows = rows.filter((item) => {
      if (showOnlyFilters.length) {
        const showOnlyMatch = showOnlyFilters.every((filterKey) => {
          if (filterKey === "AVATAR_DECORATIONS") {
            return item.category === "AVATAR_FRAME";
          }
          if (filterKey === "PROFILE_EFFECTS") {
            return item.category === "PROFILE_EFFECT" || item.category === "PROFILE_FLARE";
          }
          if (filterKey === "NAMEPLATES") {
            return item.category === "PROFILE_BANNER";
          }
          if (filterKey === "BUNDLES") {
            return isBundleItem(item);
          }
          if (filterKey === "ORBS_ELIGIBLE") {
            return isOrbsExclusive(item);
          }
          return true;
        });
        if (!showOnlyMatch) {
          return false;
        }
      }

      const meta = resolveMeta(item);
      if (selectedColors.length) {
        const hasColor = selectedColors.some((color) => meta.colors.includes(color));
        if (!hasColor) {
          return false;
        }
      }
      if (selectedThemes.length) {
        const hasTheme = selectedThemes.some((theme) => meta.themes.includes(theme));
        if (!hasTheme) {
          return false;
        }
      }
      return true;
    });
    return rows;
  }, [
    browseCategory,
    query,
    selectedColors,
    selectedThemes,
    showOnlyFilters,
    storeItems,
    tab,
  ]);

  const sortedItems = useMemo(() => {
    const rows = [...filteredItems];
    if (sortBy === "RECENT") {
      rows.sort((a, b) => b.sort_order - a.sort_order);
    } else if (sortBy === "POPULAR") {
      rows.sort((a, b) => popularityScore(b) - popularityScore(a));
    } else if (sortBy === "PRICE_ASC") {
      rows.sort((a, b) => a.price_starbits - b.price_starbits);
    } else if (sortBy === "PRICE_DESC") {
      rows.sort((a, b) => b.price_starbits - a.price_starbits);
    } else if (sortBy === "NAME") {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      rows.sort((a, b) => rarityScore(b.rarity) - rarityScore(a.rarity));
    }

    if (shuffleSeed > 0) {
      rows.sort(
        (a, b) =>
          pseudoRandomForKey(`${a.slug}-${shuffleSeed}`) -
          pseudoRandomForKey(`${b.slug}-${shuffleSeed}`),
      );
    }
    return rows;
  }, [filteredItems, shuffleSeed, sortBy]);

  const popularPicks = useMemo(
    () =>
      [...sortedItems]
        .sort((a, b) => popularityScore(b) - popularityScore(a))
        .slice(0, 8),
    [sortedItems],
  );

  const fluxRows = useMemo(
    () => sortedItems.filter((item) => resolveMeta(item).collection === "FLUX").slice(0, 8),
    [sortedItems],
  );

  const jujutsuRows = useMemo(
    () => sortedItems.filter((item) => resolveMeta(item).collection === "JUJUTSU").slice(0, 8),
    [sortedItems],
  );

  const exclusiveRows = useMemo(
    () => sortedItems.filter((item) => isOrbsExclusive(item)),
    [sortedItems],
  );

  function renderStoreCard(item: OrbitStoreItem, forceExclusiveBadge = false) {
    const owned = ownedSlugs.has(item.slug);
    const equippable = isOrbitEquippableCategory(item.category);
    const equipped = equippable
      ? getOrbitEquippedSlugForCategory(profile, item.category) === item.slug
      : false;
    const canAfford = (wallet?.starbits_balance ?? 0) >= item.price_starbits;
    const buyBusy = actionKey === `buy:${item.slug}`;
    const equipBusy = actionKey === `equip:${item.category}:${item.slug}`;
    const busy = buyBusy || equipBusy;
    const cardExclusive = forceExclusiveBadge || isOrbsExclusive(item);
    const swatches = getRaritySwatches(item.rarity);

    return (
      <article
        className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 transition hover:border-violet-300/35 hover:shadow-[0_0_0_1px_rgba(167,139,250,0.2)]"
        key={item.slug}
      >
        <div className="relative h-32 border-b border-white/10" style={getPreviewStyle(item)}>
          {cardExclusive ? (
            <span className="absolute left-2 top-2 rounded-full border border-white/30 bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-100">
              Orbs Exclusive
            </span>
          ) : null}
          <button
            className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/45 p-1 text-zinc-300 hover:text-white"
            type="button"
          >
            <Heart className="h-3.5 w-3.5" />
          </button>
          {item.category !== "BACKGROUND" ? (
            <div className="flex h-full items-center justify-center text-sm font-medium text-zinc-100/90">
              {getPreviewText(item)}
            </div>
          ) : null}
        </div>
        <div className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-zinc-100">{item.name}</p>
              <p className="line-clamp-2 text-xs text-zinc-300">{item.description}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{CATEGORY_LABELS[item.category]}</span>
            <span className="inline-flex items-center gap-1 text-zinc-200">
              <Gem className="h-3.5 w-3.5 text-zinc-300" />
              {formatCoinPrice(item.price_starbits)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {swatches.map((color) => (
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/15"
                  key={`${item.slug}-${color}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <Button
              className="rounded-full"
              disabled={busy || (!owned && !canAfford) || (owned && !equippable)}
              onClick={() => {
                if (!owned) {
                  void buyItem(item);
                  return;
                }
                if (equippable) {
                  void equipItem(item.category, item);
                }
              }}
              size="sm"
              type="button"
              variant={equipped ? "secondary" : "default"}
            >
              {busy ? (
                <Store className="h-4 w-4" />
              ) : equippable ? (
                <UserRound className="h-4 w-4" />
              ) : (
                <Gem className="h-4 w-4" />
              )}
              {!owned
                ? "Buy"
                : equippable
                  ? equipped
                    ? "Equipped"
                    : "Equip"
                  : "Owned"}
            </Button>
          </div>
        </div>
      </article>
    );
  }

  function renderGrid(items: OrbitStoreItem[], forceExclusiveBadge = false) {
    if (!items.length) {
      return (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
          No items match your current filter.
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => renderStoreCard(item, forceExclusiveBadge))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 pb-1">
      <section className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {SHOP_TAB_OPTIONS.map((option) => (
              <Button
                className="rounded-full"
                key={option.key}
                onClick={() => setTab(option.key)}
                size="sm"
                type="button"
                variant={tab === option.key ? "default" : "secondary"}
              >
                {option.label}
              </Button>
            ))}
            {tab === "BROWSE" ? (
              <select
                className="h-8 rounded-full border border-white/15 bg-black/35 px-3 text-xs text-zinc-200 outline-none"
                onChange={(event) => setBrowseCategory(event.target.value as BrowseCategory)}
                value={browseCategory}
              >
                {BROWSE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs text-zinc-300">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Sort by</span>
              <select
                className="h-7 rounded-md border border-white/15 bg-black/40 px-2 text-xs text-zinc-200 outline-none"
                onChange={(event) => setSortBy(event.target.value as ShopSort)}
                value={sortBy}
              >
                {SHOP_SORTS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              className="rounded-full"
              onClick={() => setShowFiltersRail((current) => !current)}
              size="sm"
              type="button"
              variant="secondary"
            >
              {showFiltersRail ? "Hide Filters" : "Show Filters"}
            </Button>
            <Button
              className="rounded-full"
              onClick={() => setShuffleSeed(Date.now())}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Shuffle className="h-4 w-4" />
              Shuffle!
            </Button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <Input
                className="h-8 w-[220px] rounded-full border-white/15 bg-black/35 pl-8 text-xs"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the Shop"
                value={query}
              />
            </div>
            <Button
              className="rounded-full"
              disabled={loading}
              onClick={() => void fetchShopState()}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Sparkles className="h-4 w-4" />
              Refresh
            </Button>
            <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100">
              <Wallet className="mr-1 inline h-3.5 w-3.5" />
              {(wallet?.starbits_balance ?? 0).toLocaleString()}
            </span>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-zinc-300">
          Loading Orbit Shop...
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="min-h-0 flex-1 space-y-5 overflow-auto pr-1">
            <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 px-5 py-5">
              <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_10%_10%,rgba(217,70,239,0.4),transparent_48%),radial-gradient(140%_140%_at_84%_74%,rgba(56,189,248,0.3),transparent_55%),linear-gradient(140deg,#0b1025_0%,#1a1f64_54%,#18122f_100%)]" />
              <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-200">FLUX</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Glow Collection</h2>
                  <p className="mt-1 text-sm text-zinc-200/85">
                    Neon profile cosmetics, bundles, and exclusive drops.
                  </p>
                </div>
                <Button className="rounded-full" type="button">
                  Shop the Collection
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </section>

            {tab === "FEATURED" ? (
              <>
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-100">Orbs-Worthy Popular Picks</h3>
                    <p className="text-xs text-zinc-400">Trending bundles and profile cosmetics</p>
                  </div>
                  {renderGrid(popularPicks)}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-100">Flux Neon Collection</h3>
                    <p className="text-xs text-zinc-400">Neon glow cards and avatar rings</p>
                  </div>
                  {renderGrid(fluxRows)}
                </section>

                <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(59,130,246,0.35),transparent_50%),linear-gradient(145deg,#1d2b78,#1f2937)]" />
                    <div className="relative z-[1] space-y-3">
                      <p className="text-sm font-semibold text-white">Love XP</p>
                      <p className="text-xs text-zinc-200/85">
                        Cute cosmetic drop with avatar + profile banner.
                      </p>
                      <Button className="rounded-full" size="sm" type="button" variant="secondary">
                        Take me there
                      </Button>
                    </div>
                  </article>
                  <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_80%_20%,rgba(244,63,94,0.32),transparent_50%),linear-gradient(145deg,#7f1d1d,#1f2937)]" />
                    <div className="relative z-[1] space-y-3">
                      <p className="text-sm font-semibold text-white">Year of the Horse</p>
                      <p className="text-xs text-zinc-200/85">
                        Themed bundle and profile frame collection.
                      </p>
                      <Button className="rounded-full" size="sm" type="button" variant="secondary">
                        Take me there
                      </Button>
                    </div>
                  </article>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-100">Jujutsu Kaisen</h3>
                    <Button className="rounded-full" size="sm" type="button" variant="secondary">
                      Shop All Jujutsu Kaisen
                    </Button>
                  </div>
                  {renderGrid(jujutsuRows)}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-100">Orbs Exclusive</h3>
                    <p className="text-xs text-zinc-400">High-tier premium cosmetics</p>
                  </div>
                  {renderGrid(exclusiveRows, true)}
                </section>
              </>
            ) : tab === "ORBS_EXCLUSIVE" ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-100">Orbs Exclusive Catalog</h3>
                  <p className="text-xs text-zinc-400">Exclusive drops only</p>
                </div>
                {renderGrid(exclusiveRows, true)}
              </section>
            ) : (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-100">Browse Catalog</h3>
                  <p className="text-xs text-zinc-400">
                    {BROWSE_OPTIONS.find((row) => row.key === browseCategory)?.label ?? "Shop All"}
                  </p>
                </div>
                {renderGrid(sortedItems)}
              </section>
            )}

            <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Quick clear</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeEquippedCategories.length ? (
                  activeEquippedCategories.map((category) => (
                    <Button
                      className="rounded-full"
                      disabled={actionKey === `equip:${category}:default-${category.toLowerCase()}`}
                      key={category}
                      onClick={() => void equipItem(category, null)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <Palette className="h-4 w-4" />
                      Clear {CATEGORY_LABELS[category]}
                    </Button>
                  ))
                ) : (
                  <p className="text-xs text-zinc-400">No cosmetics equipped yet.</p>
                )}
              </div>
            </section>
          </div>

          {showFiltersRail ? (
            <aside className="hidden w-[260px] shrink-0 rounded-2xl border border-white/10 bg-black/25 p-3 xl:block">
              <div className="space-y-4">
                <section className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Show only</p>
                  <div className="space-y-1">
                    {SHOW_ONLY_FILTER_OPTIONS.map((option) => {
                      const active = showOnlyFilters.includes(option.key);
                      return (
                        <button
                          className={`flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-xs transition ${
                            active
                              ? "border-violet-300/40 bg-violet-500/15 text-violet-100"
                              : "border-white/10 bg-black/25 text-zinc-300 hover:border-white/20"
                          }`}
                          key={option.key}
                          onClick={() =>
                            setShowOnlyFilters((current) => toggleMultiValue(current, option.key))
                          }
                          type="button"
                        >
                          <span>{option.label}</span>
                          <span className="text-[10px]">{active ? "ON" : "OFF"}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_FILTERS.map((color) => {
                      const active = selectedColors.includes(color.key);
                      return (
                        <button
                          className={`h-6 w-6 rounded-full border transition ${
                            active ? "border-white" : "border-white/20"
                          }`}
                          key={color.key}
                          onClick={() =>
                            setSelectedColors((current) => toggleMultiValue(current, color.key))
                          }
                          style={{ backgroundColor: color.hex }}
                          title={color.label}
                          type="button"
                        />
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-400">Themes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {THEME_FILTERS.map((theme) => {
                      const active = selectedThemes.includes(theme.key);
                      return (
                        <button
                          className={`rounded-full border px-2 py-1 text-[11px] transition ${
                            active
                              ? "border-violet-300/40 bg-violet-500/15 text-violet-100"
                              : "border-white/10 bg-black/25 text-zinc-300 hover:border-white/20"
                          }`}
                          key={theme.key}
                          onClick={() =>
                            setSelectedThemes((current) => toggleMultiValue(current, theme.key))
                          }
                          type="button"
                        >
                          {theme.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </aside>
          ) : null}
        </div>
      )}

      {localMode ? (
        <p className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Local rewards mode is active. Apply Supabase migrations for shared shop catalog.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {success}
        </p>
      ) : null}
    </div>
  );
}
