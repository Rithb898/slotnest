import { processOAuthCallback } from "corsair/oauth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { corsair } from "@/server/corsair";

const REDIRECT_URI = `${env.APP_URL}/api/corsair/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    const res = new NextResponse("Missing code or state.", { status: 400 });
    res.cookies.delete("corsair_oauth_state");
    return res;
  }

  const storedState = request.cookies.get("corsair_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    const res = new NextResponse("Invalid state.", { status: 400 });
    res.cookies.delete("corsair_oauth_state");
    return res;
  }

  try {
    const result = await processOAuthCallback(corsair, {
      code,
      state,
      redirectUri: REDIRECT_URI,
    });
    const res = NextResponse.redirect(
      new URL(`/connections?connected=${result.plugin}`, request.url),
    );
    res.cookies.delete("corsair_oauth_state");
    return res;
  } catch (error) {
    console.error("[corsair] OAuth callback failed", error);
    const res = NextResponse.redirect(
      new URL("/connections?error=oauth_failed", request.url),
    );
    res.cookies.delete("corsair_oauth_state");
    return res;
  }
}
