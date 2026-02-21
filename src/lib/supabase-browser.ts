"use client";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "example-anon-key";
const LOCAL_MODE_STORAGE_KEY = "orbit_force_local_mode";

function resolveForceLocalModeFlag() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const localParam = params.get("local");
    if (localParam === "1") {
      return true;
    }
    if (localParam === "0") {
      return false;
    }

    return window.localStorage.getItem(LOCAL_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
export function isSupabaseReady() {
  return hasSupabaseEnv && !resolveForceLocalModeFlag();
}

export function setForcedLocalMode(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (enabled) {
      window.localStorage.setItem(LOCAL_MODE_STORAGE_KEY, "1");
      return;
    }
    window.localStorage.removeItem(LOCAL_MODE_STORAGE_KEY);
  } catch {
    // Ignore storage persistence failures.
  }
}

let cachedClient: SupabaseClient | null = null;

export function getOrbitSupabaseClient() {
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
  }

  return cachedClient;
}
