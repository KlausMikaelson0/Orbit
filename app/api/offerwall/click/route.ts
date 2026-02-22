import { NextResponse } from "next/server";

import { createSupabaseServerServiceClient } from "@/src/lib/supabase-server";
import { getOrbitRequestIp } from "@/src/lib/orbit-developer-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidHttpUrl(value: string | null) {
  if (!value) {
    return false;
  }
  return /^https?:\/\//i.test(value.trim());
}

function isUuid(value: string | null) {
  if (!value) {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const destination = requestUrl.searchParams.get("u")?.trim() ?? "";
  if (!isValidHttpUrl(destination)) {
    return NextResponse.json({ error: "Invalid offer destination." }, { status: 400 });
  }

  const provider = (requestUrl.searchParams.get("provider")?.trim() || "UNKNOWN").slice(0, 32);
  const offerId = (requestUrl.searchParams.get("offerId")?.trim() || "unknown-offer").slice(0, 128);
  const profileIdRaw = requestUrl.searchParams.get("profileId")?.trim() ?? null;
  const profileId = isUuid(profileIdRaw) ? profileIdRaw : null;
  const country = request.headers.get("x-vercel-ip-country") ?? null;
  const userAgent = request.headers.get("user-agent") ?? null;
  const ip = getOrbitRequestIp(request);

  try {
    const supabase = createSupabaseServerServiceClient();
    const insertResult = await supabase.from("offerwall_click_events").insert({
      provider,
      offer_id: offerId,
      profile_id: profileId,
      destination_url: destination,
      ip_address: ip,
      country,
      user_agent: userAgent,
      metadata: {
        source: "orbit_offerwall_click",
      },
    });
    if (insertResult.error) {
      // If tracking storage fails, continue redirect to avoid blocking campaign flow.
      console.error("offerwall click insert failed", insertResult.error.message);
    }
  } catch {
    // Ignore tracking failures and continue redirect.
  }

  return NextResponse.redirect(destination, { status: 302 });
}
