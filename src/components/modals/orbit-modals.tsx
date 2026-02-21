"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, Gauge, Loader2, Sparkles, Store, Wallet } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SwipeDismissable } from "@/components/ui/swipe-dismissable";
import { Textarea } from "@/components/ui/textarea";
import { OrbitLanguagePicker } from "@/src/components/i18n/orbit-language-picker";
import { useModal } from "@/src/hooks/use-modal";
import { useOrbitLocale } from "@/src/hooks/use-orbit-locale";
import { useOrbitRuntime } from "@/src/hooks/use-orbit-runtime";
import {
  ORBIT_LOCAL_PROFILE,
  getOrbitLocalQuestProgress,
  getOrbitLocalQuests,
  getOrbitLocalStoreItems,
} from "@/src/lib/orbit-local-data";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type {
  ChannelType,
  OrbitInventoryItem,
  OrbitProfile,
  OrbitQuest,
  OrbitQuestActionType,
  OrbitQuestCategory,
  OrbitQuestProgress,
  OrbitProfileSubscription,
  OrbitProfileWallet,
  OrbitStoreItem,
  OrbitSubscriptionTier,
  OrbitServerTemplateKey,
} from "@/src/types/orbit";

interface ActionResult {
  error?: string;
}

interface OrbitModalsProps {
  createServer: (values: {
    name: string;
    imageUrl?: string;
    templateKey?: OrbitServerTemplateKey | null;
  }) => Promise<ActionResult>;
  createChannel: (values: {
    serverId: string;
    name: string;
    type: ChannelType;
  }) => Promise<ActionResult>;
  joinServerByInvite: (inviteCode: string) => Promise<ActionResult>;
}

const DAILY_STARBITS_REWARD = 120;
const DAILY_CLAIM_COOLDOWN_HOURS = 20;

const PULSE_PLANS: Array<{
  tier: OrbitSubscriptionTier;
  label: string;
  price: string;
  perks: string[];
}> = [
  {
    tier: "FREE",
    label: "Orbit Free",
    price: "$0",
    perks: ["720p stream quality", "Basic profile personalization", "Standard support queue"],
  },
  {
    tier: "PULSE",
    label: "Orbit Pulse",
    price: "$5.99",
    perks: ["1080p streams", "Animated profile flair", "Priority support queue"],
  },
  {
    tier: "PULSE_PLUS",
    label: "Orbit Pulse+",
    price: "$11.99",
    perks: ["4K-ready stream unlock", "Cross-server stickers", "Early access feature labs"],
  },
];

interface DailyClaimWindow {
  canClaim: boolean;
  nextClaimAt: Date | null;
}

function getDailyClaimWindow(lastClaimAt: string | null): DailyClaimWindow {
  if (!lastClaimAt) {
    return { canClaim: true, nextClaimAt: null };
  }

  const claimAt = new Date(lastClaimAt);
  if (Number.isNaN(claimAt.getTime())) {
    return { canClaim: true, nextClaimAt: null };
  }

  const nextClaimAt = new Date(
    claimAt.getTime() + DAILY_CLAIM_COOLDOWN_HOURS * 60 * 60 * 1000,
  );
  return {
    canClaim: Date.now() >= nextClaimAt.getTime(),
    nextClaimAt,
  };
}

function formatTierLabel(tier: OrbitSubscriptionTier | null | undefined) {
  if (!tier) {
    return "Free";
  }

  if (tier === "PULSE") {
    return "Orbit Pulse";
  }

  if (tier === "PULSE_PLUS") {
    return "Orbit Pulse+";
  }

  return "Orbit Free";
}

function getQuestActionLabel(category: OrbitQuestCategory) {
  switch (category) {
    case "VISIT":
      return "Log app visit";
    case "WATCH":
      return "Watch sponsor";
    case "PLAY":
      return "Play mini run";
    case "SOCIAL":
      return "Share activity";
    default:
      return "Progress quest";
  }
}

function questActionByCategory(category: OrbitQuestCategory): OrbitQuestActionType {
  switch (category) {
    case "VISIT":
      return "VISIT_APP";
    case "WATCH":
      return "WATCH_AD";
    case "PLAY":
      return "PLAY_SESSION";
    case "SOCIAL":
      return "SOCIAL_SHARE";
    default:
      return "VISIT_APP";
  }
}

