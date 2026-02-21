import type {
  OrbitChannel,
  OrbitDmConversation,
  OrbitDmMessage,
  OrbitMember,
  OrbitMemberWithProfile,
  OrbitMessageView,
  OrbitProfile,
  OrbitQuest,
  OrbitQuestProgress,
  OrbitRelationship,
  OrbitServerMediaAsset,
  OrbitServer,
  OrbitServerMembership,
  OrbitStoreItem,
} from "@/src/types/orbit";

const TS = "2026-02-20T00:00:00.000Z";

export const ORBIT_LOCAL_PROFILE: OrbitProfile = {
  id: "local-user",
  username: "orbituser",
  tag: "0001",
  full_name: "Orbit User",
  avatar_url: null,
  active_background_slug: null,
  active_background_css: null,
  performance_mode: false,
  created_at: TS,
  updated_at: TS,
};

export const ORBIT_LOCAL_DIRECTORY: OrbitProfile[] = [
  {
    id: "local-friend-nora",
    username: "nora",
    tag: "1042",
    full_name: "Nora Voss",
    avatar_url: null,
    created_at: TS,
    updated_at: TS,
  },
  {
    id: "local-friend-mika",
    username: "mika",
    tag: "9088",
    full_name: "Mika Stone",
    avatar_url: null,
    created_at: TS,
    updated_at: TS,
  },
  {
    id: "local-friend-rayan",
    username: "rayan",
    tag: "2204",
    full_name: "Rayan Byte",
    avatar_url: null,
    created_at: TS,
    updated_at: TS,
  },
];

const LOCAL_SERVERS: OrbitServer[] = [
  {
    id: "local-server-hq",
    name: "Orbit HQ",
    image_url: null,
    description: "Core command server for launch ops, announcements, and community sync.",
    invite_code: "ORBIT",
    owner_id: ORBIT_LOCAL_PROFILE.id,
    created_at: TS,
    updated_at: TS,
  },
  {
    id: "local-server-creators",
    name: "Creator Lounge",
    image_url: null,
    description: "Premium creator hub for collabs, monetization, and live sessions.",
    invite_code: "CREATOR",
    owner_id: ORBIT_LOCAL_PROFILE.id,
    created_at: TS,
    updated_at: TS,
  },
];

const LOCAL_MEMBERS: OrbitMember[] = [
  {
    id: "local-member-hq-owner",
    role: "ADMIN",
    profile_id: ORBIT_LOCAL_PROFILE.id,
    server_id: "local-server-hq",
    created_at: TS,
    updated_at: TS,
  },
  {
    id: "local-member-creator-owner",
    role: "ADMIN",
    profile_id: ORBIT_LOCAL_PROFILE.id,
    server_id: "local-server-creators",
    created_at: TS,
    updated_at: TS,
  },
];

const LOCAL_CHANNELS: OrbitChannel[] = [
  {
    id: "local-channel-general",
    name: "general",
    type: "TEXT",
    server_id: "local-server-hq",
    created_at: TS,
    updated_at: TS,
  },
  {
    id: "local-channel-stage",
    name: "town-hall",
    type: "AUDIO",
    server_id: "local-server-hq",
    created_at: TS,
    updated_at: TS,
  },
  {
    id: "local-channel-forum",
    name: "product-forum",
    type: "FORUM",
    server_id: "local-server-hq",
    created_at: TS,
    updated_at: TS,
  },
  {
    id: "local-channel-creators",
    name: "creator-chat",
    type: "TEXT",
    server_id: "local-server-creators",
    created_at: TS,
    updated_at: TS,
  },
  {
    id: "local-channel-stream",
    name: "stream-room",
    type: "VIDEO",
    server_id: "local-server-creators",
    created_at: TS,
    updated_at: TS,
  },
];

const LOCAL_DM_THREAD = {
  id: "local-dm-thread-1",
  created_at: TS,
  updated_at: TS,
};

