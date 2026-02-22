"use client";

import { useEffect, useMemo, useState } from "react";
import { Inbox, MessageCircle, ShieldX, Users } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrbitSocialContext } from "@/src/context/orbit-social-context";
import { useOrbitNavStore, type OrbitDmHomeTab } from "@/src/stores/use-orbit-nav-store";
import type { OrbitDmConversation } from "@/src/types/orbit";

interface DmHomeViewProps {
  onOpenFriends: () => void;
  sendFriendRequest: (identifier: string) => Promise<{ error?: string }>;
  acceptFriendRequest: (relationshipId: string) => Promise<{ error?: string }>;
  declineFriendRequest: (relationshipId: string) => Promise<{ error?: string }>;
}

const REQUESTS_HIDDEN_STORAGE_KEY = "orbit_dm_requests_hidden";
const REQUESTS_APPROVED_STORAGE_KEY = "orbit_dm_requests_approved";

function readIdSet(key: string) {
  if (typeof window === "undefined") {
    return new Set<string>();
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return new Set<string>();
    }
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }
    return new Set(parsed.filter((value) => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function writeIdSet(key: string, values: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(values)));
  } catch {
    // Ignore storage persistence issues.
  }
}

function matchesConversationQuery(conversation: OrbitDmConversation, query: string) {
  if (!query) {
    return true;
  }
  const profile = conversation.otherProfile;
  const displayName = profile.full_name ?? "";
  const username = profile.username ?? "";
  const tag = profile.tag ?? "";
  return (
    displayName.toLowerCase().includes(query) ||
    username.toLowerCase().includes(query) ||
    `${username}#${tag}`.toLowerCase().includes(query)
  );
}

