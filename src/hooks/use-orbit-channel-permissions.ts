"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  ORBIT_LOCAL_PERMISSIONS_UPDATED_EVENT,
  ORBIT_MEMBER_ROLES,
  getOrbitDefaultChannelPermissionFlags,
  readOrbitLocalChannelPermissionOverrideMap,
} from "@/src/lib/orbit-channel-permissions-local";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type {
  ChannelType,
  MemberRole,
  OrbitChannel,
  OrbitChannelPermission,
} from "@/src/types/orbit";

interface ChannelPermissionState {
  role: MemberRole | null;
  isOwner: boolean;
  canView: boolean;
  canPost: boolean;
  canConnect: boolean;
  canManage: boolean;
}

function rolePermissionFallback(role: MemberRole) {
  return getOrbitDefaultChannelPermissionFlags(role);
}

function canPostInChannelType(channelType: ChannelType) {
  return channelType === "TEXT" || channelType === "FORUM";
}

function canConnectInChannelType(channelType: ChannelType) {
  return channelType === "AUDIO" || channelType === "VIDEO";
}

export function useOrbitChannelPermissions() {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const { profile, servers, membershipsByServer, channelsByServer } = useOrbitNavStore(
    useShallow((state) => ({
      profile: state.profile,
      servers: state.servers,
      membershipsByServer: state.membershipsByServer,
      channelsByServer: state.channelsByServer,
    })),
  );
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [permissions, setPermissions] = useState<OrbitChannelPermission[]>([]);
  const profileId = profile?.id ?? null;

  const serverIds = useMemo(() => servers.map((server) => server.id), [servers]);
  const serverIdSignature = useMemo(() => serverIds.join(","), [serverIds]);
  const serverById = useMemo(
    () => new Map(servers.map((server) => [server.id, server])),
    [servers],
  );

  const buildLocalPermissionRows = useCallback(() => {
    const now = new Date().toISOString();
    const localOverrides = readOrbitLocalChannelPermissionOverrideMap();
    const rows: OrbitChannelPermission[] = [];
    for (const serverId of serverIds) {
      const channels = channelsByServer[serverId] ?? [];
      for (const channel of channels) {
        const overrideByRole = localOverrides[channel.id] ?? {};
        for (const role of ORBIT_MEMBER_ROLES) {
          const defaults = rolePermissionFallback(role);
          const override = overrideByRole[role];
          rows.push({
            id: `local-perm-${channel.id}-${role}`,
            server_id: serverId,
            channel_id: channel.id,
            role,
            can_view: override?.can_view ?? defaults.can_view,
            can_post: override?.can_post ?? defaults.can_post,
            can_connect: override?.can_connect ?? defaults.can_connect,
            can_manage: override?.can_manage ?? defaults.can_manage,
            created_by: profileId,
            created_at: now,
            updated_at: now,
          });
        }
      }
    }
    return rows;
  }, [channelsByServer, profileId, serverIds]);

  const fetchPermissions = useCallback(async () => {
    if (!serverIds.length) {
      setPermissions([]);
      setLoadingPermissions(false);
      return;
    }

    setLoadingPermissions(true);

    if (!isSupabaseReady()) {
      setPermissions(buildLocalPermissionRows());
      setLoadingPermissions(false);
      return;
    }

    const { data, error } = await supabase
      .from("channel_role_permissions")
      .select("*")
      .in("server_id", serverIds)
      .order("role", { ascending: true });

    if (error) {
      setPermissions(buildLocalPermissionRows());
      setLoadingPermissions(false);
      return;
    }

    setPermissions((data ?? []) as OrbitChannelPermission[]);
    setLoadingPermissions(false);
  }, [buildLocalPermissionRows, serverIds, supabase]);

  useEffect(() => {
    void fetchPermissions();
  }, [fetchPermissions]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const refreshPermissions = () => void fetchPermissions();
    window.addEventListener(ORBIT_LOCAL_PERMISSIONS_UPDATED_EVENT, refreshPermissions);
    window.addEventListener("storage", refreshPermissions);
    return () => {
      window.removeEventListener(ORBIT_LOCAL_PERMISSIONS_UPDATED_EVENT, refreshPermissions);
      window.removeEventListener("storage", refreshPermissions);
    };
  }, [fetchPermissions]);

  useEffect(() => {
    if (!isSupabaseReady() || !serverIds.length) {
      return;
    }

    const realtime = supabase
      .channel(`orbit-channel-permissions-${serverIdSignature}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_role_permissions",
        },
        () => void fetchPermissions(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channels",
        },
        () => void fetchPermissions(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "members",
        },
        () => void fetchPermissions(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(realtime);
    };
  }, [fetchPermissions, serverIdSignature, serverIds.length, supabase]);

  const permissionByChannelRole = useMemo(() => {
    const mapping = new Map<string, OrbitChannelPermission>();
    for (const row of permissions) {
      mapping.set(`${row.channel_id}:${row.role}`, row);
    }
    return mapping;
  }, [permissions]);

  const getChannelPermissionState = useCallback(
    (channel: OrbitChannel | null | undefined): ChannelPermissionState => {
      if (!channel) {
        return {
          role: null,
          isOwner: false,
          canView: false,
          canPost: false,
          canConnect: false,
          canManage: false,
        };
      }

      const server = serverById.get(channel.server_id);
      const isOwner = Boolean(profileId && server?.owner_id === profileId);
      if (isOwner) {
        return {
          role: "ADMIN",
          isOwner: true,
          canView: true,
          canPost: true,
          canConnect: true,
          canManage: true,
        };
      }

      const role = membershipsByServer[channel.server_id]?.role ?? null;
      if (!role) {
        return {
          role: null,
          isOwner: false,
          canView: false,
          canPost: false,
          canConnect: false,
          canManage: false,
        };
      }

      const row =
        permissionByChannelRole.get(`${channel.id}:${role}`) ??
        ({
          ...rolePermissionFallback(role),
        } as Pick<
          OrbitChannelPermission,
          "can_view" | "can_post" | "can_connect" | "can_manage"
        >);

      return {
        role,
        isOwner: false,
        canView: row.can_view,
        canPost: row.can_post,
        canConnect: row.can_connect,
        canManage: row.can_manage,
      };
    },
    [membershipsByServer, permissionByChannelRole, profileId, serverById],
  );

  const canViewChannel = useCallback(
    (channel: OrbitChannel | null | undefined) =>
      getChannelPermissionState(channel).canView,
    [getChannelPermissionState],
  );

  const canPostChannel = useCallback(
    (channel: OrbitChannel | null | undefined) => {
      if (!channel || !canPostInChannelType(channel.type)) {
        return false;
      }
      const state = getChannelPermissionState(channel);
      return state.canView && state.canPost;
    },
    [getChannelPermissionState],
  );

  const canConnectChannel = useCallback(
    (channel: OrbitChannel | null | undefined) => {
      if (!channel || !canConnectInChannelType(channel.type)) {
        return false;
      }
      const state = getChannelPermissionState(channel);
      return state.canView && state.canConnect;
    },
    [getChannelPermissionState],
  );

  const canManageChannel = useCallback(
    (channel: OrbitChannel | null | undefined) =>
      getChannelPermissionState(channel).canManage,
    [getChannelPermissionState],
  );

  const canManageServerRules = useCallback(
    (serverId: string | null) => {
      if (!serverId) {
        return false;
      }
      const server = serverById.get(serverId);
      if (!server) {
        return false;
      }
      if (profileId && server.owner_id === profileId) {
        return true;
      }
      const role = membershipsByServer[serverId]?.role ?? null;
      return role === "ADMIN" || role === "MODERATOR";
    },
    [membershipsByServer, profileId, serverById],
  );

  return {
    loadingPermissions,
    permissions,
    fetchPermissions,
    getChannelPermissionState,
    canViewChannel,
    canPostChannel,
    canConnectChannel,
    canManageChannel,
    canManageServerRules,
  };
}
