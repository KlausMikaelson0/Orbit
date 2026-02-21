export type ChannelType = "TEXT" | "AUDIO" | "VIDEO" | "FORUM";
export type MemberRole = "ADMIN" | "MODERATOR" | "GUEST";
export type OrbitViewMode =
  | "SERVER"
  | "DM_HOME"
  | "DM_THREAD"
  | "FRIENDS"
  | "SHOP"
  | "QUESTS"
  | "LABS";
export type RelationshipStatus = "PENDING" | "ACCEPTED" | "BLOCKED";
export type OrbitThemePreset = "MIDNIGHT" | "ONYX" | "CYBERPUNK" | "CUSTOM";
export type OrbitTaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type OrbitLocale = "en" | "ar" | "tr";
export type OrbitSubscriptionTier = "FREE" | "PULSE" | "PULSE_PLUS";
export type OrbitSubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELED";
export type OrbitQuestCategory = "VISIT" | "WATCH" | "PLAY" | "SOCIAL";
export type OrbitQuestActionType =
  | "VISIT_APP"
  | "WATCH_AD"
  | "PLAY_SESSION"
  | "SOCIAL_SHARE";
export type OrbitServerTemplateKey = "community" | "gaming" | "startup";
export type OrbitEventType = "STAGE" | "LIVE" | "COMMUNITY";
export type OrbitAchievementMetric =
  | "MESSAGES"
  | "LOGINS"
  | "QUESTS"
  | "VOICE_MINUTES"
  | "SOCIAL";
export type OrbitMarketplaceCategory =
  | "UTILITY"
  | "ENGAGEMENT"
  | "MODERATION"
  | "MONETIZATION"
  | "AI";
export type OrbitPayoutDestinationType = "BANK" | "CARD" | "WALLET";
export type OrbitPayoutRequestStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "REJECTED"
  | "CANCELED";