const LOCAL_SERVER_MEDIA_ASSETS: OrbitServerMediaAsset[] = [
  {
    id: "local-media-hq-gif-1",
    server_id: "local-server-hq",
    kind: "GIF",
    title: "HQ Glow",
    media_url: "https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif",
    preview_url: "https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif",
    created_by: ORBIT_LOCAL_PROFILE.id,
    usage_count: 0,
    is_active: true,
    created_at: TS,
    updated_at: TS,
  },
  {
    id: "local-media-hq-sticker-1",
    server_id: "local-server-hq",
    kind: "STICKER",
    title: "HQ Shield",
    media_url: "/stickers/orbit-shield.svg",
    preview_url: "/stickers/orbit-shield.svg",
    created_by: ORBIT_LOCAL_PROFILE.id,
    usage_count: 0,
    is_active: true,
    created_at: TS,
    updated_at: TS,
  },
  {
    id: "local-media-creators-gif-1",
    server_id: "local-server-creators",
    kind: "GIF",
    title: "Creator Hype",
    media_url: "https://media.giphy.com/media/OkJat1YNdoD3W/giphy.gif",
    preview_url: "https://media.giphy.com/media/OkJat1YNdoD3W/giphy.gif",
    created_by: ORBIT_LOCAL_PROFILE.id,
    usage_count: 0,
    is_active: true,
    created_at: TS,
    updated_at: TS,
  },
  {
    id: "local-media-creators-sticker-1",
    server_id: "local-server-creators",
    kind: "STICKER",
    title: "Creator Rocket",
    media_url: "/stickers/orbit-rocket.svg",
    preview_url: "/stickers/orbit-rocket.svg",
    created_by: ORBIT_LOCAL_PROFILE.id,
    usage_count: 0,
    is_active: true,
    created_at: TS,
    updated_at: TS,
  },
];

function channelMessage(
  id: string,
  channelId: string,
  author: OrbitProfile,
  member: OrbitMember,
  content: string,
  createdAt: string,
): OrbitMessageView {
  return {
    id,
    content,
    file_url: null,
    member_id: member.id,
    channel_id: channelId,
    profile_id: author.id,
    thread_id: null,
    thread_parent_id: null,
    created_at: createdAt,
    updated_at: createdAt,
    author: {
      member,
      profile: author,
    },
    optimistic: false,
  };
}

function dmMessage(
  id: string,
  profile: OrbitProfile,
  content: string,
  createdAt: string,
): OrbitMessageView {
  return {
    id,
    content,
    file_url: null,
    member_id: null,
    channel_id: null,
    profile_id: profile.id,
    thread_id: LOCAL_DM_THREAD.id,
    thread_parent_id: null,
    created_at: createdAt,
    updated_at: createdAt,
    author: {
      member: null,
      profile,
    },
    optimistic: false,
  };
}

export function getOrbitLocalServerMemberships(): OrbitServerMembership[] {
  return [
    { member: LOCAL_MEMBERS[0], server: LOCAL_SERVERS[0] },
    { member: LOCAL_MEMBERS[1], server: LOCAL_SERVERS[1] },
  ];
}

export function getOrbitLocalChannels(serverId: string): OrbitChannel[] {
  return LOCAL_CHANNELS.filter((channel) => channel.server_id === serverId);
}

export function getOrbitLocalDmConversations(): OrbitDmConversation[] {
  const nora = ORBIT_LOCAL_DIRECTORY[0];
  const lastMessage: OrbitDmMessage = {
    id: "local-dm-message-1",
    thread_id: LOCAL_DM_THREAD.id,
    profile_id: nora.id,
    content: "Welcome to Orbit local mode. Chat is fully usable in browser now.",
    file_url: null,
    created_at: TS,
    updated_at: TS,
  };

  return [
    {
      thread: LOCAL_DM_THREAD,
      otherProfile: nora,
      lastMessage,
    },
  ];
}

export function getOrbitLocalRelationships(): OrbitRelationship[] {
  const nora = ORBIT_LOCAL_DIRECTORY[0];
  const mika = ORBIT_LOCAL_DIRECTORY[1];
  return [
    {
      id: "local-rel-1",
      requester_id: ORBIT_LOCAL_PROFILE.id,
      addressee_id: nora.id,
      status: "ACCEPTED",
      created_at: TS,
      updated_at: TS,
      requester: ORBIT_LOCAL_PROFILE,
      addressee: nora,
    },
    {
      id: "local-rel-2",
      requester_id: mika.id,
      addressee_id: ORBIT_LOCAL_PROFILE.id,
      status: "PENDING",
      created_at: TS,
      updated_at: TS,
      requester: mika,
      addressee: ORBIT_LOCAL_PROFILE,
    },
  ];
}

export function getOrbitLocalOnlineIds(): string[] {
  return [ORBIT_LOCAL_PROFILE.id, ORBIT_LOCAL_DIRECTORY[0].id, ORBIT_LOCAL_DIRECTORY[2].id];
}

