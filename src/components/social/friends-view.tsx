"use client";

import { FormEvent, memo, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MessageSquare, Search, UserPlus, Users } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrbitSocialContext } from "@/src/context/orbit-social-context";
import { useOrbitNavStore, type OrbitFriendsTab } from "@/src/stores/use-orbit-nav-store";
import type { OrbitFriendView, OrbitProfile } from "@/src/types/orbit";

interface FriendsViewProps {
  sendFriendRequest: (identifier: string) => Promise<{ error?: string }>;
  acceptFriendRequest: (relationshipId: string) => Promise<{ error?: string }>;
  declineFriendRequest: (relationshipId: string) => Promise<{ error?: string }>;
  openOrCreateDmWithProfile: (
    profile: OrbitProfile,
  ) => Promise<{ error?: string }>;
}

function friendMatchesQuery(friend: OrbitFriendView, query: string) {
  if (!query) {
    return true;
  }
  const name = friend.profile.full_name ?? "";
  const username = friend.profile.username ?? "";
  const tag = friend.profile.tag ?? "";
  return (
    name.toLowerCase().includes(query) ||
    username.toLowerCase().includes(query) ||
    `${username}#${tag}`.toLowerCase().includes(query)
  );
}

export function FriendsView({
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  openOrCreateDmWithProfile,
}: FriendsViewProps) {
  const { loadingSocial } = useOrbitSocialContext();
  const tab = useOrbitNavStore((state) => state.friendsTab);
  const setFriendsTab = useOrbitNavStore((state) => state.setFriendsTab);
  const [requestInput, setRequestInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { relationships, onlineProfileIds, profile, dmConversations, activeCallSession } = useOrbitNavStore(
    useShallow((state) => ({
      relationships: state.relationships,
      onlineProfileIds: state.onlineProfileIds,
      profile: state.profile,
      dmConversations: state.dmConversations,
      activeCallSession: state.activeCallSession,
    })),
  );

  const acceptedFriends = useMemo(() => {
    if (!profile) {
      return [] as OrbitFriendView[];
    }

    return relationships
      .filter((row) => row.status === "ACCEPTED")
      .map((relationship) => {
        const isRequester = relationship.requester_id === profile.id;
        const friend = isRequester ? relationship.addressee : relationship.requester;
        if (!friend) {
          return null;
        }
        return {
          relationship,
          profile: friend,
          online: onlineProfileIds.includes(friend.id),
        } satisfies OrbitFriendView;
      })
      .filter((row): row is OrbitFriendView => Boolean(row))
      .sort((a, b) => Number(b.online) - Number(a.online));
  }, [onlineProfileIds, profile, relationships]);

  const pendingIncoming = useMemo(() => {
    if (!profile) {
      return [] as OrbitFriendView[];
    }

    return relationships
      .filter(
        (row) => row.status === "PENDING" && row.addressee_id === profile.id,
      )
      .map((relationship) => {
        if (!relationship.requester) {
          return null;
        }
        return {
          relationship,
          profile: relationship.requester,
          online: onlineProfileIds.includes(relationship.requester.id),
        } satisfies OrbitFriendView;
      })
      .filter((row): row is OrbitFriendView => Boolean(row));
  }, [onlineProfileIds, profile, relationships]);

  const pendingOutgoing = useMemo(() => {
    if (!profile) {
      return [] as OrbitFriendView[];
    }

    return relationships
      .filter(
        (row) => row.status === "PENDING" && row.requester_id === profile.id,
      )
      .map((relationship) => {
        if (!relationship.addressee) {
          return null;
        }
        return {
          relationship,
          profile: relationship.addressee,
          online: onlineProfileIds.includes(relationship.addressee.id),
        } satisfies OrbitFriendView;
      })
      .filter((row): row is OrbitFriendView => Boolean(row));
  }, [onlineProfileIds, profile, relationships]);

  const blockedFriends = useMemo(() => {
    if (!profile) {
      return [] as OrbitFriendView[];
    }

    return relationships
      .filter((row) => row.status === "BLOCKED")
      .map((relationship) => {
        const isRequester = relationship.requester_id === profile.id;
        const friend = isRequester ? relationship.addressee : relationship.requester;
        if (!friend) {
          return null;
        }
        return {
          relationship,
          profile: friend,
          online: onlineProfileIds.includes(friend.id),
        } satisfies OrbitFriendView;
      })
      .filter((row): row is OrbitFriendView => Boolean(row));
  }, [onlineProfileIds, profile, relationships]);

  const query = searchQuery.trim().toLowerCase();
  const filteredAcceptedFriends = useMemo(
    () => acceptedFriends.filter((friend) => friendMatchesQuery(friend, query)),
    [acceptedFriends, query],
  );
  const onlineFriends = useMemo(
    () => filteredAcceptedFriends.filter((friend) => friend.online),
    [filteredAcceptedFriends],
  );
  const filteredPendingIncoming = useMemo(
    () => pendingIncoming.filter((friend) => friendMatchesQuery(friend, query)),
    [pendingIncoming, query],
  );
  const filteredPendingOutgoing = useMemo(
    () => pendingOutgoing.filter((friend) => friendMatchesQuery(friend, query)),
    [pendingOutgoing, query],
  );
  const filteredBlockedFriends = useMemo(
    () => blockedFriends.filter((friend) => friendMatchesQuery(friend, query)),
    [blockedFriends, query],
  );
  const activeNowFriends = useMemo(
    () => acceptedFriends.filter((friend) => friend.online).slice(0, 7),
    [acceptedFriends],
  );

  const lastMessageByProfileId = useMemo(() => {
    const map = new Map<string, string>();
    for (const conversation of dmConversations) {
      const id = conversation.otherProfile.id;
      if (!map.has(id)) {
        map.set(id, conversation.lastMessage?.content ?? "Online");
      }
    }
    return map;
  }, [dmConversations]);

  async function onSendFriendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const result = await sendFriendRequest(requestInput);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess("Friend request sent.");
    setRequestInput("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
        <div className="flex items-center gap-2 text-violet-100">
          <Users className="h-4 w-4" />
          <p className="text-sm font-semibold">Friends</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {(["ALL", "ONLINE", "PENDING", "BLOCKED", "ADD"] as OrbitFriendsTab[]).map((item) => (
            <Button
              className="rounded-full"
              key={item}
              onClick={() => setFriendsTab(item)}
              size="sm"
              type="button"
              variant={tab === item ? "default" : "secondary"}
            >
              {item === "ADD" ? "Add Friend" : item}
            </Button>
          ))}
        </div>
        {tab !== "ADD" ? (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              className="h-10 rounded-xl border-white/10 bg-black/35 pl-9"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search friends"
              value={searchQuery}
            />
          </div>
        ) : null}
      </div>

      {tab === "ADD" ? (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <form className="space-y-3" onSubmit={onSendFriendRequest}>
            <label className="block text-xs uppercase tracking-[0.14em] text-zinc-400">
              Add Friend by username#tag
            </label>
            <div className="flex items-center gap-2">
              <Input
                className="h-11 rounded-xl border-white/10 bg-black/35"
                onChange={(event) => setRequestInput(event.target.value)}
                placeholder="orbituser#1234"
                value={requestInput}
              />
              <Button className="h-11 rounded-xl px-4" type="submit">
                <UserPlus className="h-4 w-4" />
                Send
              </Button>
            </div>
          </form>
          {error ? (
            <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {success}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab !== "ADD" ? (
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-h-0 flex-1">
            {tab === "ALL" ? (
              <FriendList
                actionLabel="Message"
                emptyText="No friends yet. Add people to start direct conversations."
                friends={filteredAcceptedFriends}
                loading={loadingSocial}
                onAction={async (friend) => {
                  await openOrCreateDmWithProfile(friend.profile);
                }}
                renderActionIcon={<MessageSquare className="h-4 w-4" />}
              />
            ) : null}

            {tab === "ONLINE" ? (
              <FriendList
                actionLabel="Message"
                emptyText="No friends online right now."
                friends={onlineFriends}
                loading={loadingSocial}
                onAction={async (friend) => {
                  await openOrCreateDmWithProfile(friend.profile);
                }}
                renderActionIcon={<MessageSquare className="h-4 w-4" />}
              />
            ) : null}

            {tab === "PENDING" ? (
              <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2">
                <FriendList
                  actionLabel="Accept"
                  emptyText="No incoming requests."
                  friends={filteredPendingIncoming}
                  loading={loadingSocial}
                  onAction={async (friend) => {
                    setBusyId(friend.relationship.id);
                    const result = await acceptFriendRequest(friend.relationship.id);
                    if (result.error) {
                      setError(result.error);
                    }
                    setBusyId(null);
                  }}
                  renderActionIcon={null}
                  secondaryActionLabel="Decline"
                  onSecondaryAction={async (friend) => {
                    setBusyId(friend.relationship.id);
                    const result = await declineFriendRequest(friend.relationship.id);
                    if (result.error) {
                      setError(result.error);
                    }
                    setBusyId(null);
                  }}
                  busyId={busyId}
                />
                <FriendList
                  actionLabel="Cancel"
                  emptyText="No outgoing requests."
                  friends={filteredPendingOutgoing}
                  loading={loadingSocial}
                  onAction={async (friend) => {
                    setBusyId(friend.relationship.id);
                    const result = await declineFriendRequest(friend.relationship.id);
                    if (result.error) {
                      setError(result.error);
                    }
                    setBusyId(null);
                  }}
                  renderActionIcon={null}
                  busyId={busyId}
                />
              </div>
            ) : null}

            {tab === "BLOCKED" ? (
              <FriendList
                actionLabel="Remove"
                emptyText="No blocked users."
                friends={filteredBlockedFriends}
                loading={loadingSocial}
                onAction={async (friend) => {
                  setBusyId(friend.relationship.id);
                  const result = await declineFriendRequest(friend.relationship.id);
                  if (result.error) {
                    setError(result.error);
                  }
                  setBusyId(null);
                }}
                renderActionIcon={null}
                busyId={busyId}
              />
            ) : null}
          </div>

          <aside className="hidden rounded-2xl border border-white/10 bg-black/25 p-3 xl:block">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Active Now</p>
            <div className="mt-2 space-y-2">
              {activeNowFriends.map((friend) => {
                const label = friend.profile.full_name ?? friend.profile.username ?? "Orbit User";
                const isInCall = activeCallSession?.peer_profile_id === friend.profile.id;
                const activity = isInCall
                  ? "In a voice call"
                  : lastMessageByProfileId.get(friend.profile.id) ?? "Online";
                return (
                  <article
                    className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2"
                    key={`active-now-${friend.relationship.id}`}
                  >
                    <p className="truncate text-sm text-zinc-100">{label}</p>
                    <p className="truncate text-[11px] text-zinc-400">{activity}</p>
                  </article>
                );
              })}
              {!activeNowFriends.length ? (
                <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-xs text-zinc-500">
                  No friends active right now.
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

interface FriendListProps {
  friends: OrbitFriendView[];
  loading?: boolean;
  emptyText: string;
  actionLabel: string;
  onAction: (friend: OrbitFriendView) => Promise<void>;
  renderActionIcon: ReactNode;
  secondaryActionLabel?: string;
  onSecondaryAction?: (friend: OrbitFriendView) => Promise<void>;
  busyId?: string | null;
}

const FriendList = memo(function FriendList({
  friends,
  loading = false,
  emptyText,
  actionLabel,
  onAction,
  renderActionIcon,
  secondaryActionLabel,
  onSecondaryAction,
  busyId = null,
}: FriendListProps) {
  return (
    <div className="min-h-0 flex-1 rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </>
        ) : null}

        {friends.map((friend) => {
          const label =
            friend.profile.full_name ?? friend.profile.username ?? "Orbit User";
          const tag = friend.profile.tag ?? "0000";

          return (
            <div
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2"
              key={friend.relationship.id}
            >
              <div className="min-w-0 flex items-center gap-2">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage alt={label} src={friend.profile.avatar_url ?? undefined} />
                  <AvatarFallback className="rounded-lg bg-violet-500/25 text-[11px] text-violet-100">
                    {label.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-100">{label}</p>
                  <p className="truncate text-[11px] text-zinc-400">
                    {(friend.profile.username ?? "orbit")}#{tag}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    friend.online ? "bg-emerald-400" : "bg-zinc-600"
                  }`}
                />
                <Button
                  className="rounded-full"
                  disabled={busyId === friend.relationship.id}
                  onClick={() => void onAction(friend)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {renderActionIcon}
                  {actionLabel}
                </Button>
                {secondaryActionLabel && onSecondaryAction ? (
                  <Button
                    className="rounded-full"
                    disabled={busyId === friend.relationship.id}
                    onClick={() => void onSecondaryAction(friend)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {secondaryActionLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
        {!loading && !friends.length ? (
          <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-zinc-400">
            {emptyText}
          </div>
        ) : null}
      </div>
    </div>
  );
});

FriendList.displayName = "FriendList";
