"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";

import {
  ORBIT_LOCAL_DIRECTORY,
  ORBIT_LOCAL_PROFILE,
  getOrbitLocalDmConversations,
  getOrbitLocalOnlineIds,
  getOrbitLocalRelationships,
} from "@/src/lib/orbit-local-data";
import {
  notifyOrbitMessage,
  playOrbitPingSound,
} from "@/src/lib/orbit-notifications";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type {
  OrbitDmConversation,
  OrbitDmMessage,
  OrbitDmParticipant,
  OrbitDmThread,
  OrbitIncomingCall,
  OrbitActiveCallSession,
  OrbitProfile,
  OrbitRelationship,
} from "@/src/types/orbit";

interface OrbitSocialResult<T = void> {
  data?: T;
  error?: string;
}

interface ParticipantWithProfile extends OrbitDmParticipant {
  profile: OrbitProfile | OrbitProfile[] | null;
}

export interface UseOrbitSocialResult {
  loadingSocial: boolean;
  incomingCall: OrbitIncomingCall | null;
  activeCallSession: OrbitActiveCallSession | null;
  outgoingCallPending: boolean;
  callNotice: string | null;
  sendFriendRequest: (identifier: string) => Promise<OrbitSocialResult>;
  acceptFriendRequest: (relationshipId: string) => Promise<OrbitSocialResult>;
  declineFriendRequest: (relationshipId: string) => Promise<OrbitSocialResult>;
  openOrCreateDmWithProfile: (
    profile: OrbitProfile,
  ) => Promise<OrbitSocialResult<OrbitDmConversation>>;
  startDmCall: (
    targetProfile: OrbitProfile,
    options: { threadId: string | null; mode: "AUDIO" | "VIDEO" },
  ) => Promise<OrbitSocialResult>;
  acceptIncomingCall: () => Promise<OrbitSocialResult>;
  declineIncomingCall: () => Promise<OrbitSocialResult>;
  endActiveCall: () => Promise<OrbitSocialResult>;
  cancelOutgoingCall: () => Promise<OrbitSocialResult>;
  clearCallNotice: () => void;
  fetchRelationships: () => Promise<void>;
  fetchDmConversations: () => Promise<void>;
}

function normalizeProfileRow(
  row: OrbitProfile | OrbitProfile[] | null | undefined,
): OrbitProfile | null {
  if (!row) {
    return null;
  }
  if (Array.isArray(row)) {
    return row[0] ?? null;
  }
  return row;
}

interface OrbitCallStartedPayload {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatarUrl: string | null;
  recipientId: string;
  mode: "AUDIO" | "VIDEO";
  roomId: string;
  threadId: string | null;
  startedAt: string;
}

interface OrbitCallDecisionPayload {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatarUrl: string | null;
  recipientId: string;
  recipientName: string;
  recipientAvatarUrl: string | null;
  mode: "AUDIO" | "VIDEO";
  roomId: string;
  threadId: string | null;
}

