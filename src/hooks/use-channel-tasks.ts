"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";
import { useOrbitNavStore } from "@/src/stores/use-orbit-nav-store";
import type { OrbitChannelTask, OrbitProfile, OrbitTaskStatus } from "@/src/types/orbit";

interface ChannelTaskResult {
  error?: string;
}

interface TaskRow {
  id: string;
  channel_id: string;
  creator_profile_id: string;
  content: string;
  status: OrbitTaskStatus;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  creator: OrbitProfile | OrbitProfile[] | null;
}

function normalizeProfile(
  row: OrbitProfile | OrbitProfile[] | null | undefined,
): OrbitProfile | null {
  if (!row) {
    return null;
  }
  return Array.isArray(row) ? row[0] ?? null : row;
}

function normalizeTask(row: TaskRow): OrbitChannelTask {
  return {
    id: row.id,
    channel_id: row.channel_id,
    creator_profile_id: row.creator_profile_id,
    content: row.content,
    status: row.status,
    due_at: row.due_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    creator: normalizeProfile(row.creator),
  };
}

const LOCAL_TASK_STORE = new Map<string, OrbitChannelTask[]>();

export function useChannelTasks(channelId: string | null, profileId: string | null) {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const profile = useOrbitNavStore((state) => state.profile);
  const [tasks, setTasks] = useState<OrbitChannelTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!channelId) {
      setTasks([]);
      return;
    }

    if (!isSupabaseReady()) {
      setLoadingTasks(true);
      setTaskError(null);
      setTasks(LOCAL_TASK_STORE.get(channelId) ?? []);
      setLoadingTasks(false);
      return;
    }

    setLoadingTasks(true);
    const { data, error } = await supabase
      .from("channel_tasks")
      .select(
        "id, channel_id, creator_profile_id, content, status, due_at, completed_at, created_at, updated_at, creator:profiles(id, username, tag, full_name, avatar_url, created_at, updated_at)",
      )
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });

    if (error) {
      setTaskError(error.message);
      setLoadingTasks(false);
      return;
    }

    const rows = (data ?? []) as unknown as TaskRow[];
    setTasks(rows.map(normalizeTask));
    setLoadingTasks(false);
  }, [channelId, supabase]);

  useEffect(() => {
    setTaskError(null);
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!isSupabaseReady()) {
      return;
    }
    if (!channelId) {
      return;
    }

    const realtimeChannel = supabase
      .channel(`orbit-tasks-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_tasks",
          filter: `channel_id=eq.${channelId}`,
        },
        () => void fetchTasks(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(realtimeChannel);
    };
  }, [channelId, fetchTasks, supabase]);

  const addTask = useCallback(
    async (content: string): Promise<ChannelTaskResult> => {
      if (!channelId || !profileId) {
        return { error: "Channel context is missing." };
      }
      const trimmed = content.trim();
      if (!trimmed) {
        return { error: "Task content is required." };
      }

      if (!isSupabaseReady()) {
        const now = new Date().toISOString();
        const task: OrbitChannelTask = {
          id: `local-task-${crypto.randomUUID().slice(0, 8)}`,
          channel_id: channelId,
          creator_profile_id: profileId,
          content: trimmed,
          status: "TODO",
          due_at: null,
          completed_at: null,
          created_at: now,
          updated_at: now,
          creator: profile,
        };
        const nextTasks = [...(LOCAL_TASK_STORE.get(channelId) ?? []), task].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        );
        LOCAL_TASK_STORE.set(channelId, nextTasks);
        setTasks(nextTasks);
        return {};
      }

      const tempId = `temp-task-${crypto.randomUUID()}`;
      const optimistic: OrbitChannelTask = {
        id: tempId,
        channel_id: channelId,
        creator_profile_id: profileId,
        content: trimmed,
        status: "TODO",
        due_at: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        creator: profile,
      };

      setTasks((current) => [...current, optimistic]);

      const { data, error } = await supabase
        .from("channel_tasks")
        .insert({
          channel_id: channelId,
          creator_profile_id: profileId,
          content: trimmed,
          status: "TODO" as OrbitTaskStatus,
        })
        .select(
          "id, channel_id, creator_profile_id, content, status, due_at, completed_at, created_at, updated_at, creator:profiles(id, username, tag, full_name, avatar_url, created_at, updated_at)",
        )
        .single();

      if (error || !data) {
        setTasks((current) => current.filter((item) => item.id !== tempId));
        return { error: error?.message ?? "Unable to add task." };
      }

      const hydrated = normalizeTask(data as unknown as TaskRow);
      setTasks((current) =>
        current
          .map((item) => (item.id === tempId ? hydrated : item))
          .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      );
      return {};
    },
    [channelId, profile, profileId, supabase],
  );

  const setTaskStatus = useCallback(
    async (taskId: string, status: OrbitTaskStatus): Promise<ChannelTaskResult> => {
      const completedAt = status === "DONE" ? new Date().toISOString() : null;
      setTaskError(null);

      if (!isSupabaseReady()) {
        if (!channelId) {
          return { error: "Channel context is missing." };
        }
        const nextTasks = (LOCAL_TASK_STORE.get(channelId) ?? []).map((item) =>
          item.id === taskId
            ? {
                ...item,
                status,
                completed_at: completedAt,
                updated_at: new Date().toISOString(),
              }
            : item,
        );
        LOCAL_TASK_STORE.set(channelId, nextTasks);
        setTasks(nextTasks);
        return {};
      }

      const previous = tasks;
      setTasks((current) =>
        current.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status,
                completed_at: completedAt,
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      );

      const { error } = await supabase
        .from("channel_tasks")
        .update({
          status,
          completed_at: completedAt,
        })
        .eq("id", taskId);

      if (error) {
        setTasks(previous);
        return { error: error.message };
      }
      return {};
    },
    [channelId, supabase, tasks],
  );

  const removeTask = useCallback(
    async (taskId: string): Promise<ChannelTaskResult> => {
      if (!isSupabaseReady()) {
        if (!channelId) {
          return { error: "Channel context is missing." };
        }
        const nextTasks = (LOCAL_TASK_STORE.get(channelId) ?? []).filter(
          (item) => item.id !== taskId,
        );
        LOCAL_TASK_STORE.set(channelId, nextTasks);
        setTasks(nextTasks);
        return {};
      }

      const previous = tasks;
      setTasks((current) => current.filter((item) => item.id !== taskId));
      const { error } = await supabase.from("channel_tasks").delete().eq("id", taskId);
      if (error) {
        setTasks(previous);
        return { error: error.message };
      }
      return {};
    },
    [channelId, supabase, tasks],
  );

  return {
    tasks,
    loadingTasks,
    taskError,
    addTask,
    setTaskStatus,
    removeTask,
  };
}
