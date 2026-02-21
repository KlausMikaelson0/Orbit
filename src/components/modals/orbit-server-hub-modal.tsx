"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Image as ImageIcon,
  Loader2,
  Rocket,
  Sparkles,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { generateInviteCode } from "@/lib/utils";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type {
  OrbitServer,
  OrbitServerLift,
  OrbitSubscriptionStatus,
  OrbitSubscriptionTier,
} from "@/src/types/orbit";

const LOCAL_SERVER_HUB_META_KEY = "orbit_local_server_hub_meta_v1";
const LOCAL_SERVER_LIFTS_KEY = "orbit_local_server_lifts_v1";

type ServerHubSection = "OVERVIEW" | "LIFT";

interface OrbitServerHubModalProps {
  open: boolean;
  serverId: string | null;
  initialSection?: ServerHubSection;
  onOpenChange: (open: boolean) => void;
}

interface LocalServerMeta {
  name: string;
  image_url: string | null;
  description: string | null;
  invite_code: string;
}

interface OrbitLiftLevel {
  level: number;
  minPoints: number;
  title: string;
  perks: string[];
}

const LIFT_LEVELS: OrbitLiftLevel[] = [
  {
    level: 0,
    minPoints: 0,
    title: "Base Orbit",
    perks: ["Standard voice quality", "Standard server identity"],
  },
  {
    level: 1,
    minPoints: 2,
    title: "Orbit Lift I",
    perks: ["Enhanced server profile card", "Bonus emoji capacity"],
  },
  {
    level: 2,
    minPoints: 5,
    title: "Orbit Lift II",
    perks: ["Animated server spotlight", "Higher quality stream defaults"],
  },
  {
    level: 3,
    minPoints: 9,
    title: "Orbit Lift III",
    perks: ["Ultra server banner effects", "Priority feature unlock queue"],
  },
];

function loadLocalServerMetaMap() {
  if (typeof window === "undefined") {
    return {} as Record<string, LocalServerMeta>;
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_SERVER_HUB_META_KEY);
    if (!raw) {
      return {} as Record<string, LocalServerMeta>;
    }
    const parsed = JSON.parse(raw) as Record<string, LocalServerMeta>;
    return parsed && typeof parsed === "object"
      ? parsed
      : ({} as Record<string, LocalServerMeta>);
  } catch {
    return {} as Record<string, LocalServerMeta>;
  }
}

function saveLocalServerMetaMap(map: Record<string, LocalServerMeta>) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LOCAL_SERVER_HUB_META_KEY, JSON.stringify(map));
  } catch {
    // Ignore local storage failures in browser-restricted environments.
  }
}

function loadLocalLiftMap() {
  if (typeof window === "undefined") {
    return {} as Record<string, OrbitServerLift[]>;
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_SERVER_LIFTS_KEY);
    if (!raw) {
      return {} as Record<string, OrbitServerLift[]>;
    }
    const parsed = JSON.parse(raw) as Record<string, OrbitServerLift[]>;
    return parsed && typeof parsed === "object"
      ? parsed
      : ({} as Record<string, OrbitServerLift[]>);
  } catch {
    return {} as Record<string, OrbitServerLift[]>;
  }
}

function saveLocalLiftMap(map: Record<string, OrbitServerLift[]>) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LOCAL_SERVER_LIFTS_KEY, JSON.stringify(map));
  } catch {
    // Ignore local storage failures in browser-restricted environments.
  }
}

function canBoostFromTier(tier: OrbitSubscriptionTier) {
  return tier === "PULSE" || tier === "PULSE_PLUS";
}

function resolveBoostPointsFromTier(tier: OrbitSubscriptionTier) {
  if (tier === "PULSE_PLUS") return 2;
  if (tier === "PULSE") return 1;
  return 0;
}

function resolveLiftLevel(points: number) {
  let selected = LIFT_LEVELS[0];
  for (const level of LIFT_LEVELS) {
    if (points >= level.minPoints) {
      selected = level;
    }
  }
  return selected;
}