export interface OrbitProfile {
  id: string;
  username: string | null;
  tag: string | null;
  full_name: string | null;
  avatar_url: string | null;
  active_background_slug?: string | null;
  active_background_css?: string | null;
  performance_mode?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface OrbitServer {
  id: string;
  name: string;
  image_url: string | null;
  invite_code: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrbitChannel {
  id: string;
  name: string;
  type: ChannelType;
  server_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrbitMember {
  id: string;
  role: MemberRole;
  profile_id: string;
  server_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrbitMessage {
  id: string;
  content: string | null;
  file_url: string | null;
  member_id: string;
  channel_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrbitMessageAuthor {
  member: OrbitMember | null;
  profile: OrbitProfile | null;
}

export interface OrbitAttachmentMeta {
  name: string;
  mimeType: string;
}

export interface OrbitLinkPreview {
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  site_name: string | null;
}

export interface OrbitMessageView {
  id: string;
  content: string | null;
  file_url: string | null;
  member_id: string | null;
  channel_id: string | null;
  profile_id: string | null;
  thread_id: string | null;
  thread_parent_id: string | null;
  created_at: string;
  updated_at: string;
  author: OrbitMessageAuthor;
  optimistic?: boolean;
  attachment?: OrbitAttachmentMeta | null;
  link_preview?: OrbitLinkPreview | null;
  moderation?: OrbitModerationSignal | null;
}

export interface OrbitNavSummary {
  activeServerName: string;
  activeChannelName: string;
}

export interface OrbitServerMembership {
  member: OrbitMember;
  server: OrbitServer;
}

export interface OrbitMemberWithProfile {
  member: OrbitMember;
  profile: OrbitProfile | null;
  online: boolean;
}

export interface OrbitDmThread {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface OrbitDmParticipant {
  id: string;
  thread_id: string;
  profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrbitDmMessage {
  id: string;
  thread_id: string;
  profile_id: string;
  content: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrbitDmConversation {
  thread: OrbitDmThread;
  otherProfile: OrbitProfile;
  lastMessage: OrbitDmMessage | null;
}

export interface OrbitRelationship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: RelationshipStatus;
  created_at: string;
  updated_at: string;
  requester: OrbitProfile | null;
  addressee: OrbitProfile | null;
}

export interface OrbitFriendView {
  relationship: OrbitRelationship;
  profile: OrbitProfile;
  online: boolean;
}

export interface OrbitServerBot {
  id: string;
  server_id: string;
  name: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

export interface OrbitModerationSignal {
  score: number;
  reason: string;
}

export interface OrbitMessageFlag {
  id: string;
  message_id: string;
  flagged_by: string;
  model: string;
  score: number;
  reason: string;
  created_at: string;
}

export interface OrbitChannelTask {
  id: string;
  channel_id: string;
  creator_profile_id: string;
  content: string;
  status: OrbitTaskStatus;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  creator: OrbitProfile | null;
}

export interface OrbitServerWebhook {
  id: string;
  server_id: string;
  channel_id: string;
  sender_member_id: string;
  created_by: string;
  name: string;
  is_active: boolean;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrbitIncomingCall {
  call_id: string;
  caller_profile_id: string;
  caller_name: string;
  caller_avatar_url: string | null;
  recipient_profile_id: string;
  mode: "AUDIO" | "VIDEO";
  room_id: string;
  thread_id: string | null;
  started_at: string;
}

export interface OrbitActiveCallSession {
  call_id: string;
  peer_profile_id: string;
  peer_name: string;
  peer_avatar_url: string | null;
  mode: "AUDIO" | "VIDEO";
  room_id: string;
  thread_id: string | null;
  joined_at: string;
}

export interface OrbitProfileSubscription {
  profile_id: string;
  tier: OrbitSubscriptionTier;
  status: OrbitSubscriptionStatus;
  renews_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrbitProfileWallet {
  profile_id: string;
  starbits_balance: number;
  lifetime_earned: number;
  last_daily_claim_at: string | null;
  created_at: string;
  updated_at: string;
}

export type OrbitStoreCategory = "BACKGROUND" | "PROFILE_FLARE" | "SFX_PACK";

export interface OrbitStoreItem {
  slug: string;
  name: string;
  description: string;
  category: OrbitStoreCategory;
  rarity: string;
  price_starbits: number;
  css_background: string | null;
  preview_emoji: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrbitInventoryItem {
  item_slug: string;
  purchased_at: string;
}

export interface OrbitQuest {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: OrbitQuestCategory;
  action_type: OrbitQuestActionType;
  reward_starbits: number;
  target_count: number;
  repeat_interval_hours: number;
  sponsor_name: string | null;
  sponsor_url: string | null;
  is_active: boolean;
  active_from: string | null;
  active_to: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrbitQuestProgress {
  id: string;
  profile_id: string;
  quest_id: string;
  progress_count: number;
  target_count_snapshot: number;
  completed_at: string | null;
  last_action_at: string | null;
  last_claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrbitServerTemplate {
  key: OrbitServerTemplateKey;
  name: string;
  description: string;
  channels: Array<{ name: string; type: ChannelType }>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrbitChannelPermission {
  id: string;
  server_id: string;
  channel_id: string;
  role: MemberRole;
  can_view: boolean;
  can_post: boolean;
  can_connect: boolean;
  can_manage: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type OrbitServerMediaKind = "GIF" | "STICKER";

export interface OrbitServerMediaAsset {
  id: string;
  server_id: string;
  kind: OrbitServerMediaKind;
  title: string;
  media_url: string;
  preview_url: string | null;
  created_by: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrbitServerSoundboardItem {
  id: string;
  server_id: string;
  title: string;
  sound_url: string;
  icon_emoji: string | null;
  created_by: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrbitServerEvent {
  id: string;
  server_id: string;
  channel_id: string | null;
  host_profile_id: string;
  event_type: OrbitEventType;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string | null;
  is_recording_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrbitForumTag {
  id: string;
  server_id: string;
  slug: string;
  label: string;
  color_hex: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrbitForumPost {
  id: string;
  server_id: string;
  channel_id: string;
  author_profile_id: string;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface OrbitForumReply {
  id: string;
  post_id: string;
  author_profile_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface OrbitCallClip {
  id: string;
  server_id: string;
  channel_id: string | null;
  created_by: string;
  title: string;
  clip_url: string;
  preview_image_url: string | null;
  duration_seconds: number;
  created_at: string;
}

export interface OrbitServerAiSettings {
  server_id: string;
  auto_moderation_enabled: boolean;
  auto_summary_enabled: boolean;
  ai_assistant_enabled: boolean;
  smart_reply_enabled: boolean;
  summarize_interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface OrbitSeason {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  xp_per_level: number;
  max_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrbitSeasonProgress {
  id: string;
  profile_id: string;
  season_id: string;
  xp: number;
  level: number;
  claimed_level: number;
  created_at: string;
  updated_at: string;
}

export interface OrbitAchievement {
  id: string;
  slug: string;
  title: string;
  description: string;
  metric_type: OrbitAchievementMetric;
  target_value: number;
  reward_starbits: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrbitAchievementProgress {
  id: string;
  profile_id: string;
  achievement_id: string;
  progress_value: number;
  unlocked_at: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrbitLeaderboardEntry {
  profile_id: string;
  points: number;
  wins: number;
  streak: number;
  created_at: string;
  updated_at: string;
  profile?: OrbitProfile | null;
}

export interface OrbitCreatorTier {
  id: string;
  creator_profile_id: string;
  server_id: string | null;
  slug: string;
  title: string;
  monthly_price_starbits: number;
  benefits: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrbitCreatorSupportSubscription {
  id: string;
  tier_id: string;
  creator_profile_id: string;
  supporter_profile_id: string;
  status: "ACTIVE" | "CANCELED";
  started_at: string;
  renews_at: string;
  created_at: string;
  updated_at: string;
}

export interface OrbitCreatorTip {
  id: string;
  creator_profile_id: string;
  supporter_profile_id: string;
  amount_starbits: number;
  note: string | null;
  created_at: string;
}

export interface OrbitCreatorPayoutAccount {
  profile_id: string;
  destination_type: OrbitPayoutDestinationType;
  provider: string;
  destination_label: string;
  payout_handle: string;
  account_holder_name: string | null;
  currency: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrbitCreatorPayoutRequest {
  id: string;
  profile_id: string;
  destination_type: OrbitPayoutDestinationType;
  destination_label: string;
  payout_handle: string;
  amount_starbits: number;
  amount_usd_cents: number;
  status: OrbitPayoutRequestStatus;
  note: string | null;
  payout_reference: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrbitMarketplaceApp {
  slug: string;
  name: string;
  description: string;
  category: OrbitMarketplaceCategory;
  developer_name: string;
  install_url: string | null;
  icon_emoji: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrbitInstalledApp {
  id: string;
  server_id: string;
  app_slug: string;
  installed_by: string;
  config: Record<string, unknown>;
  created_at: string;
}
