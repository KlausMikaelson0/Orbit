"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gamepad2,
  Gift,
  PlayCircle,
  RefreshCcw,
  Sparkles,
  Store,
  Trophy,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import {
  ORBIT_LOCAL_PROFILE,
  getOrbitLocalQuestProgress,
  getOrbitLocalQuests,
} from "@/src/lib/orbit-local-data";
import type { OrbitOfferwallOffer } from "@/src/lib/orbit-offerwall";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type { OrbitProfileWallet, OrbitQuest, OrbitQuestProgress } from "@/src/types/orbit";

type QuestTab = "ALL" | "CLAIMED";
type SponsoredGateMode = "WATCH" | "PLAY";

interface SponsoredGateState {
  questId: string;
  mode: SponsoredGateMode;
  secondsLeft: number;
  taps: number;
  openedSponsor: boolean;
  pausedForFocusLoss: boolean;
  completed: boolean;
  failed: boolean;
}

const SPONSORED_WATCH_SECONDS = 36;
const SPONSORED_PLAY_SECONDS = 42;
const SPONSORED_PLAY_TAPS = 18;
const SPONSORED_DEMO_VIDEO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const SPONSORED_VIDEO_BY_SLUG: Record<string, string> = {
  "local-watch-sponsor-full": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "local-watch-r6-spotlight": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "local-watch-opera-gx": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "local-watch-azure-build": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "sponsor-video-winds-meet": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "sponsor-video-r6-siege": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "sponsor-video-opera-gx": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "sponsor-video-azure-build": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
};

function resolveSponsoredVideoSource(quest: OrbitQuest) {
  const candidate = quest.sponsor_url?.trim() ?? "";
  if (candidate && /\.mp4($|\?)/i.test(candidate)) {
    return candidate;
  }
  if (SPONSORED_VIDEO_BY_SLUG[quest.slug]) {
    return SPONSORED_VIDEO_BY_SLUG[quest.slug];
  }
  return SPONSORED_DEMO_VIDEO_URL;
}

const categoryBackground: Record<string, string> = {
  VISIT:
    "radial-gradient(130% 140% at 12% 18%, rgba(56,189,248,0.36), transparent 50%), linear-gradient(135deg, #0c1226 0%, #12203f 55%, #140f29 100%)",
  WATCH:
    "radial-gradient(130% 140% at 84% 18%, rgba(251,191,36,0.36), transparent 52%), linear-gradient(135deg, #160e05 0%, #2d1a0b 55%, #1a1324 100%)",
  PLAY:
    "radial-gradient(130% 140% at 18% 82%, rgba(168,85,247,0.42), transparent 52%), linear-gradient(135deg, #0b0918 0%, #1b1440 54%, #161027 100%)",
  SOCIAL:
    "radial-gradient(130% 140% at 88% 82%, rgba(244,63,94,0.36), transparent 52%), linear-gradient(135deg, #1a0a12 0%, #301323 54%, #141827 100%)",
};

const QUEST_CAMPAIGN_STYLES: Record<string, string> = {
  "local-watch-sponsor-full":
    "radial-gradient(120% 120% at 12% 18%, rgba(56,189,248,0.28), transparent 45%), linear-gradient(145deg,#0b1a28,#132a46,#111827)",
  "local-watch-r6-spotlight":
    "radial-gradient(120% 120% at 84% 18%, rgba(239,68,68,0.28), transparent 45%), linear-gradient(145deg,#1f1414,#2f1a1a,#111827)",
  "local-watch-opera-gx":
    "radial-gradient(120% 120% at 18% 80%, rgba(168,85,247,0.3), transparent 50%), linear-gradient(145deg,#180f22,#24143a,#111827)",
  "local-watch-azure-build":
    "radial-gradient(120% 120% at 82% 20%, rgba(14,165,233,0.3), transparent 48%), linear-gradient(145deg,#102033,#17314d,#111827)",
  "local-play-sponsored-challenge":
    "radial-gradient(120% 120% at 24% 26%, rgba(34,197,94,0.28), transparent 45%), linear-gradient(145deg,#0f241a,#173122,#111827)",
};

