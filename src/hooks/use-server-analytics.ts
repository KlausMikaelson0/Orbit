"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";

export interface OrbitServerAnalytics {
  membersTotal: number;
  channelsTotal: number;
  activeMembers24h: number;
  currentlyOnline: number;
  messages24h: number;
  messages7d: number;
  source: "edge-function" | "client-fallback";
}

interface MessageAnalyticsRow {
  id: string;
  created_at: string;
  member:
    | {
        profile_id: string;
      }
    | Array<{ profile_id: string }>
    | null;
}

function normalizeProfileId(row: MessageAnalyticsRow) {
  if (!row.member) {
    return null;
  }
  if (Array.isArray(row.member)) {
    return row.member[0]?.profile_id ?? null;
  }
  return row.member.profile_id;
}

export function useServerAnalytics(serverId: string | null, enabled: boolean) {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const onlineProfileIds = useOrbitNavStore((state) => state.onlineProfileIds);
  const channelsByServer = useOrbitNavStore((state) => state.channelsByServer);
  const membershipsByServer = useOrbitNavStore((state) => state.membershipsByServer);
  const messageCache = useOrbitNavStore((state) => state.messageCache);
  const [analytics, setAnalytics] = useState<OrbitServerAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!enabled || !serverId) {
      setAnalytics(null);
      return;
    }

    setLoadingAnalytics(true);
    setAnalyticsError(null);

    if (!isSupabaseReady()) {
      const channels = channelsByServer[serverId] ?? [];
      const channelMessages = channels.flatMap(
        (channel) => messageCache[`channel:${channel.id}`] ?? [],
      );
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const rows7d = channelMessages.filter((message) => message.created_at >= since7d);
      const rows24h = rows7d.filter((message) => message.created_at >= since24h);

      const memberProfileIds = new Set<string>();
      const currentMembership = membershipsByServer[serverId];
      if (currentMembership?.profile_id) {
        memberProfileIds.add(currentMembership.profile_id);
      }
      for (const message of channelMessages) {
        const profileId = message.author.profile?.id ?? message.profile_id ?? null;
        if (profileId) {
          memberProfileIds.add(profileId);
        }
      }

      const activeMembers24h = new Set(
        rows24h
          .map((message) => message.author.profile?.id ?? message.profile_id ?? null)
          .filter((id): id is string => Boolean(id)),
      ).size;
      const currentlyOnline = [...memberProfileIds].filter((id) =>
        onlineProfileIds.includes(id),
      ).length;

      setAnalytics({
        membersTotal: memberProfileIds.size,
        channelsTotal: channels.length,
        activeMembers24h,
        currentlyOnline,
        messages24h: rows24h.length,
        messages7d: rows7d.length,
        source: "client-fallback",
      });
      setLoadingAnalytics(false);
      return;
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token ?? null;

    if (
      accessToken &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/orbit-analytics`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ serverId }),
          },
        );

        if (response.ok) {
          const payload = (await response.json()) as {
            membersTotal?: number;
            channelsTotal?: number;
            activeMembers24h?: number;
            currentlyOnline?: number;
            messages24h?: number;
            messages7d?: number;
          };

          setAnalytics({
            membersTotal: payload.membersTotal ?? 0,
            channelsTotal: payload.channelsTotal ?? 0,
            activeMembers24h: payload.activeMembers24h ?? 0,
            currentlyOnline: payload.currentlyOnline ?? 0,
            messages24h: payload.messages24h ?? 0,
            messages7d: payload.messages7d ?? 0,
            source: "edge-function",
          });
          setLoadingAnalytics(false);
          return;
        }
      } catch {
        // Fallback to client-side metrics if Edge Function is unavailable.
      }
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [channelsResult, membersCountResult, memberProfilesResult] = await Promise.all([
      supabase.from("channels").select("id").eq("server_id", serverId),
      supabase
        .from("members")
        .select("id", { head: true, count: "exact" })
        .eq("server_id", serverId),
      supabase.from("members").select("profile_id").eq("server_id", serverId),
    ]);

    if (channelsResult.error || membersCountResult.error || memberProfilesResult.error) {
      setAnalyticsError(
        channelsResult.error?.message ??
          membersCountResult.error?.message ??
          memberProfilesResult.error?.message ??
          "Unable to load analytics.",
      );
      setLoadingAnalytics(false);
      return;
    }

    const channelIds = (channelsResult.data ?? []).map((item) => item.id);
    const memberProfiles = (memberProfilesResult.data ?? []).map((item) => item.profile_id);
    const currentlyOnline = memberProfiles.filter((profileId) =>
      onlineProfileIds.includes(profileId),
    ).length;

    let messageRows: MessageAnalyticsRow[] = [];
    if (channelIds.length > 0) {
      const { data, error } = await supabase
        .from("messages")
        .select("id, created_at, member:members(profile_id)")
        .in("channel_id", channelIds)
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) {
        setAnalyticsError(error.message);
        setLoadingAnalytics(false);
        return;
      }
      messageRows = (data ?? []) as unknown as MessageAnalyticsRow[];
    }

    const rows24h = messageRows.filter((row) => row.created_at >= since24h);
    const activeMembers24h = new Set(
      rows24h
        .map((row) => normalizeProfileId(row))
        .filter((id): id is string => Boolean(id)),
    ).size;

    setAnalytics({
      membersTotal: membersCountResult.count ?? 0,
      channelsTotal: channelIds.length,
      activeMembers24h,
      currentlyOnline,
      messages24h: rows24h.length,
      messages7d: messageRows.length,
      source: "client-fallback",
    });
    setLoadingAnalytics(false);
  }, [
    channelsByServer,
    enabled,
    membershipsByServer,
    messageCache,
    onlineProfileIds,
    serverId,
    supabase,
  ]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    loadingAnalytics,
    analyticsError,
    refreshAnalytics: fetchAnalytics,
  };
}