export function getOrbitLocalMessageCache(): Record<string, OrbitMessageView[]> {
  const hqOwner = LOCAL_MEMBERS[0];
  const creatorsOwner = LOCAL_MEMBERS[1];
  const nora = ORBIT_LOCAL_DIRECTORY[0];
  const mika = ORBIT_LOCAL_DIRECTORY[1];

  return {
    "channel:local-channel-general": [
      channelMessage(
        "local-msg-1",
        "local-channel-general",
        nora,
        hqOwner,
        "Orbit is running in local mode so users can continue in browser even before backend setup.",
        "2026-02-20T12:00:00.000Z",
      ),
      channelMessage(
        "local-msg-2",
        "local-channel-general",
        ORBIT_LOCAL_PROFILE,
        hqOwner,
        "Great, this now feels like a real Discord-style entrypoint.",
        "2026-02-20T12:02:00.000Z",
      ),
      channelMessage(
        "local-msg-3",
        "local-channel-general",
        mika,
        hqOwner,
        "Once Supabase is configured, it automatically switches to cloud realtime mode.",
        "2026-02-20T12:03:00.000Z",
      ),
    ],
    "channel:local-channel-creators": [
      channelMessage(
        "local-msg-4",
        "local-channel-creators",
        ORBIT_LOCAL_PROFILE,
        creatorsOwner,
        "Creator economy tools and premium tiers live here.",
        "2026-02-20T12:10:00.000Z",
      ),
    ],
    "dm:local-dm-thread-1": [
      dmMessage(
        "local-dm-msg-1",
        ORBIT_LOCAL_DIRECTORY[0],
        "Hey! Ready for launch?",
        "2026-02-20T12:11:00.000Z",
      ),
      dmMessage(
        "local-dm-msg-2",
        ORBIT_LOCAL_PROFILE,
        "Yes. Browser flow is fixed and smooth now.",
        "2026-02-20T12:12:00.000Z",
      ),
    ],
  };
}

export function getOrbitLocalMembers(serverId: string): OrbitMemberWithProfile[] {
  if (serverId === "local-server-hq") {
    return [
      {
        member: LOCAL_MEMBERS[0],
        profile: ORBIT_LOCAL_PROFILE,
        online: true,
      },
      {
        member: {
          id: "local-member-hq-nora",
          role: "MODERATOR",
          profile_id: ORBIT_LOCAL_DIRECTORY[0].id,
          server_id: "local-server-hq",
          created_at: TS,
          updated_at: TS,
        },
        profile: ORBIT_LOCAL_DIRECTORY[0],
        online: true,
      },
      {
        member: {
          id: "local-member-hq-mika",
          role: "GUEST",
          profile_id: ORBIT_LOCAL_DIRECTORY[1].id,
          server_id: "local-server-hq",
          created_at: TS,
          updated_at: TS,
        },
        profile: ORBIT_LOCAL_DIRECTORY[1],
        online: false,
      },
    ];
  }

  if (serverId === "local-server-creators") {
    return [
      {
        member: LOCAL_MEMBERS[1],
        profile: ORBIT_LOCAL_PROFILE,
        online: true,
      },
      {
        member: {
          id: "local-member-creator-rayan",
          role: "MODERATOR",
          profile_id: ORBIT_LOCAL_DIRECTORY[2].id,
          server_id: "local-server-creators",
          created_at: TS,
          updated_at: TS,
        },
        profile: ORBIT_LOCAL_DIRECTORY[2],
        online: true,
      },
    ];
  }

  return [];
}

export function getOrbitLocalServerMediaAssets(serverId: string): OrbitServerMediaAsset[] {
  return LOCAL_SERVER_MEDIA_ASSETS.filter(
    (item) => item.server_id === serverId && item.is_active,
  );
}

export function getOrbitLocalStoreItems(): OrbitStoreItem[] {
  return [
    {
      slug: "bg-nebula",
      name: "Nebula Drift",
      description: "Animated cosmic gradient backdrop.",
      category: "BACKGROUND",
      rarity: "RARE",
      price_starbits: 420,
      css_background:
        "radial-gradient(circle at 20% 20%, rgba(139,92,246,0.45), transparent 45%), radial-gradient(circle at 80% 70%, rgba(59,130,246,0.35), transparent 42%), #080a16",
      preview_emoji: null,
      is_active: true,
      sort_order: 1,
      created_at: TS,
      updated_at: TS,
    },
    {
      slug: "bg-sunset-grid",
      name: "Sunset Grid",
      description: "Warm cyber sunset with neon lines.",
      category: "BACKGROUND",
      rarity: "EPIC",
      price_starbits: 680,
      css_background:
        "linear-gradient(145deg, rgba(251,146,60,0.42), rgba(244,63,94,0.32), rgba(37,99,235,0.32))",
      preview_emoji: null,
      is_active: true,
      sort_order: 2,
      created_at: TS,
      updated_at: TS,
    },
    {
      slug: "flare-comet",
      name: "Comet Flare",
      description: "Profile flare for premium identity.",
      category: "PROFILE_FLARE",
      rarity: "COMMON",
      price_starbits: 180,
      css_background: null,
      preview_emoji: "☄️",
      is_active: true,
      sort_order: 3,
      created_at: TS,
      updated_at: TS,
    },
  ];
}

