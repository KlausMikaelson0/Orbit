import { NextResponse } from "next/server";

import { getOrbitRequestIp } from "@/src/lib/orbit-developer-api";
import {
  ORBIT_FALLBACK_TRENDING_GIFS,
  ORBIT_FALLBACK_TRENDING_STICKERS,
  dedupeOrbitMediaItems,
  filterOrbitMediaItems,
  type OrbitMediaPickerItem,
} from "@/src/lib/orbit-media-catalog";
import { checkOrbitRateLimit } from "@/src/lib/rate-limit";

export const runtime = "nodejs";

interface GiphyImageVariant {
  url?: string;
  width?: string;
  height?: string;
}

interface GiphyItem {
  id: string;
  title?: string;
  images?: {
    original?: GiphyImageVariant;
    downsized_medium?: GiphyImageVariant;
    fixed_width_small?: GiphyImageVariant;
  };
}

type OrbitApiMediaKind = "gif" | "sticker";
type OrbitApiMode = "trending" | "search";

function getGiphyApiKey() {
  return process.env.GIPHY_API_KEY ?? process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? null;
}

function normalizeSearchQuery(value: string | null) {
  return (value ?? "").trim().slice(0, 80);
}

function parseMediaKind(value: string | null): OrbitApiMediaKind {
  return value?.toLowerCase() === "sticker" ? "sticker" : "gif";
}

function parseMode(value: string | null, query: string): OrbitApiMode {
  if (value?.toLowerCase() === "search") {
    return "search";
  }
  if (value?.toLowerCase() === "trending") {
    return "trending";
  }
  return query ? "search" : "trending";
}

function mapGiphyEndpoint(kind: OrbitApiMediaKind, mode: OrbitApiMode) {
  if (kind === "sticker") {
    return mode === "search" ? "stickers/search" : "stickers/trending";
  }
  return mode === "search" ? "gifs/search" : "gifs/trending";
}

function getFallbackItems(
  kind: OrbitApiMediaKind,
  mode: OrbitApiMode,
  query: string,
  limit: number,
) {
  const source = kind === "sticker" ? ORBIT_FALLBACK_TRENDING_STICKERS : ORBIT_FALLBACK_TRENDING_GIFS;
  const filtered = mode === "search" ? filterOrbitMediaItems(source, query) : source;
  return dedupeOrbitMediaItems(filtered).slice(0, limit);
}

export async function GET(request: Request) {
  const ip = getOrbitRequestIp(request);
  const rate = checkOrbitRateLimit({
    key: `orbit-giphy:${ip}`,
    limit: 40,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { items: [], error: "Rate limit exceeded." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  const apiKey = getGiphyApiKey();

  const requestUrl = new URL(request.url);
  const query = normalizeSearchQuery(requestUrl.searchParams.get("q"));
  const kind = parseMediaKind(requestUrl.searchParams.get("kind"));
  const mode = parseMode(requestUrl.searchParams.get("mode"), query);
  const limit = Math.min(
    96,
    Math.max(1, Number.parseInt(requestUrl.searchParams.get("limit") ?? "36", 10) || 36),
  );

  if (!apiKey) {
    return NextResponse.json({
      items: getFallbackItems(kind, mode, query, limit),
      fallback: true,
    });
  }

  const endpointPath = mapGiphyEndpoint(kind, mode);
  const endpoint = new URL(`https://api.giphy.com/v1/${endpointPath}`);
  endpoint.searchParams.set("api_key", apiKey);
  endpoint.searchParams.set("limit", String(limit));
  endpoint.searchParams.set("rating", "pg-13");
  endpoint.searchParams.set("bundle", "messaging_non_clips");
  if (mode === "search" && query) {
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("lang", "en");
  }

  try {
    const response = await fetch(endpoint.toString(), {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json(
        {
          items: getFallbackItems(kind, mode, query, limit),
          fallback: true,
        },
        { status: 200 },
      );
    }

    const data = (await response.json()) as { data?: GiphyItem[] };
    const items = (data.data ?? [])
      .map((item) => {
        const original = item.images?.original;
        const medium = item.images?.downsized_medium ?? item.images?.fixed_width_small;
        const url = original?.url ?? medium?.url ?? null;
        if (!url) {
          return null;
        }
        return {
          id: item.id,
          title: item.title?.trim() || "GIF",
          url,
          preview_url: medium?.url ?? url,
          width: Number.parseInt(original?.width ?? medium?.width ?? "0", 10) || null,
          height: Number.parseInt(original?.height ?? medium?.height ?? "0", 10) || null,
          mime_type: "image/gif",
          source: "GIPHY" as const,
          kind: kind === "sticker" ? "STICKER" : ("GIF" as const),
        } satisfies OrbitMediaPickerItem;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    return NextResponse.json({
      items: dedupeOrbitMediaItems(items).slice(0, limit),
      fallback: false,
    });
  } catch {
    return NextResponse.json(
      {
        items: getFallbackItems(kind, mode, query, limit),
        fallback: true,
      },
      { status: 200 },
    );
  }
}