const OFFER_CATEGORY_LABELS: Record<OrbitOfferwallOffer["category"], string> = {
  PLAY: "Game Quest",
  WATCH: "Watch Quest",
  INSTALL: "Install Quest",
  SURVEY: "Survey Quest",
};

function getOfferCardBackground(offer: OrbitOfferwallOffer) {
  if (offer.thumbnailUrl) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.16), rgba(0,0,0,0.78)), url("${offer.thumbnailUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    } as const;
  }
  if (offer.category === "PLAY") {
    return {
      background:
        "radial-gradient(120% 120% at 18% 20%, rgba(139,92,246,0.38), transparent 50%), linear-gradient(145deg,#110d25,#1d1453,#111827)",
    } as const;
  }
  if (offer.category === "WATCH") {
    return {
      background:
        "radial-gradient(120% 120% at 82% 20%, rgba(251,191,36,0.34), transparent 52%), linear-gradient(145deg,#22170a,#3a240f,#111827)",
    } as const;
  }
  if (offer.category === "INSTALL") {
    return {
      background:
        "radial-gradient(120% 120% at 22% 82%, rgba(56,189,248,0.3), transparent 52%), linear-gradient(145deg,#0f1a2f,#17304f,#111827)",
    } as const;
  }
  return {
    background:
      "radial-gradient(120% 120% at 86% 18%, rgba(236,72,153,0.28), transparent 52%), linear-gradient(145deg,#201126,#35173d,#111827)",
  } as const;
}

function progressPercent(progress: number, target: number) {
  if (target <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((progress / target) * 100));
}

