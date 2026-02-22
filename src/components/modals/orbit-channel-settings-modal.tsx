"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Settings2, ShieldCheck, Sparkles } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useOrbitChannelPermissions } from "@/src/hooks/use-orbit-channel-permissions";
import {
  ORBIT_MEMBER_ROLES,
  getOrbitDefaultChannelPermissionFlags,
  setOrbitLocalChannelPermissionOverrides,
} from "@/src/lib/orbit-channel-permissions-local";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type { MemberRole, OrbitChannel } from "@/src/types/orbit";

type ChannelSettingsSection = "OVERVIEW" | "PERMISSIONS";

interface OrbitChannelSettingsModalProps {
  open: boolean;
  serverId: string | null;
  channelId: string | null;
  initialSection?: ChannelSettingsSection;
  onOpenChange: (open: boolean) => void;
}

type RolePermissionDraft = Record<
  MemberRole,
  {
    can_view: boolean;
    can_post: boolean;
    can_connect: boolean;
    can_manage: boolean;
  }
>;

function buildPermissionDraft(
  permissions: Array<{
    role: MemberRole;
    can_view: boolean;
    can_post: boolean;
    can_connect: boolean;
    can_manage: boolean;
  }>,
): RolePermissionDraft {
  const map = new Map(permissions.map((row) => [row.role, row]));
  return {
    ADMIN: {
      ...getOrbitDefaultChannelPermissionFlags("ADMIN"),
      ...(map.get("ADMIN") ?? {}),
    },
    MODERATOR: {
      ...getOrbitDefaultChannelPermissionFlags("MODERATOR"),
      ...(map.get("MODERATOR") ?? {}),
    },
    GUEST: {
      ...getOrbitDefaultChannelPermissionFlags("GUEST"),
      ...(map.get("GUEST") ?? {}),
    },
  };
}

function parseSlowmode(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(21_600, parsed));
}

function parseHideAfterDays(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 3;
  }
  return [1, 3, 7, 14, 30].includes(parsed) ? parsed : 3;
}

