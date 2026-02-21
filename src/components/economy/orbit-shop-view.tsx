"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gem, Search, Sparkles, Store, Wallet } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import { getOrbitLocalStoreItems } from "@/src/lib/orbit-local-data";
import type {
  OrbitInventoryItem,
  OrbitProfile,
  OrbitProfileWallet,
  OrbitStoreItem,
} from "@/src/types/orbit";

type ShopTab = "FEATURED" | "BROWSE" | "STARBITS_EXCLUSIVES";

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

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = (item: OrbitStoreItem) =>
      !normalizedQuery ||
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.description.toLowerCase().includes(normalizedQuery);

    let rows = storeItems.filter(matchesQuery);
    if (tab === "FEATURED") {
      rows = rows
        .filter((item) => item.category === "BACKGROUND")
        .slice(0, 6);
    } else if (tab === "STARBITS_EXCLUSIVES") {
      rows = rows.filter((item) => item.price_starbits >= 350 || item.rarity !== "COMMON");
    }

    return rows;
  }, [query, storeItems, tab]);

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
      setInventory(
        profile?.active_background_slug
          ? [{ item_slug: profile.active_background_slug, purchased_at: now }]
          : [],
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

  async function equipBackground(item: OrbitStoreItem | null) {
    const actionSlug = item?.slug ?? "default";
    setActionKey(`equip:${actionSlug}`);
    setError(null);
    setSuccess(null);

    if (!isSupabaseReady()) {
      if (profile) {
        setProfile({
          ...(profile as OrbitProfile),
          active_background_slug: item?.slug ?? null,
          active_background_css: item?.css_background ?? null,
        });
      }
      setSuccess(item ? `${item.name} equipped.` : "Default background restored.");
      setActionKey(null);
      return;
    }

    const { error } = await supabase.rpc("set_active_store_background", {
      target_slug: item?.slug ?? null,
    });

    if (error) {
      setError(error.message);
      setActionKey(null);
      return;
    }

    if (profile) {
      setProfile({
        ...(profile as OrbitProfile),
        active_background_slug: item?.slug ?? null,
        active_background_css: item?.css_background ?? null,
      });
    }

    setSuccess(item ? `${item.name} equipped.` : "Default background restored.");
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
                Cosmetic bundles, premium backgrounds, and account flair drops.
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
              {profile?.active_background_slug ? (
                <Button
                  className="rounded-full"
                  disabled={actionKey === "equip:default"}
                  onClick={() => void equipBackground(null)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Use Default
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-2">
          <Button
            className="rounded-full"
            onClick={() => setTab("FEATURED")}
            size="sm"
            type="button"
            variant={tab === "FEATURED" ? "default" : "secondary"}
          >
            Featured
          </Button>
          <Button
            className="rounded-full"
            onClick={() => setTab("BROWSE")}
            size="sm"
            type="button"
            variant={tab === "BROWSE" ? "default" : "secondary"}
          >
            Browse
          </Button>
          <Button
            className="rounded-full"
            onClick={() => setTab("STARBITS_EXCLUSIVES")}
            size="sm"
            type="button"
            variant={tab === "STARBITS_EXCLUSIVES" ? "default" : "secondary"}
          >
            Starbits Exclusives
          </Button>
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
            const isBackground = item.category === "BACKGROUND";
            const equipped = isBackground && profile?.active_background_slug === item.slug;
            const canAfford = (wallet?.starbits_balance ?? 0) >= item.price_starbits;
            const buyBusy = actionKey === `buy:${item.slug}`;
            const equipBusy = actionKey === `equip:${item.slug}`;
            const busy = buyBusy || equipBusy;

            return (
              <article
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition hover:border-violet-300/35 hover:shadow-[0_0_0_1px_rgba(167,139,250,0.2)]"
                key={item.slug}
              >
                <div
                  className="h-24 border-b border-white/10"
                  style={
                    isBackground && item.css_background
                      ? { background: item.css_background }
                      : {
                          background:
                            "radial-gradient(120% 120% at 18% 20%, rgba(99,102,241,0.3), transparent 48%), linear-gradient(140deg,#0f1120,#1d1538)",
                        }
                  }
                >
                  {!isBackground ? (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-200">
                      {item.preview_emoji ?? "Bundle Preview"}
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
                    <span>{item.category}</span>
                    <span>{item.price_starbits.toLocaleString()} Starbits</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      className="rounded-full"
                      disabled={busy || (!owned && !canAfford) || (owned && !isBackground)}
                      onClick={() => {
                        if (!owned) {
                          void buyItem(item);
                          return;
                        }
                        if (isBackground) {
                          void equipBackground(item);
                        }
                      }}
                      size="sm"
                      type="button"
                      variant={equipped ? "secondary" : "default"}
                    >
                      {busy ? <Store className="h-4 w-4" /> : <Gem className="h-4 w-4" />}
                      {!owned ? "Buy" : isBackground ? (equipped ? "Equipped" : "Equip") : "Owned"}
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