export function DmHomeView({
  onOpenFriends,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
}: DmHomeViewProps) {
  const { loadingSocial } = useOrbitSocialContext();
  const {
    dmConversations,
    onlineProfileIds,
    relationships,
    profile,
    dmHomeTab,
    setDmHomeTab,
    setActiveDmThread,
  } = useOrbitNavStore(
    useShallow((state) => ({
      dmConversations: state.dmConversations,
      onlineProfileIds: state.onlineProfileIds,
      relationships: state.relationships,
      profile: state.profile,
      dmHomeTab: state.dmHomeTab,
      setDmHomeTab: state.setDmHomeTab,
      setActiveDmThread: state.setActiveDmThread,
    })),
  );
  const [query, setQuery] = useState("");
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hiddenRequestIds, setHiddenRequestIds] = useState<Set<string>>(new Set());
  const [approvedRequestIds, setApprovedRequestIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHiddenRequestIds(readIdSet(REQUESTS_HIDDEN_STORAGE_KEY));
    setApprovedRequestIds(readIdSet(REQUESTS_APPROVED_STORAGE_KEY));
  }, []);

  const acceptedFriendIds = useMemo(() => {
    if (!profile) {
      return new Set<string>();
    }
    const ids = new Set<string>();
    for (const relationship of relationships) {
      if (relationship.status !== "ACCEPTED") {
        continue;
      }
      if (relationship.requester_id === profile.id) {
        ids.add(relationship.addressee_id);
      } else if (relationship.addressee_id === profile.id) {
        ids.add(relationship.requester_id);
      }
    }
    return ids;
  }, [profile, relationships]);

  const blockedIds = useMemo(() => {
    if (!profile) {
      return new Set<string>();
    }
    const ids = new Set<string>();
    for (const relationship of relationships) {
      if (relationship.status !== "BLOCKED") {
        continue;
      }
      if (relationship.requester_id === profile.id) {
        ids.add(relationship.addressee_id);
      } else if (relationship.addressee_id === profile.id) {
        ids.add(relationship.requester_id);
      }
    }
    return ids;
  }, [profile, relationships]);

  const pendingIncomingByProfileId = useMemo(() => {
    const map = new Map<string, string>();
    if (!profile) {
      return map;
    }
    for (const relationship of relationships) {
      if (
        relationship.status === "PENDING" &&
        relationship.addressee_id === profile.id
      ) {
        map.set(relationship.requester_id, relationship.id);
      }
    }
    return map;
  }, [profile, relationships]);

  const pendingOutgoingProfileIds = useMemo(() => {
    const ids = new Set<string>();
    if (!profile) {
      return ids;
    }
    for (const relationship of relationships) {
      if (
        relationship.status === "PENDING" &&
        relationship.requester_id === profile.id
      ) {
        ids.add(relationship.addressee_id);
      }
    }
    return ids;
  }, [profile, relationships]);

  const messageConversations = useMemo(
    () =>
      dmConversations.filter((conversation) => {
        const otherId = conversation.otherProfile.id;
        return (
          acceptedFriendIds.has(otherId) || approvedRequestIds.has(otherId)
        );
      }),
    [acceptedFriendIds, approvedRequestIds, dmConversations],
  );

  const requestConversations = useMemo(
    () =>
      dmConversations.filter((conversation) => {
        const otherId = conversation.otherProfile.id;
        if (acceptedFriendIds.has(otherId) || approvedRequestIds.has(otherId)) {
          return false;
        }
        if (blockedIds.has(otherId) || hiddenRequestIds.has(otherId)) {
          return false;
        }
        return true;
      }),
    [acceptedFriendIds, approvedRequestIds, blockedIds, hiddenRequestIds, dmConversations],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const visibleConversations = useMemo(() => {
    const source = dmHomeTab === "REQUESTS" ? requestConversations : messageConversations;
    return source.filter((conversation) =>
      matchesConversationQuery(conversation, normalizedQuery),
    );
  }, [dmHomeTab, messageConversations, normalizedQuery, requestConversations]);

  async function handleAcceptRequest(conversation: OrbitDmConversation) {
    const otherId = conversation.otherProfile.id;
    setActionError(null);
    setBusyProfileId(otherId);

    const incomingRelationshipId = pendingIncomingByProfileId.get(otherId) ?? null;
    if (incomingRelationshipId) {
      const result = await acceptFriendRequest(incomingRelationshipId);
      if (result.error) {
        setActionError(result.error);
        setBusyProfileId(null);
        return;
      }
    } else if (
      !pendingOutgoingProfileIds.has(otherId) &&
      conversation.otherProfile.username &&
      conversation.otherProfile.tag
    ) {
      // If there is no incoming relationship, send friend request to establish mutual DM trust.
      const result = await sendFriendRequest(
        `${conversation.otherProfile.username}#${conversation.otherProfile.tag}`,
      );
      if (result.error) {
        setActionError(result.error);
        setBusyProfileId(null);
        return;
      }
    }

    const nextApproved = new Set(approvedRequestIds);
    nextApproved.add(otherId);
    setApprovedRequestIds(nextApproved);
    writeIdSet(REQUESTS_APPROVED_STORAGE_KEY, nextApproved);
    setDmHomeTab("MESSAGES");
    setBusyProfileId(null);
  }

  async function handleIgnoreRequest(conversation: OrbitDmConversation) {
    const otherId = conversation.otherProfile.id;
    setActionError(null);
    setBusyProfileId(otherId);

    const incomingRelationshipId = pendingIncomingByProfileId.get(otherId) ?? null;
    if (incomingRelationshipId) {
      const result = await declineFriendRequest(incomingRelationshipId);
      if (result.error) {
        setActionError(result.error);
        setBusyProfileId(null);
        return;
      }
    }

    const nextHidden = new Set(hiddenRequestIds);
    nextHidden.add(otherId);
    setHiddenRequestIds(nextHidden);
    writeIdSet(REQUESTS_HIDDEN_STORAGE_KEY, nextHidden);
    setBusyProfileId(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Home</p>
        <h2 className="text-lg font-semibold text-violet-100">Direct Messages</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {([
            { key: "MESSAGES", label: "Messages" },
            { key: "REQUESTS", label: `Message Requests (${requestConversations.length})` },
          ] as Array<{ key: OrbitDmHomeTab; label: string }>).map((item) => (
            <Button
              className="rounded-full"
              key={item.key}
              onClick={() => setDmHomeTab(item.key)}
              size="sm"
              type="button"
              variant={dmHomeTab === item.key ? "default" : "secondary"}
            >
              {item.key === "REQUESTS" ? <Inbox className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mb-3 rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button className="rounded-full" onClick={onOpenFriends} variant="secondary">
            <Users className="h-4 w-4" />
            Friends
          </Button>
          <Input
            className="h-9 max-w-[260px] rounded-full border-white/10 bg-black/35"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dmHomeTab === "REQUESTS" ? "Search requests" : "Search messages"}
            value={query}
          />
        </div>
      </div>

      {actionError ? (
        <p className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {actionError}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="space-y-2">
          {loadingSocial ? (
            <>
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </>
          ) : null}

          {visibleConversations.map((conversation) => {
            const otherProfile = conversation.otherProfile;
            const displayName = otherProfile.full_name ?? otherProfile.username ?? "Orbit User";
            const online = onlineProfileIds.includes(otherProfile.id);
            const isBusy = busyProfileId === otherProfile.id;
            return (
              <div
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 transition hover:bg-white/[0.06]"
                key={conversation.thread.id}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setActiveDmThread(conversation.thread.id)}
                  type="button"
                >
                  <p className="truncate text-sm font-medium text-zinc-100">{displayName}</p>
                  <p className="truncate text-xs text-zinc-400">
                    {conversation.lastMessage?.content ?? "No messages yet"}
                  </p>
                </button>
                <div className="ml-2 flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      online ? "bg-emerald-400" : "bg-zinc-600"
                    }`}
                  />
                  {dmHomeTab === "REQUESTS" ? (
                    <>
                      <Button
                        className="rounded-full"
                        disabled={isBusy}
                        onClick={() => void handleAcceptRequest(conversation)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Accept
                      </Button>
                      <Button
                        className="rounded-full"
                        disabled={isBusy}
                        onClick={() => void handleIgnoreRequest(conversation)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <ShieldX className="h-4 w-4" />
                        Ignore
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}

          {!loadingSocial && !visibleConversations.length ? (
            <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-zinc-400">
              <MessageCircle className="mx-auto mb-2 h-5 w-5 text-violet-300" />
              <p className="text-sm">
                {dmHomeTab === "REQUESTS"
                  ? "No pending message requests."
                  : "No conversations yet. Add friends to start DMs."}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
