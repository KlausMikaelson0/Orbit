"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { generateInviteCode } from "@/lib/utils";
import {
  ORBIT_MEMBER_ROLES,
  clearOrbitLocalChannelPermissionOverrides,
  getOrbitDefaultChannelPermissionFlags,
  setOrbitLocalChannelPermissionOverrides,
} from "@/src/lib/orbit-channel-permissions-local";
import {
  ORBIT_LOCAL_PROFILE,
  getOrbitLocalChannels,
  getOrbitLocalDmConversations,
  getOrbitLocalMessageCache,
  getOrbitLocalOnlineIds,
  getOrbitLocalRelationships,
  getOrbitLocalServerMemberships,
} from "@/src/lib/orbit-local-data";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type {
  ChannelType,
  MemberRole,
  OrbitChannel,
  OrbitMember,
  OrbitProfile,
  OrbitServer,
  OrbitServerTemplateKey,
} from "@/src/types/orbit";

interface WorkspaceActionResult<T = void> {
  data?: T;
  error?: string;
}

interface MembershipRow extends OrbitMember {
  server: OrbitServer | OrbitServer[] | null;
}

const DEFAULT_SERVER_CHANNELS: Array<{ name: string; type: ChannelType }> = [
  { name: "general", type: "TEXT" },
];

const SERVER_TEMPLATE_CHANNELS: Record<
  OrbitServerTemplateKey,
  Array<{ name: string; type: ChannelType }>
> = {
  community: [
    { name: "announcements", type: "TEXT" },
    { name: "general", type: "TEXT" },
    { name: "events", type: "FORUM" },
    { name: "town-hall", type: "AUDIO" },
  ],
  gaming: [
    { name: "lobby", type: "TEXT" },
    { name: "squad-chat", type: "TEXT" },
    { name: "clips", type: "FORUM" },
    { name: "voice-1", type: "AUDIO" },
    { name: "stream-room", type: "VIDEO" },
  ],
  startup: [
    { name: "announcements", type: "TEXT" },
    { name: "ops", type: "TEXT" },
    { name: "product-forum", type: "FORUM" },
    { name: "standup-live", type: "AUDIO" },
  ],
};

