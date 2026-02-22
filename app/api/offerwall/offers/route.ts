import { NextResponse } from "next/server";

import { getOrbitRequestIp } from "@/src/lib/orbit-developer-api";
import {
  getOrbitFallbackOfferwallOffers,
  toOfferwallStarbitsFromUsd,
  type OrbitOfferwallCategory,
  type OrbitOfferwallOffer,
} from "@/src/lib/orbit-offerwall";
import { checkOrbitRateLimit } from "@/src/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADGATE_OFFERS_ENDPOINT = "https://api.adgatemedia.com/v1/user-based-api/offers";
const BITLABS_CLIENT_OFFERS_ENDPOINT = "https://api.bitlabs.ai/v2/client/offers";

interface AdGateConfig {
  affiliateId: string;
  apiKey: string;
  wallCode: string;
  starbitsPerUsd: number;
}

interface BitLabsConfig {
  appToken: string;
  starbitsPerUsd: number;
}

function getAdGateConfig(): AdGateConfig | null {
  const affiliateId = process.env.ADGATE_AFF_ID?.trim() ?? "";
  const apiKey = process.env.ADGATE_API_KEY?.trim() ?? "";
  const wallCode = process.env.ADGATE_WALL_CODE?.trim() ?? "";
  if (!affiliateId || !apiKey || !wallCode) {
    return null;
  }

  const starbitsPerUsd =
    Number.parseFloat(process.env.OFFERWALL_STARBITS_PER_USD ?? "700") || 700;
  return { affiliateId, apiKey, wallCode, starbitsPerUsd };
}