export function OrbitServerHubModal({
  open,
  serverId,
  initialSection = "OVERVIEW",
  onOpenChange,
}: OrbitServerHubModalProps) {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const isLocalMode = !isSupabaseReady();
  const { servers, profile, membershipsByServer, upsertServer } = useOrbitNavStore(
    useShallow((state) => ({
      servers: state.servers,
      profile: state.profile,
      membershipsByServer: state.membershipsByServer,
      upsertServer: state.upsertServer,
    })),
  );

  const server = useMemo(
    () => (serverId ? servers.find((item) => item.id === serverId) ?? null : null),
    [serverId, servers],
  );
  const memberRole = serverId ? membershipsByServer[serverId]?.role ?? null : null;
  const isOwner = Boolean(profile?.id && server?.owner_id === profile.id);
  const isStaff = memberRole === "ADMIN" || memberRole === "MODERATOR" || isOwner;
  const canManageOverview = isOwner;

  const [section, setSection] = useState<ServerHubSection>(initialSection);
  const [serverName, setServerName] = useState("");
  const [serverImageUrl, setServerImageUrl] = useState("");
  const [serverDescription, setServerDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loadingHub, setLoadingHub] = useState(false);
  const [savingOverview, setSavingOverview] = useState(false);
  const [regeneratingInvite, setRegeneratingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [subscriptionTier, setSubscriptionTier] = useState<OrbitSubscriptionTier>("FREE");
  const [subscriptionStatus, setSubscriptionStatus] = useState<OrbitSubscriptionStatus | null>(
    null,
  );
  const [liftRows, setLiftRows] = useState<OrbitServerLift[]>([]);
  const [liftProfileNames, setLiftProfileNames] = useState<Record<string, string>>({});
  const [loadingLifts, setLoadingLifts] = useState(false);
  const [togglingLift, setTogglingLift] = useState(false);

  const totalLiftPoints = useMemo(
    () => liftRows.reduce((sum, row) => sum + row.boost_points, 0),
    [liftRows],
  );
  const liftLevel = useMemo(() => resolveLiftLevel(totalLiftPoints), [totalLiftPoints]);
  const selfLift = useMemo(
    () => liftRows.find((row) => row.profile_id === profile?.id) ?? null,
    [liftRows, profile?.id],
  );
  const canBoost = canBoostFromTier(subscriptionTier);
  const tierLabel =
    subscriptionTier === "PULSE_PLUS"
      ? "Pulse+"
      : subscriptionTier === "PULSE"
        ? "Pulse"
        : "Free";
  const serverPreviewImage = serverImageUrl.trim() || null;

  const applyServerToStore = useCallback(
    (nextServer: OrbitServer) => {
      upsertServer(nextServer);
    },
    [upsertServer],
  );

  const loadLiftData = useCallback(async () => {
    setLoadingLifts(true);
    if (!serverId) {
      setLiftRows([]);
      setLiftProfileNames({});
      setLoadingLifts(false);
      return;
    }

    if (isLocalMode) {
      const localMap = loadLocalLiftMap();
      const rows = (localMap[serverId] ?? []).filter((item) => item.is_active);
      setLiftRows(rows);
      setLiftProfileNames(
        Object.fromEntries(
          rows.map((row) => [
            row.profile_id,
            row.profile_id === profile?.id
              ? profile?.full_name ?? profile?.username ?? "You"
              : `Member ${row.profile_id.slice(0, 5)}`,
          ]),
        ),
      );
      setLoadingLifts(false);
      return;
    }

    const result = await supabase
      .from("server_orbit_lifts")
      .select("*")
      .eq("server_id", serverId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (result.error) {
      setError(
        result.error.message.includes("server_orbit_lifts")
          ? "Orbit Lift table missing. Run Phase 13 migration."
          : result.error.message,
      );
      setLiftRows([]);
      setLoadingLifts(false);
      return;
    }

    const rows = (result.data ?? []) as OrbitServerLift[];
    setLiftRows(rows);

    const profileIds = Array.from(new Set(rows.map((row) => row.profile_id)));
    if (!profileIds.length) {
      setLiftProfileNames({});
      setLoadingLifts(false);
      return;
    }

    const profileResult = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", profileIds);

    const names: Record<string, string> = {};
    (profileResult.data ?? []).forEach((row) => {
      const profileRow = row as { id: string; username?: string | null; full_name?: string | null };
      names[profileRow.id] =
        profileRow.full_name?.trim() ||
        profileRow.username?.trim() ||
        `member-${profileRow.id.slice(0, 6)}`;
    });
    setLiftProfileNames(names);
    setLoadingLifts(false);
  }, [isLocalMode, profile, serverId, supabase]);

  const loadServerHubState = useCallback(async () => {
    if (!open || !serverId) {
      return;
    }

    setLoadingHub(true);
    setError(null);
    setMessage(null);

    if (isLocalMode) {
      const localMetaMap = loadLocalServerMetaMap();
      const localMeta = localMetaMap[serverId];
      const baseline = server;
      setServerName(localMeta?.name ?? baseline?.name ?? "");
      setServerImageUrl(localMeta?.image_url ?? baseline?.image_url ?? "");
      setServerDescription(localMeta?.description ?? baseline?.description ?? "");
      setInviteCode(localMeta?.invite_code ?? baseline?.invite_code ?? "");
      setSubscriptionTier("PULSE_PLUS");
      setSubscriptionStatus("ACTIVE");
      await loadLiftData();
      setLoadingHub(false);
      return;
    }

    const [serverResult, subscriptionResult] = await Promise.all([
      supabase.from("servers").select("*").eq("id", serverId).maybeSingle(),
      profile?.id
        ? supabase
            .from("profile_subscriptions")
            .select("tier, status")
            .eq("profile_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (serverResult.error || !serverResult.data) {
      setError(serverResult.error?.message ?? "Unable to load server settings.");
      setLoadingHub(false);
      return;
    }

    const serverRow = serverResult.data as OrbitServer;
    applyServerToStore(serverRow);
    setServerName(serverRow.name);
    setServerImageUrl(serverRow.image_url ?? "");
    setServerDescription(serverRow.description ?? "");
    setInviteCode(serverRow.invite_code);

    const subRow = (subscriptionResult.data ?? null) as
      | { tier?: OrbitSubscriptionTier | null; status?: OrbitSubscriptionStatus | null }
      | null;
    setSubscriptionTier(subRow?.tier ?? "FREE");
    setSubscriptionStatus(subRow?.status ?? null);

    await loadLiftData();
    setLoadingHub(false);
  }, [
    applyServerToStore,
    isLocalMode,
    loadLiftData,
    open,
    profile,
    server,
    serverId,
    supabase,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSection(initialSection);
  }, [initialSection, open]);

  useEffect(() => {
    void loadServerHubState();
  }, [loadServerHubState]);

  useEffect(() => {
    if (!copiedInvite) {
      return;
    }
    const timer = window.setTimeout(() => setCopiedInvite(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copiedInvite]);

  async function saveOverview() {
    if (!serverId || !server) {
      return;
    }
    const trimmedName = serverName.trim();
    if (!trimmedName) {
      setError("Server name is required.");
      return;
    }

    setSavingOverview(true);
    setError(null);
    setMessage(null);

    if (isLocalMode) {
      const localMetaMap = loadLocalServerMetaMap();
      localMetaMap[serverId] = {
        name: trimmedName,
        image_url: serverImageUrl.trim() || null,
        description: serverDescription.trim() || null,
        invite_code: inviteCode || server.invite_code,
      };
      saveLocalServerMetaMap(localMetaMap);

      const nextServer: OrbitServer = {
        ...server,
        name: trimmedName,
        image_url: serverImageUrl.trim() || null,
        description: serverDescription.trim() || null,
        invite_code: inviteCode || server.invite_code,
        updated_at: new Date().toISOString(),
      };
      applyServerToStore(nextServer);
      setMessage("Server profile updated.");
      setSavingOverview(false);
      return;
    }

    const result = await supabase
      .from("servers")
      .update({
        name: trimmedName,
        image_url: serverImageUrl.trim() || null,
        description: serverDescription.trim() || null,
      })
      .eq("id", serverId)
      .select("*")
      .single();

    if (result.error || !result.data) {
      setError(result.error?.message ?? "Unable to update server profile.");
      setSavingOverview(false);
      return;
    }

    applyServerToStore(result.data as OrbitServer);
    setMessage("Server profile updated.");
    setSavingOverview(false);
  }

  async function regenerateInviteCode() {
    if (!serverId || !server) {
      return;
    }
    const nextInviteCode = generateInviteCode();
    setRegeneratingInvite(true);
    setError(null);
    setMessage(null);

    if (isLocalMode) {
      setInviteCode(nextInviteCode);
      const localMetaMap = loadLocalServerMetaMap();
      const previous = localMetaMap[serverId];
      localMetaMap[serverId] = {
        name: serverName.trim() || previous?.name || server.name,
        image_url: serverImageUrl.trim() || previous?.image_url || server.image_url || null,
        description:
          serverDescription.trim() || previous?.description || server.description || null,
        invite_code: nextInviteCode,
      };
      saveLocalServerMetaMap(localMetaMap);
      applyServerToStore({
        ...server,
        invite_code: nextInviteCode,
        name: localMetaMap[serverId].name,
        image_url: localMetaMap[serverId].image_url,
        description: localMetaMap[serverId].description,
        updated_at: new Date().toISOString(),
      });
      setMessage("Invite code regenerated.");
      setRegeneratingInvite(false);
      return;
    }

    const result = await supabase
      .from("servers")
      .update({ invite_code: nextInviteCode })
      .eq("id", serverId)
      .select("*")
      .single();

    if (result.error || !result.data) {
      setError(result.error?.message ?? "Unable to regenerate invite code.");
      setRegeneratingInvite(false);
      return;
    }

    const row = result.data as OrbitServer;
    setInviteCode(row.invite_code);
    applyServerToStore(row);
    setMessage("Invite code regenerated.");
    setRegeneratingInvite(false);
  }

  async function copyInviteCode() {
    if (!inviteCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedInvite(true);
    } catch {
      setError("Unable to copy invite code.");
    }
  }

  async function toggleLift() {
    if (!serverId || !profile?.id) {
      return;
    }
    if (!canBoost) {
      setError("Orbit Lift requires Pulse or Pulse+ membership.");
      return;
    }

    const points = resolveBoostPointsFromTier(subscriptionTier);
    if (points < 1) {
      setError("Your current plan cannot activate Orbit Lift.");
      return;
    }

    setTogglingLift(true);
    setError(null);
    setMessage(null);

    if (isLocalMode) {
      const localLiftMap = loadLocalLiftMap();
      const serverRows = localLiftMap[serverId] ?? [];
      const existing = serverRows.find((row) => row.profile_id === profile.id) ?? null;
      const now = new Date().toISOString();
      if (existing?.is_active) {
        localLiftMap[serverId] = serverRows.map((row) =>
          row.profile_id === profile.id ? { ...row, is_active: false, updated_at: now } : row,
        );
        saveLocalLiftMap(localLiftMap);
        setMessage("Orbit Lift removed from this server.");
      } else if (existing) {
        localLiftMap[serverId] = serverRows.map((row) =>
          row.profile_id === profile.id
            ? {
                ...row,
                is_active: true,
                tier_snapshot: subscriptionTier,
                boost_points: points,
                updated_at: now,
              }
            : row,
        );
        saveLocalLiftMap(localLiftMap);
        setMessage("Orbit Lift activated.");
      } else {
        const newRow: OrbitServerLift = {
          id: `local-lift-${crypto.randomUUID().slice(0, 8)}`,
          server_id: serverId,
          profile_id: profile.id,
          tier_snapshot: subscriptionTier,
          boost_points: points,
          is_active: true,
          created_at: now,
          updated_at: now,
        };
        localLiftMap[serverId] = [newRow, ...serverRows];
        saveLocalLiftMap(localLiftMap);
        setMessage("Orbit Lift activated.");
      }

      await loadLiftData();
      setTogglingLift(false);
      return;
    }

    if (selfLift?.is_active) {
      const result = await supabase
        .from("server_orbit_lifts")
        .update({ is_active: false })
        .eq("id", selfLift.id)
        .eq("server_id", serverId);
      if (result.error) {
        setError(result.error.message);
        setTogglingLift(false);
        return;
      }
      setMessage("Orbit Lift removed from this server.");
    } else {
      const result = await supabase
        .from("server_orbit_lifts")
        .upsert(
          {
            server_id: serverId,
            profile_id: profile.id,
            tier_snapshot: subscriptionTier,
            boost_points: points,
            is_active: true,
          },
          { onConflict: "server_id,profile_id" },
        )
        .select("*");
      if (result.error) {
        setError(result.error.message);
        setTogglingLift(false);
        return;
      }
      setMessage("Orbit Lift activated.");
    }

    await loadLiftData();
    setTogglingLift(false);
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Server Hub</DialogTitle>
          <DialogDescription>
            Manage server profile options and Orbit Lift boosts.
          </DialogDescription>
        </DialogHeader>

        {!server ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-400">
            Select a server first.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{server.name}</p>
                <p className="truncate text-xs text-zinc-400">
                  Invite: {inviteCode || server.invite_code}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  className="rounded-full"
                  onClick={() => setSection("OVERVIEW")}
                  size="sm"
                  type="button"
                  variant={section === "OVERVIEW" ? "default" : "secondary"}
                >
                  Server profile
                </Button>
                <Button
                  className="rounded-full"
                  onClick={() => setSection("LIFT")}
                  size="sm"
                  type="button"
                  variant={section === "LIFT" ? "default" : "secondary"}
                >
                  <Rocket className="h-4 w-4" />
                  Orbit Lift
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-[60vh] pr-2">
              {loadingHub ? (
                <div className="flex items-center justify-center py-12 text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : section === "OVERVIEW" ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                        Server name
                      </p>
                      <Input
                        disabled={!canManageOverview}
                        onChange={(event) => setServerName(event.target.value)}
                        placeholder="My Orbit Server"
                        value={serverName}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                        Server image URL
                      </p>
                      <Input
                        disabled={!canManageOverview}
                        onChange={(event) => setServerImageUrl(event.target.value)}
                        placeholder="https://..."
                        value={serverImageUrl}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Description
                    </p>
                    <Textarea
                      className="min-h-24"
                      disabled={!canManageOverview}
                      maxLength={320}
                      onChange={(event) => setServerDescription(event.target.value)}
                      placeholder="Tell members what this server is about..."
                      value={serverDescription}
                    />
                    <p className="text-[11px] text-zinc-500">
                      {serverDescription.length}/320 characters
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Invite code
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input className="w-44" readOnly value={inviteCode} />
                      <Button
                        className="rounded-full"
                        onClick={() => void copyInviteCode()}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {copiedInvite ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copiedInvite ? "Copied" : "Copy"}
                      </Button>
                      <Button
                        className="rounded-full"
                        disabled={!canManageOverview || regeneratingInvite}
                        onClick={() => void regenerateInviteCode()}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {regeneratingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Regenerate
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="mb-1 text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Preview
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                        {serverPreviewImage ? (
                          <img
                            alt={serverName || "Server"}
                            className="h-full w-full object-cover"
                            src={serverPreviewImage}
                          />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">
                          {serverName || "Unnamed Server"}
                        </p>
                        <p className="line-clamp-2 text-xs text-zinc-400">
                          {serverDescription || "No description set yet."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-violet-100">
                          Orbit Lift status
                        </p>
                        <p className="text-sm text-zinc-100">
                          Level {liftLevel.level} · {liftLevel.title}
                        </p>
                      </div>
                      <span className="rounded-full border border-violet-300/35 bg-violet-500/15 px-2.5 py-1 text-xs text-violet-100">
                        {totalLiftPoints} lift points
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-zinc-200">
                      {liftLevel.perks.map((perk) => (
                        <p key={perk}>• {perk}</p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                          Your membership
                        </p>
                        <p className="text-sm text-zinc-100">
                          {tierLabel}
                          {subscriptionStatus ? ` · ${subscriptionStatus}` : ""}
                        </p>
                      </div>
                      <Button
                        className="rounded-full"
                        disabled={togglingLift || !canBoost}
                        onClick={() => void toggleLift()}
                        size="sm"
                        type="button"
                      >
                        {togglingLift ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {selfLift ? "Remove Lift" : "Lift this server"}
                      </Button>
                    </div>
                    {!canBoost ? (
                      <p className="mt-2 text-xs text-amber-200">
                        Orbit Lift requires Pulse or Pulse+.
                      </p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Pulse adds +1 point, Pulse+ adds +2 points.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                        Active supporters
                      </p>
                      <span className="text-xs text-zinc-500">{liftRows.length} members</span>
                    </div>
                    {loadingLifts ? (
                      <div className="flex items-center justify-center py-6 text-zinc-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : !liftRows.length ? (
                      <p className="text-xs text-zinc-500">
                        No active lifts yet. Be the first to boost this server.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {liftRows.slice(0, 12).map((row) => (
                          <div
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs"
                            key={row.id}
                          >
                            <span className="truncate text-zinc-200">
                              {liftProfileNames[row.profile_id] ??
                                (row.profile_id === profile?.id ? "You" : "Member")}
                            </span>
                            <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-100">
                              +{row.boost_points}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
                      <Crown className="h-3.5 w-3.5 text-violet-300" />
                      Group options ready
                    </div>
                    <p className="mt-2 text-xs text-zinc-300">
                      Server owner/staff can manage profile settings, invite flow, permissions, and Orbit Lift levels from this hub.
                    </p>
                    {isStaff ? (
                      <p className="mt-1 text-[11px] text-emerald-200">
                        Staff access detected for this server.
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </ScrollArea>

            {error ? (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                {message}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {section === "OVERVIEW" && server ? (
            <Button
              className="rounded-full"
              disabled={!canManageOverview || savingOverview}
              onClick={() => void saveOverview()}
              type="button"
            >
              {savingOverview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Save server profile
            </Button>
          ) : null}
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="secondary"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
