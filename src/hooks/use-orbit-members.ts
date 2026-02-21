"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { getOrbitLocalMembers } from "@/src/lib/orbit-local-data";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type {
  OrbitMember,
  OrbitMemberWithProfile,
  OrbitProfile,
  OrbitServerBot,
  OrbitServer,
} from "@/src/types/orbit";

interface MemberProfileRow extends OrbitMember {
  profile: OrbitProfile | OrbitProfile[] | null;
}

interface MemberActionResult {
  error?: string;
}

export function useOrbitMembers(user: User | null, serverId: string | null) {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const servers = useOrbitNavStore((state) => state.servers);
  const membershipsByServer = useOrbitNavStore((state) => state.membershipsByServer);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<OrbitMemberWithProfile[]>([]);
  const [onlineProfileIds, setOnlineProfileIds] = useState<Set<string>>(new Set());
  const [bot, setBot] = useState<OrbitServerBot | null>(null);

  const activeServer = useMemo<OrbitServer | null>(
    () => servers.find((server) => server.id === serverId) ?? null,
    [serverId, servers],
  );
  const currentMember = serverId ? membershipsByServer[serverId] ?? null : null;
  const isAdmin = Boolean(
    user &&
      activeServer &&
      (activeServer.owner_id === user.id || currentMember?.role === "ADMIN"),
  );

  const fetchMembers = useCallback(async () => {
    if (!serverId) {
      setMembers([]);
      setBot(null);
      return;
    }

    if (!isSupabaseReady()) {
      setLoading(true);
      setMembers(getOrbitLocalMembers(serverId));
      setBot({
        id: "local-bot",
        server_id: serverId,
        name: "Orbit Bot",
        provider: "local",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    const [membersResult, botResult] = await Promise.all([
      supabase
        .from("members")
        .select(
          "id, role, profile_id, server_id, created_at, updated_at, profile:profiles(id, username, tag, full_name, avatar_url, created_at, updated_at)",
        )
        .eq("server_id", serverId)
        .order("created_at", { ascending: true }),
      supabase.from("orbit_bots").select("*").eq("server_id", serverId).maybeSingle(),
    ]);

    const rows = (membersResult.data ?? []) as unknown as MemberProfileRow[];
    const normalized = rows.map((row) => {
      const profile = Array.isArray(row.profile) ? row.profile[0] ?? null : row.profile;
      return {
        member: {
          id: row.id,
          role: row.role,
          profile_id: row.profile_id,
          server_id: row.server_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
        profile,
        online: false,
      } satisfies OrbitMemberWithProfile;
    });

    setMembers(normalized);
    setBot((botResult.data ?? null) as OrbitServerBot | null);
    setLoading(false);
  }, [serverId, supabase]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (!isSupabaseReady()) {
      return;
    }
    if (!serverId) {
      return;
    }

    const realtimeChannel = supabase
      .channel(`orbit-members-${serverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "members",
          filter: `server_id=eq.${serverId}`,
        },
        () => void fetchMembers(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void fetchMembers(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orbit_bots",
          filter: `server_id=eq.${serverId}`,
        },
        () => void fetchMembers(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(realtimeChannel);
    };
  }, [fetchMembers, serverId, supabase]);

  useEffect(() => {
    if (!isSupabaseReady()) {
      return;
    }
    if (!serverId || !user) {
      setOnlineProfileIds(new Set());
      return;
    }

    const presenceChannel = supabase.channel(`orbit-presence-${serverId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    const syncPresence = () => {
      const presenceState = presenceChannel.presenceState();
      const online = new Set<string>();

      for (const key of Object.keys(presenceState)) {
        const entries = presenceState[key] as Array<{ profile_id?: string }>;
        for (const entry of entries) {
          if (entry.profile_id) {
            online.add(entry.profile_id);
          }
        }
      }

      setOnlineProfileIds(online);
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
  }, [serverId, supabase, user]);

  const membersWithStatus = useMemo(
    () =>
      members
        .map((row) => ({
          ...row,
          online: onlineProfileIds.has(row.member.profile_id),
        }))
        .sort((a, b) => {
          if (a.online === b.online) {
            return a.member.role.localeCompare(b.member.role);
          }
          return a.online ? -1 : 1;
        }),
    [members, onlineProfileIds],
  );

  const kickMember = useCallback(
    async (targetMemberId: string): Promise<MemberActionResult> => {
      if (!serverId) {
        return { error: "No active server selected." };
      }

      const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", targetMemberId)
        .eq("server_id", serverId);

      if (error) {
        return { error: error.message };
      }

      await fetchMembers();
      return {};
    },
    [fetchMembers, serverId, supabase],
  );

  const banMember = useCallback(
    async (
      targetMemberId: string,
      targetProfileId: string,
    ): Promise<MemberActionResult> => {
      if (!serverId || !user) {
        return { error: "No active server selected." };
      }

      const { error: banError } = await supabase.from("server_bans").upsert(
        {
          server_id: serverId,
          profile_id: targetProfileId,
          banned_by: user.id,
        },
        { onConflict: "server_id,profile_id" },
      );

      if (banError) {
        return { error: banError.message };
      }

      const { error: kickError } = await supabase
        .from("members")
        .delete()
        .eq("id", targetMemberId)
        .eq("server_id", serverId);

      if (kickError) {
        return { error: kickError.message };
      }

      await fetchMembers();
      return {};
    },
    [fetchMembers, serverId, supabase, user],
  );

  return {
    loading,
    members: membersWithStatus,
    bot,
    isAdmin,
    currentMember,
    kickMember,
    banMember,
  };
}