function getBitLabsConfig(): BitLabsConfig | null {
  const appToken = process.env.BITLABS_APP_TOKEN?.trim() ?? "";
  if (!appToken) {
    return null;
  }
  const starbitsPerUsd =
    Number.parseFloat(process.env.OFFERWALL_STARBITS_PER_USD ?? "700") || 700;
  return { appToken, starbitsPerUsd };
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pickString(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = toStringValue(row[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function pickNumber(
  row: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = toNumber(row[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function toCategory(value: string | null): OrbitOfferwallCategory {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("survey")) {
    return "SURVEY";
  }
  if (normalized.includes("watch") || normalized.includes("video")) {
    return "WATCH";
  }
  if (normalized.includes("install")) {
    return "INSTALL";
  }
  return "PLAY";
}

function normalizeUrl(value: string | null) {
  if (!value) {
    return null;
  }
  if (!/^https?:\/\//i.test(value)) {
    return null;
  }
  return value;
}

function collectPotentialOfferRows(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const root = payload as Record<string, unknown>;

  const directArrays = [
    root.offers,
    root.data,
    root.results,
    (root.data as Record<string, unknown> | undefined)?.offers,
    (root.result as Record<string, unknown> | undefined)?.offers,
  ];

  for (const candidate of directArrays) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    const rows = candidate.filter(
      (row): row is Record<string, unknown> => Boolean(row && typeof row === "object"),
    );
    if (rows.length) {
      return rows;
    }
  }
  return [];
}

function normalizeAdGateOffers(
  payload: unknown,
  config: AdGateConfig,
): OrbitOfferwallOffer[] {
  const rows = collectPotentialOfferRows(payload);
  if (!rows.length) {
    return [];
  }

  const offers: OrbitOfferwallOffer[] = [];
  for (const row of rows) {
    const title = pickString(row, [
      "title",
      "name",
      "offer_name",
      "vc_title",
      "offerTitle",
    ]);
    const offerUrl = normalizeUrl(
      pickString(row, [
        "click_url",
        "tracking_url",
        "offer_url",
        "url",
        "link",
        "go_url",
      ]),
    );
    if (!title || !offerUrl) {
      continue;
    }

    const description =
      pickString(row, ["description", "instructions", "details", "subtitle"]) ??
      "Complete the required partner steps to unlock your reward.";
    const payoutUsd =
      pickNumber(row, ["payout", "usd", "usd_value", "payout_usd"]) ?? 0;
    const explicitPoints =
      pickNumber(row, ["points", "point_value", "reward", "reward_points"]) ?? 0;
    const rewardStarbits =
      explicitPoints > 0
        ? Math.max(1, Math.round(explicitPoints))
        : toOfferwallStarbitsFromUsd(payoutUsd, config.starbitsPerUsd);
    if (rewardStarbits <= 0) {
      continue;
    }

    const offerId =
      pickString(row, ["offer_id", "id", "conversion_id"]) ??
      `adgate-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const thumbnailUrl = normalizeUrl(
      pickString(row, ["image_url", "icon", "image", "thumbnail", "banner"]),
    );
    const category = toCategory(
      pickString(row, ["category", "event_type", "offer_type", "type"]),
    );

    offers.push({
      id: offerId,
      provider: "ADGATE",
      title,
      description,
      category,
      rewardStarbits,
      payoutUsdCents: Math.max(0, Math.round(payoutUsd * 100)),
      offerUrl,
      thumbnailUrl,
      ctaLabel: `Play and earn ${rewardStarbits.toLocaleString()}`,
      featured: rewardStarbits >= 650,
    });
  }

  const deduped = new Map<string, OrbitOfferwallOffer>();
  for (const offer of offers) {
    const key = `${offer.title.toLowerCase()}|${offer.offerUrl}`;
    if (!deduped.has(key)) {
      deduped.set(key, offer);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) => b.rewardStarbits - a.rewardStarbits,
  );
}

function normalizeBitLabsOffers(
  payload: unknown,
  config: BitLabsConfig,
): OrbitOfferwallOffer[] {
  const rows = collectPotentialOfferRows(payload);
  if (!rows.length) {
    return [];
  }

  const offers: OrbitOfferwallOffer[] = [];
  for (const row of rows) {
    const title = pickString(row, [
      "anchor",
      "title",
      "name",
      "offer_name",
      "offerName",
    ]);
    const offerUrl = normalizeUrl(
      pickString(row, ["click_url", "tracking_url", "url", "link"]),
    );
    if (!title || !offerUrl) {
      continue;
    }

    const description =
      pickString(row, ["description", "requirements", "instructions", "subtitle"]) ??
      "Complete the listed partner tasks to unlock your reward.";
    const payoutUsd =
      pickNumber(row, ["raw", "payout", "usd", "payout_usd", "value_usd"]) ?? 0;
    const explicitPoints =
      pickNumber(row, ["val", "value", "points", "reward", "reward_points"]) ?? 0;
    const rewardStarbits =
      explicitPoints > 0
        ? Math.max(1, Math.round(explicitPoints))
        : toOfferwallStarbitsFromUsd(payoutUsd, config.starbitsPerUsd);
    if (rewardStarbits <= 0) {
      continue;
    }

    const offerId =
      pickString(row, ["id", "offer_id", "offerId"]) ??
      `bitlabs-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const thumbnailUrl = normalizeUrl(
      pickString(row, ["icon_url", "image_url", "thumbnail", "icon"]),
    );
    const category = toCategory(
      pickString(row, ["category", "type", "offer_type", "task_type"]),
    );

    offers.push({
      id: offerId,
      provider: "BITLABS",
      title,
      description,
      category,
      rewardStarbits,
      payoutUsdCents: Math.max(0, Math.round(payoutUsd * 100)),
      offerUrl,
      thumbnailUrl,
      ctaLabel: `Play and earn ${rewardStarbits.toLocaleString()}`,
      featured: rewardStarbits >= 650,
    });
  }

  const deduped = new Map<string, OrbitOfferwallOffer>();
  for (const offer of offers) {
    const key = `${offer.title.toLowerCase()}|${offer.offerUrl}`;
    if (!deduped.has(key)) {
      deduped.set(key, offer);
    }
  }
  return Array.from(deduped.values()).sort(
    (a, b) => b.rewardStarbits - a.rewardStarbits,
  );
}

function buildBitLabsLaunchOffer(profileId: string, config: BitLabsConfig): OrbitOfferwallOffer {
  const launchUrl = new URL("https://web.bitlabs.ai/");
  launchUrl.searchParams.set("uid", profileId);
  launchUrl.searchParams.set("token", config.appToken);
  const rewardStarbits = Number.parseInt(process.env.BITLABS_DEFAULT_REWARD_STARBITS ?? "700", 10) || 700;
  return {
    id: "bitlabs-live-offerwall",
    provider: "BITLABS",
    title: "BitLabs Live Offerwall",
    description: "Open live partner games, surveys, and install campaigns with real payouts.",
    category: "PLAY",
    rewardStarbits,
    payoutUsdCents: Math.round((rewardStarbits / Math.max(1, config.starbitsPerUsd)) * 100),
    offerUrl: launchUrl.toString(),
    thumbnailUrl: null,
    ctaLabel: `Play and earn ${rewardStarbits.toLocaleString()}+`,
    featured: true,
  };
}

export async function GET(request: Request) {
  const ip = getOrbitRequestIp(request);
  const rate = checkOrbitRateLimit({
    key: `orbit-offerwall:${ip}`,
    limit: 40,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        offers: [],
        source: "RATE_LIMITED",
        live: false,
        error: "Rate limit exceeded.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  const fallbackOffers = getOrbitFallbackOfferwallOffers();
  const requestUrl = new URL(request.url);
  const profileId =
    requestUrl.searchParams.get("profileId")?.trim() || `guest-${ip}`;
  const country = request.headers.get("x-vercel-ip-country") ?? "US";
  const userAgent = request.headers.get("user-agent") ?? "Orbit/1.0";
  const providerWarnings: string[] = [];

  const bitlabsConfig = getBitLabsConfig();
  if (bitlabsConfig) {
    const endpoint = new URL(BITLABS_CLIENT_OFFERS_ENDPOINT);
    endpoint.searchParams.set("uid", profileId);
    endpoint.searchParams.set("token", bitlabsConfig.appToken);
    endpoint.searchParams.set("client_ip", ip);
    endpoint.searchParams.set("client_user_agent", userAgent.slice(0, 220));
    endpoint.searchParams.set("country", country);
    try {
      const response = await fetch(endpoint.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (response.ok) {
        const payload = (await response.json()) as unknown;
        const liveOffers = normalizeBitLabsOffers(payload, bitlabsConfig);
        if (liveOffers.length) {
          return NextResponse.json({
            offers: liveOffers,
            source: "BITLABS",
            live: true,
          });
        }
      } else {
        providerWarnings.push(`BitLabs request failed (${response.status}).`);
      }
    } catch {
      providerWarnings.push("BitLabs request failed.");
    }

    // BitLabs fallback still opens a real offerwall with live campaigns.
    return NextResponse.json({
      offers: [buildBitLabsLaunchOffer(profileId, bitlabsConfig)],
      source: "BITLABS",
      live: true,
      warning: providerWarnings.join(" "),
    });
  }

  const adgateConfig = getAdGateConfig();
  if (!adgateConfig) {
    return NextResponse.json({
      offers: fallbackOffers,
      source: "FALLBACK",
      live: false,
      warning:
        "No live offerwall credentials found. Set BITLABS_APP_TOKEN or ADGATE_AFF_ID/ADGATE_API_KEY/ADGATE_WALL_CODE.",
    });
  }

  const endpoint = new URL(ADGATE_OFFERS_ENDPOINT);
  endpoint.searchParams.set("aff_id", adgateConfig.affiliateId);
  endpoint.searchParams.set("api_key", adgateConfig.apiKey);
  endpoint.searchParams.set("wall_code", adgateConfig.wallCode);
  endpoint.searchParams.set("user_id", profileId);
  endpoint.searchParams.set("country", country);
  endpoint.searchParams.set("s1", profileId);
  endpoint.searchParams.set("ip", ip);
  endpoint.searchParams.set("user_agent", userAgent.slice(0, 220));

  try {
    const response = await fetch(endpoint.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json(
        {
          offers: fallbackOffers,
          source: "FALLBACK",
          live: false,
          error: `AdGate request failed (${response.status}).`,
        },
        { status: 200 },
      );
    }

    const payload = (await response.json()) as unknown;
    const liveOffers = normalizeAdGateOffers(payload, adgateConfig);
    if (!liveOffers.length) {
      return NextResponse.json(
        {
          offers: fallbackOffers,
          source: "FALLBACK",
          live: false,
          warning: "AdGate returned no eligible offers for this user/location.",
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      offers: liveOffers,
      source: "ADGATE",
      live: true,
    });
  } catch {
    return NextResponse.json(
      {
        offers: fallbackOffers,
        source: "FALLBACK",
        live: false,
        error: "Unable to fetch live offers.",
      },
      { status: 200 },
    );
  }
}
