"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Gem,
  Palette,
  Search,
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
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import { getOrbitLocalStoreItems } from "@/src/lib/orbit-local-data";
import type {
  OrbitInventoryItem,
  OrbitProfile,
  OrbitProfileWallet,
  OrbitStoreCategory,
  OrbitStoreItem,
} from "@/src/types/orbit";

type ShopTab = "FEATURED" | "AVATAR" | "PROFILE" | "EFFECTS" | "ALL";

const SHOP_TABS: Array<{ key: ShopTab; label: string }> = [
  { key: "FEATURED", label: "Featured" },
  { key: "AVATAR", label: "Avatar" },
  { key: "PROFILE", label: "Profile" },
  { key: "EFFECTS", label: "Effects" },
  { key: "ALL", label: "All Items" },
];

const CATEGORY_LABELS: Record<OrbitStoreCategory, string> = {
  BACKGROUND: "Background",
  AVATAR_FRAME: "Avatar Frame",
  PROFILE_BANNER: "Profile Banner",
  PROFILE_EFFECT: "Profile Effect",
  PROFILE_FLARE: "Profile Flare",
  SFX_PACK: "SFX Pack",
};

function getPreviewStyle(item: OrbitStoreItem) {
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
      return "Banner";
    case "PROFILE_EFFECT":
      return "Effect";
    case "SFX_PACK":
      return "SFX";
    case "PROFILE_FLARE":
      return "Flare";
    default:
      return "Preview";
  }
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
  const activeAvatarFrameItem = useMemo(
    () =>
      storeItems.find((item) => item.slug === profile?.active_avatar_frame_slug) ?? null,
    [profile?.active_avatar_frame_slug, storeItems],
  );
  const activeProfileBannerItem = useMemo(
    () =>
      storeItems.find((item) => item.slug === profile?.active_profile_banner_slug) ?? null,
    [profile?.active_profile_banner_slug, storeItems],
  );
  const activeProfileEffectItem = useMemo(
    () =>
      storeItems.find((item) => item.slug === profile?.active_profile_effect_slug) ?? null,
    [profile?.active_profile_effect_slug, storeItems],
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = (item: OrbitStoreItem) =>
      !normalizedQuery ||
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.description.toLowerCase().includes(normalizedQuery);

    let rows = storeItems.filter(matchesQuery);

    if (tab === "FEATURED") {
      rows = rows.filter(
        (item) =>
          item.category === "BACKGROUND" ||
          item.category === "AVATAR_FRAME" ||
          item.category === "PROFILE_BANNER",
      );
    } else if (tab === "AVATAR") {
      rows = rows.filter((item) => item.category === "AVATAR_FRAME");
    } else if (tab === "PROFILE") {
      rows = rows.filter(
        (item) =>
          item.category === "PROFILE_BANNER" || item.category === "PROFILE_FLARE",
      );
    } else if (tab === "EFFECTS") {
      rows = rows.filter(
        (item) => item.category === "PROFILE_EFFECT" || item.category === "SFX_PACK",
      );
    }

    return rows;
  }, [query, storeItems, tab]);

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
      setInventory(activeOwnedSlugs.map((itemSlug) => ({ item_slug: itemSlug, purchased_at: now })));
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
      if (item) {
        setSuccess(`${item.name} equipped.`);
      } else {
        setSuccess(`${CATEGORY_LABELS[category]} cleared.`);
      }
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

    if (item) {
      setSuccess(`${item.name} equipped.`);
    } else {
      setSuccess(`${CATEGORY_LABELS[category]} cleared.`);
    }
    setActionKey(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 pb-1">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
        <div className="relative overflow-hidden px-5 py-5">
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_10%_10%,rgba(217,70,239,0.38),transparent_48%),radial-gradient(140%_140%_at_84%_74%,rgba(56,189,248,0.25),transparent_55%),linear-gradient(140deg,#0c0d18_0%,#15103a_54%,#1b1030_100%)]" />
          <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-300">Orbit Shop</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Flux Collection</h2>
              <p className="mt-1 text-sm text-zinc-300">
                Avatar frames, profile banners, effects, and premium backgrounds.
              </p>
              {localMode ? (
                <p className="mt-2 inline-flex rounded-full border border-amber-300/35 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-amber-100">
                  Local rewards mode
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100">
                <Wallet className="mr-1 inline h-3.5 w-3.5" />
                {(wallet?.starbits_balance ?? 0).toLocaleString()} Starbits
              </span>
            </div>
          </div>

          <div className="relative z-[1] mt-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                Equipped profile preview
              </p>
              <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                <div
                  className="h-20 border-b border-white/10"
                  style={
                    activeProfileBannerItem
                      ? getPreviewStyle(activeProfileBannerItem)
                      : {
                          background:
                            "linear-gradient(145deg, rgba(99,102,241,0.3), rgba(59,130,246,0.22), rgba(244,63,94,0.2))",
                        }
                  }
                />
                <div className="flex items-center gap-3 px-3 pb-3 pt-2">
                  <div
                    className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/45 text-lg font-semibold text-zinc-100"
                    style={
                      activeAvatarFrameItem
                        ? {
                            boxShadow:
                              "0 0 0 2px rgba(167,139,250,0.55), 0 0 0 6px rgba(167,139,250,0.18)",
                          }
                        : undefined
                    }
                  >
                    {(profile?.full_name ?? profile?.username ?? "O").slice(0, 1).toUpperCase()}
                    {activeProfileEffectItem ? (
                      <span className="absolute -bottom-1.5 -right-1.5 rounded-full border border-violet-300/40 bg-violet-500/25 px-1.5 py-0.5 text-[10px] text-violet-100">
                        FX
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {profile?.full_name ?? profile?.username ?? "Orbit User"}
                    </p>
                    <p className="truncate text-xs text-zinc-300">
                      {activeAvatarFrameItem?.name ?? "Default frame"} ·{" "}
                      {activeProfileBannerItem?.name ?? "Default banner"} ·{" "}
                      {activeProfileEffectItem?.name ?? "No effect"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
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
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-2">
          {SHOP_TABS.map((shopTab) => (
            <Button
              className="rounded-full"
              key={shopTab.key}
              onClick={() => setTab(shopTab.key)}
              size="sm"
              type="button"
              variant={tab === shopTab.key ? "default" : "secondary"}
            >
              {shopTab.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              className="h-8 w-[220px] rounded-full border-white/15 bg-black/35 pl-8 text-xs"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Orbit Shop..."
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
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-zinc-300">
          Loading Orbit Shop...
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => {
            const owned = ownedSlugs.has(item.slug);
            const equippable = isOrbitEquippableCategory(item.category);
            const equipped = equippable
              ? getOrbitEquippedSlugForCategory(profile, item.category) === item.slug
              : false;
            const canAfford = (wallet?.starbits_balance ?? 0) >= item.price_starbits;
            const buyBusy = actionKey === `buy:${item.slug}`;
            const equipBusy = actionKey === `equip:${item.category}:${item.slug}`;
            const busy = buyBusy || equipBusy;

            return (
              <article
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition hover:border-violet-300/35 hover:shadow-[0_0_0_1px_rgba(167,139,250,0.2)]"
                key={item.slug}
              >
                <div
                  className="h-24 border-b border-white/10"
                  style={getPreviewStyle(item)}
                >
                  {item.category !== "BACKGROUND" ? (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-200">
                      {getPreviewText(item)}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{item.name}</p>
                      <p className="text-xs text-zinc-300">{item.description}</p>
                    </div>
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                      {item.rarity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>{CATEGORY_LABELS[item.category]}</span>
                    <span>{item.price_starbits.toLocaleString()} Starbits</span>
                  </div>
                  <div className="flex items-center gap-2">
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
                      {busy ? <Store className="h-4 w-4" /> : equippable ? <UserRound className="h-4 w-4" /> : <Gem className="h-4 w-4" />}
                      {!owned
                        ? "Buy"
                        : equippable
                          ? equipped
                            ? "Equipped"
                            : "Equip"
                          : "Owned"}
                    </Button>
                    {!owned && !canAfford ? (
                      <span className="text-[11px] text-rose-300">Need more Starbits</span>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
          {!visibleItems.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
              No items match your current filter.
            </div>
          ) : null}
        </div>
      )}

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
