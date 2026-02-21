"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarVisualizer,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent, type RemoteParticipant, Track } from "livekit-client";
import {
  Crown,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  Sparkles,
  Trash2,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buildLivekitRoomName } from "@/lib/utils";
import {
  playOrbitCallJoinSound,
  playOrbitCallLeaveSound,
  playOrbitParticipantJoinSound,
  playOrbitParticipantLeaveSound,
} from "@/src/lib/orbit-notifications";
import {
  getOrbitBuiltInSoundboardPresets,
  playOrbitSoundboardPreset,
  playOrbitSoundboardUrl,
} from "@/src/lib/orbit-soundboard";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import type {
  ChannelType,
  OrbitServerSoundboardItem,
  OrbitSubscriptionStatus,
  OrbitSubscriptionTier,
} from "@/src/types/orbit";

interface LivekitChannelRoomProps {
  serverId: string;
  channelId: string;
  channelType: ChannelType;
  userId: string;
  displayName: string;
  canManageServerSoundboard?: boolean;
}

type OrbitSoundboardSource = "BUILTIN" | "SERVER";

interface OrbitSoundboardClip {
  id: string;
  title: string;
  emoji: string;
  source: OrbitSoundboardSource;
  presetId: string | null;
  soundUrl: string | null;
}

interface OrbitSoundboardBroadcastPayload {
  id: string;
  title: string;
  source: OrbitSoundboardSource;
  presetId: string | null;
  soundUrl: string | null;
  senderId: string;
  senderName: string;
  sentAt: string;
}

type SoundboardActionResult = { error?: string };

const SOUNDBOARD_PLUS_TIER: OrbitSubscriptionTier = "PULSE_PLUS";

function hasPulsePlusEntitlement(
  tier: OrbitSubscriptionTier,
  status: OrbitSubscriptionStatus | null,
) {
  return tier === SOUNDBOARD_PLUS_TIER && (!status || status === "ACTIVE");
}

function normalizeSoundUrl(value: string) {
  return value.trim();
}

function isValidSoundUrl(value: string) {
  return /^https?:\/\/.+/i.test(value);
}

