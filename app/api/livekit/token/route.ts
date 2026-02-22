import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const livekitApiKey = process.env.LIVEKIT_API_KEY;
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

  if (!livekitApiKey || !livekitApiSecret) {
    return NextResponse.json(
      { error: "LiveKit API credentials are not configured." },
      { status: 500 },
    );
  }

  const requestUrl = new URL(request.url);
  const room = requestUrl.searchParams.get("room");
  const requestedIdentity = requestUrl.searchParams.get("identity")?.trim() ?? null;
  const requestedName = requestUrl.searchParams.get("name")?.trim() ?? null;

  if (!room) {
    return NextResponse.json(
      { error: "Missing room." },
      { status: 400 },
    );
  }

  if (room.length > 180) {
    return NextResponse.json(
      { error: "Invalid room format." },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUserId = authData.user?.id ?? null;
  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Trust authenticated user identity from Supabase to avoid
  // client-side state drift blocking the call join flow.
  const identity = authUserId;
  const name = requestedName || requestedIdentity || identity || "Orbit User";

  const token = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity,
    name,
    ttl: "2h",
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return NextResponse.json({
    token: await token.toJwt(),
  });
}
