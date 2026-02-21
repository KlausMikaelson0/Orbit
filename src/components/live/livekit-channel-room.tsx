"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildLivekitRoomName } from "@/lib/utils";
import {
  playOrbitCallJoinSound,
  playOrbitCallLeaveSound,
  playOrbitParticipantJoinSound,
  playOrbitParticipantLeaveSound,
} from "@/src/lib/orbit-notifications";
import type { ChannelType } from "@/src/types/orbit";

interface LivekitChannelRoomProps {
  serverId: string;
  channelId: string;
  channelType: ChannelType;
  userId: string;
  displayName: string;
}

export function LivekitChannelRoom({
  serverId,
  channelId,
  channelType,
  userId,
  displayName,
}: LivekitChannelRoomProps) {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [loadingToken, setLoadingToken] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [joined, setJoined] = useState(true);

  const isVideoChannel = channelType === "VIDEO";
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const roomName = useMemo(
    () => buildLivekitRoomName(serverId, channelId),
    [channelId, serverId],
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
          isVideo={isVideoChannel}
          onLeave={() => setJoined(false)}
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
}

function FloatingRoomControls({ isVideo, onLeave }: FloatingRoomControlsProps) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
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
