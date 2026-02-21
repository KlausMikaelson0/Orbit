"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import {
  FlaskConical,
  Hash,
  Home,
  ScrollText,
  Search,
  ShoppingBag,
  UserRound,
  Users,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { useOrbitChannelPermissions } from "@/src/hooks/use-orbit-channel-permissions";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type { OrbitProfile } from "@/src/types/orbit";

interface OrbitCommandPaletteProps {
  openOrCreateDmWithProfile: (
    profile: OrbitProfile,
  ) => Promise<{ error?: string }>;
}

export function OrbitCommandPalette({
  openOrCreateDmWithProfile,
}: OrbitCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const { canViewChannel } = useOrbitChannelPermissions();
  const {
    servers,
    channelsByServer,
    relationships,
    dmConversations,
    profile,
    setActiveServer,
    setActiveChannel,
    setActiveHome,
    setActiveFriends,
    setActiveShop,
    setActiveQuests,
    setActiveLabs,
    setActiveDmThread,
  } = useOrbitNavStore(
    useShallow((state) => ({
      servers: state.servers,
      channelsByServer: state.channelsByServer,
      relationships: state.relationships,
      dmConversations: state.dmConversations,
      profile: state.profile,
      setActiveServer: state.setActiveServer,
      setActiveChannel: state.setActiveChannel,
      setActiveHome: state.setActiveHome,
      setActiveFriends: state.setActiveFriends,
      setActiveShop: state.setActiveShop,
      setActiveQuests: state.setActiveQuests,
      setActiveLabs: state.setActiveLabs,
      setActiveDmThread: state.setActiveDmThread,
    })),
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const acceptedFriends = useMemo(() => {
    if (!profile) {
      return [] as OrbitProfile[];
    }
    return relationships
      .filter((relationship) => relationship.status === "ACCEPTED")
      .map((relationship) =>
        relationship.requester_id === profile.id
          ? relationship.addressee
          : relationship.requester,
      )
      .filter((item): item is OrbitProfile => Boolean(item));
  }, [profile, relationships]);
  const indexedChannels = useMemo(
    () =>
      servers.flatMap((server) =>
        (channelsByServer[server.id] ?? [])
          .filter((channel) => canViewChannel(channel))
          .map((channel) => ({
            server,
            channel,
          })),
      ),
    [canViewChannel, channelsByServer, servers],
  );

  return (
    <Command.Dialog
      className="fixed inset-0 z-[100] bg-black/65 p-4 backdrop-blur-sm"
      label="Orbit Spotlight"
      onOpenChange={setOpen}
      open={open}
    >
      <div
        className="mx-auto mt-20 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0c0d15] shadow-2xl transition-transform duration-150"
        onTouchEnd={() => {
          if (swipeOffset > 90) {
            setOpen(false);
          }
          setSwipeOffset(0);
          touchStartRef.current = null;
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (!touchStartRef.current || !touch) {
            return;
          }
          const dy = touch.clientY - touchStartRef.current.y;
          const dx = touch.clientX - touchStartRef.current.x;
          if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
            setSwipeOffset(dy);
          }
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (!touch) {
            return;
          }
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        style={{ transform: `translateY(${Math.max(0, swipeOffset)}px)` }}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3">
          <Search className="h-4 w-4 text-zinc-400" />
          <Command.Input
            className="h-11 w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            placeholder="Search servers, channels, friends..."
          />
        </div>
        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-zinc-400">
            No results found.
          </Command.Empty>

          <Command.Group
            className="mb-2 rounded-xl border border-white/10 bg-white/[0.02] p-1"
            heading="Quick Actions"
          >
            <Command.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 aria-selected:bg-violet-500/20"
              onSelect={() => {
                setActiveHome();
                setOpen(false);
              }}
            >
              <Home className="h-4 w-4 text-violet-300" />
              Go to Home
            </Command.Item>
            <Command.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 aria-selected:bg-violet-500/20"
              onSelect={() => {
                setActiveFriends();
                setOpen(false);
              }}
            >
              <Users className="h-4 w-4 text-violet-300" />
              Open Friends
            </Command.Item>
            <Command.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 aria-selected:bg-violet-500/20"
              onSelect={() => {
                setActiveShop();
                setOpen(false);
              }}
            >
              <ShoppingBag className="h-4 w-4 text-violet-300" />
              Open Shop
            </Command.Item>
            <Command.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 aria-selected:bg-violet-500/20"
              onSelect={() => {
                setActiveQuests();
                setOpen(false);
              }}
            >
              <ScrollText className="h-4 w-4 text-violet-300" />
              Open Quests
            </Command.Item>
            <Command.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 aria-selected:bg-violet-500/20"
              onSelect={() => {
                setActiveLabs();
                setOpen(false);
              }}
            >
              <FlaskConical className="h-4 w-4 text-violet-300" />
              Open Labs
            </Command.Item>
          </Command.Group>

          <Command.Group
            className="mb-2 rounded-xl border border-white/10 bg-white/[0.02] p-1"
            heading="Servers"
          >
            {servers.map((server) => (
              <Command.Item
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 aria-selected:bg-violet-500/20"
                key={server.id}
                onSelect={() => {
                  setActiveServer(server.id);
                  setOpen(false);
                }}
                value={`server ${server.name}`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-violet-300" />
                {server.name}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group
            className="mb-2 rounded-xl border border-white/10 bg-white/[0.02] p-1"
            heading="Channels"
          >
            {indexedChannels.map(({ server, channel }) => (
              <Command.Item
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 aria-selected:bg-violet-500/20"
                key={channel.id}
                onSelect={() => {
                  setActiveServer(server.id);
                  setActiveChannel(channel.id);
                  setOpen(false);
                }}
                value={`channel ${channel.name} ${server.name}`}
              >
                <Hash className="h-4 w-4 text-violet-300" />
                <span>
                  {server.name} / {channel.name}
                </span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group
            className="mb-2 rounded-xl border border-white/10 bg-white/[0.02] p-1"
            heading="Direct Messages"
          >
            {dmConversations.map((conversation) => {
              const label =
                conversation.otherProfile.full_name ??
                conversation.otherProfile.username ??
                "Orbit User";
              return (
                <Command.Item
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 aria-selected:bg-violet-500/20"
                  key={conversation.thread.id}
                  onSelect={() => {
                    setActiveDmThread(conversation.thread.id);
                    setOpen(false);
                  }}
                  value={`dm ${label}`}
                >
                  <UserRound className="h-4 w-4 text-violet-300" />
                  {label}
                </Command.Item>
              );
            })}
          </Command.Group>

          <Command.Group
            className="rounded-xl border border-white/10 bg-white/[0.02] p-1"
            heading="Friends"
          >
            {acceptedFriends.map((friend) => {
              const label = friend.full_name ?? friend.username ?? "Orbit User";
              return (
                <Command.Item
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 aria-selected:bg-violet-500/20"
                  key={friend.id}
                  onSelect={() => {
                    void openOrCreateDmWithProfile(friend);
                    setOpen(false);
                  }}
                  value={`friend ${label}`}
                >
                  <UserRound className="h-4 w-4 text-violet-300" />
                  {label}
                </Command.Item>
              );
            })}
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
