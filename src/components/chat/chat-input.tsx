"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { FileText, Image as ImageIcon, Loader2, Paperclip, SendHorizontal, Smile, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getConversationKey, isImageAttachment, isPdfAttachment } from "@/lib/utils";
import { OrbitEmojiPicker } from "@/src/components/chat/orbit-emoji-picker";
import { OrbitGifPicker, type OrbitGifResult } from "@/src/components/chat/orbit-gif-picker";
import {
  buildOrbitPollMarkdown,
  parseOrbitSlashCommand,
  requestOrbitSummary,
  scoreOrbitToxicity,
} from "@/src/lib/orbit-bot";
import { extractOrbitUrls, primeOrbitLinkPreview } from "@/src/lib/orbit-link-preview";
import { moderateOrbitImageFilename } from "@/src/lib/orbit-image-moderation";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type {
  OrbitAttachmentMeta,
  OrbitDmMessage,
  OrbitMember,
  OrbitMessageView,
  OrbitProfile,
} from "@/src/types/orbit";

interface ChatInputProps {
  mode: "channel" | "dm";
  conversationId: string | null;
  member: OrbitMember | null;
  profile: OrbitProfile | null;
  threadParentId?: string | null;
}

const EMPTY_CACHED_MESSAGES: OrbitMessageView[] = [];