export function OrbitModals({
  createServer,
  createChannel,
  joinServerByInvite,
}: OrbitModalsProps) {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const isLocalMode = !isSupabaseReady();
  const { isOpen, type, data, onClose } = useModal();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverName, setServerName] = useState("");
  const [serverImage, setServerImage] = useState("");
  const [serverTemplate, setServerTemplate] = useState<OrbitServerTemplateKey>("community");
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<ChannelType>("TEXT");
  const [inviteCode, setInviteCode] = useState("");
  const [loadingMfa, setLoadingMfa] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [aalLevel, setAalLevel] = useState<string | null>(null);
  const [totpFactors, setTotpFactors] = useState<
    Array<{ id: string; status?: string; friendly_name?: string }>
  >([]);
  const [pendingTotp, setPendingTotp] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const { t } = useOrbitLocale();
  const { isElectron, platformLabel } = useOrbitRuntime();
  const {
    profile,
    themePreset,
    customThemeCss,
    setProfile,
    setThemePreset,
    setCustomThemeCss,
  } =
    useOrbitNavStore(
      useShallow((state) => ({
        profile: state.profile,
        themePreset: state.themePreset,
        customThemeCss: state.customThemeCss,
        setProfile: state.setProfile,
        setThemePreset: state.setThemePreset,
        setCustomThemeCss: state.setCustomThemeCss,
      })),
    );
  const [loadingCommerce, setLoadingCommerce] = useState(false);
  const [commerceError, setCommerceError] = useState<string | null>(null);
  const [commerceSuccess, setCommerceSuccess] = useState<string | null>(null);
  const [switchingTier, setSwitchingTier] = useState<OrbitSubscriptionTier | null>(null);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [savingPerformanceMode, setSavingPerformanceMode] = useState(false);
  const [storeActionKey, setStoreActionKey] = useState<string | null>(null);
  const [questActionKey, setQuestActionKey] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<OrbitProfileSubscription | null>(null);
  const [wallet, setWallet] = useState<OrbitProfileWallet | null>(null);
  const [storeItems, setStoreItems] = useState<OrbitStoreItem[]>([]);
  const [inventory, setInventory] = useState<OrbitInventoryItem[]>([]);
  const [loadingQuests, setLoadingQuests] = useState(false);
  const [questError, setQuestError] = useState<string | null>(null);
  const [questSuccess, setQuestSuccess] = useState<string | null>(null);
  const [quests, setQuests] = useState<OrbitQuest[]>([]);
  const [questProgressRows, setQuestProgressRows] = useState<OrbitQuestProgress[]>([]);

  const createServerOpen = isOpen && type === "createServer";
  const createChannelOpen = isOpen && type === "createChannel";
  const joinServerOpen = isOpen && type === "joinServer";
  const settingsOpen = isOpen && type === "settings";

  const modalServerId = useMemo(() => data.serverId ?? null, [data.serverId]);
  const ownedItemSlugs = useMemo(
    () => new Set(inventory.map((entry) => entry.item_slug)),
    [inventory],
  );
  const questProgressByQuestId = useMemo(
    () =>
      Object.fromEntries(questProgressRows.map((row) => [row.quest_id, row])) as Record<
        string,
        OrbitQuestProgress
      >,
    [questProgressRows],
  );
  const dailyClaimWindow = useMemo(
    () => getDailyClaimWindow(wallet?.last_daily_claim_at ?? null),
    [wallet?.last_daily_claim_at],
  );

  function resetAndClose() {
    setError(null);
    setSubmitting(false);
    setServerName("");
    setServerImage("");
    setServerTemplate("community");
    setChannelName("");
    setChannelType("TEXT");
    setInviteCode("");
    setMfaError(null);
    setMfaSuccess(null);
    setPendingTotp(null);
    setMfaCode("");
    setCommerceError(null);
    setCommerceSuccess(null);
    setSwitchingTier(null);
    setClaimingDaily(false);
    setSavingPerformanceMode(false);
    setStoreActionKey(null);
    setQuestActionKey(null);
    setQuestError(null);
    setQuestSuccess(null);
    onClose();
  }

  const fetchMfaState = useCallback(async () => {
    setLoadingMfa(true);
    setMfaError(null);

    if (isLocalMode) {
      setTotpFactors([]);
      setAalLevel("local");
      setPendingTotp(null);
      setLoadingMfa(false);
      return;
    }

    const [factorsResult, aalResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    if (factorsResult.error) {
      setMfaError(factorsResult.error.message);
      setLoadingMfa(false);
      return;
    }

    if (aalResult.error) {
      setMfaError(aalResult.error.message);
      setLoadingMfa(false);
      return;
    }

    const allFactors =
      ((factorsResult.data?.all ?? []) as Array<{
        id: string;
        factor_type?: string;
        status?: string;
        friendly_name?: string;
      }>) ?? [];
    setTotpFactors(
      allFactors.filter((factor) => factor.factor_type === "totp"),
    );
    setAalLevel(aalResult.data?.currentLevel ?? null);
    setLoadingMfa(false);
  }, [isLocalMode, supabase]);

  const fetchCommerceState = useCallback(async () => {
    setLoadingCommerce(true);
    setCommerceError(null);

    if (isLocalMode) {
      const now = new Date().toISOString();
      const localProfileId = profile?.id ?? ORBIT_LOCAL_PROFILE.id;
      setSubscription((current) => {
        if (current) {
          return current;
        }
        return {
          profile_id: localProfileId,
          tier: "FREE",
          status: "ACTIVE",
          renews_at: null,
          created_at: now,
          updated_at: now,
        } satisfies OrbitProfileSubscription;
      });
      setWallet((current) => {
        if (current) {
          return current;
        }
        return {
          profile_id: localProfileId,
          starbits_balance: 1450,
          lifetime_earned: 1450,
          last_daily_claim_at: null,
          created_at: now,
          updated_at: now,
        } satisfies OrbitProfileWallet;
      });
      setStoreItems(getOrbitLocalStoreItems());
      setInventory((current) => {
        const activeBackgroundSlug = profile?.active_background_slug;
        if (!activeBackgroundSlug) {
          return current;
        }
        if (current.some((row) => row.item_slug === activeBackgroundSlug)) {
          return current;
        }
        return [...current, { item_slug: activeBackgroundSlug, purchased_at: now }];
      });
      setLoadingCommerce(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setCommerceError(userError?.message ?? "Unable to load wallet and store.");
      setLoadingCommerce(false);
      return;
    }

    const [subscriptionResult, walletResult, storeResult, inventoryResult] =
      await Promise.all([
        supabase
          .from("profile_subscriptions")
          .select("*")
          .eq("profile_id", user.id)
          .maybeSingle(),
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
          .eq("profile_id", user.id)
          .order("purchased_at", { ascending: false }),
      ]);

    if (subscriptionResult.error) {
      setCommerceError(subscriptionResult.error.message);
      setLoadingCommerce(false);
      return;
    }

    if (walletResult.error) {
      setCommerceError(walletResult.error.message);
      setLoadingCommerce(false);
      return;
    }

    if (storeResult.error) {
      setCommerceError(storeResult.error.message);
      setLoadingCommerce(false);
      return;
    }

    if (inventoryResult.error) {
      setCommerceError(inventoryResult.error.message);
      setLoadingCommerce(false);
      return;
    }

    setSubscription((subscriptionResult.data ?? null) as OrbitProfileSubscription | null);
    setWallet((walletResult.data ?? null) as OrbitProfileWallet | null);
    setStoreItems((storeResult.data ?? []) as OrbitStoreItem[]);
    setInventory((inventoryResult.data ?? []) as OrbitInventoryItem[]);
    setLoadingCommerce(false);
  }, [isLocalMode, profile?.active_background_slug, profile?.id, supabase]);

  const fetchQuestState = useCallback(async () => {
    setLoadingQuests(true);
    setQuestError(null);

    if (isLocalMode) {
      setQuests(getOrbitLocalQuests());
      setQuestProgressRows((currentRows) =>
        currentRows.length ? currentRows : getOrbitLocalQuestProgress(),
      );
      setLoadingQuests(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setQuestError(userError?.message ?? "Unable to load Orbit Missions.");
      setLoadingQuests(false);
      return;
    }

    const [questsResult, progressResult] = await Promise.all([
      supabase
        .from("orbit_quests")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("profile_quest_progress")
        .select("*")
        .eq("profile_id", user.id),
    ]);

    if (questsResult.error) {
      setQuestError(questsResult.error.message);
      setLoadingQuests(false);
      return;
    }

    if (progressResult.error) {
      setQuestError(progressResult.error.message);
      setLoadingQuests(false);
      return;
    }

    setQuests((questsResult.data ?? []) as OrbitQuest[]);
    setQuestProgressRows((progressResult.data ?? []) as OrbitQuestProgress[]);
    setLoadingQuests(false);
  }, [isLocalMode, supabase]);

  async function progressQuest(quest: OrbitQuest) {
    setQuestActionKey(`progress:${quest.slug}`);
    setQuestError(null);
    setQuestSuccess(null);

    if (isLocalMode) {
      const now = new Date().toISOString();
      setQuestProgressRows((currentRows) => {
        const existing = currentRows.find((row) => row.quest_id === quest.id);
        if (!existing) {
          const progressCount = 1;
          return [
            ...currentRows,
            {
              id: `local-quest-progress-${crypto.randomUUID().slice(0, 8)}`,
              profile_id: profile?.id ?? ORBIT_LOCAL_PROFILE.id,
              quest_id: quest.id,
              progress_count: progressCount,
              target_count_snapshot: quest.target_count,
              completed_at: progressCount >= quest.target_count ? now : null,
              last_action_at: now,
              last_claimed_at: null,
              created_at: now,
              updated_at: now,
            },
          ];
        }
        const progressCount = Math.min(existing.target_count_snapshot, existing.progress_count + 1);
        return currentRows.map((row) =>
          row.id === existing.id
            ? {
                ...row,
                progress_count: progressCount,
                completed_at:
                  progressCount >= existing.target_count_snapshot ? row.completed_at ?? now : null,
                last_action_at: now,
                updated_at: now,
              }
            : row,
        );
      });
      setQuestSuccess(`${quest.title} progress updated.`);
      setQuestActionKey(null);
      return;
    }

    const { error } = await supabase.rpc("orbit_log_quest_action", {
      target_slug: quest.slug,
      action_type: questActionByCategory(quest.category),
      amount: 1,
      metadata: { surface: "settings_modal" },
    });

    if (error) {
      setQuestError(error.message);
      setQuestActionKey(null);
      return;
    }

    setQuestSuccess(`${quest.title} progress updated.`);
    await fetchQuestState();
    setQuestActionKey(null);
  }

  async function claimQuestReward(quest: OrbitQuest) {
    setQuestActionKey(`claim:${quest.slug}`);
    setQuestError(null);
    setQuestSuccess(null);

    if (isLocalMode) {
      const row = questProgressByQuestId[quest.id];
      if (!row?.completed_at) {
        setQuestError("Complete the mission before claiming reward.");
        setQuestActionKey(null);
        return;
      }
      if (row.last_claimed_at) {
        setQuestError("Mission reward already claimed for this cycle.");
        setQuestActionKey(null);
        return;
      }

      const now = new Date().toISOString();
      setQuestProgressRows((currentRows) =>
        currentRows.map((item) =>
          item.id === row.id
            ? {
                ...item,
                last_claimed_at: now,
                updated_at: now,
              }
            : item,
        ),
      );
      setWallet((currentWallet) =>
        currentWallet
          ? {
              ...currentWallet,
              starbits_balance: currentWallet.starbits_balance + quest.reward_starbits,
              lifetime_earned: currentWallet.lifetime_earned + quest.reward_starbits,
              updated_at: now,
            }
          : currentWallet,
      );
      setQuestSuccess(`Mission claimed: +${quest.reward_starbits} Starbits.`);
      setQuestActionKey(null);
      return;
    }

    const { data, error } = await supabase.rpc("orbit_claim_quest_reward", {
      target_slug: quest.slug,
    });

    if (error) {
      setQuestError(error.message);
      setQuestActionKey(null);
      return;
    }

    const row =
      (Array.isArray(data) ? data[0] : data) as
        | { rewarded?: number; balance?: number; next_claim_at?: string }
        | null;
    const rewardValue = typeof row?.rewarded === "number" ? row.rewarded : quest.reward_starbits;
    setQuestSuccess(`Mission claimed: +${rewardValue} Starbits.`);

    await Promise.all([fetchQuestState(), fetchCommerceState()]);
    setQuestActionKey(null);
  }

  async function switchSubscriptionTier(nextTier: OrbitSubscriptionTier) {
    const currentTier = subscription?.tier ?? "FREE";
    if (nextTier === currentTier) {
      return;
    }

    if (isLocalMode) {
      const now = new Date().toISOString();
      const renewsAt = nextTier === "FREE" ? null : subscription?.renews_at ?? null;
      setSwitchingTier(nextTier);
      setCommerceError(null);
      setCommerceSuccess(null);
      setSubscription((current) => ({
        profile_id: current?.profile_id ?? profile?.id ?? ORBIT_LOCAL_PROFILE.id,
        tier: nextTier,
        status: "ACTIVE",
        renews_at: renewsAt,
        created_at: current?.created_at ?? now,
        updated_at: now,
      }));
      setCommerceSuccess(`Plan updated: ${formatTierLabel(nextTier)}.`);
      setSwitchingTier(null);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setCommerceError(userError?.message ?? "You must be signed in.");
      return;
    }

    setSwitchingTier(nextTier);
    setCommerceError(null);
    setCommerceSuccess(null);

    const renewsAt = nextTier === "FREE" ? null : subscription?.renews_at ?? null;

    const { data, error } = await supabase
      .from("profile_subscriptions")
      .update({
        tier: nextTier,
        status: "ACTIVE",
        renews_at: renewsAt,
      })
      .eq("profile_id", user.id)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      setCommerceError(
        error?.message ?? "Subscription row is missing. Run Phase 7 migration.",
      );
      setSwitchingTier(null);
      return;
    }

    setSubscription(data as OrbitProfileSubscription);
    setCommerceSuccess(`Plan updated: ${formatTierLabel(nextTier)}.`);
    setSwitchingTier(null);
  }

  async function claimDailyStarbits() {
    setClaimingDaily(true);
    setCommerceError(null);
    setCommerceSuccess(null);

    if (isLocalMode) {
      if (!dailyClaimWindow.canClaim) {
        if (dailyClaimWindow.nextClaimAt) {
          setCommerceSuccess(
            `Already claimed. Next claim available at ${dailyClaimWindow.nextClaimAt.toLocaleString()}.`,
          );
        } else {
          setCommerceSuccess("Daily reward is on cooldown.");
        }
        setClaimingDaily(false);
        return;
      }

      const now = new Date().toISOString();
      setWallet((currentWallet) =>
        currentWallet
          ? {
              ...currentWallet,
              starbits_balance: currentWallet.starbits_balance + DAILY_STARBITS_REWARD,
              lifetime_earned: currentWallet.lifetime_earned + DAILY_STARBITS_REWARD,
              last_daily_claim_at: now,
              updated_at: now,
            }
          : {
              profile_id: profile?.id ?? ORBIT_LOCAL_PROFILE.id,
              starbits_balance: DAILY_STARBITS_REWARD,
              lifetime_earned: DAILY_STARBITS_REWARD,
              last_daily_claim_at: now,
              created_at: now,
              updated_at: now,
            },
      );
      setCommerceSuccess(`Daily reward claimed: +${DAILY_STARBITS_REWARD} Starbits.`);
      setClaimingDaily(false);
      return;
    }

    const { data, error } = await supabase.rpc("claim_daily_starbits", {
      reward: DAILY_STARBITS_REWARD,
    });

    if (error) {
      setCommerceError(error.message);
      setClaimingDaily(false);
      return;
    }

    const row =
      (Array.isArray(data) ? data[0] : data) as
        | { balance?: number; rewarded?: number; next_claim_at?: string }
        | null;
    const rewarded = typeof row?.rewarded === "number" ? row.rewarded : 0;

    if (rewarded > 0) {
      setCommerceSuccess(`Daily reward claimed: +${rewarded} Starbits.`);
    } else if (row?.next_claim_at) {
      const nextLabel = new Date(row.next_claim_at).toLocaleString();
      setCommerceSuccess(`Already claimed. Next claim available at ${nextLabel}.`);
    } else {
      setCommerceSuccess("Daily reward is on cooldown.");
    }

    await fetchCommerceState();
    setClaimingDaily(false);
  }

  async function buyStoreItem(itemSlug: string) {
    setStoreActionKey(`buy:${itemSlug}`);
    setCommerceError(null);
    setCommerceSuccess(null);

    if (isLocalMode) {
      const item = storeItems.find((storeItem) => storeItem.slug === itemSlug);
      if (!item) {
        setCommerceError("Store item is unavailable.");
        setStoreActionKey(null);
        return;
      }
      if (!wallet) {
        setCommerceError("Wallet is unavailable.");
        setStoreActionKey(null);
        return;
      }
      if (ownedItemSlugs.has(itemSlug)) {
        setCommerceSuccess(`${item.name} is already owned.`);
        setStoreActionKey(null);
        return;
      }
      if (wallet.starbits_balance < item.price_starbits) {
        setCommerceError("Not enough Starbits for this purchase.");
        setStoreActionKey(null);
        return;
      }

      const now = new Date().toISOString();
      setWallet({
        ...wallet,
        starbits_balance: wallet.starbits_balance - item.price_starbits,
        updated_at: now,
      });
      setInventory((currentRows) => [
        ...currentRows,
        { item_slug: item.slug, purchased_at: now },
      ]);
      setCommerceSuccess(`${item.name} purchased successfully.`);
      setStoreActionKey(null);
      return;
    }

    const { data, error } = await supabase.rpc("buy_store_item", {
      target_slug: itemSlug,
    });

    if (error) {
      setCommerceError(error.message);
      setStoreActionKey(null);
      return;
    }

    const row =
      (Array.isArray(data) ? data[0] : data) as
        | { balance?: number; item_slug?: string }
        | null;
    const purchasedSlug = row?.item_slug ?? itemSlug;
    const purchasedName =
      storeItems.find((item) => item.slug === purchasedSlug)?.name ?? "Store item";

    setCommerceSuccess(`${purchasedName} purchased successfully.`);
    await fetchCommerceState();
    setStoreActionKey(null);
  }

  async function equipBackground(itemSlug: string | null) {
    setStoreActionKey(`equip:${itemSlug ?? "default"}`);
    setCommerceError(null);
    setCommerceSuccess(null);

    if (isLocalMode) {
      if (profile) {
        const selectedItem = itemSlug
          ? storeItems.find((item) => item.slug === itemSlug)
          : null;
        setProfile({
          ...(profile as OrbitProfile),
          active_background_slug: itemSlug,
          active_background_css: selectedItem?.css_background ?? null,
        });
      }
      setCommerceSuccess(itemSlug ? "Background equipped." : "Default background restored.");
      setStoreActionKey(null);
      return;
    }

    const { error } = await supabase.rpc("set_active_store_background", {
      target_slug: itemSlug,
    });

    if (error) {
      setCommerceError(error.message);
      setStoreActionKey(null);
      return;
    }

    if (profile) {
      const selectedItem = itemSlug
        ? storeItems.find((item) => item.slug === itemSlug)
        : null;
      setProfile({
        ...(profile as OrbitProfile),
        active_background_slug: itemSlug,
        active_background_css: selectedItem?.css_background ?? null,
      });
    }

    setCommerceSuccess(itemSlug ? "Background equipped." : "Default background restored.");
    setStoreActionKey(null);
  }

  async function togglePerformanceMode(nextValue: boolean) {
    if (!profile?.id) {
      return;
    }

    setSavingPerformanceMode(true);
    setCommerceError(null);
    setCommerceSuccess(null);

    if (isLocalMode) {
      setProfile({
        ...(profile as OrbitProfile),
        performance_mode: nextValue,
      });
      setCommerceSuccess(
        nextValue ? "Ultra Performance Mode enabled." : "Ultra Performance Mode disabled.",
      );
      setSavingPerformanceMode(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ performance_mode: nextValue })
      .eq("id", profile.id)
      .select("*")
      .single();

    if (error || !data) {
      setCommerceError(error?.message ?? "Unable to update performance mode.");
      setSavingPerformanceMode(false);
      return;
    }

    setProfile(data as OrbitProfile);
    setCommerceSuccess(
      nextValue ? "Ultra Performance Mode enabled." : "Ultra Performance Mode disabled.",
    );
    setSavingPerformanceMode(false);
  }

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }
    void fetchMfaState();
    void fetchCommerceState();
    void fetchQuestState();
  }, [fetchCommerceState, fetchMfaState, fetchQuestState, settingsOpen]);

  async function enrollTotp() {
    if (isLocalMode) {
      setMfaError("2FA requires cloud auth setup and a signed-in account.");
      setMfaSuccess(null);
      return;
    }

    setMfaError(null);
    setMfaSuccess(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Orbit Authenticator",
    });

    if (error || !data) {
      setMfaError(error?.message ?? "Unable to start 2FA enrollment.");
      return;
    }

    setPendingTotp({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setMfaSuccess("Scan the QR code and verify to complete setup.");
  }

  async function verifyTotp() {
    if (isLocalMode) {
      setMfaError("2FA verification is unavailable in browser local mode.");
      setMfaSuccess(null);
      return;
    }

    if (!pendingTotp || !mfaCode.trim()) {
      setMfaError("Enter a valid 6-digit authenticator code.");
      return;
    }

    setMfaError(null);
    setMfaSuccess(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pendingTotp.factorId,
      code: mfaCode.trim(),
    });

    if (error) {
      setMfaError(error.message);
      return;
    }

    setPendingTotp(null);
    setMfaCode("");
    setMfaSuccess("Two-factor authentication enabled.");
    await fetchMfaState();
  }

  async function removeTotpFactor(factorId: string) {
    if (isLocalMode) {
      setMfaError("2FA factor removal requires cloud auth mode.");
      setMfaSuccess(null);
      return;
    }

    setMfaError(null);
    setMfaSuccess(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setMfaError(error.message);
      return;
    }
    setMfaSuccess("Authenticator removed.");
    await fetchMfaState();
  }

  const pendingQrDataUri = pendingTotp
    ? `data:image/svg+xml;utf8,${encodeURIComponent(pendingTotp.qrCode)}`
    : null;

  async function submitCreateServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createServer({
      name: serverName,
      imageUrl: serverImage,
      templateKey: serverTemplate,
    });
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    resetAndClose();
  }

  async function submitCreateChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modalServerId) {
      setError("No server selected.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await createChannel({
      serverId: modalServerId,
      name: channelName,
      type: channelType,
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    resetAndClose();
  }

  async function submitJoinServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await joinServerByInvite(inviteCode);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    resetAndClose();
  }

  return (
    <>
      <Dialog onOpenChange={(open) => !open && resetAndClose()} open={createServerOpen}>
        <DialogContent>
          <SwipeDismissable direction="down" onDismiss={resetAndClose}>
            <DialogHeader>
              <DialogTitle>Create a new Orbit server</DialogTitle>
              <DialogDescription>
                Start a collaboration hub with instant invite sharing.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-3" onSubmit={submitCreateServer}>
              <Input
                onChange={(event) => setServerName(event.target.value)}
                placeholder="Server name"
                value={serverName}
              />
              <Input
                onChange={(event) => setServerImage(event.target.value)}
                placeholder="Image URL (optional)"
                value={serverImage}
              />
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Starter template
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: "community", label: "Community" },
                      { key: "gaming", label: "Gaming" },
                      { key: "startup", label: "Startup" },
                    ] as Array<{ key: OrbitServerTemplateKey; label: string }>
                  ).map((template) => (
                    <Button
                      className="rounded-lg"
                      key={template.key}
                      onClick={() => setServerTemplate(template.key)}
                      type="button"
                      variant={serverTemplate === template.key ? "default" : "secondary"}
                    >
                      {template.label}
                    </Button>
                  ))}
                </div>
              </div>
              {error ? (
                <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              ) : null}
              <DialogFooter>
                <Button onClick={resetAndClose} type="button" variant="ghost">
                  Cancel
                </Button>
                <Button disabled={submitting} type="submit">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </SwipeDismissable>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && resetAndClose()} open={createChannelOpen}>
        <DialogContent>
          <SwipeDismissable direction="down" onDismiss={resetAndClose}>
            <DialogHeader>
              <DialogTitle>Create channel</DialogTitle>
              <DialogDescription>
                Add text, audio, or video channels to your server.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-3" onSubmit={submitCreateChannel}>
              <Input
                onChange={(event) => setChannelName(event.target.value)}
                placeholder="Channel name"
                value={channelName}
              />
              <div className="grid grid-cols-4 gap-2">
                {(["TEXT", "AUDIO", "VIDEO", "FORUM"] as ChannelType[]).map((typeOption) => (
                  <Button
                    className="rounded-lg"
                    key={typeOption}
                    onClick={() => setChannelType(typeOption)}
                    type="button"
                    variant={channelType === typeOption ? "default" : "secondary"}
                  >
                    {typeOption}
                  </Button>
                ))}
              </div>
              {error ? (
                <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              ) : null}
              <DialogFooter>
                <Button onClick={resetAndClose} type="button" variant="ghost">
                  Cancel
                </Button>
                <Button disabled={submitting} type="submit">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </SwipeDismissable>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && resetAndClose()} open={joinServerOpen}>
        <DialogContent>
          <SwipeDismissable direction="down" onDismiss={resetAndClose}>
            <DialogHeader>
              <DialogTitle>Join a server</DialogTitle>
              <DialogDescription>
                Enter an invite code to join an Orbit workspace.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-3" onSubmit={submitJoinServer}>
              <Input
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="INVITE CODE"
                value={inviteCode}
              />
              {error ? (
                <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              ) : null}
              <DialogFooter>
                <Button onClick={resetAndClose} type="button" variant="ghost">
                  Cancel
                </Button>
                <Button disabled={submitting} type="submit">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Join
                </Button>
              </DialogFooter>
            </form>
          </SwipeDismissable>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && resetAndClose()} open={settingsOpen}>
        <DialogContent className="max-w-2xl">
          <SwipeDismissable direction="down" onDismiss={resetAndClose}>
            <DialogHeader>
              <DialogTitle>Orbit Settings</DialogTitle>
              <DialogDescription>
                Theme engine, security controls, and power tools.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
              <section className="space-y-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Theme selector
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "MIDNIGHT", label: "Midnight" },
                    { value: "ONYX", label: "Onyx (True Black)" },
                    { value: "CYBERPUNK", label: "Cyberpunk (Neon)" },
                    { value: "CUSTOM", label: "Custom CSS" },
                  ].map((item) => (
                    <Button
                      className="justify-start rounded-xl"
                      key={item.value}
                      onClick={() =>
                        setThemePreset(
                          item.value as "MIDNIGHT" | "ONYX" | "CYBERPUNK" | "CUSTOM",
                        )
                      }
                      type="button"
                      variant={themePreset === item.value ? "default" : "secondary"}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Custom CSS
                    </p>
                    <Button
                      className="rounded-full"
                      onClick={() => setThemePreset("CUSTOM")}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Use custom
                    </Button>
                  </div>
                  <Textarea
                    className="min-h-32 rounded-xl border-white/15 bg-black/35 font-mono text-xs"
                    onChange={(event) => setCustomThemeCss(event.target.value)}
                    placeholder=":root { --orbit-accent: #7c3aed; --orbit-panel: #12131c; }"
                    value={customThemeCss}
                  />
                  <p className="text-[11px] text-zinc-500">
                    Custom CSS is injected only when the Custom CSS theme is active.
                  </p>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                  {t("settings.languageTitle")}
                </p>
                <p className="text-sm text-zinc-300">{t("settings.languageHelp")}</p>
                <OrbitLanguagePicker showLabel={false} />
              </section>

              <section className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Runtime
                  </p>
                  {isElectron ? (
                    <span className="rounded-full border border-cyan-400/35 bg-cyan-500/15 px-2.5 py-1 text-[10px] uppercase tracking-wide text-cyan-100">
                      Desktop App
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-wide text-zinc-300">
                      Browser
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-200">
                  Running on: {platformLabel}
                </p>
                <p className="text-xs text-zinc-400">
                  {isElectron
                    ? "Orbit desktop mode is active with tray persistence."
                    : "Install Orbit from the landing page to unlock desktop runtime."}
                </p>
              </section>

              <section className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Ultra Performance Mode
                    </p>
                    <p className="text-sm text-zinc-200">
                      Reduce blur and heavy effects for smoother performance on low-end devices.
                    </p>
                  </div>
                  <Button
                    className="rounded-full"
                    disabled={!profile || savingPerformanceMode}
                    onClick={() => void togglePerformanceMode(!Boolean(profile?.performance_mode))}
                    size="sm"
                    type="button"
                    variant={profile?.performance_mode ? "default" : "secondary"}
                  >
                    <Gauge className="h-4 w-4" />
                    {profile?.performance_mode ? "Enabled" : "Enable"}
                  </Button>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Orbit Pulse Membership
                  </p>
                  <span className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-[10px] uppercase tracking-wide text-violet-100">
                    Current: {formatTierLabel(subscription?.tier)}
                  </span>
                </div>
                <p className="text-sm text-zinc-200">
                  Pulse unlocks premium stream quality, identity cosmetics, and faster support.
                </p>
                <div className="grid gap-2 lg:grid-cols-3">
                  {PULSE_PLANS.map((plan) => {
                    const currentTier = subscription?.tier ?? "FREE";
                    const isCurrent = currentTier === plan.tier;
                    const isWorking = switchingTier === plan.tier;
                    return (
                      <div
                        className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3"
                        key={plan.tier}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-zinc-100">{plan.label}</p>
                          <p className="text-xs text-zinc-400">{plan.price}/mo</p>
                        </div>
                        <ul className="space-y-1 text-[11px] text-zinc-300">
                          {plan.perks.map((perk) => (
                            <li className="flex items-start gap-1.5" key={perk}>
                              <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-300" />
                              <span>{perk}</span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          className="w-full rounded-lg"
                          disabled={isCurrent || isWorking}
                          onClick={() => void switchSubscriptionTier(plan.tier)}
                          size="sm"
                          type="button"
                          variant={isCurrent ? "secondary" : "default"}
                        >
                          {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {isCurrent ? "Current plan" : `Switch to ${plan.label}`}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-500">
                  Billing checkout is mocked for now. This controls feature flags and UI entitlements.
                </p>
              </section>

              <section className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Orbit Vault Store
                    </p>
                    <p className="text-sm text-zinc-200">
                      Spend Starbits on backgrounds and upcoming cosmetics.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100">
                    <Wallet className="h-3.5 w-3.5" />
                    <span>{(wallet?.starbits_balance ?? 0).toLocaleString()} Starbits</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="rounded-full"
                    disabled={!dailyClaimWindow.canClaim || claimingDaily}
                    onClick={() => void claimDailyStarbits()}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {claimingDaily ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {dailyClaimWindow.canClaim
                      ? `Claim ${DAILY_STARBITS_REWARD} Starbits`
                      : "Daily claim cooling down"}
                  </Button>
                  <Button
                    className="rounded-full"
                    disabled={loadingCommerce}
                    onClick={() => void fetchCommerceState()}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Store className="h-4 w-4" />
                    Refresh vault
                  </Button>
                  {profile?.active_background_slug ? (
                    <Button
                      className="rounded-full"
                      disabled={storeActionKey === "equip:default"}
                      onClick={() => void equipBackground(null)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {storeActionKey === "equip:default" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Use default background
                    </Button>
                  ) : null}
                </div>

                {dailyClaimWindow.nextClaimAt && !dailyClaimWindow.canClaim ? (
                  <p className="text-[11px] text-zinc-500">
                    Next daily reward unlocks at {dailyClaimWindow.nextClaimAt.toLocaleString()}.
                  </p>
                ) : null}

                {loadingCommerce ? (
                  <p className="text-sm text-zinc-300">Loading Orbit Vault inventory...</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {storeItems.map((item) => {
                      const owned = ownedItemSlugs.has(item.slug);
                      const isBackground = item.category === "BACKGROUND";
                      const isEquipped =
                        isBackground && profile?.active_background_slug === item.slug;
                      const buyActionKey = `buy:${item.slug}`;
                      const equipActionKey = `equip:${item.slug}`;
                      const isWorking =
                        storeActionKey === buyActionKey || storeActionKey === equipActionKey;

                      return (
                        <article
                          className="space-y-2 rounded-xl border border-white/10 bg-black/35 p-3"
                          key={item.slug}
                        >
                          <div
                            className="relative h-20 rounded-lg border border-white/10"
                            style={
                              isBackground && item.css_background
                                ? { background: item.css_background }
                                : undefined
                            }
                          >
                            {!isBackground ? (
                              <div className="flex h-full items-center justify-center text-2xl">
                                {item.preview_emoji ?? "FX"}
                              </div>
                            ) : null}
                            <span className="absolute right-2 top-2 rounded-full border border-black/30 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-100">
                              {item.rarity}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-100">{item.name}</p>
                            <p className="text-xs text-zinc-300">{item.description}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-zinc-400">
                              {item.price_starbits.toLocaleString()} Starbits
                            </p>
                            <Button
                              className="rounded-full"
                              disabled={
                                isWorking ||
                                (owned && !isBackground) ||
                                (!owned && (wallet?.starbits_balance ?? 0) < item.price_starbits)
                              }
                              onClick={() => {
                                if (owned && isBackground) {
                                  void equipBackground(item.slug);
                                  return;
                                }
                                if (!owned) {
                                  void buyStoreItem(item.slug);
                                }
                              }}
                              size="sm"
                              type="button"
                              variant={isEquipped ? "secondary" : "default"}
                            >
                              {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              {owned
                                ? isBackground
                                  ? isEquipped
                                    ? "Equipped"
                                    : "Equip"
                                  : "Owned"
                                : "Buy"}
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {commerceError ? (
                  <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {commerceError}
                  </p>
                ) : null}
                {commerceSuccess ? (
                  <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    {commerceSuccess}
                  </p>
                ) : null}
              </section>

              <section className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Orbit Missions
                    </p>
                    <p className="text-sm text-zinc-200">
                      Quests built in Orbit style: visits, sponsor moments, mini-play loops, and social actions.
                    </p>
                  </div>
                  <span className="rounded-full border border-cyan-400/35 bg-cyan-500/12 px-2.5 py-1 text-[10px] uppercase tracking-wide text-cyan-100">
                    Ad + engagement revenue layer
                  </span>
                </div>
                <div>
                  <Button
                    className="rounded-full"
                    disabled={loadingQuests}
                    onClick={() => void fetchQuestState()}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Store className="h-4 w-4" />
                    Refresh missions
                  </Button>
                </div>

                {loadingQuests ? (
                  <p className="text-sm text-zinc-300">Loading missions...</p>
                ) : (
                  <div className="space-y-3">
                    {!quests.length ? (
                      <p className="text-sm text-zinc-300">
                        No missions yet. Seed quests from Phase 8 migration.
                      </p>
                    ) : null}
                    {quests.map((quest) => {
                      const progressRow = questProgressByQuestId[quest.id];
                      const progressCount = progressRow?.progress_count ?? 0;
                      const targetCount = progressRow?.target_count_snapshot ?? quest.target_count;
                      const isCompleted = Boolean(progressRow?.completed_at);
                      const progressActionKey = `progress:${quest.slug}`;
                      const claimActionKey = `claim:${quest.slug}`;
                      const isProgressing = questActionKey === progressActionKey;
                      const isClaiming = questActionKey === claimActionKey;
                      const nextCycleAt = progressRow?.last_claimed_at
                        ? new Date(
                            new Date(progressRow.last_claimed_at).getTime() +
                              quest.repeat_interval_hours * 60 * 60 * 1000,
                          )
                        : null;

                      return (
                        <article
                          className="space-y-2 rounded-xl border border-white/10 bg-black/35 p-3"
                          key={quest.id}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-zinc-100">{quest.title}</p>
                              <p className="text-xs text-zinc-300">{quest.description}</p>
                            </div>
                            <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-100">
                              +{quest.reward_starbits} Starbits
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                            <span className="rounded-full border border-white/15 px-2 py-0.5">
                              {quest.category}
                            </span>
                            <span>
                              Progress: {progressCount}/{targetCount}
                            </span>
                            <span>Cycle: every {quest.repeat_interval_hours}h</span>
                            {quest.sponsor_name ? (
                              <span className="rounded-full border border-violet-400/35 bg-violet-500/10 px-2 py-0.5 text-violet-100">
                                Sponsor: {quest.sponsor_name}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              className="rounded-full"
                              disabled={isCompleted || isProgressing || isClaiming}
                              onClick={() => {
                                if (quest.category === "WATCH" || quest.category === "PLAY") {
                                  setQuestError(
                                    "Sponsored WATCH/PLAY missions require full verification in Orbit Missions view.",
                                  );
                                  return;
                                }
                                void progressQuest(quest);
                              }}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              {isProgressing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              {getQuestActionLabel(quest.category)}
                            </Button>
                            <Button
                              className="rounded-full"
                              disabled={!isCompleted || isClaiming || isProgressing}
                              onClick={() => void claimQuestReward(quest)}
                              size="sm"
                              type="button"
                              variant={isCompleted ? "default" : "ghost"}
                            >
                              {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Claim reward
                            </Button>
                            {quest.sponsor_url ? (
                              <a
                                className="text-xs text-cyan-200 underline-offset-2 hover:underline"
                                href={quest.sponsor_url}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Sponsor destination
                              </a>
                            ) : null}
                          </div>

                          {nextCycleAt ? (
                            <p className="text-[11px] text-zinc-500">
                              Last claim cycle resets around {nextCycleAt.toLocaleString()}.
                            </p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}

                {questError ? (
                  <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {questError}
                  </p>
                ) : null}
                {questSuccess ? (
                  <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    {questSuccess}
                  </p>
                ) : null}
              </section>

              <section className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Two-Factor Authentication
                  </p>
                  <span className="text-xs text-zinc-400">
                    Session AAL: {aalLevel ?? "unknown"}
                  </span>
                </div>

                {loadingMfa ? (
                  <p className="text-sm text-zinc-300">Loading 2FA status...</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-zinc-200">
                      {totpFactors.length
                        ? `${totpFactors.length} authenticator factor(s) connected.`
                        : "No authenticator configured yet."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="rounded-full"
                        disabled={isLocalMode}
                        onClick={() => void enrollTotp()}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Enable TOTP
                      </Button>
                      {totpFactors.map((factor) => (
                        <Button
                          className="rounded-full"
                          key={factor.id}
                          onClick={() => void removeTotpFactor(factor.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Remove {factor.friendly_name ?? "factor"}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {pendingTotp && pendingQrDataUri ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="mb-2 text-xs text-zinc-400">
                      Scan QR in your authenticator app, then verify.
                    </p>
                    <div className="mb-2 w-fit rounded-lg border border-white/10 bg-white p-2">
                      <Image
                        alt="Orbit 2FA QR code"
                        height={180}
                        src={pendingQrDataUri}
                        unoptimized
                        width={180}
                      />
                    </div>
                    <p className="mb-2 text-[11px] text-zinc-500">
                      Secret: {pendingTotp.secret}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-10"
                        inputMode="numeric"
                        maxLength={8}
                        onChange={(event) => setMfaCode(event.target.value)}
                        placeholder="123456"
                        value={mfaCode}
                      />
                      <Button
                        className="rounded-full"
                        onClick={() => void verifyTotp()}
                        type="button"
                      >
                        Verify
                      </Button>
                    </div>
                  </div>
                ) : null}

                {mfaError ? (
                  <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {mfaError}
                  </p>
                ) : null}
                {mfaSuccess ? (
                  <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    {mfaSuccess}
                  </p>
                ) : null}
              </section>
            </div>

            <DialogFooter>
              <Button onClick={resetAndClose} type="button">
                Close
              </Button>
            </DialogFooter>
          </SwipeDismissable>
        </DialogContent>
      </Dialog>
    </>
  );
}
