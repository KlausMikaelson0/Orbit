import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

import { createSupabaseServerServiceClient } from "@/src/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BitLabsPayload {
  profileId: string | null;
  transactionId: string | null;
  rewardValue: number;
  payoutUsd: number;
  state: string;
  offerName: string | null;
  receivedHash: string | null;
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
  return (value ?? "completed").trim().toLowerCase();
}

async function readBodyParams(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const json = (await request.json()) as Record<string, unknown>;
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(json)) {
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
    const fromUrl = urlParams.get(key);
    if (fromUrl) {
      return fromUrl.trim();
    }
    const fromBody = bodyParams.get(key);
    if (fromBody) {
      return fromBody.trim();
    }
  }
  return null;
}

async function parseBitLabsPayload(request: Request): Promise<BitLabsPayload> {
  const requestUrl = new URL(request.url);
  const urlParams = requestUrl.searchParams;
  const bodyParams =
    request.method === "POST" ? await readBodyParams(request) : new URLSearchParams();

  const profileId = getParam(urlParams, bodyParams, ["uid", "user_id", "s1"]);
  const transactionId = getParam(urlParams, bodyParams, ["tx", "transaction_id", "transactionId"]);
  const rewardValue =
    toNumber(getParam(urlParams, bodyParams, ["val", "value", "points", "reward"])) ?? 0;
  const payoutUsd =
    toNumber(getParam(urlParams, bodyParams, ["raw", "usd", "payout"])) ?? 0;
  const state = normalizeState(
    getParam(urlParams, bodyParams, [
      "state",
      "type",
      "offer_task_state",
      "offerState",
    ]),
  );
  const offerName = getParam(urlParams, bodyParams, [
    "offer_name",
    "offer",
    "name",
    "offer_title",
  ]);
  const receivedHash = getParam(urlParams, bodyParams, ["hash"]);

  const raw: Record<string, string> = {};
  for (const [key, value] of urlParams.entries()) {
    raw[key] = value;
  }
  for (const [key, value] of bodyParams.entries()) {
    raw[key] = value;
  }

  return {
    profileId,
    transactionId,
    rewardValue: Math.max(0, Math.round(rewardValue)),
    payoutUsd: Math.max(0, payoutUsd),
    state,
    offerName,
    receivedHash,
    raw,
  };
}

function extractSignedSegment(rawUrl: string) {
  const ampHashIndex = rawUrl.indexOf("&hash=");
  if (ampHashIndex !== -1) {
    return rawUrl.slice(0, ampHashIndex);
  }

  const questionHashIndex = rawUrl.indexOf("?hash=");
  if (questionHashIndex === -1) {
    return rawUrl;
  }

  const after = rawUrl.slice(questionHashIndex + 1);
  const nextAmp = after.indexOf("&");
  if (nextAmp === -1) {
    return rawUrl.slice(0, questionHashIndex);
  }
  return `${rawUrl.slice(0, questionHashIndex)}?${after.slice(nextAmp + 1)}`;
}

function hasValidBitLabsHash(request: Request, payload: BitLabsPayload) {
  const requireHash = (process.env.BITLABS_REQUIRE_HASH ?? "1") !== "0";
  if (!requireHash) {
    return true;
  }

  const appSecret = process.env.BITLABS_APP_SECRET?.trim();
  if (!appSecret) {
    return false;
  }
  if (!payload.receivedHash) {
    return false;
  }

  const signedSegment = extractSignedSegment(request.url);
  const digest = createHmac("sha1", appSecret)
    .update(signedSegment)
    .digest("hex");
  return digest.toLowerCase() === payload.receivedHash.toLowerCase();
}

function isApprovedState(state: string) {
  const normalized = state.toLowerCase();
  if (
    normalized.includes("pending") ||
    normalized.includes("reject") ||
    normalized.includes("reconcile")
  ) {
    return false;
  }
  return true;
}

async function handle(request: Request) {
  const payload = await parseBitLabsPayload(request);
  if (!hasValidBitLabsHash(request, payload)) {
    return new NextResponse("invalid hash", { status: 403 });
  }

  if (!isApprovedState(payload.state)) {
    return new NextResponse("ignored", { status: 200 });
  }

  if (!payload.transactionId || !isUuid(payload.profileId) || payload.rewardValue <= 0) {
    return new NextResponse("ok", { status: 200 });
  }

  try {
    const supabase = createSupabaseServerServiceClient();
    const rpcResult = await supabase.rpc("orbit_apply_offerwall_reward", {
      p_provider: "BITLABS",
      p_conversion_id: payload.transactionId,
      p_profile_id: payload.profileId,
      p_reward_points: payload.rewardValue,
      p_payout_usd_cents: Math.round(payload.payoutUsd * 100),
      p_offer_name: payload.offerName,
      p_state: payload.state,
      p_payload: payload.raw,
    });
    if (rpcResult.error) {
      return new NextResponse("retry", { status: 503 });
    }
  } catch {
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