export function getOrbitLocalQuests(): OrbitQuest[] {
  return [
    {
      id: "local-quest-visit",
      slug: "local-daily-visit",
      title: "Daily Orbit Check-in",
      description: "Open Orbit and complete your first interaction.",
      category: "VISIT",
      action_type: "VISIT_APP",
      reward_starbits: 80,
      target_count: 1,
      repeat_interval_hours: 24,
      sponsor_name: null,
      sponsor_url: null,
      is_active: true,
      active_from: null,
      active_to: null,
      sort_order: 1,
      created_at: TS,
      updated_at: TS,
    },
    {
      id: "local-quest-social",
      slug: "local-social-loop",
      title: "Social Pulse",
      description: "Send 3 messages in any text channel.",
      category: "SOCIAL",
      action_type: "SOCIAL_SHARE",
      reward_starbits: 140,
      target_count: 3,
      repeat_interval_hours: 24,
      sponsor_name: "Orbit Partners",
      sponsor_url: "https://github.com/KlausMikaelson0/orbit",
      is_active: true,
      active_from: null,
      active_to: null,
      sort_order: 2,
      created_at: TS,
      updated_at: TS,
    },
    {
      id: "local-quest-watch",
      slug: "local-watch-sponsor-full",
      title: "Sponsor Spotlight (Full Watch)",
      description: "Watch the full sponsored clip. Skipping blocks reward payout.",
      category: "WATCH",
      action_type: "WATCH_AD",
      reward_starbits: 220,
      target_count: 1,
      repeat_interval_hours: 24,
      sponsor_name: "Orbit Ad Network",
      sponsor_url: "https://www.youtube.com",
      is_active: true,
      active_from: null,
      active_to: null,
      sort_order: 3,
      created_at: TS,
      updated_at: TS,
    },
    {
      id: "local-quest-play",
      slug: "local-play-sponsored-challenge",
      title: "Sponsored Mini-Game Trial",
      description: "Complete the full mini challenge before deadline to unlock points.",
      category: "PLAY",
      action_type: "PLAY_SESSION",
      reward_starbits: 280,
      target_count: 1,
      repeat_interval_hours: 24,
      sponsor_name: "Orbit Play Partners",
      sponsor_url: "https://store.steampowered.com",
      is_active: true,
      active_from: null,
      active_to: null,
      sort_order: 4,
      created_at: TS,
      updated_at: TS,
    },
  ];
}

export function getOrbitLocalQuestProgress(): OrbitQuestProgress[] {
  return [
    {
      id: "local-quest-progress-visit",
      profile_id: ORBIT_LOCAL_PROFILE.id,
      quest_id: "local-quest-visit",
      progress_count: 1,
      target_count_snapshot: 1,
      completed_at: "2026-02-20T12:01:00.000Z",
      last_action_at: "2026-02-20T12:01:00.000Z",
      last_claimed_at: null,
      created_at: TS,
      updated_at: TS,
    },
    {
      id: "local-quest-progress-social",
      profile_id: ORBIT_LOCAL_PROFILE.id,
      quest_id: "local-quest-social",
      progress_count: 1,
      target_count_snapshot: 3,
      completed_at: null,
      last_action_at: "2026-02-20T12:05:00.000Z",
      last_claimed_at: null,
      created_at: TS,
      updated_at: TS,
    },
    {
      id: "local-quest-progress-watch",
      profile_id: ORBIT_LOCAL_PROFILE.id,
      quest_id: "local-quest-watch",
      progress_count: 0,
      target_count_snapshot: 1,
      completed_at: null,
      last_action_at: null,
      last_claimed_at: null,
      created_at: TS,
      updated_at: TS,
    },
    {
      id: "local-quest-progress-play",
      profile_id: ORBIT_LOCAL_PROFILE.id,
      quest_id: "local-quest-play",
      progress_count: 0,
      target_count_snapshot: 1,
      completed_at: null,
      last_action_at: null,
      last_claimed_at: null,
      created_at: TS,
      updated_at: TS,
    },
  ];
}
