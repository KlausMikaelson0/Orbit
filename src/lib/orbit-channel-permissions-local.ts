"use client";

import type { MemberRole } from "@/src/types/orbit";

export interface OrbitLocalChannelPermissionFlags {
  can_view: boolean;
  can_post: boolean;
  can_connect: boolean;
  can_manage: boolean;
}

export type OrbitLocalChannelPermissionOverrideMap = Record<
  string,
  Partial<Record<MemberRole, OrbitLocalChannelPermissionFlags>>
>;

export const ORBIT_MEMBER_ROLES: MemberRole[] = ["ADMIN", "MODERATOR", "GUEST"];

const LOCAL_CHANNEL_PERMISSION_OVERRIDES_KEY =
  "orbit_local_channel_permission_overrides_v1";

export const ORBIT_LOCAL_PERMISSIONS_UPDATED_EVENT =
  "orbit-local-channel-permissions-updated";

export function getOrbitDefaultChannelPermissionFlags(
  role: MemberRole,
): OrbitLocalChannelPermissionFlags {
  if (role === "ADMIN") {
    return {
      can_view: true,
      can_post: true,
      can_connect: true,
      can_manage: true,
    };
  }
  if (role === "MODERATOR") {
    return {
      can_view: true,
      can_post: true,
      can_connect: true,
      can_manage: false,
    };
  }
  return {
    can_view: true,
    can_post: true,
    can_connect: true,
    can_manage: false,
  };
}

export function readOrbitLocalChannelPermissionOverrideMap(): OrbitLocalChannelPermissionOverrideMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_CHANNEL_PERMISSION_OVERRIDES_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as OrbitLocalChannelPermissionOverrideMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeOrbitLocalChannelPermissionOverrideMap(
  map: OrbitLocalChannelPermissionOverrideMap,
) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      LOCAL_CHANNEL_PERMISSION_OVERRIDES_KEY,
      JSON.stringify(map),
    );
  } catch {
    // Ignore localStorage errors in restricted browser contexts.
  }
}

export function setOrbitLocalChannelPermissionOverrides(
  channelId: string,
  overrides: Partial<Record<MemberRole, OrbitLocalChannelPermissionFlags>>,
) {
  const map = readOrbitLocalChannelPermissionOverrideMap();
  map[channelId] = overrides;
  writeOrbitLocalChannelPermissionOverrideMap(map);
  emitOrbitLocalPermissionsUpdated();
}

export function clearOrbitLocalChannelPermissionOverrides(channelId: string) {
  const map = readOrbitLocalChannelPermissionOverrideMap();
  delete map[channelId];
  writeOrbitLocalChannelPermissionOverrideMap(map);
  emitOrbitLocalPermissionsUpdated();
}

export function emitOrbitLocalPermissionsUpdated() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(ORBIT_LOCAL_PERMISSIONS_UPDATED_EVENT));
}