export function ChatInput({
  mode,
  conversationId,
  member,
  profile,
  threadParentId = null,
}: ChatInputProps) {
  const RATE_WINDOW_MS = 10_000;
  const RATE_LIMIT_COUNT = 8;
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const conversationKey = getConversationKey(mode, conversationId);
  const cachedMessages = useOrbitNavStore((state) =>
    conversationKey
      ? state.messageCache[conversationKey] ?? EMPTY_CACHED_MESSAGES
      : EMPTY_CACHED_MESSAGES,
  );
  const upsertMessage = useOrbitNavStore((state) => state.upsertMessage);
  const replaceMessage = useOrbitNavStore((state) => state.replaceMessage);
  const removeMessage = useOrbitNavStore((state) => state.removeMessage);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const sendTimestampsRef = useRef<number[]>([]);

  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);

  useEffect(() => {
    if (!attachment) {
      setAttachmentPreview(null);
      return;
    }

    if (!isImageAttachment(attachment.name)) {
      setAttachmentPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(attachment);
    setAttachmentPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [attachment]);

  async function uploadAttachment(file: File) {
    if (!isSupabaseReady()) {
      throw new Error("Attachments require cloud storage configuration.");
    }

    if (!conversationId || !profile) {
      throw new Error("Missing conversation context.");
    }

    if (file.type.startsWith("image/")) {
      const moderation = moderateOrbitImageFilename(file.name);
      if (!moderation.safe) {
        throw new Error(moderation.reason ?? "Image blocked by moderation.");
      }
    }

    const extension = file.name.split(".").pop() ?? "file";
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const cleanBaseName = baseName.replace(/[^\w.-]/g, "_").slice(0, 40);
    const path = `${mode}/${conversationId}/${profile.id}/${Date.now()}-${cleanBaseName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("message-attachments")
      .upload(path, file, {
        upsert: false,
        cacheControl: "3600",
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from("message-attachments").getPublicUrl(path);
    return data.publicUrl;
  }

  function consumeClientRateLimit() {
    const now = Date.now();
    sendTimestampsRef.current = sendTimestampsRef.current.filter(
      (timestamp) => now - timestamp < RATE_WINDOW_MS,
    );
    if (sendTimestampsRef.current.length >= RATE_LIMIT_COUNT) {
      setError("Rate limit reached. Please slow down for a few seconds.");
      return false;
    }
    sendTimestampsRef.current.push(now);
    return true;
  }

  async function persistMessage(options: {
    contentToSend: string;
    resolvedFileUrl: string | null;
    optimisticFileUrl?: string | null;
    attachmentMeta: OrbitAttachmentMeta | null;
  }) {
    if (!conversationId || !profile || !conversationKey) {
      throw new Error("Missing conversation context.");
    }

    const messageText = options.contentToSend.trim();
    if (!messageText && !options.resolvedFileUrl) {
      throw new Error("Message content is required.");
    }

    if (messageText) {
      const firstUrl = extractOrbitUrls(messageText)[0] ?? null;
      if (firstUrl) {
        primeOrbitLinkPreview(firstUrl);
      }
    }

    if (!isSupabaseReady()) {
      const now = new Date().toISOString();
      const localMessage: OrbitMessageView = {
        id: `local-${crypto.randomUUID()}`,
        content: messageText || null,
        file_url: options.optimisticFileUrl ?? options.resolvedFileUrl,
        member_id: mode === "channel" ? member?.id ?? null : null,
        channel_id: mode === "channel" ? conversationId : null,
        profile_id: mode === "dm" ? profile.id : profile.id,
        thread_id: mode === "dm" ? conversationId : null,
        thread_parent_id: mode === "channel" ? threadParentId : null,
        created_at: now,
        updated_at: now,
        optimistic: false,
        moderation: messageText
          ? (() => {
              const signal = scoreOrbitToxicity(messageText);
              return signal.flagged
                ? { score: signal.score, reason: signal.reason }
                : null;
            })()
          : null,
        attachment: options.attachmentMeta,
        author: {
          member: mode === "channel" ? member : null,
          profile,
        },
      };
      upsertMessage(conversationKey, localMessage);

      if (mode === "dm") {
        const state = useOrbitNavStore.getState();
        const currentConversation = state.dmConversations.find(
          (conversation) => conversation.thread.id === conversationId,
        );
        if (currentConversation) {
          const lastMessage: OrbitDmMessage = {
            id: localMessage.id,
            thread_id: conversationId,
            profile_id: profile.id,
            content: localMessage.content,
            file_url: localMessage.file_url,
            created_at: now,
            updated_at: now,
          };
          state.upsertDmConversation({
            ...currentConversation,
            thread: {
              ...currentConversation.thread,
              updated_at: now,
            },
            lastMessage,
          });
        }
      }
      return;
    }

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticMessage: OrbitMessageView = {
      id: tempId,
      content: messageText || null,
      file_url: options.optimisticFileUrl ?? options.resolvedFileUrl,
      member_id: mode === "channel" ? member?.id ?? null : null,
      channel_id: mode === "channel" ? conversationId : null,
      profile_id: mode === "dm" ? profile.id : null,
      thread_id: mode === "dm" ? conversationId : null,
      thread_parent_id: mode === "channel" ? threadParentId : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      optimistic: true,
      moderation: messageText
        ? (() => {
            const signal = scoreOrbitToxicity(messageText);
            return signal.flagged
              ? { score: signal.score, reason: signal.reason }
              : null;
          })()
        : null,
      attachment: options.attachmentMeta,
      author: {
        member: mode === "channel" ? member : null,
        profile,
      },
    };
    upsertMessage(conversationKey, optimisticMessage);

    let insertError: string | null = null;
    let insertedRow: Record<string, unknown> | null = null;

    if (mode === "channel") {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          content: messageText || null,
          file_url: options.resolvedFileUrl,
          member_id: member?.id ?? null,
          channel_id: conversationId,
          thread_parent_id: threadParentId,
        })
        .select("*")
        .single();
      insertError = error?.message ?? null;
      insertedRow = (data as Record<string, unknown> | null) ?? null;
    } else {
      const { data, error } = await supabase
        .from("dm_messages")
        .insert({
          content: messageText || null,
          file_url: options.resolvedFileUrl,
          profile_id: profile.id,
          thread_id: conversationId,
        })
        .select("*")
        .single();
      insertError = error?.message ?? null;
      insertedRow = (data as Record<string, unknown> | null) ?? null;
    }

    if (insertError || !insertedRow) {
      removeMessage(conversationKey, tempId);
      throw new Error(insertError ?? "Unable to send message.");
    }

    const committedMessage: OrbitMessageView = {
      id: String(insertedRow.id),
      content: (insertedRow.content as string | null) ?? null,
      file_url: (insertedRow.file_url as string | null) ?? null,
      member_id:
        mode === "channel" ? ((insertedRow.member_id as string | null) ?? null) : null,
      channel_id:
        mode === "channel" ? ((insertedRow.channel_id as string | null) ?? null) : null,
      profile_id:
        mode === "dm" ? ((insertedRow.profile_id as string | null) ?? profile.id) : null,
      thread_id:
        mode === "dm" ? ((insertedRow.thread_id as string | null) ?? conversationId) : null,
      thread_parent_id:
        mode === "channel"
          ? ((insertedRow.thread_parent_id as string | null) ?? threadParentId)
          : null,
      created_at: String(insertedRow.created_at),
      updated_at: String(insertedRow.updated_at),
      optimistic: false,
      moderation: messageText
        ? (() => {
            const signal = scoreOrbitToxicity(messageText);
            return signal.flagged
              ? { score: signal.score, reason: signal.reason }
              : null;
          })()
        : null,
      attachment: options.attachmentMeta,
      author: {
        member: mode === "channel" ? member : null,
        profile,
      },
    };

    replaceMessage(conversationKey, tempId, committedMessage);

    if (mode === "channel" && committedMessage.moderation?.score && profile) {
      void supabase.from("message_flags").upsert(
        {
          message_id: committedMessage.id,
          flagged_by: profile.id,
          model: "orbit-sentiment-v1",
          score: committedMessage.moderation.score,
          reason: committedMessage.moderation.reason,
        },
        { onConflict: "message_id,flagged_by,model" },
      );
    }
  }

  async function sendGifMessage(gif: OrbitGifResult) {
    if (!conversationId || !profile || !conversationKey) {
      return;
    }
    if (mode === "channel" && !member) {
      return;
    }
    if (!consumeClientRateLimit()) {
      return;
    }

    setSending(true);
    setError(null);
    setNotice(null);

    try {
      await persistMessage({
        contentToSend: "",
        resolvedFileUrl: gif.url,
        optimisticFileUrl: gif.preview_url ?? gif.url,
        attachmentMeta: {
          name: `${(gif.title || "Orbit GIF").slice(0, 48)}.gif`,
          mimeType: "image/gif",
        },
      });
      setGifPickerOpen(false);
    } catch (gifError) {
      setError(gifError instanceof Error ? gifError.message : "Unable to send GIF.");
    } finally {
      setSending(false);
    }
  }

  function appendEmoji(emoji: string) {
    setContent((current) => `${current}${emoji}`);
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversationId || !profile || !conversationKey) {
      return;
    }

    if (mode === "channel" && !member) {
      return;
    }

    const trimmed = content.trim();
    if (!trimmed && !attachment) {
      return;
    }

    if (!consumeClientRateLimit()) {
      return;
    }

    setSending(true);
    setError(null);
    setNotice(null);

    let contentToSend = trimmed;
    const command = parseOrbitSlashCommand(trimmed);
    if (command) {
      if (mode !== "channel") {
        setError("Slash commands are available only in server channels.");
        setSending(false);
        return;
      }

      if (command.kind === "summarize") {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        let summaryInput: OrbitMessageView[] = cachedMessages.filter(
          (message) =>
            message.created_at >= since && !message.thread_parent_id,
        );

        if (isSupabaseReady()) {
          const { data, error: summaryFetchError } = await supabase
            .from("messages")
            .select(
              "id, content, file_url, member_id, channel_id, thread_parent_id, created_at, updated_at, member:members(id, role, profile_id, server_id, created_at, updated_at, profile:profiles(id, username, tag, full_name, avatar_url, created_at, updated_at))",
            )
            .eq("channel_id", conversationId)
            .gte("created_at", since)
            .order("created_at", { ascending: true })
            .limit(700);

          if (summaryFetchError) {
            setError(summaryFetchError.message);
            setSending(false);
            return;
          }

          const rows = (data ?? []) as unknown as Array<{
            id: string;
            content: string | null;
            file_url: string | null;
            member_id: string;
            channel_id: string;
            thread_parent_id: string | null;
            created_at: string;
            updated_at: string;
            member?: {
              profile_id: string;
              profile?: OrbitProfile | OrbitProfile[] | null;
            } | null;
          }>;

          const normalized = rows.map((row) => ({
            id: row.id,
            content: row.content,
            file_url: row.file_url,
            member_id: row.member_id,
            channel_id: row.channel_id,
            profile_id: row.member?.profile_id ?? null,
            thread_id: null,
            thread_parent_id: row.thread_parent_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            author: {
              member: null,
              profile: Array.isArray(row.member?.profile)
                ? row.member?.profile[0] ?? null
                : row.member?.profile ?? null,
            },
          })) satisfies OrbitMessageView[];

          if (normalized.length) {
            summaryInput = normalized;
          }
        }

        const summary = await requestOrbitSummary(summaryInput);
        contentToSend = `🤖 **Orbit-Bot /summarize (24h)**\n\n${summary}`;
      } else if (command.kind === "poll") {
        contentToSend = buildOrbitPollMarkdown(command.question, command.options);
      } else if (command.kind === "clear") {
        if (!isSupabaseReady()) {
          const localRows = [...cachedMessages]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, command.count);
          for (const row of localRows) {
            removeMessage(conversationKey, row.id);
          }
          setNotice(`Orbit-Bot cleared ${localRows.length} messages.`);
          setContent("");
          setAttachment(null);
          if (attachmentInputRef.current) {
            attachmentInputRef.current.value = "";
          }
          setSending(false);
          return;
        }

        const { data: latestRows, error: latestError } = await supabase
          .from("messages")
          .select("id")
          .eq("channel_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(command.count);

        if (latestError) {
          setError(latestError.message);
          setSending(false);
          return;
        }

        const ids = (latestRows ?? []).map((row) => row.id);
        if (!ids.length) {
          setNotice("Orbit-Bot: no messages to clear.");
          setContent("");
          setAttachment(null);
          setSending(false);
          return;
        }

        const { error: clearError } = await supabase
          .from("messages")
          .delete()
          .in("id", ids);

        if (clearError) {
          setError(clearError.message);
          setSending(false);
          return;
        }

        setNotice(`Orbit-Bot cleared ${ids.length} messages.`);
        setContent("");
        setAttachment(null);
        if (attachmentInputRef.current) {
          attachmentInputRef.current.value = "";
        }
        setSending(false);
        return;
      } else if (command.kind === "unknown") {
        setError(`Unknown command: /${command.name}`);
        setSending(false);
        return;
      }
    }

    setContent("");
    const currentAttachment = attachment;
    setAttachment(null);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }

    let fileUrl: string | null = null;
    try {
      if (currentAttachment) {
        fileUrl = await uploadAttachment(currentAttachment);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Attachment upload failed.",
      );
      setSending(false);
      return;
    }

    try {
      await persistMessage({
        contentToSend,
        resolvedFileUrl: fileUrl,
        optimisticFileUrl: currentAttachment
          ? attachmentPreview ?? `pending://${encodeURIComponent(currentAttachment.name)}`
          : fileUrl,
        attachmentMeta: currentAttachment
          ? {
              name: currentAttachment.name,
              mimeType: currentAttachment.type || "application/octet-stream",
            }
          : null,
      });
    } catch (persistError) {
      setError(persistError instanceof Error ? persistError.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  const isDisabled =
    !conversationId ||
    !profile ||
    (isSupabaseReady() && mode === "channel" && !member) ||
    sending;

  return (
    <form className="mt-3" onSubmit={submitMessage}>
      {attachment ? (
        <div className="mb-2 rounded-xl border border-white/10 bg-black/30 p-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="truncate text-xs text-zinc-200">{attachment.name}</p>
            <Button
              className="h-7 w-7 rounded-lg"
              disabled={sending}
              onClick={() => {
                setAttachment(null);
                if (attachmentInputRef.current) {
                  attachmentInputRef.current.value = "";
                }
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {attachmentPreview ? (
            <Image
              alt="Attachment preview"
              className="max-h-40 w-auto rounded-lg border border-white/10"
              height={360}
              src={attachmentPreview}
              unoptimized
              width={640}
            />
          ) : isPdfAttachment(attachment.name) ? (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-sm text-zinc-300">
              <FileText className="h-4 w-4 text-violet-300" />
              PDF attachment ready
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf"
          className="hidden"
          onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
          ref={attachmentInputRef}
          type="file"
        />
        <Button
          className="h-11 w-11 rounded-xl"
          disabled={isDisabled}
          onClick={() => attachmentInputRef.current?.click()}
          size="icon"
          type="button"
          variant="secondary"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Button
          className="h-11 w-11 rounded-xl"
          disabled={isDisabled}
          onClick={() => setEmojiPickerOpen(true)}
          size="icon"
          type="button"
          variant="secondary"
        >
          <Smile className="h-4 w-4" />
        </Button>
        <Button
          className="h-11 rounded-xl px-3"
          disabled={isDisabled}
          onClick={() => setGifPickerOpen(true)}
          size="sm"
          type="button"
          variant="secondary"
        >
          <ImageIcon className="h-4 w-4" />
          GIF
        </Button>

        <Input
          className="h-11 rounded-xl border-white/15 bg-black/35"
          disabled={isDisabled}
          onChange={(event) => setContent(event.target.value)}
          placeholder={
            conversationId
              ? threadParentId
                ? "Reply to thread..."
                : "Transmit a message..."
              : "Select a channel or DM to begin"
          }
          value={content}
        />

        <Button
          className="h-11 w-11 rounded-xl"
          disabled={isDisabled || (!content.trim() && !attachment)}
          size="icon"
          type="submit"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {notice ? <p className="mt-2 text-xs text-emerald-300">{notice}</p> : null}
      {mode === "channel" && !threadParentId ? (
        <p className="mt-1 text-[11px] text-zinc-500">
          Orbit-Bot commands: /summarize · /clear 20 · /poll Question | Option A | Option B
        </p>
      ) : null}

      <OrbitEmojiPicker
        onOpenChange={setEmojiPickerOpen}
        onSelectEmoji={appendEmoji}
        open={emojiPickerOpen}
      />
      <OrbitGifPicker
        onOpenChange={setGifPickerOpen}
        onSelectGif={sendGifMessage}
        open={gifPickerOpen}
      />
    </form>
  );
}