export function OrbitQuestsView() {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const watchVideoRef = useRef<HTMLVideoElement | null>(null);
  const setActiveShop = useOrbitNavStore((state) => state.setActiveShop);
  const profileId = useOrbitNavStore((state) => state.profile?.id ?? null);
  const [tab, setTab] = useState<QuestTab>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [wallet, setWallet] = useState<OrbitProfileWallet | null>(null);
  const [quests, setQuests] = useState<OrbitQuest[]>([]);
  const [progressRows, setProgressRows] = useState<OrbitQuestProgress[]>([]);
  const [sponsoredGate, setSponsoredGate] = useState<SponsoredGateState | null>(null);
  const [questPlayerOpen, setQuestPlayerOpen] = useState(false);
  const [offerwallOffers, setOfferwallOffers] = useState<OrbitOfferwallOffer[]>([]);
  const [offerwallSource, setOfferwallSource] = useState<"ADGATE" | "FALLBACK" | "RATE_LIMITED">(
    "FALLBACK",
  );
  const [loadingOfferwall, setLoadingOfferwall] = useState(false);
  const [offerwallError, setOfferwallError] = useState<string | null>(null);

  const progressByQuestId = useMemo(
    () =>
      Object.fromEntries(progressRows.map((row) => [row.quest_id, row])) as Record<
        string,
        OrbitQuestProgress
      >,
    [progressRows],
  );

  const visibleQuests = useMemo(() => {
    if (tab === "ALL") {
      return quests;
    }
    return quests.filter((quest) => Boolean(progressByQuestId[quest.id]?.last_claimed_at));
  }, [progressByQuestId, quests, tab]);

  const activeSponsoredQuest = useMemo(
    () => quests.find((quest) => quest.id === sponsoredGate?.questId) ?? null,
    [quests, sponsoredGate?.questId],
  );
  const sponsoredGateId = sponsoredGate?.questId ?? null;
  const sponsoredGateMode = sponsoredGate?.mode ?? null;
  const sponsoredGateCompleted = Boolean(sponsoredGate?.completed);
  const sponsoredGateFailed = Boolean(sponsoredGate?.failed);
  const sponsoredProgressPercent = useMemo(() => {
    if (!sponsoredGate) {
      return 0;
    }
    if (sponsoredGate.mode === "WATCH") {
      return Math.min(
        100,
        ((SPONSORED_WATCH_SECONDS - sponsoredGate.secondsLeft) / SPONSORED_WATCH_SECONDS) * 100,
      );
    }
    return Math.min(
      100,
      ((SPONSORED_PLAY_SECONDS - sponsoredGate.secondsLeft) / SPONSORED_PLAY_SECONDS) * 100,
    );
  }, [sponsoredGate]);

  const fetchQuestState = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseReady()) {
      const now = new Date().toISOString();
      setQuests(getOrbitLocalQuests());
      setProgressRows(getOrbitLocalQuestProgress());
      setWallet({
        profile_id: ORBIT_LOCAL_PROFILE.id,
        starbits_balance: 980,
        lifetime_earned: 980,
        last_daily_claim_at: null,
        created_at: now,
        updated_at: now,
      });
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

    const [questResult, progressResult, walletResult] = await Promise.all([
      supabase
        .from("orbit_quests")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("profile_quest_progress")
        .select("*")
        .eq("profile_id", user.id),
      supabase
        .from("profile_wallets")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle(),
    ]);

    if (questResult.error) {
      setError(questResult.error.message);
      setLoading(false);
      return;
    }
    if (progressResult.error) {
      setError(progressResult.error.message);
      setLoading(false);
      return;
    }
    if (walletResult.error) {
      setError(walletResult.error.message);
      setLoading(false);
      return;
    }

    setQuests((questResult.data ?? []) as OrbitQuest[]);
    setProgressRows((progressResult.data ?? []) as OrbitQuestProgress[]);
    setWallet((walletResult.data ?? null) as OrbitProfileWallet | null);
    setLoading(false);
  }, [supabase]);

  const fetchOfferwallOffers = useCallback(async () => {
    setLoadingOfferwall(true);
    setOfferwallError(null);

    try {
      const params = new URLSearchParams();
      params.set("profileId", profileId ?? ORBIT_LOCAL_PROFILE.id);
      const response = await fetch(`/api/offerwall/offers?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        offers?: OrbitOfferwallOffer[];
        source?: "ADGATE" | "FALLBACK" | "RATE_LIMITED";
        error?: string;
        warning?: string;
      };
      setOfferwallOffers((payload.offers ?? []).slice(0, 12));
      setOfferwallSource(payload.source ?? "FALLBACK");
      setOfferwallError(payload.error ?? payload.warning ?? null);
      setLoadingOfferwall(false);
    } catch {
      setOfferwallOffers([]);
      setOfferwallSource("FALLBACK");
      setOfferwallError("Unable to load live offers right now.");
      setLoadingOfferwall(false);
    }
  }, [profileId]);

  useEffect(() => {
    void fetchQuestState();
  }, [fetchQuestState]);

  useEffect(() => {
    void fetchOfferwallOffers();
  }, [fetchOfferwallOffers]);

  useEffect(() => {
    if (!sponsoredGateId || sponsoredGateCompleted || sponsoredGateFailed) {
      return;
    }

    const timer = window.setInterval(() => {
      const canTrack =
        document.visibilityState === "visible" && document.hasFocus();
      if (!canTrack) {
        watchVideoRef.current?.pause();
      }

      setSponsoredGate((current) => {
        if (!current || current.completed || current.failed) {
          return current;
        }

        if (!canTrack) {
          return current.pausedForFocusLoss
            ? current
            : {
                ...current,
                pausedForFocusLoss: true,
              };
        }

        if (current.mode === "WATCH") {
          const video = watchVideoRef.current;
          const videoIsPlaying = Boolean(
            video && !video.paused && !video.ended && video.readyState >= 2,
          );
          if (!videoIsPlaying) {
            return current.pausedForFocusLoss
              ? {
                  ...current,
                  pausedForFocusLoss: false,
                }
              : current;
          }
        }

        if (current.secondsLeft <= 1) {
          if (current.mode === "WATCH") {
            return {
              ...current,
              secondsLeft: 0,
              pausedForFocusLoss: false,
              completed: true,
            };
          }

          const finished = current.taps >= SPONSORED_PLAY_TAPS;
          return {
            ...current,
            secondsLeft: 0,
            pausedForFocusLoss: false,
            completed: finished && current.openedSponsor,
            failed: !(finished && current.openedSponsor),
          };
        }

        return {
          ...current,
          secondsLeft: current.secondsLeft - 1,
          pausedForFocusLoss: false,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sponsoredGateCompleted, sponsoredGateFailed, sponsoredGateId, sponsoredGateMode]);

  function startSponsoredGate(quest: OrbitQuest) {
    const mode: SponsoredGateMode = quest.category === "PLAY" ? "PLAY" : "WATCH";
    setError(null);
    setSuccess(null);
    setSponsoredGate({
      questId: quest.id,
      mode,
      secondsLeft: mode === "WATCH" ? SPONSORED_WATCH_SECONDS : SPONSORED_PLAY_SECONDS,
      taps: 0,
      openedSponsor: false,
      pausedForFocusLoss: false,
      completed: false,
      failed: false,
    });
    setQuestPlayerOpen(true);
  }

  function registerPlayTap() {
    setSponsoredGate((current) => {
      if (!current || current.mode !== "PLAY" || current.completed || current.failed) {
        return current;
      }
      const nextTaps = current.taps + 1;
      return {
        ...current,
        taps: nextTaps,
        completed: nextTaps >= SPONSORED_PLAY_TAPS && current.openedSponsor,
      };
    });
  }

  async function completeSponsoredGate(quest: OrbitQuest) {
    if (!sponsoredGate || sponsoredGate.questId !== quest.id) {
      setError("Start verification first.");
      return;
    }
    if (!sponsoredGate.completed || sponsoredGate.failed) {
      setError("Task not fully completed. No Starbits awarded.");
      return;
    }
    if (sponsoredGate.mode === "PLAY" && !sponsoredGate.openedSponsor) {
      setError("Open the partner game page to finish verification.");
      return;
    }

    await progressQuest(quest);
    setSponsoredGate(null);
    setQuestPlayerOpen(false);
  }

  function openSponsorDestination(url: string | null) {
    if (!url) {
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    setSponsoredGate((current) =>
      current
        ? {
            ...current,
            openedSponsor: true,
            completed:
              current.mode === "PLAY"
                ? current.taps >= SPONSORED_PLAY_TAPS
                : current.completed,
          }
        : current,
    );
  }

  function openOfferDestination(offer: OrbitOfferwallOffer) {
    const params = new URLSearchParams({
      u: offer.offerUrl,
      offerId: offer.id,
      provider: offer.provider,
    });
    if (profileId) {
      params.set("profileId", profileId);
    }
    window.open(`/api/offerwall/click?${params.toString()}`, "_blank", "noopener,noreferrer");
    setSuccess(
      `${offer.title} opened. Reward is credited after partner verification callback.`,
    );
    setError(null);
  }

  async function progressQuest(quest: OrbitQuest) {
    setActionKey(`progress:${quest.slug}`);
    setError(null);
    setSuccess(null);

    if (!isSupabaseReady()) {
      setProgressRows((currentRows) => {
        const now = new Date().toISOString();
        const existing = currentRows.find((row) => row.quest_id === quest.id);
        if (!existing) {
          const progressCount = 1;
          return [
            ...currentRows,
            {
              id: `local-quest-progress-${crypto.randomUUID().slice(0, 8)}`,
              profile_id: ORBIT_LOCAL_PROFILE.id,
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
        const progressCount = Math.min(
          existing.target_count_snapshot,
          existing.progress_count + 1,
        );
        return currentRows.map((row) =>
          row.id === existing.id
            ? {
                ...row,
                progress_count: progressCount,
                completed_at:
                  progressCount >= existing.target_count_snapshot
                    ? row.completed_at ?? now
                    : null,
                last_action_at: now,
                updated_at: now,
              }
            : row,
        );
      });
      setSuccess(`Mission progress updated: ${quest.title}`);
      setActionKey(null);
      return;
    }

    const { error } = await supabase.rpc("orbit_log_quest_action", {
      target_slug: quest.slug,
      action_type: quest.action_type,
      amount: 1,
      metadata: { surface: "orbit_quests_view" },
    });

    if (error) {
      setError(error.message);
      setActionKey(null);
      return;
    }

    setSuccess(`Mission progress updated: ${quest.title}`);
    await fetchQuestState();
    setActionKey(null);
  }

  async function claimQuest(quest: OrbitQuest) {
    setActionKey(`claim:${quest.slug}`);
    setError(null);
    setSuccess(null);

    if (!isSupabaseReady()) {
      const row = progressByQuestId[quest.id];
      if (!row?.completed_at) {
        setError("Complete the quest before claiming reward.");
        setActionKey(null);
        return;
      }
      if (row.last_claimed_at) {
        setError("Quest reward already claimed.");
        setActionKey(null);
        return;
      }

      const now = new Date().toISOString();
      setProgressRows((currentRows) =>
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
      setSuccess(`Reward claimed: +${quest.reward_starbits} Starbits.`);
      setActionKey(null);
      return;
    }

    const { data, error } = await supabase.rpc("orbit_claim_quest_reward", {
      target_slug: quest.slug,
    });

    if (error) {
      setError(error.message);
      setActionKey(null);
      return;
    }

    const row =
      (Array.isArray(data) ? data[0] : data) as { rewarded?: number } | null;
    const rewarded = typeof row?.rewarded === "number" ? row.rewarded : quest.reward_starbits;
    setSuccess(`Reward claimed: +${rewarded} Starbits.`);
    await fetchQuestState();
    setActionKey(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <div className="relative overflow-hidden px-5 py-5">
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_10%_10%,rgba(99,102,241,0.35),transparent_48%),radial-gradient(140%_140%_at_88%_80%,rgba(56,189,248,0.22),transparent_54%),linear-gradient(140deg,#090b15_0%,#0f1730_56%,#140f2b_100%)]" />
          <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-300">
                Orbit Missions
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Play. Complete. Earn Starbits.</h2>
              <p className="mt-1 text-sm text-zinc-300">
                Sponsored experiences and community quests with Orbit identity.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100">
                Balance: {(wallet?.starbits_balance ?? 0).toLocaleString()}
              </span>
              <Button
                className="rounded-full"
                onClick={() => setActiveShop()}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Store className="h-4 w-4" />
                Open Shop
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            className="rounded-full"
            onClick={() => setTab("ALL")}
            size="sm"
            type="button"
            variant={tab === "ALL" ? "default" : "secondary"}
          >
            All Quests
          </Button>
          <Button
            className="rounded-full"
            onClick={() => setTab("CLAIMED")}
            size="sm"
            type="button"
            variant={tab === "CLAIMED" ? "default" : "secondary"}
          >
            Claimed Quests
          </Button>
        </div>
        <Button
          className="rounded-full"
          disabled={loading}
          onClick={() => void fetchQuestState()}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Sparkles className="h-4 w-4" />
          Refresh
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
              Live Game & Ad Offers
            </p>
            <h3 className="text-sm font-semibold text-zinc-100">
              Play partner games and earn Starbits
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                offerwallSource === "ADGATE"
                  ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-300/35 bg-amber-500/10 text-amber-100"
              }`}
            >
              Source: {offerwallSource === "ADGATE" ? "Live Offerwall" : "Fallback Feed"}
            </span>
            <Button
              className="rounded-full"
              disabled={loadingOfferwall}
              onClick={() => void fetchOfferwallOffers()}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCcw className={`h-4 w-4 ${loadingOfferwall ? "animate-spin" : ""}`} />
              Refresh offers
            </Button>
          </div>
        </div>

        {offerwallOffers.length ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {offerwallOffers.map((offer) => (
              <article
                className="overflow-hidden rounded-xl border border-white/10 bg-black/30"
                key={offer.id}
              >
                <div
                  className="relative h-28 border-b border-white/10"
                  style={getOfferCardBackground(offer)}
                >
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-100/90">
                      {offer.provider === "ADGATE" ? "AdGate Partner" : "Orbit Offerwall"}
                    </p>
                    <p className="text-[11px] text-zinc-200/90">
                      {OFFER_CATEGORY_LABELS[offer.category]}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{offer.title}</p>
                      <p className="line-clamp-2 text-xs text-zinc-300">{offer.description}</p>
                    </div>
                    <span className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
                      +{offer.rewardStarbits.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <Gamepad2 className="h-3.5 w-3.5" />
                      {offer.ctaLabel}
                    </span>
                    <span>${(offer.payoutUsdCents / 100).toFixed(2)}</span>
                  </div>
                  <Button
                    className="w-full rounded-full"
                    onClick={() => openOfferDestination(offer)}
                    size="sm"
                    type="button"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Offer
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : loadingOfferwall ? (
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-5 text-sm text-zinc-300">
            Loading offerwall feed...
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/25 px-3 py-5 text-sm text-zinc-400">
            No live offers available for this region right now.
          </div>
        )}
      </section>

      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-zinc-300">
          Loading Orbit Missions...
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 overflow-auto lg:grid-cols-2 xl:grid-cols-3">
          {visibleQuests.map((quest) => {
            const progress = progressByQuestId[quest.id];
            const progressCount = progress?.progress_count ?? 0;
            const targetCount = progress?.target_count_snapshot ?? quest.target_count;
            const completed = Boolean(progress?.completed_at);
            const claimedAt = progress?.last_claimed_at
              ? new Date(progress.last_claimed_at).toLocaleString()
              : null;
            const pct = progressPercent(progressCount, targetCount);
            const progressBusy = actionKey === `progress:${quest.slug}`;
            const claimBusy = actionKey === `claim:${quest.slug}`;

            return (
              <article
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                key={quest.id}
              >
                <div
                  className="relative h-32 border-b border-white/10"
                  style={{
                    background:
                      QUEST_CAMPAIGN_STYLES[quest.slug] ??
                      categoryBackground[quest.category] ??
                      "linear-gradient(140deg,#0b0d16,#1a1730)",
                  }}
                >
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-100/90">
                      {quest.sponsor_name ?? "Orbit Campaign"}
                    </p>
                    <p className="text-[11px] text-zinc-300">
                      {quest.category === "WATCH"
                        ? "Video Quest"
                        : quest.category === "PLAY"
                          ? "Play Quest"
                          : "Daily Mission"}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{quest.title}</p>
                      <p className="text-xs text-zinc-300">{quest.description}</p>
                    </div>
                    <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-100">
                      +{quest.reward_starbits}
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-violet-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                    <span>
                      Progress: {progressCount}/{targetCount}
                    </span>
                    <span>Type: {quest.category}</span>
                    {quest.category === "WATCH" || quest.category === "PLAY" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-100">
                        <Clock3 className="h-3 w-3" />
                        Full completion required
                      </span>
                    ) : null}
                    {quest.sponsor_name ? <span>Sponsor: {quest.sponsor_name}</span> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="rounded-full"
                      disabled={completed || progressBusy || claimBusy}
                      onClick={() => {
                        if (quest.category === "WATCH" || quest.category === "PLAY") {
                          startSponsoredGate(quest);
                          return;
                        }
                        void progressQuest(quest);
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {quest.category === "WATCH" ? (
                        <Video className="h-4 w-4" />
                      ) : quest.category === "PLAY" ? (
                        <Trophy className="h-4 w-4" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {progressBusy
                        ? "Processing..."
                        : quest.category === "WATCH"
                          ? "Start Video Quest"
                          : quest.category === "PLAY"
                            ? "Start Play Quest"
                            : "Accept Quest"}
                    </Button>
                    <Button
                      className="rounded-full"
                      disabled={!completed || claimBusy || progressBusy}
                      onClick={() => void claimQuest(quest)}
                      size="sm"
                      type="button"
                      variant={completed ? "default" : "ghost"}
                    >
                      {claimBusy ? <Gift className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      Claim Reward
                    </Button>
                  </div>

                  {sponsoredGate?.questId === quest.id ? (
                    <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-amber-100">
                          Verification running in quest player.
                        </p>
                        <Button
                          className="rounded-full"
                          onClick={() => setQuestPlayerOpen(true)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          <PlayCircle className="h-4 w-4" />
                          Open Quest Player
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {claimedAt ? (
                    <p className="text-[11px] text-zinc-500">Last claimed: {claimedAt}</p>
                  ) : null}
                </div>
              </article>
            );
          })}
          {!visibleQuests.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
              No quests available for this tab.
            </div>
          ) : null}
        </div>
      )}

      {activeSponsoredQuest ? (
        <p className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Sponsored gate active: {activeSponsoredQuest.title}. Rewards unlock only after full
          verification.
        </p>
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          setQuestPlayerOpen(open);
          if (!open && sponsoredGate && !sponsoredGate.completed) {
            setSponsoredGate(null);
          }
        }}
        open={Boolean(activeSponsoredQuest && sponsoredGate && questPlayerOpen)}
      >
        <DialogContent
          className="max-w-4xl border-white/10 bg-[#090b14] text-zinc-100"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          {activeSponsoredQuest && sponsoredGate ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-2">
                  <span>{activeSponsoredQuest.title}</span>
                  <span className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-100">
                    +{activeSponsoredQuest.reward_starbits} Starbits
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                {sponsoredGate.mode === "WATCH" ? (
                  <video
                    autoPlay
                    className="h-[320px] w-full rounded-xl border border-white/15 bg-black/30 object-cover"
                    controls={false}
                    muted
                    onPlay={() =>
                      setSponsoredGate((current) =>
                        current && current.mode === "WATCH"
                          ? { ...current, pausedForFocusLoss: false }
                          : current,
                      )
                    }
                    playsInline
                    ref={watchVideoRef}
                    src={resolveSponsoredVideoSource(activeSponsoredQuest)}
                  />
                ) : (
                  <div className="rounded-xl border border-white/15 bg-black/30 p-4">
                    <p className="text-sm text-zinc-200">
                      Complete full verification flow:
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                      <li>1) Open sponsor game page</li>
                      <li>2) Finish interaction challenge before timer ends</li>
                      <li>3) Claim reward</li>
                    </ul>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        className="rounded-full"
                        disabled={!activeSponsoredQuest.sponsor_url}
                        onClick={() => openSponsorDestination(activeSponsoredQuest.sponsor_url)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open partner page
                      </Button>
                      <Button
                        className="rounded-full"
                        disabled={
                          sponsoredGate.completed ||
                          sponsoredGate.failed ||
                          sponsoredGate.secondsLeft <= 0
                        }
                        onClick={() => registerPlayTap()}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Tap target ({sponsoredGate.taps}/{SPONSORED_PLAY_TAPS})
                      </Button>
                    </div>
                  </div>
                )}

                <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-amber-300 transition-all"
                    style={{ width: `${sponsoredProgressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-300">
                  Remaining: {sponsoredGate.secondsLeft}s ·{" "}
                  {sponsoredGate.mode === "PLAY"
                    ? sponsoredGate.openedSponsor
                      ? "Partner page opened"
                      : "Partner page not opened yet"
                    : "Watch continuously until complete"}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="rounded-full"
                    disabled={!sponsoredGate.completed || sponsoredGate.failed}
                    onClick={() => void completeSponsoredGate(activeSponsoredQuest)}
                    size="sm"
                    type="button"
                  >
                    Claim Reward
                  </Button>
                  <Button
                    className="rounded-full"
                    onClick={() => {
                      setSponsoredGate(null);
                      setQuestPlayerOpen(false);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>
                {sponsoredGate.pausedForFocusLoss ? (
                  <p className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    Progress paused: you left this quest/tab. Keep quest player focused to continue.
                  </p>
                ) : null}
                {sponsoredGate.failed ? (
                  <p className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    Verification failed. Complete all required steps for payout.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {offerwallError ? (
        <p className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {offerwallError}
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
