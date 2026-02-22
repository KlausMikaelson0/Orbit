import { NextResponse } from "next/server";

import { createSupabaseServerServiceClient } from "@/src/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostbackPayload {
  conversionId: string | null;
  profileId: string | null;
  points: number;
  payoutUsd: number;
  offerName: string | null;
  state: string;
  raw: Record<string, string>;
}

function toNumber(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isUuid(value: string | null) {
  if (!value) {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeState(value: string | null) {
  return (value ?? "approved").trim().toLowerCase();
}

async function readBodyParams(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = (await request.json()) as Record<string, unknown>;
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(payload)) {
        if (value === undefined || value === null) {
          continue;
        }
        params.set(key, String(value));
      }
      return params;
    } catch {
      return new URLSearchParams();
    }
  }
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return new URLSearchParams();
  }
  const text = await request.text();
  return new URLSearchParams(text);
}

function getParam(
  urlParams: URLSearchParams,
  bodyParams: URLSearchParams,
  keys: string[],
) {
  for (const key of keys) {
    const direct = urlParams.get(key);
    if (direct) {
      return direct.trim();
    }
    const fromBody = bodyParams.get(key);
    if (fromBody) {
      return fromBody.trim();
    }
  }
  return null;
}

async function parsePostbackPayload(request: Request): Promise<PostbackPayload> {
  const requestUrl = new URL(request.url);
  const urlParams = requestUrl.searchParams;
  const bodyParams = request.method === "POST" ? await readBodyParams(request) : new URLSearchParams();

  const conversionId = getParam(urlParams, bodyParams, [
    "conversion_id",
    "conversionId",
    "cid",
  ]);
  const profileId = getParam(urlParams, bodyParams, [
    "s1",
    "user_id",
    "userid",
    "uid",
  ]);
  const points =
    toNumber(
      getParam(urlParams, bodyParams, [
        "points",
        "point_value",
        "reward",
        "value",
      ]),
    ) ?? 0;
  const payoutUsd =
    toNumber(getParam(urlParams, bodyParams, ["payout", "usd_value", "usd"])) ??
    0;
  const offerName = getParam(urlParams, bodyParams, [
    "offer_name",
    "offer_title",
    "vc_title",
    "title",
  ]);
  const state = normalizeState(getParam(urlParams, bodyParams, ["state"]));

  const raw: Record<string, string> = {};
  for (const [key, value] of urlParams.entries()) {
    raw[key] = value;
  }
  for (const [key, value] of bodyParams.entries()) {
    raw[key] = value;
  }

  return {
    conversionId,
    profileId,
    points: Math.max(0, Math.round(points)),
    payoutUsd: Math.max(0, payoutUsd),
    offerName,
    state,
    raw,
  };
}

function hasValidPostbackToken(payload: PostbackPayload) {
  const requireToken = (process.env.ADGATE_REQUIRE_POSTBACK_TOKEN ?? "0") !== "0";
  const expected = process.env.ADGATE_POSTBACK_TOKEN?.trim();
  if (!expected) {
    return !requireToken;
  }
  if (!requireToken) {
    return true;
  }
  const provided = payload.raw.auth ?? payload.raw.token ?? payload.raw.postback_token;
  if (!provided) {
    return false;
  }
  return provided === expected;
}

async function handle(request: Request) {
  const payload = await parsePostbackPayload(request);
  if (!hasValidPostbackToken(payload)) {
    return new NextResponse("invalid postback token", { status: 403 });
  }

  // For non-approved states (pending/rejected), acknowledge without rewarding.
  if (payload.state !== "approved") {
    return new NextResponse("ignored", { status: 200 });
  }

  if (!payload.conversionId || !isUuid(payload.profileId) || payload.points <= 0) {
    // Acknowledge to prevent partner retries for malformed events.
    return new NextResponse("ok", { status: 200 });
  }

  try {
    const supabase = createSupabaseServerServiceClient();
    const rpcResult = await supabase.rpc("orbit_apply_offerwall_reward", {
      p_provider: "ADGATE",
      p_conversion_id: payload.conversionId,
      p_profile_id: payload.profileId,
      p_reward_points: payload.points,
      p_payout_usd_cents: Math.round(payload.payoutUsd * 100),
      p_offer_name: payload.offerName,
      p_state: payload.state,
      p_payload: payload.raw,
    });
    if (rpcResult.error) {
      return new NextResponse("retry", { status: 503 });
    }
  } catch {
    // Return non-2xx so provider retries when backend has temporary issues.
    return new NextResponse("retry", { status: 503 });
  }

  return new NextResponse("ok", { status: 200 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