export function useOrbitWorkspace(user: User | null) {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const activeServerId = useOrbitNavStore((state) => state.activeServerId);
  const setProfile = useOrbitNavStore((state) => state.setProfile);
  const setServersWithMemberships = useOrbitNavStore(
    (state) => state.setServersWithMemberships,
  );
  const setDmConversations = useOrbitNavStore((state) => state.setDmConversations);
  const setRelationships = useOrbitNavStore((state) => state.setRelationships);
  const setOnlineProfileIds = useOrbitNavStore((state) => state.setOnlineProfileIds);
  const setMessages = useOrbitNavStore((state) => state.setMessages);
  const setChannels = useOrbitNavStore((state) => state.setChannels);
  const setActiveServer = useOrbitNavStore((state) => state.setActiveServer);
  const setActiveChannel = useOrbitNavStore((state) => state.setActiveChannel);
  const upsertServer = useOrbitNavStore((state) => state.upsertServer);
  const upsertChannel = useOrbitNavStore((state) => state.upsertChannel);

  const [loadingServers, setLoadingServers] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);

  const bootstrapLocalState = useCallback(() => {
    const current = useOrbitNavStore.getState();
    if (current.profile?.id === ORBIT_LOCAL_PROFILE.id && current.servers.length > 0) {
      return;
    }

    const memberships = getOrbitLocalServerMemberships();
    setProfile(ORBIT_LOCAL_PROFILE);
    setServersWithMemberships(memberships);
    setDmConversations(getOrbitLocalDmConversations());
    setRelationships(getOrbitLocalRelationships());
    setOnlineProfileIds(getOrbitLocalOnlineIds());

    for (const row of memberships) {
      setChannels(row.server.id, getOrbitLocalChannels(row.server.id));
    }

    const localCache = getOrbitLocalMessageCache();
    for (const [conversationKey, messages] of Object.entries(localCache)) {
      setMessages(conversationKey, messages);
    }

    const firstServerId = memberships[0]?.server.id ?? null;
    const firstChannelId = firstServerId
      ? getOrbitLocalChannels(firstServerId)[0]?.id ?? null
      : null;
    if (firstServerId) {
      setActiveServer(firstServerId);
    }
    if (firstChannelId) {
      setActiveChannel(firstChannelId);
    }
  }, [
    setActiveChannel,
    setActiveServer,
    setChannels,
    setDmConversations,
    setMessages,
    setOnlineProfileIds,
    setProfile,
    setRelationships,
    setServersWithMemberships,
  ]);

  const ensureProfile = useCallback(async () => {
    if (!isSupabaseReady()) {
      bootstrapLocalState();
      return;
    }

    if (!user) {
      return;
    }

    const fallbackName = user.email?.split("@")[0] ?? "orbit";
    const username = `${fallbackName}_${user.id.slice(0, 6)}`.toLowerCase();

    const { data } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          username,
          full_name:
            (typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : typeof user.user_metadata?.name === "string"
                ? user.user_metadata.name
                : null) ?? fallbackName,
          avatar_url:
            typeof user.user_metadata?.avatar_url === "string"
              ? user.user_metadata.avatar_url
              : null,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (data) {
      setProfile(data as OrbitProfile);
    }
  }, [bootstrapLocalState, setProfile, supabase, user]);

  const fetchServers = useCallback(async () => {
    if (!isSupabaseReady()) {
      bootstrapLocalState();
      setLoadingServers(false);
      return;
    }

    if (!user) {
      setServersWithMemberships([]);
      setActiveServer(null);
      setLoadingServers(false);
      return;
    }

    setLoadingServers(true);

    const { data } = await supabase
      .from("members")
      .select(
        "id, role, profile_id, server_id, created_at, updated_at, server:servers(id, name, image_url, description, invite_code, owner_id, created_at, updated_at)",
      )
      .eq("profile_id", user.id)
      .order("created_at", { ascending: true });

    const rows = (data ?? []) as unknown as MembershipRow[];
    const formatted = rows
      .map((row) => ({
        ...row,
        server: Array.isArray(row.server) ? row.server[0] ?? null : row.server,
      }))
      .filter((row): row is MembershipRow & { server: OrbitServer } => Boolean(row.server))
      .map((row) => ({
        member: {
          id: row.id,
          role: row.role,
          profile_id: row.profile_id,
          server_id: row.server_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
        server: row.server,
      }));

    setServersWithMemberships(formatted);

    if (!formatted.length) {
      setActiveServer(null);
      setLoadingServers(false);
      return;
    }

    const store = useOrbitNavStore.getState();
    const activeId = store.activeServerId;
    if (!activeId || !formatted.some((row) => row.server.id === activeId)) {
      setActiveServer(formatted[0].server.id);
    }

    setLoadingServers(false);
  }, [
    bootstrapLocalState,
    setActiveServer,
    setServersWithMemberships,
    supabase,
    user,
  ]);

  const fetchChannels = useCallback(
    async (serverId: string | null) => {
      if (!serverId) {
        return;
      }

      if (!isSupabaseReady()) {
        setLoadingChannels(true);
        setChannels(serverId, getOrbitLocalChannels(serverId));
        setLoadingChannels(false);
        return;
      }

      setLoadingChannels(true);
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("server_id", serverId)
        .order("created_at", { ascending: true });

      setChannels(serverId, (data ?? []) as OrbitChannel[]);
      setLoadingChannels(false);
    },
    [setChannels, supabase],
  );

  useEffect(() => {
    void ensureProfile();
    void fetchServers();
  }, [ensureProfile, fetchServers]);

  useEffect(() => {
    if (!isSupabaseReady()) {
      return;
    }
    if (!user) {
      return;
    }

    const membershipChannel = supabase
      .channel(`orbit-memberships-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "members",
          filter: `profile_id=eq.${user.id}`,
        },
        () => void fetchServers(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "servers" },
        () => void fetchServers(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(membershipChannel);
    };
  }, [fetchServers, supabase, user]);

  useEffect(() => {
    if (!activeServerId) {
      setActiveChannel(null);
      return;
    }

    // Channel list is refreshed whenever server changes.
    void fetchChannels(activeServerId);
  }, [activeServerId, fetchChannels, setActiveChannel]);

  useEffect(() => {
    if (!isSupabaseReady()) {
      return;
    }
    if (!activeServerId) {
      return;
    }

    const channelsRealtime = supabase
      .channel(`orbit-channels-${activeServerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channels",
          filter: `server_id=eq.${activeServerId}`,
        },
        () => void fetchChannels(activeServerId),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channelsRealtime);
    };
  }, [activeServerId, fetchChannels, supabase]);

  const createServer = useCallback(
    async (values: {
      name: string;
      imageUrl?: string;
      templateKey?: OrbitServerTemplateKey | null;
    }) => {
      if (!isSupabaseReady()) {
        const trimmedName = values.name.trim();
        if (!trimmedName) {
          return { error: "Server name is required." } satisfies WorkspaceActionResult;
        }

        const now = new Date().toISOString();
        const server: OrbitServer = {
          id: `local-server-${crypto.randomUUID().slice(0, 8)}`,
          name: trimmedName,
          image_url: values.imageUrl?.trim() || null,
          description: null,
          invite_code: generateInviteCode(),
          owner_id: ORBIT_LOCAL_PROFILE.id,
          created_at: now,
          updated_at: now,
        };
        const member: OrbitMember = {
          id: `local-member-${crypto.randomUUID().slice(0, 8)}`,
          role: "ADMIN",
          profile_id: ORBIT_LOCAL_PROFILE.id,
          server_id: server.id,
          created_at: now,
          updated_at: now,
        };
        const templateChannels = values.templateKey
          ? SERVER_TEMPLATE_CHANNELS[values.templateKey] ?? DEFAULT_SERVER_CHANNELS
          : DEFAULT_SERVER_CHANNELS;
        const channels = templateChannels.map((channel, index) => ({
          id: `local-channel-${crypto.randomUUID().slice(0, 8)}-${index}`,
          server_id: server.id,
          name: channel.name,
          type: channel.type,
          created_at: now,
          updated_at: now,
        })) satisfies OrbitChannel[];

        upsertServer(server, member);
        for (const channel of channels) {
          upsertChannel(channel);
        }
        setActiveServer(server.id);
        setActiveChannel(channels[0]?.id ?? null);
        return { data: server } satisfies WorkspaceActionResult<OrbitServer>;
      }

      if (!user) {
        return { error: "You must be signed in." } satisfies WorkspaceActionResult;
      }

      const trimmedName = values.name.trim();
      if (!trimmedName) {
        return { error: "Server name is required." } satisfies WorkspaceActionResult;
      }

      const { data: server, error: serverError } = await supabase
        .from("servers")
        .insert({
          name: trimmedName,
          image_url: values.imageUrl?.trim() || null,
          description: null,
          invite_code: generateInviteCode(),
          owner_id: user.id,
        })
        .select("*")
        .single();

      if (serverError || !server) {
        return {
          error: serverError?.message ?? "Failed to create server.",
        } satisfies WorkspaceActionResult;
      }

      const { data: member, error: memberError } = await supabase
        .from("members")
        .insert({
          role: "ADMIN",
          profile_id: user.id,
          server_id: server.id,
        })
        .select("*")
        .single();

      if (memberError || !member) {
        return {
          error: memberError?.message ?? "Failed to attach owner membership.",
        } satisfies WorkspaceActionResult;
      }

      const templateChannels = values.templateKey
        ? SERVER_TEMPLATE_CHANNELS[values.templateKey] ?? DEFAULT_SERVER_CHANNELS
        : DEFAULT_SERVER_CHANNELS;

      const { data: channels, error: channelsError } = await supabase
        .from("channels")
        .insert(
          templateChannels.map((channel) => ({
            name: channel.name,
            type: channel.type,
            server_id: server.id,
          })),
        )
        .select("*");

      if (channelsError) {
        return {
          error: channelsError.message ?? "Failed to create server channels.",
        } satisfies WorkspaceActionResult;
      }

      upsertServer(server as OrbitServer, member as OrbitMember);
      (channels ?? []).forEach((channel) => upsertChannel(channel as OrbitChannel));
      setActiveServer(server.id);
      if (channels?.[0]?.id) {
        setActiveChannel(channels[0].id);
      }

      await fetchServers();
      await fetchChannels(server.id);

      return { data: server as OrbitServer } satisfies WorkspaceActionResult<OrbitServer>;
    },
    [
      fetchChannels,
      fetchServers,
      setActiveChannel,
      setActiveServer,
      supabase,
      upsertChannel,
      upsertServer,
      user,
    ],
  );

  const createChannel = useCallback(
    async (values: {
      serverId: string;
      name: string;
      type: ChannelType;
      visibility?: "PUBLIC" | "PRIVATE";
      allowedRoles?: MemberRole[];
    }) => {
      const resolveAllowedRoles = () => {
        const explicit = (values.allowedRoles ?? []).filter((role): role is MemberRole =>
          ORBIT_MEMBER_ROLES.includes(role),
        );
        if (explicit.length) {
          return Array.from(new Set(["ADMIN", ...explicit])) as MemberRole[];
        }
        if (values.visibility === "PRIVATE") {
          return ["ADMIN", "MODERATOR"] as MemberRole[];
        }
        return ["ADMIN", "MODERATOR", "GUEST"] as MemberRole[];
      };
      const allowedRoles = resolveAllowedRoles();
      const hasCustomVisibility =
        allowedRoles.length !== ORBIT_MEMBER_ROLES.length ||
        !ORBIT_MEMBER_ROLES.every((role) => allowedRoles.includes(role));

      const buildPermissionByRole = () =>
        Object.fromEntries(
          ORBIT_MEMBER_ROLES.map((role) => {
            const defaults = getOrbitDefaultChannelPermissionFlags(role);
            const visible = allowedRoles.includes(role);
            return [
              role,
              {
                can_view: visible,
                can_post: visible ? defaults.can_post : false,
                can_connect: visible ? defaults.can_connect : false,
                can_manage: visible ? defaults.can_manage : false,
              },
            ];
          }),
        ) as Record<
          MemberRole,
          {
            can_view: boolean;
            can_post: boolean;
            can_connect: boolean;
            can_manage: boolean;
          }
        >;
      const permissionByRole = buildPermissionByRole();

      if (!isSupabaseReady()) {
        const trimmedName = values.name.trim();
        if (!trimmedName) {
          return { error: "Channel name is required." } satisfies WorkspaceActionResult;
        }

        const now = new Date().toISOString();
        const channel: OrbitChannel = {
          id: `local-channel-${crypto.randomUUID().slice(0, 8)}`,
          server_id: values.serverId,
          name: trimmedName,
          type: values.type,
          created_at: now,
          updated_at: now,
        };
        upsertChannel(channel);
        if (hasCustomVisibility) {
          setOrbitLocalChannelPermissionOverrides(channel.id, permissionByRole);
        } else {
          clearOrbitLocalChannelPermissionOverrides(channel.id);
        }
        setActiveChannel(channel.id);
        return { data: channel } satisfies WorkspaceActionResult<OrbitChannel>;
      }

      const trimmedName = values.name.trim();
      if (!trimmedName) {
        return { error: "Channel name is required." } satisfies WorkspaceActionResult;
      }

      const { data: channel, error } = await supabase
        .from("channels")
        .insert({
          server_id: values.serverId,
          name: trimmedName,
          type: values.type,
        })
        .select("*")
        .single();

      if (error || !channel) {
        return {
          error: error?.message ?? "Failed to create channel.",
        } satisfies WorkspaceActionResult;
      }

      if (hasCustomVisibility) {
        const permissionRows = ORBIT_MEMBER_ROLES.map((role) => {
          const flags = permissionByRole[role];
          return {
            server_id: values.serverId,
            channel_id: channel.id,
            role,
            can_view: flags.can_view,
            can_post: flags.can_post,
            can_connect: flags.can_connect,
            can_manage: flags.can_manage,
            created_by: user?.id ?? null,
          };
        });
        const { error: permissionError } = await supabase
          .from("channel_role_permissions")
          .upsert(permissionRows, { onConflict: "channel_id,role" });

        if (permissionError) {
          return {
            error: permissionError.message,
          } satisfies WorkspaceActionResult;
        }
      }

      upsertChannel(channel as OrbitChannel);
      setActiveChannel(channel.id);

      return { data: channel as OrbitChannel } satisfies WorkspaceActionResult<OrbitChannel>;
    },
    [setActiveChannel, supabase, upsertChannel, user],
  );

  const joinServerByInvite = useCallback(
    async (inviteCode: string) => {
      if (!isSupabaseReady()) {
        const normalizedCode = inviteCode.trim().toUpperCase();
        if (!normalizedCode) {
          return { error: "Invite code is required." } satisfies WorkspaceActionResult;
        }

        const state = useOrbitNavStore.getState();
        const target = state.servers.find((server) => server.invite_code === normalizedCode);
        if (!target) {
          return { error: "Invite code is invalid." } satisfies WorkspaceActionResult;
        }

        const now = new Date().toISOString();
        const localMember: OrbitMember = {
          id: `local-member-${crypto.randomUUID().slice(0, 8)}`,
          role: "GUEST",
          profile_id: ORBIT_LOCAL_PROFILE.id,
          server_id: target.id,
          created_at: now,
          updated_at: now,
        };

        upsertServer(target, localMember);
        setActiveServer(target.id);
        const firstChannel = (state.channelsByServer[target.id] ?? [])[0];
        if (firstChannel) {
          setActiveChannel(firstChannel.id);
        }
        return { data: target } satisfies WorkspaceActionResult<OrbitServer>;
      }

      if (!user) {
        return { error: "You must be signed in." } satisfies WorkspaceActionResult;
      }

      const normalizedCode = inviteCode.trim().toUpperCase();
      if (!normalizedCode) {
        return { error: "Invite code is required." } satisfies WorkspaceActionResult;
      }

      const { data: server, error: serverError } = await supabase
        .from("servers")
        .select("*")
        .eq("invite_code", normalizedCode)
        .maybeSingle();

      if (serverError || !server) {
        return {
          error: "Invite code is invalid.",
        } satisfies WorkspaceActionResult;
      }

      const { data: banRow } = await supabase
        .from("server_bans")
        .select("id")
        .eq("server_id", server.id)
        .eq("profile_id", user.id)
        .maybeSingle();

      if (banRow) {
        return {
          error: "You are banned from this server.",
        } satisfies WorkspaceActionResult;
      }

      const { data: existingMember } = await supabase
        .from("members")
        .select("*")
        .eq("profile_id", user.id)
        .eq("server_id", server.id)
        .maybeSingle();

      let member = existingMember as OrbitMember | null;
      if (!member) {
        const { data: insertedMember, error: memberError } = await supabase
          .from("members")
          .insert({
            role: "GUEST",
            profile_id: user.id,
            server_id: server.id,
          })
          .select("*")
          .single();

        if (memberError || !insertedMember) {
          return {
            error: memberError?.message ?? "Unable to join server.",
          } satisfies WorkspaceActionResult;
        }

        member = insertedMember as OrbitMember;
      }

      upsertServer(server as OrbitServer, member);
      setActiveServer(server.id);
      await fetchServers();
      await fetchChannels(server.id);

      return { data: server as OrbitServer } satisfies WorkspaceActionResult<OrbitServer>;
    },
    [
      fetchChannels,
      fetchServers,
      setActiveChannel,
      setActiveServer,
      supabase,
      upsertServer,
      user,
    ],
  );

  return {
    loadingServers,
    loadingChannels,
    fetchServers,
    fetchChannels,
    createServer,
    createChannel,
    joinServerByInvite,
  };
}