export function OrbitChannelSettingsModal({
  open,
  serverId,
  channelId,
  initialSection = "OVERVIEW",
  onOpenChange,
}: OrbitChannelSettingsModalProps) {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const isLocalMode = !isSupabaseReady();
  const { channelsByServer, profile, upsertChannel } = useOrbitNavStore(
    useShallow((state) => ({
      channelsByServer: state.channelsByServer,
      profile: state.profile,
      upsertChannel: state.upsertChannel,
    })),
  );
  const { permissions, fetchPermissions, canManageChannel } = useOrbitChannelPermissions();

  const channel = useMemo(() => {
    if (!serverId || !channelId) {
      return null;
    }
    return (channelsByServer[serverId] ?? []).find((item) => item.id === channelId) ?? null;
  }, [channelId, channelsByServer, serverId]);
  const scopedPermissions = useMemo(
    () => permissions.filter((row) => row.channel_id === channelId),
    [channelId, permissions],
  );
  const canManage = canManageChannel(channel);

  const [section, setSection] = useState<ChannelSettingsSection>(initialSection);
  const [channelName, setChannelName] = useState("");
  const [topic, setTopic] = useState("");
  const [slowmodeSeconds, setSlowmodeSeconds] = useState("0");
  const [ageRestricted, setAgeRestricted] = useState(false);
  const [hideAfterDays, setHideAfterDays] = useState("3");
  const [permissionDraft, setPermissionDraft] = useState<RolePermissionDraft>({
    ADMIN: getOrbitDefaultChannelPermissionFlags("ADMIN"),
    MODERATOR: getOrbitDefaultChannelPermissionFlags("MODERATOR"),
    GUEST: getOrbitDefaultChannelPermissionFlags("GUEST"),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const privateChannel = !permissionDraft.GUEST.can_view;

  useEffect(() => {
    if (!open) {
      return;
    }
    setSection(initialSection);
  }, [initialSection, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void fetchPermissions();
  }, [fetchPermissions, open]);

  useEffect(() => {
    if (!open || !channel || !channelId) {
      return;
    }
    setChannelName(channel.name);
    setTopic(channel.topic ?? "");
    setSlowmodeSeconds(String(channel.slowmode_seconds ?? 0));
    setAgeRestricted(Boolean(channel.is_age_restricted));
    setHideAfterDays(String(channel.hide_after_days ?? 3));
    setPermissionDraft(buildPermissionDraft(scopedPermissions));
    setError(null);
    setSuccess(null);
  }, [channel, channelId, open, scopedPermissions]);

  function setPublicVisibility() {
    setPermissionDraft((current) => {
      const next = { ...current };
      for (const role of ORBIT_MEMBER_ROLES) {
        const defaults = getOrbitDefaultChannelPermissionFlags(role);
        const currentFlags = current[role];
        next[role] = {
          can_view: true,
          can_post: currentFlags.can_post || defaults.can_post,
          can_connect: currentFlags.can_connect || defaults.can_connect,
          can_manage: role === "ADMIN" ? true : currentFlags.can_manage,
        };
      }
      return next;
    });
  }

  function setPrivateVisibility() {
    setPermissionDraft((current) => ({
      ADMIN: {
        ...current.ADMIN,
        can_view: true,
        can_post: true,
        can_connect: true,
        can_manage: true,
      },
      MODERATOR: {
        ...current.MODERATOR,
        can_view: true,
      },
      GUEST: {
        ...current.GUEST,
        can_view: false,
        can_post: false,
        can_connect: false,
        can_manage: false,
      },
    }));
  }

  function togglePermission(role: MemberRole, field: keyof RolePermissionDraft[MemberRole]) {
    setPermissionDraft((current) => {
      const roleFlags = current[role];
      if (role === "ADMIN" && (field === "can_view" || field === "can_manage")) {
        return current;
      }

      const nextValue = !roleFlags[field];
      const nextRoleFlags = {
        ...roleFlags,
        [field]: nextValue,
      };

      if (field === "can_view" && !nextValue) {
        nextRoleFlags.can_post = false;
        nextRoleFlags.can_connect = false;
        nextRoleFlags.can_manage = false;
      }
      if ((field === "can_post" || field === "can_connect" || field === "can_manage") && nextValue) {
        nextRoleFlags.can_view = true;
      }
      if (role === "ADMIN") {
        nextRoleFlags.can_view = true;
        nextRoleFlags.can_manage = true;
      }

      return {
        ...current,
        [role]: nextRoleFlags,
      };
    });
  }

  async function saveSettings() {
    if (!channel || !serverId) {
      return;
    }
    if (!canManage) {
      setError("Only owner/staff with channel manage permission can edit settings.");
      return;
    }

    const trimmedName = channelName.trim();
    if (!trimmedName) {
      setError("Channel name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const updatePayload = {
      name: trimmedName,
      topic: topic.trim() || null,
      slowmode_seconds: parseSlowmode(slowmodeSeconds),
      is_age_restricted: ageRestricted,
      hide_after_days: parseHideAfterDays(hideAfterDays),
    };

    if (isLocalMode) {
      const nextChannel: OrbitChannel = {
        ...channel,
        ...updatePayload,
        updated_at: new Date().toISOString(),
      };
      upsertChannel(nextChannel);
      setOrbitLocalChannelPermissionOverrides(channel.id, permissionDraft);
      await fetchPermissions();
      setSuccess("Channel settings updated.");
      setSaving(false);
      return;
    }

    const channelResult = await supabase
      .from("channels")
      .update(updatePayload)
      .eq("id", channel.id)
      .eq("server_id", serverId)
      .select("*")
      .single();

    if (channelResult.error || !channelResult.data) {
      const message = channelResult.error?.message ?? "Unable to update channel settings.";
      if (
        /topic|slowmode_seconds|is_age_restricted|hide_after_days/i.test(message)
      ) {
        setError("Missing channel settings columns. Run Phase 14 migration first.");
      } else {
        setError(message);
      }
      setSaving(false);
      return;
    }

    const permissionRows = ORBIT_MEMBER_ROLES.map((role) => ({
      server_id: serverId,
      channel_id: channel.id,
      role,
      can_view: permissionDraft[role].can_view,
      can_post: permissionDraft[role].can_post,
      can_connect: permissionDraft[role].can_connect,
      can_manage: permissionDraft[role].can_manage,
      created_by: profile?.id ?? null,
    }));
    const permissionResult = await supabase
      .from("channel_role_permissions")
      .upsert(permissionRows, { onConflict: "channel_id,role" });

    if (permissionResult.error) {
      setError(permissionResult.error.message);
      setSaving(false);
      return;
    }

    upsertChannel(channelResult.data as OrbitChannel);
    await fetchPermissions();
    setSuccess("Channel settings updated.");
    setSaving(false);
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-violet-300" />
            Channel settings
          </DialogTitle>
          <DialogDescription>
            Control channel visibility, private/public state, and role permissions.
          </DialogDescription>
        </DialogHeader>

        {!channel ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
            Select a channel first.
          </div>
        ) : (
          <div className="space-y-3">
            {!canManage ? (
              <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Only owner/staff with manage permission can edit this channel.
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-full"
                onClick={() => setSection("OVERVIEW")}
                size="sm"
                type="button"
                variant={section === "OVERVIEW" ? "default" : "secondary"}
              >
                Overview
              </Button>
              <Button
                className="rounded-full"
                onClick={() => setSection("PERMISSIONS")}
                size="sm"
                type="button"
                variant={section === "PERMISSIONS" ? "default" : "secondary"}
              >
                <ShieldCheck className="h-4 w-4" />
                Permissions
              </Button>
            </div>

            <ScrollArea className="max-h-[58vh] pr-2">
              {section === "OVERVIEW" ? (
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Channel name
                    </p>
                    <Input
                      disabled={!canManage}
                      onChange={(event) => setChannelName(event.target.value)}
                      placeholder="channel-name"
                      value={channelName}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Channel topic
                    </p>
                    <Textarea
                      className="min-h-24"
                      disabled={!canManage}
                      maxLength={1024}
                      onChange={(event) => setTopic(event.target.value)}
                      placeholder="Describe this channel rules and purpose..."
                      value={topic}
                    />
                    <p className="text-[11px] text-zinc-500">{topic.length}/1024</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Visibility mode
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="rounded-full"
                        disabled={!canManage}
                        onClick={setPublicVisibility}
                        size="sm"
                        type="button"
                        variant={!privateChannel ? "default" : "secondary"}
                      >
                        Public channel
                      </Button>
                      <Button
                        className="rounded-full"
                        disabled={!canManage}
                        onClick={setPrivateVisibility}
                        size="sm"
                        type="button"
                        variant={privateChannel ? "default" : "secondary"}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Private channel
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                      Private channel hides it from Guest role unless explicitly enabled.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Slowmode</p>
                      <select
                        className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-zinc-200 outline-none"
                        disabled={!canManage}
                        onChange={(event) => setSlowmodeSeconds(event.target.value)}
                        value={slowmodeSeconds}
                      >
                        <option value="0">Off</option>
                        <option value="5">5 seconds</option>
                        <option value="10">10 seconds</option>
                        <option value="30">30 seconds</option>
                        <option value="60">1 minute</option>
                        <option value="120">2 minutes</option>
                        <option value="300">5 minutes</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                        Hide after inactivity
                      </p>
                      <select
                        className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-zinc-200 outline-none"
                        disabled={!canManage}
                        onChange={(event) => setHideAfterDays(event.target.value)}
                        value={hideAfterDays}
                      >
                        <option value="1">1 day</option>
                        <option value="3">3 days</option>
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Age restricted channel
                    </p>
                    <Button
                      className="rounded-full"
                      disabled={!canManage}
                      onClick={() => setAgeRestricted((current) => !current)}
                      size="sm"
                      type="button"
                      variant={ageRestricted ? "default" : "secondary"}
                    >
                      {ageRestricted ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-zinc-400">
                    Control exactly who can view/post/connect in this channel.
                  </p>
                  {ORBIT_MEMBER_ROLES.map((role) => (
                    <article className="rounded-xl border border-white/10 bg-black/30 p-3" key={role}>
                      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-300">{role}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            { key: "can_view", label: "View" },
                            { key: "can_post", label: "Post" },
                            { key: "can_connect", label: "Connect" },
                            { key: "can_manage", label: "Manage" },
                          ] as Array<{
                            key: keyof RolePermissionDraft[MemberRole];
                            label: string;
                          }>
                        ).map((entry) => {
                          const selected = permissionDraft[role][entry.key];
                          const locked = role === "ADMIN" && (entry.key === "can_view" || entry.key === "can_manage");
                          return (
                            <Button
                              className="h-8 rounded-lg"
                              disabled={!canManage || locked}
                              key={entry.key}
                              onClick={() => togglePermission(role, entry.key)}
                              size="sm"
                              type="button"
                              variant={selected ? "default" : "secondary"}
                            >
                              {entry.label}
                            </Button>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {error ? (
          <p className="rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {success}
          </p>
        ) : null}

        <DialogFooter>
          {channel ? (
            <Button
              className="rounded-full"
              disabled={saving || !canManage}
              onClick={() => void saveSettings()}
              type="button"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Save channel settings
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
