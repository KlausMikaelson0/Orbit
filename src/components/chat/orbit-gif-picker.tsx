"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, Search, Sparkles, Sticker, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getOrbitLocalServerMediaAssets } from "@/src/lib/orbit-local-data";
import {
  ORBIT_OFFICIAL_GIFS,
  ORBIT_OFFICIAL_STICKERS,
  dedupeOrbitMediaItems,
  filterOrbitMediaItems,
  type OrbitMediaKind,
  type OrbitMediaPickerItem,
} from "@/src/lib/orbit-media-catalog";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import type { OrbitServerMediaAsset } from "@/src/types/orbit";

export interface OrbitGifResult extends OrbitMediaPickerItem {}

type OrbitGifPickerTab = "TRENDING" | "SEARCH" | "ORBIT" | "SERVER" | "STICKERS";

interface OrbitGiphyResponse {
  items?: OrbitMediaPickerItem[];
  error?: string;
}

const LOCAL_SERVER_MEDIA_STORAGE_KEY = "orbit_server_media_assets_local_v2";

interface OrbitGifPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectGif: (gif: OrbitGifResult) => Promise<void> | void;
  serverId?: string | null;
  canManageCustomMedia?: boolean;
}

function normalizeUrl(value: string) {
  return value.trim();
}

function isValidMediaUrl(value: string) {
  return /^https?:\/\/.+/i.test(value) || value.startsWith("/");
}

function mapServerMediaRowToPickerItem(row: OrbitServerMediaAsset): OrbitMediaPickerItem {
  return {
    id: row.id,
    title: row.title,
    url: row.media_url,
    preview_url: row.preview_url ?? row.media_url,
    width: null,
    height: null,
    mime_type: null,
    kind: row.kind,
    source: "SERVER",
  };
}

function loadLocalServerMediaMap(): Record<string, OrbitMediaPickerItem[]> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_SERVER_MEDIA_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, OrbitMediaPickerItem[]>;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveLocalServerMediaMap(map: Record<string, OrbitMediaPickerItem[]>) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LOCAL_SERVER_MEDIA_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore local storage failures.
  }
}

