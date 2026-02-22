"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Gift, Sparkles, Store, Trophy, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import {
  ORBIT_LOCAL_PROFILE,
  getOrbitLocalQuestProgress,
  getOrbitLocalQuests,
} from "@/src/lib/orbit-local-data";
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
  const [tab, setTab] = useState<QuestTab>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [wallet, setWallet] = useState<OrbitProfileWallet | null>(null);
  const [quests, setQuests] = useState<OrbitQuest[]>([]);
  const [progressRows, setProgressRows] = useState<OrbitQuestProgress[]>([]);
  const [sponsoredGate, setSponsoredGate] = useState<SponsoredGateState | null>(null);

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

  useEffect(() => {
    void fetchQuestState();
  }, [fetchQuestState]);

  useEffect(() => {
    if (!sponsoredGate || sponsoredGate.completed || sponsoredGate.failed) {
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
  }, [sponsoredGate?.completed, sponsoredGate?.failed, sponsoredGate?.questId]);

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
                  className="h-28 border-b border-white/10"
                  style={{
                    background:
                      categoryBackground[quest.category] ??
                      "linear-gradient(140deg,#0b0d16,#1a1730)",
                  }}
                />
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
                      {progressBusy ? "Processing..." : "Start / Continue"}
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
                    <div className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-100">
                        Verification required for rewards
                      </p>
                      {sponsoredGate.mode === "WATCH" ? (
                        <>
                          <video
                            autoPlay
                            className="h-40 w-full rounded-lg border border-white/15 bg-black/30 object-cover"
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
                            src={resolveSponsoredVideoSource(quest)}
                          />
                          <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                            <div
                              className="h-full rounded-full bg-amber-300 transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((SPONSORED_WATCH_SECONDS - sponsoredGate.secondsLeft) /
                                    SPONSORED_WATCH_SECONDS) *
                                    100,
                                )}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-amber-100">
                            Watch until the timer completes. Remaining: {sponsoredGate.secondsLeft}s
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-amber-100">
                            Complete the full partner flow: open sponsor page + tap target{" "}
                            {SPONSORED_PLAY_TAPS} times before timer ends.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              className="rounded-full"
                              disabled={!quest.sponsor_url}
                              onClick={() => openSponsorDestination(quest.sponsor_url)}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              Open partner game page
                            </Button>
                            <span className="text-xs text-amber-100">
                              Partner page: {sponsoredGate.openedSponsor ? "Opened" : "Not opened"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
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
                            <span className="text-xs text-amber-100">
                              Time left: {sponsoredGate.secondsLeft}s
                            </span>
                          </div>
                        </>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          className="rounded-full"
                          disabled={!sponsoredGate.completed || sponsoredGate.failed || progressBusy}
                          onClick={() => void completeSponsoredGate(quest)}
                          size="sm"
                          type="button"
                        >
                          Verify completion
                        </Button>
                        <Button
                          className="rounded-full"
                          onClick={() => setSponsoredGate(null)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                        {quest.sponsor_url ? (
                          <Button
                            className="rounded-full"
                            onClick={() => openSponsorDestination(quest.sponsor_url)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            Open sponsor page
                          </Button>
                        ) : null}
                      </div>

                      {sponsoredGate.failed ? (
                        <p className="text-xs text-rose-200">
                          Verification failed. Reward is blocked until full completion.
                        </p>
                      ) : null}
                      {sponsoredGate.pausedForFocusLoss ? (
                        <p className="text-xs text-amber-100">
                          Progress paused because you left the quest screen/tab. Return and keep this
                          screen focused to continue.
                        </p>
                      ) : null}
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
