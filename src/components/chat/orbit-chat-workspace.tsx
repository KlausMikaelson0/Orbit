"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  BrainCircuit,
  Hash,
  Phone,
  PhoneOff,
  RadioTower,
  ShieldAlert,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { ServerAnalyticsDashboard } from "@/src/components/analytics/server-analytics-dashboard";
import { ChatInput } from "@/src/components/chat/chat-input";
import { ChatMessages } from "@/src/components/chat/chat-messages";
import { ChannelTasksPanel } from "@/src/components/chat/channel-tasks-panel";
import { OrbitForumView } from "@/src/components/forum/orbit-forum-view";
import { OrbitQuestsView } from "@/src/components/economy/orbit-quests-view";
import { OrbitShopView } from "@/src/components/economy/orbit-shop-view";
import { OrbitLabsView } from "@/src/components/labs/orbit-labs-view";
import { useOrbitSocialContext } from "@/src/context/orbit-social-context";
import { useOrbitChannelPermissions } from "@/src/hooks/use-orbit-channel-permissions";
import { requestOrbitSummary } from "@/src/lib/orbit-bot";
import { isSupabaseReady } from "@/src/lib/supabase-browser";
import { DmHomeView } from "@/src/components/social/dm-home-view";
import { FriendsView } from "@/src/components/social/friends-view";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type { OrbitMessageView } from "@/src/types/orbit";

const LivekitChannelRoom = dynamic(
  () =>
    import("@/src/components/live/livekit-channel-room").then(
      (mod) => mod.LivekitChannelRoom,
    ),
  { ssr: false },
);

const EMPTY_MESSAGES: OrbitMessageView[] = [];

