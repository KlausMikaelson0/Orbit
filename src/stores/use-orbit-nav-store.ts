import { create } from "zustand";

import type {
  OrbitChannel,
  OrbitDmConversation,
  OrbitIncomingCall,
  OrbitMember,
  OrbitMessageView,
  OrbitNavSummary,
  OrbitProfile,
  OrbitRelationship,
  OrbitServer,
  OrbitServerMembership,
  OrbitActiveCallSession,
  OrbitLocale,
  OrbitThemePreset,
  OrbitViewMode,
} from "@/src/types/orbit";

export type OrbitFriendsTab = "ALL" | "ONLINE" | "PENDING" | "BLOCKED" | "ADD";

interface OrbitNavState {
  collapsed: boolean;
  profile: OrbitProfile | null;
  activeView: OrbitViewMode;
  servers: OrbitServer[];
  membershipsByServer: Record<string, OrbitMember>;
  channelsByServer: Record<string, OrbitChannel[]>;
  dmConversations: OrbitDmConversation[];
  relationships: OrbitRelationship[];
  onlineProfileIds: string[];
  messageCache: Record<string, OrbitMessageView[]>;
  activeServerId: string | null;
  activeChannelId: string | null;
  activeDmThreadId: string | null;
  friendsTab: OrbitFriendsTab;
  incomingCall: OrbitIncomingCall | null;
  activeCallSession: OrbitActiveCallSession | null;
  privacyMode: boolean;
  locale: OrbitLocale;
  themePreset: OrbitThemePreset;
  customThemeCss: string;
  mobilePanels: {
    servers: boolean;
    context: boolean;
    members: boolean;
  };
  setProfile: (profile: OrbitProfile) => void;
  setServersWithMemberships: (rows: OrbitServerMembership[]) => void;
  setChannels: (serverId: string, channels: OrbitChannel[]) => void;
  setDmConversations: (rows: OrbitDmConversation[]) => void;
  upsertDmConversation: (row: OrbitDmConversation) => void;
  setRelationships: (rows: OrbitRelationship[]) => void;
  setOnlineProfileIds: (ids: string[]) => void;
  upsertServer: (server: OrbitServer, member?: OrbitMember) => void;
  upsertChannel: (channel: OrbitChannel) => void;
  setMessages: (conversationKey: string, messages: OrbitMessageView[]) => void;
  upsertMessage: (conversationKey: string, message: OrbitMessageView) => void;
  replaceMessage: (
    conversationKey: string,
    tempId: string,
    message: OrbitMessageView,
  ) => void;
  removeMessage: (conversationKey: string, messageId: string) => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  setIncomingCall: (incomingCall: OrbitIncomingCall | null) => void;
  clearIncomingCall: () => void;
  setActiveCallSession: (session: OrbitActiveCallSession | null) => void;
  clearActiveCallSession: () => void;
  setPrivacyMode: (value: boolean) => void;
  togglePrivacyMode: () => void;
  setLocale: (locale: OrbitLocale) => void;
  setThemePreset: (preset: OrbitThemePreset) => void;
  setCustomThemeCss: (css: string) => void;
  setMobilePanelOpen: (
    panel: keyof OrbitNavState["mobilePanels"],
    open: boolean,
  ) => void;
  setActiveHome: () => void;
  setActiveFriends: () => void;
  setActiveShop: () => void;
  setActiveQuests: () => void;
  setActiveLabs: () => void;
  setActiveDmThread: (threadId: string | null) => void;
  setFriendsTab: (tab: OrbitFriendsTab) => void;
  setActiveServer: (serverId: string | null) => void;
  setActiveChannel: (channelId: string | null) => void;
  getSummary: () => OrbitNavSummary;
}

