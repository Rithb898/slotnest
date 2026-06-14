import { processOAuthCallback } from "corsair/oauth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { corsair } from "@/server/corsair";

const REDIRECT_URI = `${env.APP_URL}/api/corsair/callback`;
const PLUGINS = ["gmail", "googlecalendar"] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // No code (e.g. the user declined consent — including mid-chain) or a bad
  // state: clear both cookies and land them back on Settings, not a bare 400.
  if (!code || !state) {
    const res = NextResponse.redirect(
      new URL("/settings?tab=connections&error=oauth_cancelled", request.url),
    );
    res.cookies.delete("corsair_oauth_state");
    res.cookies.delete("corsair_oauth_next");
    return res;
  }

  const storedState = request.cookies.get("corsair_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    const res = NextResponse.redirect(
      new URL("/settings?tab=connections&error=oauth_failed", request.url),
    );
    res.cookies.delete("corsair_oauth_state");
    res.cookies.delete("corsair_oauth_next");
    return res;
  }

  try {
    const result = await processOAuthCallback(corsair, {
      code,
      state,
      redirectUri: REDIRECT_URI,
    });

    // Chain (Option A): if a `next` provider is queued and isn't the one we just
    // finished, start its OAuth now — one click connects Gmail then Calendar.
    const nextPlugin = request.cookies.get("corsair_oauth_next")?.value;
    const chainNext =
      nextPlugin &&
      nextPlugin !== result.plugin &&
      PLUGINS.includes(nextPlugin as (typeof PLUGINS)[number])
        ? nextPlugin
        : null;

    const res = NextResponse.redirect(
      chainNext
        ? new URL(`/api/corsair/connect?plugin=${chainNext}`, request.url)
        : new URL(
            `/settings?tab=connections&connected=${result.plugin}`,
            request.url,
          ),
    );
    res.cookies.delete("corsair_oauth_state");
    // The next connect leg sets its own cookie (with no further `next`), so
    // clearing here keeps the chain to a single hop.
    res.cookies.delete("corsair_oauth_next");
    return res;
  } catch (error) {
    console.error("[corsair] OAuth callback failed", error);
    const res = NextResponse.redirect(
      new URL("/settings?tab=connections&error=oauth_failed", request.url),
    );
    res.cookies.delete("corsair_oauth_state");
    res.cookies.delete("corsair_oauth_next");
    return res;
  }
}