export function OrbitChatWorkspace() {
  const isLocalMode = !isSupabaseReady();
  const hasLivekitUrl = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const {
    canConnectChannel,
    canManageServerRules,
    canPostChannel,
    canViewChannel,
  } = useOrbitChannelPermissions();
  const {
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    openOrCreateDmWithProfile,
    startDmCall,
    endActiveCall,
    outgoingCallPending,
    cancelOutgoingCall,
    callNotice,
    clearCallNotice,
  } = useOrbitSocialContext();
  const {
    activeView,
    servers,
    profile,
    activeServerId,
    activeChannelId,
    activeDmThreadId,
    channelsByServer,
    dmConversations,
    membershipsByServer,
    activeCallSession,
    privacyMode,
    setActiveFriends,
    setActiveChannel,
    setActiveLabs,
  } = useOrbitNavStore(
    useShallow((state) => ({
      activeView: state.activeView,
      servers: state.servers,
      profile: state.profile,
      activeServerId: state.activeServerId,
      activeChannelId: state.activeChannelId,
      activeDmThreadId: state.activeDmThreadId,
      channelsByServer: state.channelsByServer,
      dmConversations: state.dmConversations,
      membershipsByServer: state.membershipsByServer,
      activeCallSession: state.activeCallSession,
      privacyMode: state.privacyMode,
      setActiveFriends: state.setActiveFriends,
      setActiveChannel: state.setActiveChannel,
      setActiveLabs: state.setActiveLabs,
    })),
  );
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [channelSurface, setChannelSurface] = useState<"CHAT" | "TASKS">("CHAT");
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const activeServer = servers.find((server) => server.id === activeServerId) ?? null;
  const activeChannels = useMemo(
    () => (activeServerId ? channelsByServer[activeServerId] ?? [] : []),
    [activeServerId, channelsByServer],
  );
  const activeChannel =
    activeChannels.find((channel) => channel.id === activeChannelId) ?? null;
  const currentMember = activeServerId
    ? membershipsByServer[activeServerId] ?? null
    : null;
  const canViewAnalytics = Boolean(
    activeServer &&
      profile &&
      activeServer.owner_id === profile.id,
  );
  const activeDmConversation = dmConversations.find(
    (conversation) => conversation.thread.id === activeDmThreadId,
  );
  const isTextServerChannel =
    activeView === "SERVER" && activeChannel?.type === "TEXT";
  const activeConversationKey = useMemo(
    () => {
      if (activeView === "DM_THREAD" && activeDmThreadId) {
        return `dm:${activeDmThreadId}`;
      }
      if (activeView === "SERVER" && activeChannelId) {
        return `channel:${activeChannelId}`;
      }
      return null;
    },
    [activeChannelId, activeDmThreadId, activeView],
  );
  const recentMessages = useOrbitNavStore((state) =>
    activeConversationKey
      ? state.messageCache[activeConversationKey] ?? EMPTY_MESSAGES
      : EMPTY_MESSAGES,
  );
  const threadRootMessage = useMemo(
    () => recentMessages.find((message) => message.id === threadRootId) ?? null,
    [recentMessages, threadRootId],
  );
  const firstViewableChannel = useMemo(
    () => activeChannels.find((channel) => canViewChannel(channel)) ?? null,
    [activeChannels, canViewChannel],
  );
  const canViewActiveChannel = activeChannel ? canViewChannel(activeChannel) : false;
  const canPostActiveChannel = activeChannel ? canPostChannel(activeChannel) : false;
  const canConnectActiveChannel = activeChannel ? canConnectChannel(activeChannel) : false;
  const canManageServerRulesForActiveServer = canManageServerRules(activeServerId);

  useEffect(() => {
    setSummary(null);
    setSummaryError(null);
    setThreadRootId(null);
    setChannelSurface("CHAT");
    setShowAnalytics(false);
  }, [activeChannelId, activeDmThreadId]);

  useEffect(() => {
    if (activeView !== "SERVER" || !activeServerId) {
      return;
    }

    const fallback = firstViewableChannel;
    if (!fallback) {
      return;
    }

    if (!activeChannel || !canViewChannel(activeChannel)) {
      setActiveChannel(fallback.id);
    }
  }, [
    activeChannel,
    activeServerId,
    activeView,
    canViewChannel,
    firstViewableChannel,
    setActiveChannel,
  ]);

  async function summarizeChannel() {
    if (!recentMessages.length) {
      return;
    }

    setSummarizing(true);
    setSummaryError(null);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const text = await requestOrbitSummary(
        recentMessages
          .filter(
            (message) =>
              message.created_at >= since && !message.thread_parent_id,
          )
          .slice(-250),
      );
      setSummary(text);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Unable to summarize.");
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-[0.16em] text-zinc-400">
            {activeView === "DM_THREAD"
              ? "Direct Message"
              : activeView === "DM_HOME"
                ? "Home"
                : activeView === "FRIENDS"
                  ? "Friends"
                  : activeView === "SHOP"
                    ? "Shop"
                    : activeView === "QUESTS"
                      ? "Quests"
                      : activeView === "LABS"
                        ? "Labs"
                  : activeServer?.name ?? "Unified Space"}
          </p>
          <p className="truncate text-sm font-semibold text-violet-100">
            {activeView === "DM_THREAD"
              ? activeDmConversation?.otherProfile.full_name ??
                activeDmConversation?.otherProfile.username ??
                "Conversation"
              : activeView === "DM_HOME"
                ? "Direct Messages"
                : activeView === "FRIENDS"
                  ? "Relationship Hub"
                  : activeView === "SHOP"
                    ? "Orbit Shop"
                    : activeView === "QUESTS"
                      ? "Orbit Missions"
                      : activeView === "LABS"
                        ? "Orbit Labs"
                  : activeChannel
                    ? `#${activeChannel.name}`
                    : "No active channel"}
          </p>
        </div>
        <div className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] text-violet-200">
          {activeView === "SERVER"
            ? activeChannel?.type ?? "TEXT"
            : activeView === "DM_THREAD"
              ? "DM"
              : activeView === "SHOP"
                ? "COMMERCE"
                : activeView === "QUESTS"
                  ? "MISSIONS"
                  : activeView === "LABS"
                    ? "LABS"
              : "SOCIAL"}
        </div>
      </div>

      {activeView === "SERVER" || activeView === "DM_THREAD" ? (
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <BrainCircuit className="h-4 w-4 text-violet-300" />
              Orbit AI summarizer
            </div>
            {activeView === "DM_THREAD" && activeDmConversation ? (
              <div className="ml-2 flex items-center gap-1">
                <Button
                  className="rounded-full"
                  disabled={isLocalMode || !hasLivekitUrl}
                  onClick={() =>
                    void startDmCall(activeDmConversation.otherProfile, {
                      threadId: activeDmConversation.thread.id,
                      mode: "AUDIO",
                    })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Phone className="h-4 w-4" />
                  Voice
                </Button>
                <Button
                  className="rounded-full"
                  disabled={isLocalMode || !hasLivekitUrl}
                  onClick={() =>
                    void startDmCall(activeDmConversation.otherProfile, {
                      threadId: activeDmConversation.thread.id,
                      mode: "VIDEO",
                    })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Video className="h-4 w-4" />
                  Video
                </Button>
                {!hasLivekitUrl ? (
                  <span className="text-[11px] text-amber-200">
                    Configure LiveKit URL to enable calls
                  </span>
                ) : null}
              </div>
            ) : null}
            {isTextServerChannel ? (
              <div className="ml-2 flex items-center gap-1">
                <Button
                  className="rounded-full"
                  onClick={() => setChannelSurface("CHAT")}
                  size="sm"
                  type="button"
                  variant={channelSurface === "CHAT" ? "default" : "secondary"}
                >
                  Chat
                </Button>
                <Button
                  className="rounded-full"
                  onClick={() => setChannelSurface("TASKS")}
                  size="sm"
                  type="button"
                  variant={channelSurface === "TASKS" ? "default" : "secondary"}
                >
                  Tasks
                </Button>
              </div>
            ) : null}
            {canViewAnalytics ? (
              <Button
                className="rounded-full"
                onClick={() => setShowAnalytics((value) => !value)}
                size="sm"
                type="button"
                variant={showAnalytics ? "default" : "secondary"}
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Button>
            ) : null}
            {activeView === "SERVER" && canManageServerRulesForActiveServer ? (
              <Button
                className="rounded-full"
                onClick={() => setActiveLabs()}
                size="sm"
                type="button"
                variant="secondary"
              >
                <ShieldAlert className="h-4 w-4" />
                Rules & Roles
              </Button>
            ) : null}
          </div>
          <Button
            className="rounded-full"
            disabled={summarizing}
            onClick={() => void summarizeChannel()}
            size="sm"
            variant="secondary"
          >
            <Sparkles className="h-4 w-4" />
            {summarizing ? "Summarizing..." : "Summarize Channel"}
          </Button>
        </div>
      ) : null}

      {summary ? (
        <div className="mb-3 rounded-2xl border border-violet-400/35 bg-violet-500/10 p-3">
          <p className="mb-1 text-xs uppercase tracking-[0.14em] text-violet-200">AI Summary</p>
          <p className="text-sm leading-relaxed text-zinc-100">{summary}</p>
        </div>
      ) : null}
      {summaryError ? (
        <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {summaryError}
        </p>
      ) : null}
      {callNotice ? (
        <p className="mb-3 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {callNotice}
          {outgoingCallPending ? (
            <button
              className="ml-2 text-amber-200 underline-offset-2 hover:underline"
              onClick={() => void cancelOutgoingCall()}
              type="button"
            >
              Cancel call
            </button>
          ) : null}
          <button
            className="ml-2 text-amber-200 underline-offset-2 hover:underline"
            onClick={() => clearCallNotice()}
            type="button"
          >
            Dismiss
          </button>
        </p>
      ) : null}
      {showAnalytics ? (
        <ServerAnalyticsDashboard
          enabled={canViewAnalytics}
          serverId={activeServer?.id ?? null}
        />
      ) : null}
      {activeCallSession ? (
        <div className="mb-3 flex min-h-0 flex-1 flex-col rounded-2xl border border-violet-400/30 bg-black/25 p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.14em] text-violet-200">Live Call</p>
              <p className="truncate text-sm text-zinc-100">
                With {activeCallSession.peer_name} · {activeCallSession.mode.toLowerCase()}
              </p>
            </div>
            <Button
              className="rounded-full"
              onClick={() => void endActiveCall()}
              size="sm"
              type="button"
              variant="destructive"
            >
              <PhoneOff className="h-4 w-4" />
              End call
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <LivekitChannelRoom
              canManageServerSoundboard={false}
              channelId={activeCallSession.room_id}
              channelType={activeCallSession.mode}
              displayName={profile?.full_name ?? profile?.username ?? "Orbit User"}
              serverId="dm-call"
              userId={profile?.id ?? "guest"}
            />
          </div>
        </div>
      ) : null}

      {activeCallSession ? null : activeView === "FRIENDS" ? (
        <FriendsView
          acceptFriendRequest={acceptFriendRequest}
          declineFriendRequest={declineFriendRequest}
          openOrCreateDmWithProfile={openOrCreateDmWithProfile}
          sendFriendRequest={sendFriendRequest}
        />
      ) : activeView === "QUESTS" ? (
        <OrbitQuestsView />
      ) : activeView === "SHOP" ? (
        <OrbitShopView />
      ) : activeView === "LABS" ? (
        isLocalMode ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-center text-zinc-300">
            <div className="max-w-lg px-5">
              <p className="text-sm font-semibold text-zinc-100">Labs is in cloud mode</p>
              <p className="mt-2 text-sm text-zinc-400">
                Configure Supabase to unlock realtime Labs controls, marketplace install state,
                and server automation settings.
              </p>
            </div>
          </div>
        ) : (
          <OrbitLabsView />
        )
      ) : activeView === "DM_HOME" ? (
        <DmHomeView onOpenFriends={setActiveFriends} />
      ) : activeView === "DM_THREAD" ? (
        <>
          <div className={`min-h-0 flex-1 ${privacyMode ? "privacy-shield" : ""}`}>
            <div className="privacy-content h-full">
              <ChatMessages
                conversationId={activeDmConversation?.thread.id ?? null}
                mode="dm"
              />
            </div>
          </div>
          <ChatInput
            canManageCustomMedia={false}
            conversationId={activeDmConversation?.thread.id ?? null}
            member={null}
            mode="dm"
            profile={profile}
            serverId={null}
          />
        </>
      ) : !activeServer ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-zinc-400">
          <div className="text-center">
            <RadioTower className="mx-auto mb-2 h-6 w-6 text-violet-300" />
            <p className="text-sm">Create or join a server to begin.</p>
          </div>
        </div>
      ) : !activeChannel ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-zinc-400">
          <div className="text-center">
            <Hash className="mx-auto mb-2 h-6 w-6 text-violet-300" />
            <p className="text-sm">Create a channel in this server.</p>
          </div>
        </div>
      ) : !canViewActiveChannel ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-amber-300/30 bg-amber-500/10 text-center text-amber-100">
          <div className="max-w-lg px-5">
            <p className="text-sm font-semibold">You do not have access to view this channel</p>
            <p className="mt-2 text-sm text-amber-200/80">
              Ask the server owner/admin to update role permissions for this channel.
            </p>
          </div>
        </div>
      ) : activeChannel.type === "AUDIO" || activeChannel.type === "VIDEO" ? (
        !canConnectActiveChannel ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-amber-300/30 bg-amber-500/10 text-center text-amber-100">
            <div className="max-w-lg px-5">
              <p className="text-sm font-semibold">Voice access is restricted for your role</p>
              <p className="mt-2 text-sm text-amber-200/80">
                This {activeChannel.type.toLowerCase()} channel requires connect permission.
              </p>
            </div>
          </div>
        ) : isLocalMode ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-center text-zinc-300">
            <div className="max-w-lg px-5">
              <p className="text-sm font-semibold text-zinc-100">
                Voice/video requires cloud configuration
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Add LiveKit + Supabase environment variables to enable live channel calls.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <LivekitChannelRoom
              canManageServerSoundboard={canManageServerRulesForActiveServer}
              channelId={activeChannel.id}
              channelType={activeChannel.type}
              displayName={
                profile?.full_name ?? profile?.username ?? currentMember?.id ?? "Orbit User"
              }
              serverId={activeServer.id}
              userId={profile?.id ?? currentMember?.profile_id ?? "guest"}
            />
          </div>
        )
      ) : activeChannel.type === "FORUM" ? (
        isLocalMode ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-center text-zinc-300">
            <div className="max-w-lg px-5">
              <p className="text-sm font-semibold text-zinc-100">
                Forum channels unlock in cloud mode
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Connect Supabase to persist forum posts, tags, and replies across users.
              </p>
            </div>
          </div>
        ) : (
          <OrbitForumView
            channelId={activeChannel.id}
            profileId={profile?.id ?? null}
            serverId={activeServer.id}
          />
        )
      ) : (
        channelSurface === "TASKS" && isTextServerChannel ? (
          <ChannelTasksPanel
            channelId={activeChannel.id}
            profileId={profile?.id ?? null}
          />
        ) : (
          <>
            <div className={`min-h-0 flex-1 ${privacyMode ? "privacy-shield" : ""}`}>
              <div className="privacy-content h-full">
                <ChatMessages
                  conversationId={activeChannel.id}
                  mode="channel"
                  onOpenThread={(message) => setThreadRootId(message.id)}
                />
              </div>
            </div>
            {!canPostActiveChannel ? (
              <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                You can read this channel, but your role cannot send messages here.
              </p>
            ) : null}
            <ChatInput
              canManageCustomMedia={canManageServerRulesForActiveServer}
              canPost={canPostActiveChannel}
              conversationId={activeChannel.id}
              member={currentMember}
              mode="channel"
              profile={profile}
              serverId={activeServer.id}
            />

            {threadRootId && threadRootMessage ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Threaded replies
                    </p>
                    <p className="truncate text-sm text-zinc-200">
                      {threadRootMessage.content ?? "Attachment thread"}
                    </p>
                  </div>
                  <Button
                    className="rounded-full"
                    onClick={() => setThreadRootId(null)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="h-64">
                  <ChatMessages
                    conversationId={activeChannel.id}
                    mode="channel"
                    threadParentId={threadRootId}
                    useCacheOnly
                  />
                </div>
                <ChatInput
                  canManageCustomMedia={canManageServerRulesForActiveServer}
                  canPost={canPostActiveChannel}
                  conversationId={activeChannel.id}
                  member={currentMember}
                  mode="channel"
                  profile={profile}
                  serverId={activeServer.id}
                  threadParentId={threadRootId}
                />
              </div>
            ) : null}
          </>
        )
      )}
    </div>
  );
}
