"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  FileText,
  FlaskConical,
  Hash,
  MessagesSquare,
  Mic,
  Plus,
  Rocket,
  ScrollText,
  Settings2,
  Share2,
  Shield,
  ShoppingBag,
  Users,
  Video,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrbitChannelPermissions } from "@/src/hooks/use-orbit-channel-permissions";
import { useModal } from "@/src/hooks/use-modal";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type { ChannelType } from "@/src/types/orbit";

const channelTypeIcon: Record<ChannelType, typeof Hash> = {
  TEXT: Hash,
  AUDIO: Mic,
  VIDEO: Video,
  FORUM: MessagesSquare,
};

function channelTypeLabel(type: ChannelType) {
  if (type === "TEXT") return "Text";
  if (type === "AUDIO") return "Audio";
  if (type === "FORUM") return "Forum";
  return "Video";
}

interface ChannelSidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function ChannelSidebar({ mobile = false, onNavigate }: ChannelSidebarProps) {
  const { onOpen } = useModal();
  const { canViewChannel, canManageChannel, canManageServerRules } = useOrbitChannelPermissions();
  const {
    activeView,
    servers,
    channelsByServer,
    dmConversations,
    onlineProfileIds,
    activeServerId,
    activeChannelId,
    activeDmThreadId,
    setActiveChannel,
    setActiveFriends,
    setActiveQuests,
    setActiveShop,
    setActiveLabs,
    setActiveDmThread,
  } = useOrbitNavStore(
    useShallow((state) => ({
      activeView: state.activeView,
      servers: state.servers,
      channelsByServer: state.channelsByServer,
      dmConversations: state.dmConversations,
      onlineProfileIds: state.onlineProfileIds,
      activeServerId: state.activeServerId,
      activeChannelId: state.activeChannelId,
      activeDmThreadId: state.activeDmThreadId,
      setActiveChannel: state.setActiveChannel,
      setActiveFriends: state.setActiveFriends,
      setActiveQuests: state.setActiveQuests,
      setActiveShop: state.setActiveShop,
      setActiveLabs: state.setActiveLabs,
      setActiveDmThread: state.setActiveDmThread,
    })),
  );

  const activeServer = servers.find((server) => server.id === activeServerId) ?? null;
  const channels = useMemo(
    () => (activeServerId ? channelsByServer[activeServerId] ?? [] : []),
    [activeServerId, channelsByServer],
  );
  const visibleChannels = useMemo(
    () => channels.filter((channel) => canViewChannel(channel)),
    [canViewChannel, channels],
  );
  const isServerView = activeView === "SERVER";
  const isHomeView =
    activeView === "DM_HOME" ||
    activeView === "DM_THREAD" ||
    activeView === "FRIENDS" ||
    activeView === "SHOP" ||
    activeView === "QUESTS" ||
    activeView === "LABS";
  const [headerNotice, setHeaderNotice] = useState<string | null>(null);

