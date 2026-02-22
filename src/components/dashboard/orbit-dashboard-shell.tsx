"use client";

import { CSSProperties, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import {
  Download,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Menu,
  Orbit,
  PanelRight,
  Settings2,
  Sparkles,
  Users,
  UserPlus,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SwipeDismissable } from "@/components/ui/swipe-dismissable";
import { OrbitIncomingCallModal } from "@/src/components/calls/orbit-incoming-call-modal";
import { OrbitModals } from "@/src/components/modals/orbit-modals";
import { OrbitWelcomeTutorial } from "@/src/components/onboarding/orbit-welcome-tutorial";
import { ChannelSidebar } from "@/src/components/sidebar/channel-sidebar";
import { MembersSidebar } from "@/src/components/sidebar/members-sidebar";
import { ServerSidebar } from "@/src/components/sidebar/server-sidebar";
import { OrbitSocialProvider } from "@/src/context/orbit-social-context";
import { useModal } from "@/src/hooks/use-modal";
import { useOrbitInstallPrompt } from "@/src/hooks/use-orbit-install-prompt";
import { useOrbitLocale } from "@/src/hooks/use-orbit-locale";
import { useOrbitThemeEngine } from "@/src/hooks/use-orbit-theme-engine";
import { useOrbitSocial } from "@/src/hooks/use-orbit-social";
import { useOrbitWorkspace } from "@/src/hooks/use-orbit-workspace";
import { ensureNotificationPermission } from "@/src/lib/orbit-notifications";
import {
  getOrbitSupabaseClient,
  isSupabaseReady,
  setForcedLocalMode,
} from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";

interface OrbitDashboardShellProps {
  children: ReactNode;
}

const OrbitCommandPalette = dynamic(
  () =>
    import("@/src/components/search/orbit-command-palette").then(
      (mod) => mod.OrbitCommandPalette,
    ),
  { ssr: false },
);

export function OrbitDashboardShell({ children }: OrbitDashboardShellProps) {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const router = useRouter();
  const isLocalMode = !isSupabaseReady();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { onOpen } = useModal();
  const { t } = useOrbitLocale();
  useOrbitThemeEngine();
  const { canInstall, triggerInstall } = useOrbitInstallPrompt();
  const {
    activeView,
    activeServerId,
    activeChannelId,
    activeDmThreadId,
    profile,
    servers,
    channelsByServer,
    dmConversations,
    mobilePanels,
    setMobilePanelOpen,
    privacyMode,
    togglePrivacyMode,
  } = useOrbitNavStore(
    useShallow((state) => ({
      activeView: state.activeView,
      activeServerId: state.activeServerId,
      activeChannelId: state.activeChannelId,
      activeDmThreadId: state.activeDmThreadId,
      profile: state.profile,
      servers: state.servers,
      channelsByServer: state.channelsByServer,
      dmConversations: state.dmConversations,
      mobilePanels: state.mobilePanels,
      setMobilePanelOpen: state.setMobilePanelOpen,
      privacyMode: state.privacyMode,
      togglePrivacyMode: state.togglePrivacyMode,
    })),
  );
  const workspaceUser = isLocalMode ? null : (session?.user ?? null);
  const { loadingServers, createServer, createChannel, joinServerByInvite } =
    useOrbitWorkspace(workspaceUser);
  const social = useOrbitSocial(workspaceUser);
  const navSummary = useMemo(() => {
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
    const activeChannels = activeServerId ? channelsByServer[activeServerId] ?? [] : [];
    const activeChannel = activeChannels.find(
      (channel) => channel.id === activeChannelId,
    );

    return {
      activeServerName: activeServer?.name ?? "Unified Space",
      activeChannelName: activeChannel?.name ?? "general",
    };
  }, [
    activeChannelId,
    activeDmThreadId,
    activeServerId,
    activeView,
    channelsByServer,
    dmConversations,
    servers,
  ]);
  const serverCount = servers.length;
  const showMembersRail = activeView === "SERVER" && Boolean(activeServerId);
  const dashboardBackgroundStyle = useMemo<CSSProperties | undefined>(() => {
    const customBackground = profile?.active_background_css?.trim();
    if (!customBackground) {
      return undefined;
    }

    return { background: customBackground };
  }, [profile?.active_background_css]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const localParam = new URLSearchParams(window.location.search).get("local");
    if (localParam === "1") {
      setForcedLocalMode(true);
      return;
    }
    if (localParam === "0") {
      setForcedLocalMode(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseReady()) {
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session) {
      return;
    }
    void ensureNotificationPermission();
  }, [session]);

  async function signOut() {
    if (isLocalMode) {
      router.push("/");
      return;
    }

    await supabase.auth.signOut();
    router.push("/auth");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06070b] text-violet-200">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!session && !isLocalMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06070b] px-4 text-white">
        <div className="glass-panel max-w-lg rounded-3xl p-8 text-center">
          <Orbit className="mx-auto mb-3 h-7 w-7 text-violet-300" />
          <h1 className="mb-2 text-2xl font-semibold">{t("dashboard.authenticationRequired")}</h1>
          <p className="mb-5 text-sm text-zinc-300">
            {t("dashboard.authenticationHelp")}
          </p>
          <Button asChild className="rounded-full px-6">
            <Link href="/auth">{t("dashboard.goToAuth")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#06070b] text-white"
      style={dashboardBackgroundStyle}
    >
      <div className="cosmic-grid absolute inset-0 opacity-35" />
      <div className="orb-blur absolute -left-20 top-16 h-80 w-80 bg-violet-500/30" />
      <div className="orb-blur absolute -right-24 bottom-0 h-96 w-96 bg-fuchsia-500/20" />

      <OrbitSocialProvider value={social}>
        <OrbitCommandPalette
          openOrCreateDmWithProfile={social.openOrCreateDmWithProfile}
        />
        <OrbitWelcomeTutorial
          onCreateSpace={() => onOpen("createServer")}
          onJoinSpace={() => onOpen("joinServer")}
          serverCount={serverCount}
        />
        <OrbitIncomingCallModal />

        <div className="relative mx-auto flex h-screen w-full max-w-[1700px] gap-4 p-4">
          <div className="hidden md:block">
            <ServerSidebar loading={loadingServers} />
          </div>
          <div className="hidden lg:block">
            <ChannelSidebar />
          </div>

          <section className="flex min-w-0 flex-1 flex-col gap-4">
            <header className="glass-panel flex h-[72px] items-center justify-between rounded-[1.75rem] px-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 md:hidden">
                  <Button
                    className="rounded-full"
                    onClick={() => setMobilePanelOpen("servers", true)}
                    size="icon"
                    variant="ghost"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                  <Button
                    className="rounded-full"
                    onClick={() => setMobilePanelOpen("context", true)}
                    size="icon"
                    variant="ghost"
                  >
                    <PanelRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                    {navSummary.activeServerName}
                  </p>
                  <p className="truncate text-lg font-semibold text-violet-100">
                    {activeView === "SERVER"
                      ? `#${navSummary.activeChannelName}`
                      : navSummary.activeChannelName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button
                  className="rounded-full"
                  onClick={() => togglePrivacyMode()}
                  size="icon"
                  title="Privacy Mode"
                  variant={privacyMode ? "secondary" : "ghost"}
                >
                  {privacyMode ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  className="rounded-full"
                  onClick={() => onOpen("joinServer")}
                  size="sm"
                  variant="outline"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("dashboard.join")}</span>
                </Button>
                <Button
                  className="rounded-full"
                  onClick={() => onOpen("settings")}
                  size="icon"
                  title="Orbit Settings"
                  variant="ghost"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
                {canInstall ? (
                  <Button
                    className="rounded-full"
                    onClick={() => void triggerInstall()}
                    size="icon"
                    title="Install Orbit App"
                    variant="ghost"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button className="hidden rounded-full sm:inline-flex" size="sm" variant="secondary">
                  <Sparkles className="h-4 w-4" />
                  Orbit AI Soon
                </Button>
                {isLocalMode ? (
                  <span className="hidden rounded-full border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-amber-100 sm:inline-flex">
                    Local browser mode
                  </span>
                ) : null}
                <Button className="rounded-full" onClick={() => void signOut()} size="icon" variant="ghost">
                  <LogOut className="h-4 w-4" />
                </Button>
                {showMembersRail ? (
                  <Button
                    className="rounded-full lg:hidden"
                    onClick={() => setMobilePanelOpen("members", true)}
                    size="icon"
                    variant="ghost"
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </header>

            <div className="glass-panel min-h-0 flex-1 overflow-auto rounded-[1.75rem] p-5">
              {children}
            </div>
          </section>

          {showMembersRail ? <MembersSidebar user={session?.user ?? null} /> : null}
        </div>

        <Dialog
          onOpenChange={(open) => setMobilePanelOpen("servers", open)}
          open={mobilePanels.servers}
        >
          <DialogContent className="h-[86vh] max-w-[95vw] p-0 md:hidden">
            <SwipeDismissable
              className="h-full"
              direction="right"
              onDismiss={() => setMobilePanelOpen("servers", false)}
            >
              <ServerSidebar
                loading={loadingServers}
                mobile
                onNavigate={() => setMobilePanelOpen("servers", false)}
              />
            </SwipeDismissable>
          </DialogContent>
        </Dialog>

        <Dialog
          onOpenChange={(open) => setMobilePanelOpen("context", open)}
          open={mobilePanels.context}
        >
          <DialogContent className="h-[86vh] max-w-[95vw] p-0 lg:hidden">
            <SwipeDismissable
              className="h-full"
              direction="right"
              onDismiss={() => setMobilePanelOpen("context", false)}
            >
              <ChannelSidebar
                mobile
                onNavigate={() => setMobilePanelOpen("context", false)}
              />
            </SwipeDismissable>
          </DialogContent>
        </Dialog>

        {showMembersRail ? (
          <Dialog
            onOpenChange={(open) => setMobilePanelOpen("members", open)}
            open={mobilePanels.members}
          >
            <DialogContent className="h-[86vh] max-w-[95vw] p-0 lg:hidden">
              <SwipeDismissable
                className="h-full"
                direction="right"
                onDismiss={() => setMobilePanelOpen("members", false)}
              >
                <MembersSidebar mobile user={session?.user ?? null} />
              </SwipeDismissable>
            </DialogContent>
          </Dialog>
        ) : null}

        <OrbitModals
          createChannel={createChannel}
          createServer={createServer}
          joinServerByInvite={joinServerByInvite}
        />
      </OrbitSocialProvider>
    </div>
  );
}
