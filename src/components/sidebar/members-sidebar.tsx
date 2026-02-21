"use client";

import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Bot, MoreHorizontal, ShieldCheck, Users } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrbitMembers } from "@/src/hooks/use-orbit-members";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type { MemberRole, OrbitMemberWithProfile } from "@/src/types/orbit";

interface MembersSidebarProps {
  user: User | null;
  mobile?: boolean;
}

const roleColor: Record<MemberRole, string> = {
  ADMIN: "text-rose-300",
  MODERATOR: "text-sky-300",
  GUEST: "text-zinc-200",
};

function roleLabel(role: MemberRole) {
  if (role === "ADMIN") return "Admin";
  if (role === "MODERATOR") return "Moderator";
  return "Guest";
}

export function MembersSidebar({ user, mobile = false }: MembersSidebarProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const { activeServerId, activeServerOwnerId } = useOrbitNavStore(
    useShallow((state) => ({
      activeServerId: state.activeServerId,
      activeServerOwnerId:
        state.servers.find((server) => server.id === state.activeServerId)?.owner_id ?? null,
    })),
  );
  const { members, bot, loading, isAdmin, kickMember, banMember, updateMemberRole } = useOrbitMembers(
    user,
    activeServerId,
  );

  const onlineMembers = useMemo(
    () => members.filter((member) => member.online),
    [members],
  );
  const offlineMembers = useMemo(
    () => members.filter((member) => !member.online),
    [members],
  );

  async function onKick(member: OrbitMemberWithProfile) {
    setActionError(null);
    const result = await kickMember(member.member.id);
    if (result.error) {
      setActionError(result.error);
    }
  }

  async function onBan(member: OrbitMemberWithProfile) {
    setActionError(null);
    const result = await banMember(member.member.id, member.member.profile_id);
    if (result.error) {
      setActionError(result.error);
    }
  }

  async function onUpdateRole(member: OrbitMemberWithProfile, nextRole: MemberRole) {
    setActionError(null);
    const result = await updateMemberRole(member.member.id, nextRole);
    if (result.error) {
      setActionError(result.error);
    }
  }

  return (
    <aside
      className={`glass-panel h-full shrink-0 rounded-[1.75rem] border border-white/10 p-3 ${
        mobile ? "w-full" : "hidden w-[320px] xl:block"
      }`}
    >
      <div className="mb-3 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-violet-200">Members</p>
        <div className="mt-1 flex items-center gap-2 text-violet-100">
          <Users className="h-4 w-4" />
          <p className="text-sm font-semibold">
            {onlineMembers.length} online · {members.length} total
          </p>
        </div>
      </div>

      {actionError ? (
        <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {actionError}
        </p>
      ) : null}

      <ScrollArea className="h-[calc(100%-5.5rem)]">
        {bot ? <OrbitBotRow name={bot.name} /> : null}
        <MemberSection
          ownerId={activeServerOwnerId}
          isAdmin={isAdmin}
          label={`Online — ${onlineMembers.length}`}
          members={onlineMembers}
          onBan={onBan}
          onKick={onKick}
          onUpdateRole={onUpdateRole}
          viewerId={user?.id ?? null}
        />
        <MemberSection
          ownerId={activeServerOwnerId}
          isAdmin={isAdmin}
          label={`Offline — ${offlineMembers.length}`}
          members={offlineMembers}
          onBan={onBan}
          onKick={onKick}
          onUpdateRole={onUpdateRole}
          viewerId={user?.id ?? null}
        />

        {loading ? (
          <div className="space-y-2 px-1 py-2">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        ) : null}
      </ScrollArea>
    </aside>
  );
}

function OrbitBotRow({ name }: { name: string }) {
  return (
    <section className="mb-4">
      <p className="mb-2 px-1 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
        Automation
      </p>
      <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-2 py-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-cyan-500/20 p-1.5 text-cyan-200">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-cyan-100">{name}</p>
              <p className="text-[11px] text-cyan-200/80">AI moderation online</p>
            </div>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
      </div>
    </section>
  );
}

interface MemberSectionProps {
  label: string;
  members: OrbitMemberWithProfile[];
  isAdmin: boolean;
  ownerId: string | null;
  viewerId: string | null;
  onKick: (member: OrbitMemberWithProfile) => Promise<void>;
  onBan: (member: OrbitMemberWithProfile) => Promise<void>;
  onUpdateRole: (member: OrbitMemberWithProfile, nextRole: MemberRole) => Promise<void>;
}

function MemberSection({
  label,
  members,
  isAdmin,
  ownerId,
  viewerId,
  onKick,
  onBan,
  onUpdateRole,
}: MemberSectionProps) {
  if (!members.length) {
    return null;
  }

  return (
    <section className="mb-4">
      <p className="mb-2 px-1 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <div className="space-y-1">
        {members.map((row) => {
          const displayName =
            row.profile?.full_name ?? row.profile?.username ?? "Unknown Member";
          const isOwnerRow = ownerId === row.member.profile_id;
          const canManage = isAdmin && !isOwnerRow && viewerId !== row.member.profile_id;

          return (
            <div
              className="group flex items-center justify-between rounded-xl px-2 py-1.5 transition hover:bg-white/[0.06]"
              key={row.member.id}
            >
              <div className="min-w-0 flex items-center gap-2">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    alt={displayName}
                    src={row.profile?.avatar_url ?? undefined}
                  />
                  <AvatarFallback className="rounded-lg bg-violet-500/25 text-[11px] text-violet-100">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${roleColor[row.member.role]}`}>
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-zinc-400">{roleLabel(row.member.role)}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {row.member.role !== "GUEST" ? (
                  <ShieldCheck className="h-4 w-4 text-violet-300" />
                ) : null}
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    row.online ? "bg-emerald-400" : "bg-zinc-600"
                  }`}
                />
                {canManage ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="h-7 w-7 rounded-lg opacity-0 transition group-hover:opacity-100"
                        size="icon"
                        variant="ghost"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Manage member</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {row.member.role !== "ADMIN" ? (
                        <DropdownMenuItem onClick={() => void onUpdateRole(row, "ADMIN")}>
                          Set as Admin
                        </DropdownMenuItem>
                      ) : null}
                      {row.member.role !== "MODERATOR" ? (
                        <DropdownMenuItem onClick={() => void onUpdateRole(row, "MODERATOR")}>
                          Set as Moderator
                        </DropdownMenuItem>
                      ) : null}
                      {row.member.role !== "GUEST" ? (
                        <DropdownMenuItem onClick={() => void onUpdateRole(row, "GUEST")}>
                          Set as Guest
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => void onKick(row)}>
                        Kick from server
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => void onBan(row)}
                        variant="destructive"
                      >
                        Ban member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