export function LivekitChannelRoom({
  serverId,
  channelId,
  channelType,
  userId,
  displayName,
  canManageServerSoundboard = false,
}: LivekitChannelRoomProps) {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [loadingToken, setLoadingToken] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [joined, setJoined] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<OrbitSubscriptionTier>("FREE");
  const [subscriptionStatus, setSubscriptionStatus] = useState<OrbitSubscriptionStatus | null>(
    null,
  );
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [entitlementError, setEntitlementError] = useState<string | null>(null);
  const [soundboardNotice, setSoundboardNotice] = useState<string | null>(null);
  const [serverSoundItems, setServerSoundItems] = useState<OrbitServerSoundboardItem[]>([]);
  const [loadingServerSounds, setLoadingServerSounds] = useState(false);
  const [serverSoundError, setServerSoundError] = useState<string | null>(null);
  const [serverSoundActionError, setServerSoundActionError] = useState<string | null>(null);
  const [savingServerSound, setSavingServerSound] = useState(false);
  const [removingServerSoundId, setRemovingServerSoundId] = useState<string | null>(null);
  const soundboardChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isVideoChannel = channelType === "VIDEO";
  const isServerCall = !serverId.startsWith("dm-");
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const roomName = useMemo(
    () => buildLivekitRoomName(serverId, channelId),
    [channelId, serverId],
  );
  const builtInClips = useMemo<OrbitSoundboardClip[]>(
    () =>
      getOrbitBuiltInSoundboardPresets().map((preset) => ({
        id: preset.id,
        title: preset.title,
        emoji: preset.emoji,
        source: "BUILTIN",
        presetId: preset.id,
        soundUrl: null,
      })),
    [],
  );
  const serverClips = useMemo<OrbitSoundboardClip[]>(
    () =>
      serverSoundItems.map((item) => ({
        id: item.id,
        title: item.title,
        emoji: item.icon_emoji?.trim() || "🔊",
        source: "SERVER",
        presetId: null,
        soundUrl: item.sound_url,
      })),
    [serverSoundItems],
  );
  const hasSoundboardAccess = hasPulsePlusEntitlement(
    subscriptionTier,
    subscriptionStatus,
  );

  useEffect(() => {
    if (!livekitUrl) {
      setRoomError("NEXT_PUBLIC_LIVEKIT_URL is missing.");
      setLoadingToken(false);
      return;
    }

    const abortController = new AbortController();
    setRoomError(null);
    setLoadingToken(true);
    setJoined(true);
    setToken(undefined);

    const query = new URLSearchParams({
      room: roomName,
      identity: userId,
      name: displayName,
    });

    void fetch(`/api/livekit/token?${query.toString()}`, {
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to generate LiveKit token.");
        }
        return (await response.json()) as { token: string };
      })
      .then((payload) => {
        setToken(payload.token);
      })
      .catch((error) => {
        if (abortController.signal.aborted) {
          return;
        }
        setRoomError(error instanceof Error ? error.message : "Unable to connect.");
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoadingToken(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [displayName, livekitUrl, roomName, userId]);

  const refreshServerSoundboard = useCallback(async () => {
    if (!isServerCall || !isSupabaseReady()) {
      setServerSoundItems([]);
      setServerSoundError(null);
      setLoadingServerSounds(false);
      return;
    }

    setLoadingServerSounds(true);
    setServerSoundError(null);
    const result = await supabase
      .from("server_soundboard_items")
      .select("*")
      .eq("server_id", serverId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (result.error) {
      setServerSoundError(
        result.error.message.includes("server_soundboard_items")
          ? "Soundboard table is missing. Run Phase 12 migration."
          : result.error.message,
      );
      setServerSoundItems([]);
      setLoadingServerSounds(false);
      return;
    }

    setServerSoundItems((result.data ?? []) as OrbitServerSoundboardItem[]);
    setLoadingServerSounds(false);
  }, [isServerCall, serverId, supabase]);

  const createServerSoundboardItem = useCallback(
    async (values: {
      title: string;
      soundUrl: string;
      iconEmoji: string | null;
    }): Promise<SoundboardActionResult> => {
      if (!isServerCall) {
        return { error: "Custom soundboard is available in server calls only." };
      }
      if (!canManageServerSoundboard) {
        return { error: "Only server owner/staff can add custom sounds." };
      }
      if (!hasSoundboardAccess) {
        return { error: "Soundboard requires Orbit Pulse+ membership." };
      }
      if (!isSupabaseReady()) {
        return { error: "Cloud mode is required to manage custom sounds." };
      }

      const title = values.title.trim();
      const soundUrl = normalizeSoundUrl(values.soundUrl);
      if (!title) {
        return { error: "Sound title is required." };
      }
      if (!isValidSoundUrl(soundUrl)) {
        return { error: "Enter a valid sound URL (https://...)." };
      }

      setSavingServerSound(true);
      setServerSoundActionError(null);
      const result = await supabase
        .from("server_soundboard_items")
        .insert({
          server_id: serverId,
          title,
          sound_url: soundUrl,
          icon_emoji: values.iconEmoji?.trim() || null,
          created_by: userId,
        })
        .select("*")
        .single();

      if (result.error || !result.data) {
        const nextError =
          result.error?.message.includes("server_soundboard_items")
            ? "Custom soundboard table is missing. Run Phase 12 migration."
            : result.error?.message ?? "Unable to save custom sound.";
        setServerSoundActionError(nextError);
        setSavingServerSound(false);
        return { error: nextError };
      }

      setServerSoundItems((current) => [
        result.data as OrbitServerSoundboardItem,
        ...current,
      ]);
      setSavingServerSound(false);
      setSoundboardNotice(`Saved custom sound: ${title}.`);
      return {};
    },
    [
      canManageServerSoundboard,
      hasSoundboardAccess,
      isServerCall,
      serverId,
      supabase,
      userId,
    ],
  );

  const removeServerSoundboardItem = useCallback(
    async (clipId: string) => {
      if (!isServerCall || !isSupabaseReady() || !canManageServerSoundboard) {
        return;
      }

      setRemovingServerSoundId(clipId);
      setServerSoundActionError(null);
      const result = await supabase
        .from("server_soundboard_items")
        .update({ is_active: false })
        .eq("id", clipId)
        .eq("server_id", serverId);

      if (result.error) {
        setServerSoundActionError(result.error.message);
        setRemovingServerSoundId(null);
        return;
      }

      setServerSoundItems((current) => current.filter((item) => item.id !== clipId));
      setRemovingServerSoundId(null);
    },
    [canManageServerSoundboard, isServerCall, serverId, supabase],
  );

  const playSoundboardPayload = useCallback(
    async (payload: OrbitSoundboardBroadcastPayload) => {
      if (payload.source === "BUILTIN") {
        await playOrbitSoundboardPreset(payload.presetId ?? "crowd-hype");
        return;
      }
      if (payload.soundUrl) {
        await playOrbitSoundboardUrl(payload.soundUrl);
      }
    },
    [],
  );

  const triggerSoundboardClip = useCallback(
    async (clip: OrbitSoundboardClip) => {
      if (!hasSoundboardAccess) {
        setSoundboardNotice("Soundboard is locked. Upgrade to Orbit Pulse+.");
        return;
      }

      const payload: OrbitSoundboardBroadcastPayload = {
        id: clip.id,
        title: clip.title,
        source: clip.source,
        presetId: clip.presetId,
        soundUrl: clip.soundUrl,
        senderId: userId,
        senderName: displayName,
        sentAt: new Date().toISOString(),
      };
      await playSoundboardPayload(payload);
      setSoundboardNotice(`Played: ${clip.title}`);

      const channel = soundboardChannelRef.current;
      if (!channel) {
        return;
      }
      const status = await channel.send({
        type: "broadcast",
        event: "soundboard-play",
        payload,
      });
      if (status !== "ok") {
        setSoundboardNotice(`Played locally, but sync failed for ${clip.title}.`);
      }
    },
    [displayName, hasSoundboardAccess, playSoundboardPayload, userId],
  );

  useEffect(() => {
    if (!isSupabaseReady() || !userId || userId === "guest") {
      setSubscriptionTier("FREE");
      setSubscriptionStatus(null);
      setEntitlementError(null);
      setLoadingSubscription(false);
      return;
    }

    let mounted = true;
    setLoadingSubscription(true);
    setEntitlementError(null);
    void supabase
      .from("profile_subscriptions")
      .select("tier, status")
      .eq("profile_id", userId)
      .maybeSingle()
      .then((result) => {
        if (!mounted) {
          return;
        }
        if (result.error) {
          setEntitlementError(result.error.message);
          setSubscriptionTier("FREE");
          setSubscriptionStatus(null);
          setLoadingSubscription(false);
          return;
        }

        const row = (result.data ?? null) as
          | { tier?: OrbitSubscriptionTier | null; status?: OrbitSubscriptionStatus | null }
          | null;
        setSubscriptionTier(row?.tier ?? "FREE");
        setSubscriptionStatus(row?.status ?? null);
        setLoadingSubscription(false);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setEntitlementError("Unable to verify Pulse+ entitlement.");
        setSubscriptionTier("FREE");
        setSubscriptionStatus(null);
        setLoadingSubscription(false);
      });

    return () => {
      mounted = false;
    };
  }, [supabase, userId]);

  useEffect(() => {
    void refreshServerSoundboard();
  }, [refreshServerSoundboard]);

  useEffect(() => {
    if (!isSupabaseReady()) {
      soundboardChannelRef.current = null;
      return;
    }

    const channel = supabase.channel(`orbit-soundboard-${roomName}`, {
      config: {
        broadcast: { self: false },
      },
    });
    channel
      .on("broadcast", { event: "soundboard-play" }, ({ payload }) => {
        const data = payload as OrbitSoundboardBroadcastPayload;
        if (!data) {
          return;
        }
        void playSoundboardPayload(data);
        setSoundboardNotice(`${data.senderName || "Member"} played ${data.title}`);
      })
      .subscribe();

    soundboardChannelRef.current = channel;
    return () => {
      soundboardChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [playSoundboardPayload, roomName, supabase]);

  useEffect(() => {
    if (!soundboardNotice) {
      return;
    }
    const timer = window.setTimeout(() => setSoundboardNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [soundboardNotice]);

  if (!livekitUrl) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-sm text-zinc-300">
        Configure <code className="mx-1 rounded bg-black/40 px-1.5 py-0.5">NEXT_PUBLIC_LIVEKIT_URL</code> to enable voice/video channels.
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center">
        <div>
          <p className="text-sm text-zinc-300">You left this {channelType.toLowerCase()} room.</p>
          <Button className="mt-3 rounded-full" onClick={() => setJoined(true)}>
            Rejoin room
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      {loadingToken ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 text-zinc-200">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : null}

      {roomError ? (
        <div className="absolute left-4 top-4 z-10 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {roomError}
        </div>
      ) : null}
      {entitlementError ? (
        <div className="absolute left-4 top-16 z-10 rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {entitlementError}
        </div>
      ) : null}
      {soundboardNotice ? (
        <div className="absolute right-4 top-4 z-10 rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          {soundboardNotice}
        </div>
      ) : null}

      <LiveKitRoom
        audio
        className="h-full w-full"
        connect={joined && Boolean(token)}
        onDisconnected={() => setJoined(false)}
        onError={(error) => setRoomError(error.message)}
        serverUrl={livekitUrl}
        token={token}
        video={isVideoChannel}
      >
        <LivekitCallSoundEvents />
        <RoomAudioRenderer />
        <div className="h-full p-4">
          {isVideoChannel ? <VideoGrid /> : <AudioVisualizerGrid />}
        </div>
        <FloatingRoomControls
          builtInClips={builtInClips}
          canManageServerSoundboard={isServerCall && canManageServerSoundboard}
          creatingServerSound={savingServerSound}
          currentTier={subscriptionTier}
          isVideo={isVideoChannel}
          loadingServerSounds={loadingServerSounds}
          loadingSubscription={loadingSubscription}
          onLeave={() => setJoined(false)}
          onPlayClip={triggerSoundboardClip}
          onRefreshServerSounds={refreshServerSoundboard}
          onRemoveServerSound={removeServerSoundboardItem}
          onSaveServerSound={createServerSoundboardItem}
          removingServerSoundId={removingServerSoundId}
          serverClips={serverClips}
          serverSoundActionError={serverSoundActionError}
          serverSoundError={serverSoundError}
          soundboardLocked={!hasSoundboardAccess}
          soundboardPlusTier={SOUNDBOARD_PLUS_TIER}
        />
      </LiveKitRoom>
    </div>
  );
}

function LivekitCallSoundEvents() {
  const room = useRoomContext();
  const remoteParticipantsRef = useRef<Set<string>>(new Set());
  const joinedRef = useRef(false);

  useEffect(() => {
    const markConnected = () => {
      if (!joinedRef.current) {
        playOrbitCallJoinSound();
      }
      joinedRef.current = true;
      remoteParticipantsRef.current = new Set(Array.from(room.remoteParticipants.keys()));
    };

    const markDisconnected = () => {
      if (joinedRef.current) {
        playOrbitCallLeaveSound();
      }
      joinedRef.current = false;
      remoteParticipantsRef.current = new Set();
    };

    const onParticipantConnected = (participant: RemoteParticipant) => {
      if (remoteParticipantsRef.current.has(participant.identity)) {
        return;
      }
      remoteParticipantsRef.current.add(participant.identity);
      playOrbitParticipantJoinSound();
    };

    const onParticipantDisconnected = (participant: RemoteParticipant) => {
      if (!remoteParticipantsRef.current.has(participant.identity)) {
        return;
      }
      remoteParticipantsRef.current.delete(participant.identity);
      playOrbitParticipantLeaveSound();
    };

    room.on(RoomEvent.Connected, markConnected);
    room.on(RoomEvent.Disconnected, markDisconnected);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);

    if (room.state === ConnectionState.Connected) {
      markConnected();
    } else {
      remoteParticipantsRef.current = new Set(Array.from(room.remoteParticipants.keys()));
    }

    return () => {
      room.off(RoomEvent.Connected, markConnected);
      room.off(RoomEvent.Disconnected, markDisconnected);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    };
  }, [room]);

  return null;
}

function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <GridLayout className="h-full gap-2" tracks={tracks}>
      <ParticipantTile className="overflow-hidden rounded-xl border border-white/10 bg-black/40" />
    </GridLayout>
  );
}

function AudioVisualizerGrid() {
  const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: true });

  if (!tracks.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Waiting for participants to join voice...
      </div>
    );
  }

  return (
    <div className="grid h-full auto-rows-fr gap-3 md:grid-cols-2">
      {tracks.map((trackRef, index) => (
        <div
          className="rounded-xl border border-white/10 bg-black/35 p-4"
          key={`${trackRef.participant.identity}-${index}`}
        >
          <p className="mb-3 text-sm font-medium text-violet-100">
            {trackRef.participant.name || trackRef.participant.identity}
          </p>
          <BarVisualizer
            barCount={20}
            className="h-20 rounded-md border border-violet-400/20 bg-violet-500/10 p-2"
            track={trackRef}
          />
        </div>
      ))}
    </div>
  );
}

interface FloatingRoomControlsProps {
  isVideo: boolean;
  onLeave: () => void;
  builtInClips: OrbitSoundboardClip[];
  serverClips: OrbitSoundboardClip[];
  loadingSubscription: boolean;
  currentTier: OrbitSubscriptionTier;
  soundboardPlusTier: OrbitSubscriptionTier;
  soundboardLocked: boolean;
  canManageServerSoundboard: boolean;
  loadingServerSounds: boolean;
  serverSoundError: string | null;
  serverSoundActionError: string | null;
  creatingServerSound: boolean;
  removingServerSoundId: string | null;
  onPlayClip: (clip: OrbitSoundboardClip) => Promise<void>;
  onRefreshServerSounds: () => Promise<void>;
  onSaveServerSound: (values: {
    title: string;
    soundUrl: string;
    iconEmoji: string | null;
  }) => Promise<SoundboardActionResult>;
  onRemoveServerSound: (clipId: string) => Promise<void>;
}

function FloatingRoomControls({
  isVideo,
  onLeave,
  builtInClips,
  serverClips,
  loadingSubscription,
  currentTier,
  soundboardPlusTier,
  soundboardLocked,
  canManageServerSoundboard,
  loadingServerSounds,
  serverSoundError,
  serverSoundActionError,
  creatingServerSound,
  removingServerSoundId,
  onPlayClip,
  onRefreshServerSounds,
  onSaveServerSound,
  onRemoveServerSound,
}: FloatingRoomControlsProps) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const [busy, setBusy] = useState(false);
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customEmoji, setCustomEmoji] = useState("🔊");
  const [formError, setFormError] = useState<string | null>(null);

  const tierLabel =
    currentTier === "PULSE_PLUS"
      ? "Pulse+"
      : currentTier === "PULSE"
        ? "Pulse"
        : "Free";

  async function toggleMic() {
    setBusy(true);
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    setBusy(false);
  }

  async function toggleCamera() {
    if (!isVideo) {
      return;
    }
    setBusy(true);
    await localParticipant.setCameraEnabled(!isCameraEnabled);
    setBusy(false);
  }

  async function leaveRoom() {
    setBusy(true);
    await room.disconnect();
    setBusy(false);
    onLeave();
  }

  async function submitCustomSound() {
    const title = customTitle.trim();
    const soundUrl = normalizeSoundUrl(customUrl);
    if (!title) {
      setFormError("Sound title is required.");
      return;
    }
    if (!isValidSoundUrl(soundUrl)) {
      setFormError("Use a valid https:// sound URL.");
      return;
    }

    setFormError(null);
    const result = await onSaveServerSound({
      title,
      soundUrl,
      iconEmoji: customEmoji.trim() || null,
    });
    if (result.error) {
      setFormError(result.error);
      return;
    }

    setCustomTitle("");
    setCustomUrl("");
  }

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      {soundboardOpen ? (
        <div className="pointer-events-auto absolute bottom-16 left-1/2 w-[min(95vw,460px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/15 bg-[#080b14]/95 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-cyan-200" />
              <p className="text-sm font-semibold text-zinc-100">Orbit Soundboard</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-violet-300/35 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-100">
                Tier: {tierLabel}
              </span>
              {loadingSubscription ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
              ) : null}
            </div>
          </div>
          <ScrollArea className="max-h-[55vh] p-3">
            {soundboardLocked ? (
              <div className="mb-3 rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  <span>Unlock required: upgrade to Orbit {soundboardPlusTier}.</span>
                </div>
              </div>
            ) : null}

            <div className="mb-3">
              <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
                Built-in effects
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {builtInClips.map((clip) => (
                  <Button
                    className="h-9 justify-start rounded-xl"
                    disabled={soundboardLocked}
                    key={`builtin:${clip.id}`}
                    onClick={() => void onPlayClip(clip)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <span className="text-base">{clip.emoji}</span>
                    <span className="truncate">{clip.title}</span>
                  </Button>
                ))}
              </div>
            </div>

            {canManageServerSoundboard || serverClips.length ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Server custom sounds
                  </p>
                  <Button
                    className="rounded-full"
                    disabled={loadingServerSounds}
                    onClick={() => void onRefreshServerSounds()}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {loadingServerSounds ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Refresh
                  </Button>
                </div>
                {serverClips.length ? (
                  <div className="space-y-2">
                    {serverClips.map((clip) => (
                      <div
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-2 py-1.5"
                        key={`server:${clip.id}`}
                      >
                        <Button
                          className="h-8 flex-1 justify-start rounded-lg"
                          disabled={soundboardLocked}
                          onClick={() => void onPlayClip(clip)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          <span className="text-base">{clip.emoji}</span>
                          <span className="truncate">{clip.title}</span>
                        </Button>
                        {canManageServerSoundboard ? (
                          <Button
                            className="h-8 rounded-lg"
                            disabled={removingServerSoundId === clip.id}
                            onClick={() => void onRemoveServerSound(clip.id)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            {removingServerSoundId === clip.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 text-rose-200" />
                            )}
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-xs text-zinc-500">
                    No custom sounds yet for this server.
                  </p>
                )}
                {serverSoundError ? (
                  <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {serverSoundError}
                  </p>
                ) : null}
                {serverSoundActionError ? (
                  <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {serverSoundActionError}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-xs text-zinc-500">
                Open a server voice/video channel to use custom group sounds.
              </p>
            )}

            {canManageServerSoundboard ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Add custom sound
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    className="h-9 rounded-lg border-white/10 bg-black/30"
                    onChange={(event) => setCustomTitle(event.target.value)}
                    placeholder="Name (e.g. Duck remix)"
                    value={customTitle}
                  />
                  <Input
                    className="h-9 rounded-lg border-white/10 bg-black/30"
                    maxLength={3}
                    onChange={(event) => setCustomEmoji(event.target.value)}
                    placeholder="Emoji"
                    value={customEmoji}
                  />
                  <Input
                    className="h-9 rounded-lg border-white/10 bg-black/30 sm:col-span-2"
                    onChange={(event) => setCustomUrl(event.target.value)}
                    placeholder="https://your-cdn/sound.mp3"
                    value={customUrl}
                  />
                  <div className="sm:col-span-2">
                    <Button
                      className="w-full rounded-full"
                      disabled={creatingServerSound || soundboardLocked}
                      onClick={() => void submitCustomSound()}
                      size="sm"
                      type="button"
                    >
                      {creatingServerSound ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Save custom sound
                    </Button>
                  </div>
                </div>
                {formError ? (
                  <p className="mt-2 rounded-lg border border-red-500/35 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
                    {formError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </ScrollArea>
        </div>
      ) : null}

      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-2 py-1.5 backdrop-blur">
        <Button
          className="rounded-full"
          disabled={busy}
          onClick={() => void toggleMic()}
          size="icon"
          type="button"
          variant={isMicrophoneEnabled ? "secondary" : "destructive"}
        >
          {isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>

        {isVideo ? (
          <Button
            className="rounded-full"
            disabled={busy}
            onClick={() => void toggleCamera()}
            size="icon"
            type="button"
            variant={isCameraEnabled ? "secondary" : "destructive"}
          >
            {isCameraEnabled ? (
              <Video className="h-4 w-4" />
            ) : (
              <VideoOff className="h-4 w-4" />
            )}
          </Button>
        ) : null}

        <Button
          className="rounded-full"
          onClick={() => setSoundboardOpen((open) => !open)}
          size="icon"
          type="button"
          variant={soundboardOpen ? "default" : "secondary"}
        >
          {soundboardLocked ? (
            <Crown className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>

        <Button
          className="rounded-full"
          disabled={busy}
          onClick={() => void leaveRoom()}
          size="icon"
          type="button"
          variant="destructive"
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