  async function copyInviteCode(inviteCode: string) {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setHeaderNotice("Invite code copied.");
      window.setTimeout(() => setHeaderNotice(null), 1400);
    } catch {
      setHeaderNotice("Unable to copy invite code.");
      window.setTimeout(() => setHeaderNotice(null), 1600);
    }
  }

  useEffect(() => {
    if (!isServerView || !activeServerId) {
      return;
    }
    const fallback = visibleChannels[0] ?? null;
    if (!fallback) {
      return;
    }
    const hasActiveVisibleChannel = Boolean(
      activeChannelId && visibleChannels.some((channel) => channel.id === activeChannelId),
    );
    if (!hasActiveVisibleChannel) {
      setActiveChannel(fallback.id);
    }
  }, [activeChannelId, activeServerId, isServerView, setActiveChannel, visibleChannels]);

  return (
    <aside
      className={`glass-panel h-full rounded-[1.75rem] border border-white/10 p-3 ${
        mobile ? "w-full" : "w-[270px] xl:w-[300px]"
      }`}
    >
      <div className="mb-3 rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-violet-100">
              {isServerView ? activeServer?.name ?? "Select a server" : "Home"}
            </p>
            <p className="mt-1 truncate text-xs text-zinc-400">
              {isServerView
                ? activeServer
                  ? `Invite: ${activeServer.invite_code}`
                  : "Join or create a server"
                : "Direct messages and friends"}
            </p>
            {isServerView && activeServer?.description ? (
              <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">
                {activeServer.description}
              </p>
            ) : null}
          </div>
          {isServerView && activeServer ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-7 rounded-full px-2" size="sm" variant="ghost">
                  Group menu
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Server options</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    void copyInviteCode(activeServer.invite_code);
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  Copy invite code
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onOpen("serverHub", {
                      serverId: activeServer.id,
                      section: "OVERVIEW",
                    });
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                  Server profile settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onOpen("serverHub", {
                      serverId: activeServer.id,
                      section: "LIFT",
                    });
                  }}
                >
                  <Rocket className="h-4 w-4" />
                  Orbit Lift
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {canManageServerRules(activeServer.id) ? (
                  <DropdownMenuItem
                    onClick={() => {
                      onOpen("createChannel", { serverId: activeServer.id });
                      onNavigate?.();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Create channel
                  </DropdownMenuItem>
                ) : null}
                {canManageServerRules(activeServer.id) ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setActiveLabs();
                      onNavigate?.();
                    }}
                  >
                    <Shield className="h-4 w-4" />
                    Rules & roles
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {headerNotice ? (
          <p className="mt-2 text-[11px] text-cyan-200">{headerNotice}</p>
        ) : null}
      </div>

      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
          {isServerView ? "Channels" : "Direct Messages"}
        </p>
        {isServerView ? (
          <div className="flex items-center gap-1">
            <Button
              className="h-7 w-7 rounded-full"
              disabled={!activeServerId || !canManageServerRules(activeServerId)}
              onClick={() => {
                onOpen("createChannel", { serverId: activeServerId ?? undefined });
                onNavigate?.();
              }}
              size="icon"
              variant="ghost"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only">Create channel</span>
            </Button>
            {canManageServerRules(activeServerId) ? (
              <Button
                className="h-7 rounded-full px-2"
                onClick={() => {
                  setActiveLabs();
                  onNavigate?.();
                }}
                size="sm"
                variant="ghost"
              >
                <Shield className="h-3.5 w-3.5" />
                Rules
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              className="rounded-full px-2.5"
              onClick={() => {
                setActiveFriends();
                onNavigate?.();
              }}
              size="sm"
              variant={activeView === "FRIENDS" ? "default" : "secondary"}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Friends</span>
            </Button>
            <Button
              className="rounded-full px-2.5"
              onClick={() => {
                setActiveShop();
                onNavigate?.();
              }}
              size="sm"
              variant={activeView === "SHOP" ? "default" : "secondary"}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Shop</span>
            </Button>
            <Button
              className="rounded-full px-2.5"
              onClick={() => {
                setActiveQuests();
                onNavigate?.();
              }}
              size="sm"
              variant={activeView === "QUESTS" ? "default" : "secondary"}
            >
              <ScrollText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Quests</span>
            </Button>
            <Button
              className="rounded-full px-2.5"
              onClick={() => {
                setActiveLabs();
                onNavigate?.();
              }}
              size="sm"
              variant={activeView === "LABS" ? "default" : "secondary"}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Labs</span>
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="h-[calc(100%-7.5rem)]">
        <div className="space-y-1">
          {isServerView
            ? visibleChannels.map((channel) => {
                const Icon = channelTypeIcon[channel.type];
                const active = channel.id === activeChannelId;
                const canManageCurrentChannel = canManageChannel(channel);

                return (
                  <div
                    className={`flex items-center gap-1 rounded-xl pr-1 ${
                      active ? "bg-violet-500/20 text-violet-100" : "text-zinc-300 hover:bg-white/[0.07]"
                    }`}
                    key={channel.id}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center justify-between px-2.5 py-2 text-left text-sm"
                      onClick={() => {
                        setActiveChannel(channel.id);
                        onNavigate?.();
                      }}
                      type="button"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{channel.name}</span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                        {channelTypeLabel(channel.type)}
                      </span>
                    </button>
                    {canManageCurrentChannel ? (
                      <Button
                        className="h-7 w-7 rounded-lg"
                        onClick={() => {
                          onOpen("channelSettings", {
                            serverId: channel.server_id,
                            channelId: channel.id,
                            section: "OVERVIEW",
                          });
                        }}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Channel settings</span>
                      </Button>
                    ) : null}
                  </div>
                );
              })
            : dmConversations.map((conversation) => {
                const active = conversation.thread.id === activeDmThreadId;
                const label =
                  conversation.otherProfile.full_name ??
                  conversation.otherProfile.username ??
                  "Orbit User";
                const online = onlineProfileIds.includes(conversation.otherProfile.id);
                return (
                  <button
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm transition ${
                      active
                        ? "bg-violet-500/20 text-violet-100"
                        : "text-zinc-300 hover:bg-white/[0.07]"
                    }`}
                    key={conversation.thread.id}
                    onClick={() => {
                      setActiveDmThread(conversation.thread.id);
                      onNavigate?.();
                    }}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{label}</span>
                      <span className="block truncate text-[11px] text-zinc-500">
                        {conversation.lastMessage?.content ?? "No messages yet"}
                      </span>
                    </span>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        online ? "bg-emerald-400" : "bg-zinc-600"
                      }`}
                    />
                  </button>
                );
              })}

          {isServerView && !activeServer ? (
            <div className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-zinc-500">
              Pick a server to load its channels.
            </div>
          ) : null}

          {isServerView && activeServer && channels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-zinc-500">
              No channels yet. Create one to start messaging.
            </div>
          ) : null}
          {isServerView && activeServer && channels.length > 0 && visibleChannels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-300/25 bg-amber-500/10 p-3 text-xs text-amber-100">
              You do not have permission to view channels in this server.
            </div>
          ) : null}

          {isHomeView && dmConversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-zinc-500">
              No direct messages yet. Open Friends to start one.
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs text-zinc-400">
          <FileText className="h-3.5 w-3.5 text-violet-300" />
          AI-ready note
        </div>
        <p className="text-xs leading-relaxed text-zinc-300">
          Channel metadata is structured for future summaries and agent workflows.
        </p>
      </div>
    </aside>
  );
}