function sortByCreatedAt<T extends { created_at: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export const useOrbitNavStore = create<OrbitNavState>((set, get) => ({
  collapsed: false,
  profile: null,
  activeView: "DM_HOME",
  servers: [],
  membershipsByServer: {},
  channelsByServer: {},
  dmConversations: [],
  relationships: [],
  onlineProfileIds: [],
  messageCache: {},
  activeServerId: null,
  activeChannelId: null,
  activeDmThreadId: null,
  friendsTab: "ALL",
  incomingCall: null,
  activeCallSession: null,
  privacyMode: false,
  locale: "en",
  themePreset: "MIDNIGHT",
  customThemeCss: "",
  mobilePanels: {
    servers: false,
    context: false,
    members: false,
  },
  setProfile: (profile) => set({ profile }),
  setServersWithMemberships: (rows) =>
    set((state) => {
      const servers = rows.map((row) => row.server);
      const membershipsByServer = Object.fromEntries(
        rows.map((row) => [row.server.id, row.member]),
      );

      const nextActiveServerId =
        state.activeServerId && servers.some((server) => server.id === state.activeServerId)
          ? state.activeServerId
          : servers[0]?.id ?? null;
      const channelsForActive = nextActiveServerId
        ? state.channelsByServer[nextActiveServerId] ?? []
        : [];
      const nextActiveChannelId =
        state.activeChannelId &&
        channelsForActive.some((channel) => channel.id === state.activeChannelId)
          ? state.activeChannelId
          : channelsForActive[0]?.id ?? null;

      return {
        servers,
        membershipsByServer,
        activeServerId: nextActiveServerId,
        activeChannelId: nextActiveChannelId,
      };
    }),
  setChannels: (serverId, channels) =>
    set((state) => {
      const nextChannels = sortByCreatedAt(channels);
      const channelsByServer = {
        ...state.channelsByServer,
        [serverId]: nextChannels,
      };

      const shouldTouchActive = state.activeServerId === serverId;
      if (!shouldTouchActive) {
        return { channelsByServer };
      }

      const nextActiveChannelId =
        state.activeChannelId &&
        nextChannels.some((channel) => channel.id === state.activeChannelId)
          ? state.activeChannelId
          : nextChannels[0]?.id ?? null;

      return {
        channelsByServer,
        activeChannelId: nextActiveChannelId,
      };
    }),
  setDmConversations: (rows) =>
    set((state) => {
      const sortedRows = [...rows].sort((a, b) => {
        const aDate = a.lastMessage?.created_at ?? a.thread.updated_at;
        const bDate = b.lastMessage?.created_at ?? b.thread.updated_at;
        return bDate.localeCompare(aDate);
      });

      const nextActiveDmThreadId =
        state.activeDmThreadId &&
        sortedRows.some((row) => row.thread.id === state.activeDmThreadId)
          ? state.activeDmThreadId
          : state.activeView === "DM_THREAD"
            ? sortedRows[0]?.thread.id ?? null
            : state.activeDmThreadId;

      return {
        dmConversations: sortedRows,
        activeDmThreadId: nextActiveDmThreadId,
      };
    }),
  upsertDmConversation: (row) =>
    set((state) => {
      const nextRows = [
        ...state.dmConversations.filter(
          (current) => current.thread.id !== row.thread.id,
        ),
        row,
      ].sort((a, b) => {
        const aDate = a.lastMessage?.created_at ?? a.thread.updated_at;
        const bDate = b.lastMessage?.created_at ?? b.thread.updated_at;
        return bDate.localeCompare(aDate);
      });

      return {
        dmConversations: nextRows,
      };
    }),
  setRelationships: (rows) => set({ relationships: rows }),
  setOnlineProfileIds: (ids) => set({ onlineProfileIds: ids }),
  upsertServer: (server, member) =>
    set((state) => {
      const nextServers = [
        ...state.servers.filter((current) => current.id !== server.id),
        server,
      ];
      const membershipsByServer = member
        ? { ...state.membershipsByServer, [server.id]: member }
        : state.membershipsByServer;

      return {
        servers: sortByCreatedAt(nextServers),
        membershipsByServer,
      };
    }),
  upsertChannel: (channel) =>
    set((state) => {
      const existing = state.channelsByServer[channel.server_id] ?? [];
      const nextChannels = sortByCreatedAt(
        [...existing.filter((item) => item.id !== channel.id), channel],
      );

      return {
        channelsByServer: {
          ...state.channelsByServer,
          [channel.server_id]: nextChannels,
        },
      };
    }),
  setMessages: (conversationKey, messages) =>
    set((state) => ({
      messageCache: {
        ...state.messageCache,
        [conversationKey]: sortByCreatedAt(messages),
      },
    })),
  upsertMessage: (conversationKey, message) =>
    set((state) => {
      const current = state.messageCache[conversationKey] ?? [];
      const nextMessages = sortByCreatedAt(
        [...current.filter((item) => item.id !== message.id), message],
      );

      return {
        messageCache: {
          ...state.messageCache,
          [conversationKey]: nextMessages,
        },
      };
    }),
  replaceMessage: (conversationKey, tempId, message) =>
    set((state) => {
      const current = state.messageCache[conversationKey] ?? [];
      const nextMessages = sortByCreatedAt(
        [
          ...current.filter(
            (item) => item.id !== tempId && item.id !== message.id,
          ),
          message,
        ],
      );

      return {
        messageCache: {
          ...state.messageCache,
          [conversationKey]: nextMessages,
        },
      };
    }),
  removeMessage: (conversationKey, messageId) =>
    set((state) => {
      const current = state.messageCache[conversationKey] ?? [];
      return {
        messageCache: {
          ...state.messageCache,
          [conversationKey]: current.filter((item) => item.id !== messageId),
        },
      };
    }),
  setCollapsed: (collapsed) => set({ collapsed }),
  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
  setIncomingCall: (incomingCall) => set({ incomingCall }),
  clearIncomingCall: () => set({ incomingCall: null }),
  setActiveCallSession: (activeCallSession) => set({ activeCallSession }),
  clearActiveCallSession: () => set({ activeCallSession: null }),
  setPrivacyMode: (value) => set({ privacyMode: value }),
  togglePrivacyMode: () =>
    set((state) => ({ privacyMode: !state.privacyMode })),
  setLocale: (locale) => set({ locale }),
  setThemePreset: (preset) => set({ themePreset: preset }),
  setCustomThemeCss: (css) => set({ customThemeCss: css }),
  setMobilePanelOpen: (panel, open) =>
    set((state) => ({
      mobilePanels: {
        ...state.mobilePanels,
        [panel]: open,
      },
    })),
  setActiveHome: () =>
    set({
      activeView: "DM_HOME",
      activeServerId: null,
      activeChannelId: null,
      activeDmThreadId: null,
    }),
  setActiveFriends: () =>
    set({
      activeView: "FRIENDS",
      activeServerId: null,
      activeChannelId: null,
      activeDmThreadId: null,
    }),
  setActiveShop: () =>
    set({
      activeView: "SHOP",
      activeServerId: null,
      activeChannelId: null,
      activeDmThreadId: null,
    }),
  setActiveQuests: () =>
    set({
      activeView: "QUESTS",
      activeServerId: null,
      activeChannelId: null,
      activeDmThreadId: null,
    }),
  setActiveLabs: () =>
    set((state) => ({
      activeView: "LABS",
      activeServerId: state.activeServerId,
      activeChannelId: state.activeChannelId,
      activeDmThreadId: null,
    })),
  setActiveDmThread: (threadId) =>
    set({
      activeView: threadId ? "DM_THREAD" : "DM_HOME",
      activeDmThreadId: threadId,
      activeServerId: null,
      activeChannelId: null,
    }),
  setFriendsTab: (friendsTab) => set({ friendsTab }),
  setActiveServer: (serverId) =>
    set((state) => {
      if (!serverId) {
        return {
          activeView: "DM_HOME",
          activeServerId: null,
          activeChannelId: null,
        };
      }

      const nextServer = state.servers.find((server) => server.id === serverId);
      if (!nextServer) {
        return {};
      }

      const channels = state.channelsByServer[serverId] ?? [];
      return {
        activeView: "SERVER",
        activeServerId: serverId,
        activeChannelId: channels[0]?.id ?? null,
        activeDmThreadId: null,
      };
    }),
  setActiveChannel: (channelId) =>
    set({
      activeView: "SERVER",
      activeChannelId: channelId,
      activeDmThreadId: null,
    }),
  getSummary: () => {
    const {
      activeView,
      dmConversations,
      servers,
      channelsByServer,
      activeServerId,
      activeChannelId,
      activeDmThreadId,
    } = get();
    if (activeView === "FRIENDS") {
      return {
        activeServerName: "Home",
        activeChannelName: "Friends",
      };
    }

    if (activeView === "DM_HOME") {
      return {
        activeServerName: "Home",
        activeChannelName: "Direct Messages",
      };
    }

    if (activeView === "SHOP") {
      return {
        activeServerName: "Home",
        activeChannelName: "Orbit Shop",
      };
    }

    if (activeView === "QUESTS") {
      return {
        activeServerName: "Home",
        activeChannelName: "Orbit Quests",
      };
    }

    if (activeView === "LABS") {
      return {
        activeServerName: "Home",
        activeChannelName: "Orbit Labs",
      };
    }

    if (activeView === "DM_THREAD") {
      const activeThread = dmConversations.find(
        (thread) => thread.thread.id === activeDmThreadId,
      );
      return {
        activeServerName: "Direct Message",
        activeChannelName:
          activeThread?.otherProfile.full_name ??
          activeThread?.otherProfile.username ??
          "Conversation",
      };
    }

    const activeServer = servers.find((server) => server.id === activeServerId);
    const activeChannels = activeServerId
      ? channelsByServer[activeServerId] ?? []
      : [];
    const activeChannel = activeChannels.find(
      (channel) => channel.id === activeChannelId,
    );

    return {
      activeServerName: activeServer?.name ?? "Unified Space",
      activeChannelName: activeChannel?.name ?? "general",
    };
  },
}));