export function OrbitGifPicker({
  open,
  onOpenChange,
  onSelectGif,
  serverId = null,
  canManageCustomMedia = false,
}: OrbitGifPickerProps) {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<OrbitGifPickerTab>("TRENDING");
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteItems, setRemoteItems] = useState<OrbitMediaPickerItem[]>([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverItems, setServerItems] = useState<OrbitMediaPickerItem[]>([]);
  const [busyGifId, setBusyGifId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const [creatorOpen, setCreatorOpen] = useState(false);
  const [customKind, setCustomKind] = useState<OrbitMediaKind>("GIF");
  const [customTitle, setCustomTitle] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customPreviewUrl, setCustomPreviewUrl] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [creatingCustom, setCreatingCustom] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 240);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  useEffect(() => {
    if (!open || !serverId) {
      return;
    }

    setLoadingServer(true);
    setServerError(null);

    if (!isSupabaseReady()) {
      const localSeed = getOrbitLocalServerMediaAssets(serverId).map(mapServerMediaRowToPickerItem);
      const localMap = loadLocalServerMediaMap();
      const localCustom = localMap[serverId] ?? [];
      setServerItems(dedupeOrbitMediaItems([...localSeed, ...localCustom]));
      setLoadingServer(false);
      return;
    }

    void supabase
      .from("server_media_assets")
      .select("*")
      .eq("server_id", serverId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .then((result) => {
        if (result.error) {
          setServerError(result.error.message);
          setServerItems([]);
          setLoadingServer(false);
          return;
        }

        const rows = (result.data ?? []) as OrbitServerMediaAsset[];
        setServerItems(rows.map(mapServerMediaRowToPickerItem));
        setLoadingServer(false);
      })
      .catch(() => {
        setServerError("Unable to load custom server GIFs.");
        setServerItems([]);
        setLoadingServer(false);
      });
  }, [open, serverId, supabase]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (activeTab === "ORBIT" || activeTab === "SERVER") {
      setRemoteItems([]);
      setRemoteError(null);
      setLoadingRemote(false);
      return;
    }

    const abortController = new AbortController();
    setLoadingRemote(true);
    setRemoteError(null);

    const searchParams = new URLSearchParams();
    if (activeTab === "TRENDING") {
      searchParams.set("mode", "trending");
      searchParams.set("kind", "gif");
    } else if (activeTab === "SEARCH") {
      searchParams.set("mode", debouncedQuery ? "search" : "trending");
      searchParams.set("kind", "gif");
      if (debouncedQuery) {
        searchParams.set("q", debouncedQuery);
      }
    } else {
      searchParams.set("mode", debouncedQuery ? "search" : "trending");
      searchParams.set("kind", "sticker");
      if (debouncedQuery) {
        searchParams.set("q", debouncedQuery);
      }
    }
    searchParams.set("limit", "36");

    void fetch(`/api/giphy/search?${searchParams.toString()}`, {
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as OrbitGiphyResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to fetch GIFs.");
        }
        setRemoteItems((payload.items ?? []) as OrbitMediaPickerItem[]);
      })
      .catch((fetchError) => {
        if (abortController.signal.aborted) {
          return;
        }
        setRemoteItems([]);
        setRemoteError(fetchError instanceof Error ? fetchError.message : "Unable to fetch GIFs.");
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoadingRemote(false);
        }
      });

    return () => abortController.abort();
  }, [activeTab, debouncedQuery, open]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = debouncedQuery || query.trim();
    if (activeTab === "ORBIT") {
      return filterOrbitMediaItems(ORBIT_OFFICIAL_GIFS, normalizedQuery);
    }
    if (activeTab === "SERVER") {
      return filterOrbitMediaItems(
        serverItems.filter((item) => item.kind === "GIF"),
        normalizedQuery,
      );
    }
    if (activeTab === "STICKERS") {
      const serverStickers = serverItems.filter((item) => item.kind === "STICKER");
      const merged = dedupeOrbitMediaItems([
        ...ORBIT_OFFICIAL_STICKERS,
        ...serverStickers,
        ...remoteItems,
      ]);
      return filterOrbitMediaItems(merged, normalizedQuery);
    }
    return remoteItems;
  }, [activeTab, debouncedQuery, query, remoteItems, serverItems]);

  const subtitle = useMemo(() => {
    if (activeTab === "ORBIT") {
      return "Official Orbit GIF pack for your platform.";
    }
    if (activeTab === "SERVER") {
      return "Custom GIF library for this server.";
    }
    if (activeTab === "STICKERS") {
      return debouncedQuery ? `Sticker results for "${debouncedQuery}"` : "Trending stickers + Orbit stickers";
    }
    if (debouncedQuery && activeTab === "SEARCH") {
      return `Results for "${debouncedQuery}"`;
    }
    return "Trending GIFs";
  }, [activeTab, debouncedQuery]);

  async function submitCustomMedia() {
    if (!serverId || !canManageCustomMedia) {
      return;
    }

    const title = customTitle.trim();
    const url = normalizeUrl(customUrl);
    const preview = normalizeUrl(customPreviewUrl);
    if (!title) {
      setCustomError("Title is required.");
      return;
    }
    if (!isValidMediaUrl(url)) {
      setCustomError("Enter a valid media URL.");
      return;
    }
    if (preview && !isValidMediaUrl(preview)) {
      setCustomError("Enter a valid preview URL or leave it empty.");
      return;
    }

    setCreatingCustom(true);
    setCustomError(null);

    if (!isSupabaseReady()) {
      const map = loadLocalServerMediaMap();
      const newItem: OrbitMediaPickerItem = {
        id: `local-custom-${crypto.randomUUID().slice(0, 8)}`,
        title,
        url,
        preview_url: preview || url,
        width: null,
        height: null,
        mime_type: customKind === "GIF" ? "image/gif" : "image/webp",
        kind: customKind,
        source: "SERVER",
      };
      const nextRows = dedupeOrbitMediaItems([newItem, ...(map[serverId] ?? [])]);
      map[serverId] = nextRows;
      saveLocalServerMediaMap(map);
      setServerItems((current) => dedupeOrbitMediaItems([newItem, ...current]));
      setCustomTitle("");
      setCustomUrl("");
      setCustomPreviewUrl("");
      setCreatingCustom(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setCustomError(userError?.message ?? "You must be signed in.");
      setCreatingCustom(false);
      return;
    }

    const { data, error } = await supabase
      .from("server_media_assets")
      .insert({
        server_id: serverId,
        kind: customKind,
        title,
        media_url: url,
        preview_url: preview || null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error || !data) {
      setCustomError(
        error?.message ??
          "Unable to save custom media. Ensure media migration is applied.",
      );
      setCreatingCustom(false);
      return;
    }

    setServerItems((current) =>
      dedupeOrbitMediaItems([mapServerMediaRowToPickerItem(data as OrbitServerMediaAsset), ...current]),
    );
    setCustomTitle("");
    setCustomUrl("");
    setCustomPreviewUrl("");
    setCreatingCustom(false);
  }

  async function removeCustomMedia(item: OrbitMediaPickerItem) {
    if (!serverId || item.source !== "SERVER" || !canManageCustomMedia) {
      return;
    }

    setDeleteBusyId(item.id);
    if (!isSupabaseReady()) {
      const map = loadLocalServerMediaMap();
      map[serverId] = (map[serverId] ?? []).filter((row) => row.id !== item.id);
      saveLocalServerMediaMap(map);
      setServerItems((current) => current.filter((row) => row.id !== item.id));
      setDeleteBusyId(null);
      return;
    }

    const { error } = await supabase
      .from("server_media_assets")
      .update({ is_active: false })
      .eq("id", item.id)
      .eq("server_id", serverId);

    if (!error) {
      setServerItems((current) => current.filter((row) => row.id !== item.id));
    }
    setDeleteBusyId(null);
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-3xl overflow-hidden rounded-2xl border-white/10 bg-[#0a0b13] p-0 text-zinc-100">
        <DialogHeader className="border-b border-white/10 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-violet-300" />
            Orbit Media Picker
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3">
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                { key: "TRENDING", label: "Trending", icon: Sparkles },
                { key: "SEARCH", label: "Search", icon: Search },
                { key: "ORBIT", label: "Orbit GIF Pack", icon: Wand2 },
                { key: "SERVER", label: "Server GIFs", icon: Sparkles },
                { key: "STICKERS", label: "Stickers", icon: Sticker },
              ] as Array<{ key: OrbitGifPickerTab; label: string; icon: typeof Sparkles }>
            ).map((tab) => (
              <Button
                className="h-8 rounded-full"
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                size="sm"
                type="button"
                variant={activeTab === tab.key ? "default" : "secondary"}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              className="h-10 rounded-xl border-white/10 bg-black/35 pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search GIFs..."
              value={query}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">{subtitle}</p>
          {activeTab === "SERVER" || activeTab === "STICKERS" ? (
            <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2">
              {!serverId ? (
                <p className="text-xs text-zinc-400">
                  Open a server channel to load custom server GIFs and stickers.
                </p>
              ) : canManageCustomMedia ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-zinc-300">
                      Server owners/admins can add custom GIFs and stickers.
                    </p>
                    <Button
                      className="h-7 rounded-full"
                      onClick={() => setCreatorOpen((value) => !value)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {creatorOpen ? "Hide creator" : "Add custom media"}
                    </Button>
                  </div>
                  {creatorOpen ? (
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <Input
                        onChange={(event) => setCustomTitle(event.target.value)}
                        placeholder="Title"
                        value={customTitle}
                      />
                      <select
                        className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none"
                        onChange={(event) => setCustomKind(event.target.value as OrbitMediaKind)}
                        value={customKind}
                      >
                        <option value="GIF">GIF</option>
                        <option value="STICKER">Sticker</option>
                      </select>
                      <Input
                        className="md:col-span-2"
                        onChange={(event) => setCustomUrl(event.target.value)}
                        placeholder="Media URL (https://...)"
                        value={customUrl}
                      />
                      <Input
                        className="md:col-span-2"
                        onChange={(event) => setCustomPreviewUrl(event.target.value)}
                        placeholder="Preview URL (optional)"
                        value={customPreviewUrl}
                      />
                      <div className="md:col-span-2">
                        <Button
                          className="rounded-full"
                          disabled={creatingCustom}
                          onClick={() => void submitCustomMedia()}
                          size="sm"
                          type="button"
                        >
                          {creatingCustom ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Save custom media
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {customError ? (
                    <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
                      {customError}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-zinc-400">
                  You can use server custom media, but only owner/admin can manage it.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <ScrollArea className="h-[55vh] px-4 pb-4">
          {loadingRemote || loadingServer ? (
            <div className="flex h-32 items-center justify-center text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : null}

          {remoteError ? (
            <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {remoteError}
            </p>
          ) : null}
          {serverError ? (
            <p className="mt-2 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {serverError}
            </p>
          ) : null}

          {!loadingRemote && !remoteError ? (
            <div className="grid grid-cols-2 gap-3 pb-3 md:grid-cols-3">
              {visibleItems.map((gif) => (
                <button
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/35 text-left transition hover:border-violet-400/35"
                  disabled={busyGifId === gif.id || deleteBusyId === gif.id}
                  key={`${gif.source}:${gif.id}:${gif.kind}`}
                  onClick={async () => {
                    setBusyGifId(gif.id);
                    try {
                      await onSelectGif(gif);
                    } finally {
                      setBusyGifId(null);
                    }
                  }}
                  type="button"
                >
                  <Image
                    alt={gif.title}
                    className="h-36 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    height={gif.height ?? 360}
                    src={gif.preview_url}
                    unoptimized
                    width={gif.width ?? 360}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                    <p className="truncate text-[11px] text-zinc-100">{gif.title}</p>
                    <p className="truncate text-[10px] uppercase tracking-wide text-zinc-300/80">
                      {gif.source} · {gif.kind}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
          {canManageCustomMedia && serverId ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {visibleItems
                .filter((item) => item.source === "SERVER")
                .slice(0, 12)
                .map((item) => (
                  <Button
                    className="h-7 rounded-full"
                    disabled={deleteBusyId === item.id}
                    key={`delete:${item.id}`}
                    onClick={() => void removeCustomMedia(item)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {deleteBusyId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Remove {item.title}
                  </Button>
                ))}
            </div>
          ) : null}

          {!loadingRemote && !remoteError && visibleItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-zinc-500">
              No media found for this tab.
            </div>
          ) : null}
        </ScrollArea>

        <div className="border-t border-white/10 px-4 py-3">
          <Button className="rounded-full" onClick={() => onOpenChange(false)} variant="ghost">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
