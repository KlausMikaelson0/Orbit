"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { FileText, Loader2, Orbit } from "lucide-react";
import remarkGfm from "remark-gfm";
import { useShallow } from "zustand/react/shallow";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime, getConversationKey, isImageAttachment, isPdfAttachment } from "@/lib/utils";
import { extractOrbitUrls, fetchOrbitLinkPreview } from "@/src/lib/orbit-link-preview";
import { scoreOrbitToxicity } from "@/src/lib/orbit-bot";
import {
  notifyOrbitMessage,
  playOrbitPingSound,
} from "@/src/lib/orbit-notifications";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type { OrbitLinkPreview, OrbitMessage, OrbitMessageView } from "@/src/types/orbit";

interface ChatMessagesProps {
  mode: "channel" | "dm";
  conversationId: string | null;
  threadParentId?: string | null;
  useCacheOnly?: boolean;
  onOpenThread?: (message: OrbitMessageView) => void;
}

const EMPTY_MESSAGES: OrbitMessageView[] = [];

export function ChatMessages({
  mode,
  conversationId,
  threadParentId = null,
  useCacheOnly = false,
  onOpenThread,
}: ChatMessagesProps) {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const [loading, setLoading] = useState(false);
  const [linkPreviewByUrl, setLinkPreviewByUrl] = useState<
    Record<string, OrbitLinkPreview | null>
  >({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const conversationKey = getConversationKey(mode, conversationId);

  const { ownProfileId, messages, setMessages, removeMessage } =
    useOrbitNavStore(
      useShallow((state) => ({
        ownProfileId: state.profile?.id ?? null,
        messages: conversationKey
          ? state.messageCache[conversationKey] ?? EMPTY_MESSAGES
          : EMPTY_MESSAGES,
        setMessages: state.setMessages,
        removeMessage: state.removeMessage,
      })),
    );

  const hydrateChannelRows = useCallback((rows: unknown[]) => {
    return rows.map((row) => {
      const source = row as {
        id: string;
        content: string | null;
        file_url: string | null;
        member_id: string;
        channel_id: string;
        thread_parent_id: string | null;
        created_at: string;
        updated_at: string;
        member?: {
          id: string;
          role: "ADMIN" | "MODERATOR" | "GUEST";
          profile_id: string;
          server_id: string;
          created_at: string;
          updated_at: string;
          profile?: {
            id: string;
            username: string | null;
            tag: string | null;
            full_name: string | null;
            avatar_url: string | null;
            created_at: string;
            updated_at: string;
          } | null;
        } | null;
      };

      return {
        id: source.id,
        content: source.content,
        file_url: source.file_url,
        member_id: source.member_id,
        channel_id: source.channel_id,
        profile_id: source.member?.profile_id ?? null,
        thread_id: null,
        thread_parent_id: source.thread_parent_id ?? null,
        created_at: source.created_at,
        updated_at: source.updated_at,
        author: {
          member: source.member ?? null,
          profile: source.member?.profile ?? null,
        },
      } satisfies OrbitMessageView;
    });
  }, []);

  const hydrateDmRows = useCallback((rows: unknown[]) => {
    return rows.map((row) => {
      const source = row as {
        id: string;
        content: string | null;
        file_url: string | null;
        profile_id: string;
        thread_id: string;
        created_at: string;
        updated_at: string;
        profile?: {
          id: string;
          username: string | null;
          tag: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        } | null;
      };

      return {
        id: source.id,
        content: source.content,
        file_url: source.file_url,
        member_id: null,
        channel_id: null,
        profile_id: source.profile_id,
        thread_id: source.thread_id,
        thread_parent_id: null,
        created_at: source.created_at,
        updated_at: source.updated_at,
        author: {
          member: null,
          profile: source.profile ?? null,
        },
      } satisfies OrbitMessageView;
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !conversationKey) {
      return;
    }

    setLoading(true);

    if (mode === "channel") {
      const { data } = await supabase
        .from("messages")
        .select(
          "id, content, file_url, member_id, channel_id, thread_parent_id, created_at, updated_at, member:members(id, role, profile_id, server_id, created_at, updated_at, profile:profiles(id, username, tag, full_name, avatar_url, created_at, updated_at))",
        )
        .eq("channel_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(300);

      setMessages(conversationKey, hydrateChannelRows(data ?? []));
    } else {
      const { data } = await supabase
        .from("dm_messages")
        .select(
          "id, content, file_url, profile_id, thread_id, created_at, updated_at, profile:profiles(id, username, tag, full_name, avatar_url, created_at, updated_at)",
        )
        .eq("thread_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(300);

      setMessages(conversationKey, hydrateDmRows(data ?? []));
    }

    setLoading(false);
  }, [
    conversationId,
    conversationKey,
    hydrateChannelRows,
    hydrateDmRows,
    mode,
    setMessages,
    supabase,
  ]);

  const notifyIfIncoming = useCallback(
    async (message: OrbitMessageView) => {
      if (!ownProfileId) {
        return;
      }

      if (mode === "dm") {
        return;
      }

      const authorId = message.profile_id ?? message.author.profile?.id ?? null;
      if (!authorId || authorId === ownProfileId) {
        return;
      }

      const notFocused = document.visibilityState !== "visible";
      if (notFocused) {
        playOrbitPingSound();
        const title = "New channel message";
        const body = message.content ?? "Sent an attachment";
        await notifyOrbitMessage(title, body);
      }
    },
    [mode, ownProfileId],
  );

  useEffect(() => {
    if (!isSupabaseReady() || !conversationId || useCacheOnly) {
      return;
    }

    void fetchMessages();
  }, [conversationId, fetchMessages, useCacheOnly]);

  useEffect(() => {
    if (!isSupabaseReady() || !conversationId || !conversationKey || useCacheOnly) {
      return;
    }

    if (mode === "channel") {
      const realtimeChannel = supabase
        .channel(`orbit-messages-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `channel_id=eq.${conversationId}`,
          },
          () => {
            void (async () => {
              await fetchMessages();
              const latest =
                useOrbitNavStore.getState().messageCache[conversationKey]?.slice(-1)[0] ?? null;
              if (latest) {
                await notifyIfIncoming(latest);
              }
            })();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `channel_id=eq.${conversationId}`,
          },
          () => void fetchMessages(),
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `channel_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.old as OrbitMessage;
            removeMessage(conversationKey, row.id);
          },
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(realtimeChannel);
      };
    }

    const realtimeDm = supabase
      .channel(`orbit-dm-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
          filter: `thread_id=eq.${conversationId}`,
        },
        () => {
          void (async () => {
            await fetchMessages();
            const latest =
              useOrbitNavStore.getState().messageCache[conversationKey]?.slice(-1)[0] ?? null;
            if (latest) {
              await notifyIfIncoming(latest);
            }
          })();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dm_messages",
          filter: `thread_id=eq.${conversationId}`,
        },
        () => void fetchMessages(),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "dm_messages",
          filter: `thread_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.old as OrbitMessage;
          removeMessage(conversationKey, row.id);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(realtimeDm);
    };
  }, [
    conversationId,
    conversationKey,
    fetchMessages,
    mode,
    notifyIfIncoming,
    removeMessage,
    supabase,
    useCacheOnly,
  ]);

  const threadReplyCountByMessageId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const message of messages) {
      if (!message.thread_parent_id) {
        continue;
      }
      counts.set(
        message.thread_parent_id,
        (counts.get(message.thread_parent_id) ?? 0) + 1,
      );
    }
    return counts;
  }, [messages]);

  const visibleMessages = useMemo(() => {
    if (mode !== "channel") {
      return messages;
    }

    if (threadParentId) {
      const root = messages.find((message) => message.id === threadParentId) ?? null;
      const replies = messages.filter(
        (message) => message.thread_parent_id === threadParentId,
      );
      return root ? [root, ...replies] : replies;
    }

    return messages.filter((message) => !message.thread_parent_id);
  }, [messages, mode, threadParentId]);

  const moderationSignals = useMemo(() => {
    const signals = new Map<string, { score: number; reason: string }>();
    for (const message of visibleMessages) {
      const toxicity = scoreOrbitToxicity(message.content);
      if (toxicity.flagged) {
        signals.set(message.id, {
          score: toxicity.score,
          reason: toxicity.reason,
        });
      }
    }
    return signals;
  }, [visibleMessages]);

  const firstUrlByMessageId = useMemo(() => {
    const mapping = new Map<string, string | null>();
    for (const message of visibleMessages) {
      mapping.set(message.id, extractOrbitUrls(message.content)[0] ?? null);
    }
    return mapping;
  }, [visibleMessages]);

  useEffect(() => {
    const urlsToFetch = new Set<string>();
    for (const url of firstUrlByMessageId.values()) {
      if (!url) {
        continue;
      }
      if (!(url in linkPreviewByUrl)) {
        urlsToFetch.add(url);
      }
    }
    if (!urlsToFetch.size) {
      return;
    }

    let cancelled = false;
    for (const url of urlsToFetch) {
      void fetchOrbitLinkPreview(url).then((preview) => {
        if (cancelled) {
          return;
        }
        setLinkPreviewByUrl((current) => {
          if (url in current) {
            return current;
          }
          return {
            ...current,
            [url]: preview,
          };
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [firstUrlByMessageId, linkPreviewByUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [visibleMessages.length]);

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-4">
        <p className="text-sm text-zinc-400">Select a channel or DM to start messaging.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full rounded-2xl border border-white/10 bg-black/20">
      <div className="space-y-1 p-3">
        {visibleMessages.map((message) => {
          const displayName =
            message.author.profile?.full_name ??
            message.author.profile?.username ??
            "Unknown";
          const replyCount = threadReplyCountByMessageId.get(message.id) ?? 0;
          const signal = moderationSignals.get(message.id) ?? null;
          const isThreadRoot = threadParentId === message.id;
          const isReply = Boolean(message.thread_parent_id);
          const firstUrl = firstUrlByMessageId.get(message.id) ?? null;
          const linkPreview = firstUrl ? linkPreviewByUrl[firstUrl] : null;

          return (
            <article
              className={`rounded-xl px-3 py-2 transition ${
                message.optimistic ? "bg-violet-500/10" : "hover:bg-white/[0.04]"
              }`}
              key={message.id}
            >
              <div className="mb-1 flex items-center gap-2">
                <Avatar className="h-7 w-7 rounded-lg">
                  <AvatarImage
                    alt={displayName}
                    src={message.author.profile?.avatar_url ?? undefined}
                  />
                  <AvatarFallback className="rounded-lg bg-violet-500/25 text-[11px] text-violet-100">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium text-violet-100">{displayName}</p>
                <p className="text-[11px] text-zinc-500">{formatTime(message.created_at)}</p>
                {message.optimistic ? (
                  <span className="rounded-full border border-violet-300/35 px-2 py-0.5 text-[10px] text-violet-200">
                    Sending
                  </span>
                ) : null}
                {isThreadRoot ? (
                  <span className="rounded-full border border-sky-400/35 px-2 py-0.5 text-[10px] text-sky-200">
                    Thread root
                  </span>
                ) : null}
                {isReply ? (
                  <span className="rounded-full border border-sky-400/35 px-2 py-0.5 text-[10px] text-sky-200">
                    Reply
                  </span>
                ) : null}
                {signal ? (
                  <span
                    className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200"
                    title={signal.reason}
                  >
                    Orbit-Bot flagged ({Math.round(signal.score * 100)}%)
                  </span>
                ) : null}
              </div>

              {message.content ? (
                <div className="text-sm leading-relaxed text-zinc-200 [&_a]:text-violet-300 [&_code]:rounded [&_code]:bg-white/[0.08] [&_code]:px-1 [&_code]:py-0.5 [&_ol]:list-inside [&_ol]:list-decimal [&_p]:mb-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-black/35 [&_pre]:p-2 [&_ul]:list-inside [&_ul]:list-disc">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : null}
              {firstUrl ? (
                <LinkPreviewCard
                  preview={linkPreview}
                  url={firstUrl}
                />
              ) : null}
              {message.file_url ? <AttachmentPreview message={message} /> : null}

              {mode === "channel" && !threadParentId && onOpenThread && !isReply ? (
                <button
                  className="mt-2 inline-flex rounded-full border border-sky-400/35 px-2.5 py-1 text-[11px] text-sky-200 transition hover:bg-sky-500/10"
                  onClick={() => onOpenThread(message)}
                  type="button"
                >
                  Reply in thread{replyCount > 0 ? ` (${replyCount})` : ""}
                </button>
              ) : null}
            </article>
          );
        })}

        {loading && visibleMessages.length === 0 ? (
          <div className="space-y-2 py-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading messages...
            </div>
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : null}

        {!loading && visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-zinc-400">
            <Orbit className="h-6 w-6 text-violet-300" />
            <p className="text-sm">
              {threadParentId
                ? "No replies yet. Start the thread."
                : "No messages yet. Say hello to your crew."}
            </p>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}

function LinkPreviewCard({
  url,
  preview,
}: {
  url: string;
  preview: OrbitLinkPreview | null | undefined;
}) {
  if (preview === undefined) {
    return (
      <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-2">
        <Skeleton className="h-20 rounded-lg" />
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  let hostname = "link preview";
  try {
    hostname = new URL(preview.url || url).hostname;
  } catch {
    hostname = "link preview";
  }

  return (
    <a
      className="mt-2 block overflow-hidden rounded-xl border border-white/10 bg-black/30 transition hover:border-violet-400/35"
      href={preview.url || url}
      rel="noreferrer"
      target="_blank"
    >
      {preview.image ? (
        <Image
          alt={preview.title}
          className="h-36 w-full object-cover"
          height={360}
          src={preview.image}
          unoptimized
          width={720}
        />
      ) : null}
      <div className="space-y-1 p-3">
        <p className="line-clamp-1 text-sm font-semibold text-violet-100">{preview.title}</p>
        {preview.description ? (
          <p className="line-clamp-2 text-xs text-zinc-300">{preview.description}</p>
        ) : null}
        <p className="line-clamp-1 text-[11px] text-zinc-500">
          {preview.site_name ?? hostname}
        </p>
      </div>
    </a>
  );
}

function AttachmentPreview({ message }: { message: OrbitMessageView }) {
  const fileUrl = message.file_url;
  const attachmentName = message.attachment?.name ?? "Attachment";
  const isPending = fileUrl?.startsWith("pending://") ?? false;
  const resolvedUrl = isPending ? null : fileUrl;
  const isImage =
    isImageAttachment(resolvedUrl) || message.attachment?.mimeType.startsWith("image/");
  const isGif =
    /\.gif(\?.*)?$/i.test(resolvedUrl ?? "") || message.attachment?.mimeType === "image/gif";
  const isPdf =
    isPdfAttachment(resolvedUrl) || message.attachment?.mimeType === "application/pdf";

  if (!fileUrl) {
    return null;
  }

  if (isPending) {
    return (
      <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300">
        <FileText className="h-4 w-4 text-violet-300" />
        Uploading {attachmentName}
      </div>
    );
  }

  if (isImage) {
    return (
      <a href={resolvedUrl ?? ""} rel="noreferrer" target="_blank">
        <Image
          alt={attachmentName}
          className={`mt-2 max-h-72 w-auto rounded-xl border object-cover ${
            isGif
              ? "border-violet-400/25 bg-black/30 shadow-[0_8px_30px_rgba(124,58,237,0.22)]"
              : "border-white/10"
          }`}
          height={720}
          src={resolvedUrl ?? ""}
          unoptimized
          width={960}
        />
      </a>
    );
  }

  if (isPdf) {
    return (
      <a
        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-violet-200 hover:bg-white/[0.08]"
        href={resolvedUrl ?? ""}
        rel="noreferrer"
        target="_blank"
      >
        <FileText className="h-4 w-4" />
        Open PDF
      </a>
    );
  }

  return (
    <a
      className="mt-2 inline-flex text-xs text-violet-300 hover:text-violet-200"
      href={resolvedUrl ?? ""}
      rel="noreferrer"
      target="_blank"
    >
      Open attachment
    </a>
  );
}
