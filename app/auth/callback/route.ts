import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

function resolveAppOrigin(requestUrl: string) {
  const fallbackOrigin = new URL(requestUrl).origin;
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredUrl) {
    return fallbackOrigin;
  }

  const normalized = /^https?:\/\//i.test(configuredUrl)
    ? configuredUrl
    : `https://${configuredUrl}`;
  try {
    return new URL(normalized).origin;
  } catch {
    return fallbackOrigin;
  }
}

function resolveNextPath(rawNext: string | null) {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//")) {
    return "/dashboard?local=0";
  }
  return rawNext;
}

function buildAuthErrorRedirect(origin: string, errorMessage: string) {
  const params = new URLSearchParams({ error: errorMessage });
  return NextResponse.redirect(`${origin}/auth?${params.toString()}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = resolveNextPath(url.searchParams.get("next"));
  const oauthError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const origin = resolveAppOrigin(request.url);

  if (oauthError) {
    return buildAuthErrorRedirect(origin, oauthError);
  }

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return buildAuthErrorRedirect(origin, error.message);
    }
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