export function useOrbitSocial(user: User | null): UseOrbitSocialResult {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const hasLivekitUrl = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const profile = useOrbitNavStore((state) => state.profile);
  const incomingCall = useOrbitNavStore((state) => state.incomingCall);
  const activeCallSession = useOrbitNavStore((state) => state.activeCallSession);
  const setRelationships = useOrbitNavStore((state) => state.setRelationships);
  const setDmConversations = useOrbitNavStore((state) => state.setDmConversations);
  const setOnlineProfileIds = useOrbitNavStore((state) => state.setOnlineProfileIds);
  const setActiveDmThread = useOrbitNavStore((state) => state.setActiveDmThread);
  const setIncomingCall = useOrbitNavStore((state) => state.setIncomingCall);
  const clearIncomingCall = useOrbitNavStore((state) => state.clearIncomingCall);
  const setActiveCallSession = useOrbitNavStore((state) => state.setActiveCallSession);
  const clearActiveCallSession = useOrbitNavStore((state) => state.clearActiveCallSession);

  const [loadingSocial, setLoadingSocial] = useState(true);
  const [callNotice, setCallNotice] = useState<string | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OrbitCallStartedPayload | null>(null);
  const callSignalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchRelationships = useCallback(async () => {
    if (!isSupabaseReady()) {
      const localRows = useOrbitNavStore.getState().relationships;
      if (!localRows.length) {
        setRelationships(getOrbitLocalRelationships());
      }
      return;
    }

    if (!user) {
      setRelationships([]);
      return;
    }

    const { data } = await supabase
      .from("relationships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as Array<{
      id: string;
      requester_id: string;
      addressee_id: string;
      status: "PENDING" | "ACCEPTED" | "BLOCKED";
      created_at: string;
      updated_at: string;
    }>;

    const profileIds = Array.from(
      new Set(
        rows.flatMap((row) => [row.requester_id, row.addressee_id]),
      ),
    );
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .in("id", profileIds);
    const profileRows = (profileData ?? []) as OrbitProfile[];
    const profileById = new Map(profileRows.map((item) => [item.id, item]));

    const relationships: OrbitRelationship[] = rows.map((row) => ({
      ...row,
      requester: profileById.get(row.requester_id) ?? null,
      addressee: profileById.get(row.addressee_id) ?? null,
    }));

    setRelationships(relationships);
  }, [setRelationships, supabase, user]);

  const fetchDmConversations = useCallback(async () => {
    if (!isSupabaseReady()) {
      const localRows = useOrbitNavStore.getState().dmConversations;
      if (!localRows.length) {
        setDmConversations(getOrbitLocalDmConversations());
      }
      return;
    }

    if (!user) {
      setDmConversations([]);
      return;
    }

    const { data: selfParticipantsData } = await supabase
      .from("dm_participants")
      .select("*")
      .eq("profile_id", user.id);

    const selfParticipants = (selfParticipantsData ?? []) as OrbitDmParticipant[];
    if (!selfParticipants.length) {
      setDmConversations([]);
      return;
    }

    const threadIds = Array.from(
      new Set(selfParticipants.map((row) => row.thread_id)),
    );

    const [threadsResult, otherParticipantsResult, messagesResult] =
      await Promise.all([
        supabase
          .from("dm_threads")
          .select("*")
          .in("id", threadIds)
          .order("updated_at", { ascending: false }),
        supabase
          .from("dm_participants")
          .select(
            "id, thread_id, profile_id, created_at, updated_at, profile:profiles(*)",
          )
          .in("thread_id", threadIds)
          .neq("profile_id", user.id),
        supabase
          .from("dm_messages")
          .select("*")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

    const threads = (threadsResult.data ?? []) as OrbitDmThread[];
    const otherParticipants =
      (otherParticipantsResult.data ?? []) as unknown as ParticipantWithProfile[];
    const latestMessages = (messagesResult.data ?? []) as OrbitDmMessage[];

    const threadById = new Map(threads.map((thread) => [thread.id, thread]));
    const otherProfileByThread = new Map<string, OrbitProfile>();
    for (const participant of otherParticipants) {
      const profileRow = normalizeProfileRow(participant.profile);
      if (profileRow) {
        otherProfileByThread.set(participant.thread_id, profileRow);
      }
    }

    const lastMessageByThread = new Map<string, OrbitDmMessage>();
    for (const message of latestMessages) {
      if (!lastMessageByThread.has(message.thread_id)) {
        lastMessageByThread.set(message.thread_id, message);
      }
    }

    const conversations: OrbitDmConversation[] = [];
    for (const threadId of threadIds) {
      const thread = threadById.get(threadId);
      const otherProfile = otherProfileByThread.get(threadId);
      if (!thread || !otherProfile) {
        continue;
      }
      conversations.push({
        thread,
        otherProfile,
        lastMessage: lastMessageByThread.get(threadId) ?? null,
      });
    }

    conversations.sort((a, b) => {
      const aDate = a.lastMessage?.created_at ?? a.thread.updated_at;
      const bDate = b.lastMessage?.created_at ?? b.thread.updated_at;
      return bDate.localeCompare(aDate);
    });

    setDmConversations(conversations);
  }, [setDmConversations, supabase, user]);

  useEffect(() => {
    if (!isSupabaseReady()) {
      setRelationships(getOrbitLocalRelationships());
      setDmConversations(getOrbitLocalDmConversations());
      setOnlineProfileIds(getOrbitLocalOnlineIds());
      setLoadingSocial(false);
      return;
    }

    setLoadingSocial(true);
    void Promise.all([fetchRelationships(), fetchDmConversations()]).finally(() =>
      setLoadingSocial(false),
    );
  }, [
    fetchDmConversations,
    fetchRelationships,
    setDmConversations,
    setOnlineProfileIds,
    setRelationships,
  ]);

  useEffect(() => {
    if (!isSupabaseReady()) {
      return;
    }
    if (!user) {
      return;
    }

    const socialChannel = supabase
      .channel(`orbit-social-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationships",
        },
        () => void fetchRelationships(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_participants",
        },
        () => void fetchDmConversations(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
        },
        (payload) => {
          void (async () => {
            const inserted = payload.new as OrbitDmMessage;
            const currentState = useOrbitNavStore.getState();
            const knownThread = currentState.dmConversations.some(
              (conversation) => conversation.thread.id === inserted.thread_id,
            );
            if (!knownThread) {
              return;
            }

            await fetchDmConversations();

            if (inserted.profile_id === user.id) {
              return;
            }

            if (document.visibilityState !== "visible") {
              const source = currentState.dmConversations.find(
                (conversation) => conversation.thread.id === inserted.thread_id,
              );
              const title = source
                ? `DM from ${
                    source.otherProfile.full_name ??
                    source.otherProfile.username ??
                    "Orbit User"
                  }`
                : "New direct message";
              const body = inserted.content ?? "Sent an attachment";
              playOrbitPingSound();
              await notifyOrbitMessage(title, body);
            }
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(socialChannel);
    };
  }, [fetchDmConversations, fetchRelationships, supabase, user]);

  const sendCallSignal = useCallback(
    async (event: string, payload: object): Promise<OrbitSocialResult> => {
      const channel = callSignalChannelRef.current;
      if (!channel) {
        return { error: "Call signaling channel is not ready." };
      }
      const status = await channel.send({
        type: "broadcast",
        event,
        payload,
      });
      if (status !== "ok") {
        return { error: "Unable to send call signal." };
      }
      return {};
    },
    [],
  );

  useEffect(() => {
    if (!isSupabaseReady()) {
      clearIncomingCall();
      clearActiveCallSession();
      callSignalChannelRef.current = null;
      return;
    }
    if (!user) {
      clearIncomingCall();
      clearActiveCallSession();
      callSignalChannelRef.current = null;
      return;
    }

    const callChannel = supabase.channel("orbit-call-signaling", {
      config: {
        broadcast: { self: true },
      },
    });

    callChannel
      .on("broadcast", { event: "call-started" }, ({ payload }) => {
        const data = payload as OrbitCallStartedPayload;
        if (!data || data.recipientId !== user.id || data.callerId === user.id) {
          return;
        }

        const state = useOrbitNavStore.getState();
        const knownConversation = state.dmConversations.find(
          (conversation) =>
            conversation.otherProfile.id === data.callerId &&
            (!data.threadId || conversation.thread.id === data.threadId),
        );
        if (!knownConversation) {
          return;
        }

        setIncomingCall({
          call_id: data.callId,
          caller_profile_id: data.callerId,
          caller_name:
            data.callerName ||
            knownConversation.otherProfile.full_name ||
            knownConversation.otherProfile.username ||
            "Orbit User",
          caller_avatar_url:
            data.callerAvatarUrl || knownConversation.otherProfile.avatar_url || null,
          recipient_profile_id: data.recipientId,
          mode: data.mode,
          room_id: data.roomId,
          thread_id: data.threadId ?? knownConversation.thread.id,
          started_at: data.startedAt ?? new Date().toISOString(),
        });
      })
      .on("broadcast", { event: "call-cancelled" }, ({ payload }) => {
        const data = payload as { callId?: string; recipientId?: string };
        if (!data?.callId || data.recipientId !== user.id) {
          return;
        }
        const currentIncoming = useOrbitNavStore.getState().incomingCall;
        if (currentIncoming?.call_id === data.callId) {
          clearIncomingCall();
        }
      })
      .on("broadcast", { event: "call-accepted" }, ({ payload }) => {
        const data = payload as OrbitCallDecisionPayload;
        if (!data || data.callerId !== user.id) {
          return;
        }
        setOutgoingCall(null);
        setCallNotice(null);
        setActiveCallSession({
          call_id: data.callId,
          peer_profile_id: data.recipientId,
          peer_name: data.recipientName || "Orbit User",
          peer_avatar_url: data.recipientAvatarUrl ?? null,
          mode: data.mode,
          room_id: data.roomId,
          thread_id: data.threadId,
          joined_at: new Date().toISOString(),
        });
      })
      .on("broadcast", { event: "call-declined" }, ({ payload }) => {
        const data = payload as OrbitCallDecisionPayload;
        if (!data || data.callerId !== user.id) {
          return;
        }
        setOutgoingCall(null);
        setCallNotice(`${data.recipientName || "Recipient"} declined your call.`);
      })
      .on("broadcast", { event: "call-ended" }, ({ payload }) => {
        const data = payload as { callId?: string; callerId?: string; recipientId?: string };
        if (!data?.callId) {
          return;
        }

        const active = useOrbitNavStore.getState().activeCallSession;
        if (active?.call_id === data.callId) {
          clearActiveCallSession();
          setCallNotice("Call ended.");
        }
        setOutgoingCall((current) => (current?.callId === data.callId ? null : current));
      })
      .subscribe();

    callSignalChannelRef.current = callChannel;

    return () => {
      callSignalChannelRef.current = null;
      void supabase.removeChannel(callChannel);
    };
  }, [
    clearActiveCallSession,
    clearIncomingCall,
    setActiveCallSession,
    setIncomingCall,
    supabase,
    user,
  ]);

  useEffect(() => {
    if (!isSupabaseReady()) {
      setOnlineProfileIds(getOrbitLocalOnlineIds());
      return;
    }
    if (!user) {
      setOnlineProfileIds([]);
      return;
    }

    const presenceChannel = supabase.channel("orbit-global-presence", {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    const syncPresence = () => {
      const state = presenceChannel.presenceState();
      const ids = new Set<string>();
      for (const key of Object.keys(state)) {
        const entries = state[key] as Array<{ profile_id?: string }>;
        for (const entry of entries) {
          if (entry.profile_id) {
            ids.add(entry.profile_id);
          }
        }
      }
      setOnlineProfileIds(Array.from(ids));
    };

    presenceChannel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            profile_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(presenceChannel);
    };
  }, [setOnlineProfileIds, supabase, user]);

  const sendFriendRequest = useCallback(
    async (identifier: string): Promise<OrbitSocialResult> => {
      if (!isSupabaseReady()) {
        const parsed = identifier.trim().match(/^([a-zA-Z0-9_]{2,32})#(\d{4})$/);
        if (!parsed) {
          return { error: "Use the format username#1234" };
        }
        const username = parsed[1].toLowerCase();
        const tag = parsed[2];
        const target =
          ORBIT_LOCAL_DIRECTORY.find(
            (row) =>
              row.username?.toLowerCase() === username && row.tag === tag,
          ) ?? null;
        if (!target) {
          return { error: "No user found with that tag." };
        }
        if (target.id === ORBIT_LOCAL_PROFILE.id) {
          return { error: "You cannot add yourself." };
        }

        const state = useOrbitNavStore.getState();
        const exists = state.relationships.some(
          (row) =>
            (row.requester_id === ORBIT_LOCAL_PROFILE.id &&
              row.addressee_id === target.id) ||
            (row.requester_id === target.id &&
              row.addressee_id === ORBIT_LOCAL_PROFILE.id),
        );
        if (exists) {
          return { error: "A relationship already exists with this user." };
        }

        setRelationships([
          ...state.relationships,
          {
            id: `local-rel-${crypto.randomUUID().slice(0, 8)}`,
            requester_id: ORBIT_LOCAL_PROFILE.id,
            addressee_id: target.id,
            status: "PENDING",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            requester: ORBIT_LOCAL_PROFILE,
            addressee: target,
          },
        ]);
        return {};
      }

      if (!user) {
        return { error: "You must be signed in." };
      }

      const parsed = identifier.trim().match(/^([a-zA-Z0-9_]{2,32})#(\d{4})$/);
      if (!parsed) {
        return { error: "Use the format username#1234" };
      }

      const username = parsed[1].toLowerCase();
      const tag = parsed[2];

      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .eq("tag", tag)
        .maybeSingle();

      if (!targetProfile) {
        return { error: "No user found with that tag." };
      }

      if (targetProfile.id === user.id) {
        return { error: "You cannot add yourself." };
      }

      const { data: existing } = await supabase
        .from("relationships")
        .select("*")
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${user.id})`,
        )
        .maybeSingle();

      if (existing) {
        return { error: "A relationship already exists with this user." };
      }

      const { error } = await supabase.from("relationships").insert({
        requester_id: user.id,
        addressee_id: targetProfile.id,
        status: "PENDING",
      });

      if (error) {
        return { error: error.message };
      }

      await fetchRelationships();
      return {};
    },
    [fetchRelationships, setRelationships, supabase, user],
  );

  const acceptFriendRequest = useCallback(
    async (relationshipId: string): Promise<OrbitSocialResult> => {
      if (!isSupabaseReady()) {
        const state = useOrbitNavStore.getState();
        setRelationships(
          state.relationships.map((relationship) =>
            relationship.id === relationshipId
              ? {
                  ...relationship,
                  status: "ACCEPTED",
                  updated_at: new Date().toISOString(),
                }
              : relationship,
          ),
        );
        return {};
      }

      if (!user) {
        return { error: "You must be signed in." };
      }

      const { error } = await supabase
        .from("relationships")
        .update({ status: "ACCEPTED" })
        .eq("id", relationshipId)
        .eq("addressee_id", user.id);

      if (error) {
        return { error: error.message };
      }

      await fetchRelationships();
      return {};
    },
    [fetchRelationships, setRelationships, supabase, user],
  );

  const declineFriendRequest = useCallback(
    async (relationshipId: string): Promise<OrbitSocialResult> => {
      if (!isSupabaseReady()) {
        const state = useOrbitNavStore.getState();
        setRelationships(
          state.relationships.filter((relationship) => relationship.id !== relationshipId),
        );
        return {};
      }

      if (!user) {
        return { error: "You must be signed in." };
      }

      const { error } = await supabase
        .from("relationships")
        .delete()
        .eq("id", relationshipId)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (error) {
        return { error: error.message };
      }

      await fetchRelationships();
      return {};
    },
    [fetchRelationships, setRelationships, supabase, user],
  );

  const openOrCreateDmWithProfile = useCallback(
    async (targetProfile: OrbitProfile): Promise<OrbitSocialResult<OrbitDmConversation>> => {
      if (!isSupabaseReady()) {
        const currentState = useOrbitNavStore.getState();
        const existing = currentState.dmConversations.find(
          (conversation) => conversation.otherProfile.id === targetProfile.id,
        );
        if (existing) {
          setActiveDmThread(existing.thread.id);
          return { data: existing };
        }

        const now = new Date().toISOString();
        const conversation: OrbitDmConversation = {
          thread: {
            id: `local-dm-${crypto.randomUUID().slice(0, 8)}`,
            created_at: now,
            updated_at: now,
          },
          otherProfile: targetProfile,
          lastMessage: null,
        };
        useOrbitNavStore.getState().upsertDmConversation(conversation);
        setActiveDmThread(conversation.thread.id);
        return { data: conversation };
      }

      if (!user || !profile) {
        return { error: "You must be signed in." };
      }

      const currentState = useOrbitNavStore.getState();
      const existing = currentState.dmConversations.find(
        (conversation) => conversation.otherProfile.id === targetProfile.id,
      );
      if (existing) {
        setActiveDmThread(existing.thread.id);
        return { data: existing };
      }

      const { data: thread, error: threadError } = await supabase
        .from("dm_threads")
        .insert({})
        .select("*")
        .single();

      if (threadError || !thread) {
        return { error: threadError?.message ?? "Unable to create DM thread." };
      }

      const { error: participantError } = await supabase.from("dm_participants").insert([
        {
          thread_id: thread.id,
          profile_id: user.id,
        },
        {
          thread_id: thread.id,
          profile_id: targetProfile.id,
        },
      ]);

      if (participantError) {
        return { error: participantError.message };
      }

      const createdConversation: OrbitDmConversation = {
        thread: thread as OrbitDmThread,
        otherProfile: targetProfile,
        lastMessage: null,
      };

      useOrbitNavStore.getState().upsertDmConversation(createdConversation);
      setActiveDmThread(thread.id);
      await fetchDmConversations();

      return { data: createdConversation };
    },
    [fetchDmConversations, profile, setActiveDmThread, supabase, user],
  );

  const startDmCall = useCallback(
    async (
      targetProfile: OrbitProfile,
      options: { threadId: string | null; mode: "AUDIO" | "VIDEO" },
    ): Promise<OrbitSocialResult> => {
      if (!hasLivekitUrl) {
        setCallNotice(
          "Voice/video calls require NEXT_PUBLIC_LIVEKIT_URL plus server-side LiveKit credentials.",
        );
        return { error: "LiveKit URL is not configured." };
      }

      if (!isSupabaseReady()) {
        setCallNotice(
          "Voice/video calls need LiveKit + Supabase in cloud mode. Messaging stays available in browser mode.",
        );
        return { error: "Cloud call services are not configured." };
      }

      if (!user || !profile) {
        return { error: "You must be signed in." };
      }
      if (!options.threadId) {
        return { error: "Open a DM thread before starting a call." };
      }

      const callId = crypto.randomUUID();
      const roomId = `dm-${options.threadId}-${callId.slice(0, 8)}`;
      const startedPayload: OrbitCallStartedPayload = {
        callId,
        callerId: user.id,
        callerName: profile.full_name ?? profile.username ?? "Orbit User",
        callerAvatarUrl: profile.avatar_url ?? null,
        recipientId: targetProfile.id,
        mode: options.mode,
        roomId,
        threadId: options.threadId,
        startedAt: new Date().toISOString(),
      };
      setCallNotice(`Calling ${targetProfile.full_name ?? targetProfile.username ?? "Orbit User"}...`);
      setOutgoingCall(startedPayload);

      const result = await sendCallSignal("call-started", startedPayload);
      if (result.error) {
        setOutgoingCall(null);
      }
      return result;
    },
    [hasLivekitUrl, profile, sendCallSignal, user],
  );

  const acceptIncomingCall = useCallback(async (): Promise<OrbitSocialResult> => {
    if (!isSupabaseReady()) {
      return { error: "Cloud call services are not configured." };
    }
    if (!user || !profile || !incomingCall) {
      return { error: "No incoming call." };
    }

    clearIncomingCall();
    setCallNotice(null);
    setActiveCallSession({
      call_id: incomingCall.call_id,
      peer_profile_id: incomingCall.caller_profile_id,
      peer_name: incomingCall.caller_name,
      peer_avatar_url: incomingCall.caller_avatar_url,
      mode: incomingCall.mode,
      room_id: incomingCall.room_id,
      thread_id: incomingCall.thread_id,
      joined_at: new Date().toISOString(),
    });

    return sendCallSignal("call-accepted", {
      callId: incomingCall.call_id,
      callerId: incomingCall.caller_profile_id,
      callerName: incomingCall.caller_name,
      callerAvatarUrl: incomingCall.caller_avatar_url,
      recipientId: user.id,
      recipientName: profile.full_name ?? profile.username ?? "Orbit User",
      recipientAvatarUrl: profile.avatar_url ?? null,
      mode: incomingCall.mode,
      roomId: incomingCall.room_id,
      threadId: incomingCall.thread_id,
    });
  }, [
    clearIncomingCall,
    incomingCall,
    profile,
    sendCallSignal,
    setActiveCallSession,
    user,
  ]);

  const declineIncomingCall = useCallback(async (): Promise<OrbitSocialResult> => {
    if (!isSupabaseReady()) {
      return { error: "Cloud call services are not configured." };
    }
    if (!user || !profile || !incomingCall) {
      return { error: "No incoming call." };
    }

    const current = incomingCall;
    clearIncomingCall();

    return sendCallSignal("call-declined", {
      callId: current.call_id,
      callerId: current.caller_profile_id,
      callerName: current.caller_name,
      callerAvatarUrl: current.caller_avatar_url,
      recipientId: user.id,
      recipientName: profile.full_name ?? profile.username ?? "Orbit User",
      recipientAvatarUrl: profile.avatar_url ?? null,
      mode: current.mode,
      roomId: current.room_id,
      threadId: current.thread_id,
    });
  }, [clearIncomingCall, incomingCall, profile, sendCallSignal, user]);

  const endActiveCall = useCallback(async (): Promise<OrbitSocialResult> => {
    if (!isSupabaseReady()) {
      return { error: "Cloud call services are not configured." };
    }
    if (!activeCallSession || !user) {
      return { error: "No active call to end." };
    }

    const endedCallId = activeCallSession.call_id;
    clearActiveCallSession();
    setCallNotice(null);
    setOutgoingCall(null);

    return sendCallSignal("call-ended", {
      callId: endedCallId,
      callerId: user.id,
      recipientId: activeCallSession.peer_profile_id,
    });
  }, [activeCallSession, clearActiveCallSession, sendCallSignal, user]);

  const cancelOutgoingCall = useCallback(async (): Promise<OrbitSocialResult> => {
    if (!isSupabaseReady()) {
      return { error: "Cloud call services are not configured." };
    }
    if (!outgoingCall) {
      return { error: "No outgoing call to cancel." };
    }

    const callId = outgoingCall.callId;
    setOutgoingCall(null);
    setCallNotice(null);

    return sendCallSignal("call-cancelled", {
      callId,
      callerId: outgoingCall.callerId,
      recipientId: outgoingCall.recipientId,
    });
  }, [outgoingCall, sendCallSignal]);

  const clearCallNotice = useCallback(() => {
    setCallNotice(null);
  }, []);

  return {
    loadingSocial,
    incomingCall,
    activeCallSession,
    outgoingCallPending: Boolean(outgoingCall),
    callNotice,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    openOrCreateDmWithProfile,
    startDmCall,
    acceptIncomingCall,
    declineIncomingCall,
    endActiveCall,
    cancelOutgoingCall,
    clearCallNotice,
    fetchRelationships,
    fetchDmConversations,
  };
}
